#!/usr/bin/env python3
"""AdOff Media Queue Worker v2 — multimodal, brand-aware, multi-model routing.

Processes adoff_autopilot.media_queue. Routes by `model` column:
  flux2   -> FLUX.2-klein  sd-server :1237 (quality default, photo/carousel)
  qwen    -> Qwen-Image    sd-server :1238 (text-in-image: banners, copy_text)
  zimage  -> Z-Image Turbo sd-server :1236 (fastest)
  auto    -> flux2 for photo/carousel, fastwan for video formats

Per format_type:
  photo    -> 1 render at platform size + logo overlay
  carousel -> N renders, brand-consistent + logo
  reel/story/video:
     model auto|fastwan -> REAL AI video via FastWan 2.2 (sd-cli vid_gen) + brand overlay
     model kenburns     -> legacy Flux frames + ffmpeg ken-burns (fallback)

Brand specs: ~/sdcpp/brands/<brand>.json + social-specs.json
Output: /opt/n8n/local-files (== /files in n8n container)
"""
import base64
import json
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

POLL = 8
OUT = Path("/opt/n8n/local-files")
CONTAINER_PREFIX = "/files"
BRANDS = Path("/home/mrxxx/sdcpp/brands")
MODELS_DIR = Path("/home/mrxxx/sdcpp/models")
SD_CLI = "/home/mrxxx/sdcpp/stable-diffusion.cpp/build/bin/sd-cli"
SCHEMA = "adoff_autopilot.media_queue"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]

SPECS = json.loads((BRANDS / "social-specs.json").read_text())

# Image model registry: model -> sd-server endpoint + sampling profile.
IMG_MODELS = {
    "flux2":  {"url": "http://127.0.0.1:1237/sdapi/v1/txt2img",
               "steps": 4,  "cfg": 1.0, "sampler": "euler"},
    "qwen":   {"url": "http://127.0.0.1:1238/sdapi/v1/txt2img",
               "steps": 20, "cfg": 2.5, "sampler": "euler"},
    "zimage": {"url": "http://127.0.0.1:1236/sdapi/v1/txt2img",
               "steps": 8,  "cfg": 1.0, "sampler": "euler"},
}
DEFAULT_IMG_MODEL = "flux2"

# FastWan 2.2 TI2V-5B real video generation (sd-cli vid_gen, on-demand).
# Use tiny TAE (taew2_2): full wan2.2_vae needs a ~21GB single Vulkan compute
# buffer that exceeds the RADV device allocation limit on Strix Halo gfx1151.
WAN_DIFFUSION = MODELS_DIR / "FastWan2.2-TI2V-5B-q8_0.gguf"
WAN_TAE = MODELS_DIR / "taew2_2.safetensors"
WAN_T5 = MODELS_DIR / "umt5-xxl-encoder-Q8_0.gguf"
WAN_STEPS = 3
WAN_CFG = 1.0
WAN_FLOW_SHIFT = 3.0
WAN_FPS = 16  # FastWan TI2V-5B native frame rate


def q(sql):
    r = subprocess.run(PG + ["-tAqc", sql], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def qx(sql):
    r = subprocess.run(PG, input=sql, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def esc(s):
    return str(s).replace("'", "''")


def load_brand(name):
    f = BRANDS / f"{name}.json"
    if not f.exists():
        f = BRANDS / "adoff.json"
    return json.loads(f.read_text())


def dims(platform, fmt):
    p = SPECS["platforms"].get(platform, SPECS["platforms"]["twitter"])
    keymap = {
        "photo": ["image_post", "image_square", "image_portrait"],
        "carousel": ["carousel", "image_square"],
        "reel": ["reel", "story", "video"],
        "story": ["story", "reel"],
        "video": ["video", "video_square"],
    }
    for k in keymap.get(fmt, ["image_post"]):
        if k in p:
            d = p[k]
            return int(d.get("w", 1080)), int(d.get("h", 1080))
    return 1080, 1080


BASE_LONG = 768  # image long-edge px for fast gen + upscale


def resolve_img_model(model, fmt):
    """Map queue model -> IMG_MODELS key. 'auto' -> default unless text-heavy."""
    m = (model or "auto").lower()
    if m in IMG_MODELS:
        return m
    return DEFAULT_IMG_MODEL


def _raw_render(prompt, w, h, mkey):
    cfg = IMG_MODELS[mkey]
    payload = json.dumps({
        "prompt": prompt, "steps": cfg["steps"], "cfg_scale": cfg["cfg"],
        "width": w, "height": h, "sampler_name": cfg["sampler"],
        "seed": -1, "batch_size": 1,
    }).encode()
    req = urllib.request.Request(cfg["url"], data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        data = json.loads(r.read())
    return base64.b64decode(data["images"][0])


def render_upscaled(prompt, target_w, target_h, dest: Path, mkey):
    """Generate at low res (fast), upscale + center-crop to exact target."""
    longest = max(target_w, target_h)
    scale = BASE_LONG / longest
    bw = max(256, round(target_w * scale / 16) * 16)
    bh = max(256, round(target_h * scale / 16) * 16)
    png = _raw_render(prompt, bw, bh, mkey)
    tmp = dest.with_suffix(".raw.png")
    tmp.write_bytes(png)
    subprocess.run([
        "convert", str(tmp),
        "-resize", f"{target_w}x{target_h}^",
        "-gravity", "center", "-extent", f"{target_w}x{target_h}",
        "-unsharp", "0x0.75+0.75+0.008",
        "-quality", "92", str(dest)
    ], check=True, capture_output=True)
    tmp.unlink(missing_ok=True)
    return dest.stat().st_size


_BANNED_WORDS = ("stealth", "hacker", "spy", "anonymous", "person", "people",
                 "user", "someone", "hooded", "figure", "agent", "ninja")


def sanitize_topic(topic):
    t = (topic or "").lower()
    for w in _BANNED_WORDS:
        t = t.replace(w, "")
    return " ".join(t.split()).strip() or "privacy shield emblem"


def brand_style(brand):
    v = brand.get("visual", {})
    colors = v.get("colors", {})
    accent = colors.get("shield_purple", "#7c5cfc")
    bg = colors.get("deep_space", "#0a0a1a")
    img_style = v.get("imagery_style", "minimal dark geometric")
    return (f", flat vector emblem icon, abstract geometric symbol only, "
            f"{img_style}, deep space black background ({bg}), "
            f"glowing purple violet accents ({accent}), premium tech branding, "
            f"centered shield motif, cinematic volumetric glow, "
            f"NO people, NO human, NO face, NO person, NO character, "
            f"NO hands, NO body, NO portrait, NO realistic photo, "
            f"NO text, NO words, NO letters, NO logo")


def qwen_text_style(brand, copy_text):
    """Qwen-Image excels at rendering crisp text — use for banners."""
    v = brand.get("visual", {})
    colors = v.get("colors", {})
    accent = colors.get("shield_purple", "#7c5cfc")
    bg = colors.get("deep_space", "#0a0a1a")
    return (f', premium SaaS marketing banner, large bold headline text '
            f'"{copy_text}" perfectly legible centered, '
            f"deep space black background ({bg}), glowing purple violet accents "
            f"({accent}), clean modern typography, geometric shield motif, "
            f"high contrast, crisp sharp lettering, professional tech branding")


def logo_path(brand_name):
    p = BRANDS / f"{brand_name}-logo.png"
    return str(p) if p.exists() else str(BRANDS / "adoff-logo.png")


def overlay_logo(img_path, brand_name, w, h):
    logo = logo_path(brand_name)
    lw = max(64, int(w * 0.13))
    margin = int(w * 0.04)
    subprocess.run([
        "convert", str(img_path),
        "(", logo, "-resize", f"{lw}x{lw}", ")",
        "-gravity", "SouthEast", "-geometry", f"+{margin}+{margin}",
        "-composite", str(img_path)
    ], check=True, capture_output=True)


def make_photo(job, brand, w, h):
    mkey = resolve_img_model(job["model"], "photo")
    copy = (job.get("copy_text") or "").strip()
    if mkey == "qwen" and copy:
        prompt = sanitize_topic(job["topic"]) + qwen_text_style(brand, copy[:80])
    else:
        prompt = sanitize_topic(job["topic"]) + brand_style(brand)
    fname = f"media-{job['job_id']}.png"
    fp = OUT / fname
    render_upscaled(prompt, w, h, fp, mkey)
    overlay_logo(fp, job["brand"], w, h)
    return fname, fp.stat().st_size


def make_carousel(job, brand, w, h):
    mkey = resolve_img_model(job["model"], "carousel")
    slides = max(2, min(int(job.get("slides") or 5), 10))
    base = sanitize_topic(job["topic"])
    angles = ["hero shield emblem", "data flow blocked visualization",
              "clean browsing speed concept", "privacy lock motif",
              "stealth invisibility concept", "network protection grid",
              "before-after ad clutter contrast", "minimal logo mark",
              "shield with checkmark", "abstract trust concept"]
    frames = []
    for i in range(slides):
        prompt = f"{base}, {angles[i % len(angles)]}" + brand_style(brand)
        fpath = OUT / f"media-{job['job_id']}-s{i+1}.png"
        render_upscaled(prompt, w, h, fpath, mkey)
        overlay_logo(fpath, job["brand"], w, h)
        frames.append(fpath)
    fname = f"media-{job['job_id']}-carousel.json"
    manifest = {"type": "carousel", "slides": slides,
                "files": [f"{CONTAINER_PREFIX}/{p.name}" for p in frames]}
    (OUT / fname).write_text(json.dumps(manifest))
    total = sum(p.stat().st_size for p in frames)
    return fname, total


def make_video_fastwan(job, brand, w, h):
    """REAL AI video via FastWan 2.2 TI2V-5B (sd-cli vid_gen), then brand overlay."""
    for f in (WAN_DIFFUSION, WAN_TAE, WAN_T5):
        if not f.exists():
            raise RuntimeError(f"FastWan model missing: {f.name}")
    dur = int(job.get("duration_sec") or 5)
    dur = max(2, min(dur, 8))  # FastWan practical cap
    frames = min(int(dur * WAN_FPS) | 1, 121)  # odd count, model max 121
    base = sanitize_topic(job["topic"])
    prompt = (f"{base}, cinematic motion, smooth camera, abstract geometric "
              f"privacy shield, glowing purple violet accents on deep space "
              f"black, premium tech branding, no text, no people")
    # FastWan wants width/height multiples of 32; cap long edge 832 for speed.
    longest = max(w, h)
    sc = min(1.0, 832 / longest)
    vw = max(256, round(w * sc / 32) * 32)
    vh = max(256, round(h * sc / 32) * 32)

    raw = OUT / f"media-{job['job_id']}.raw.webm"
    cmd = [
        SD_CLI, "-M", "vid_gen",
        "--diffusion-model", str(WAN_DIFFUSION),
        "--tae", str(WAN_TAE),
        "--t5xxl", str(WAN_T5),
        "--cfg-scale", str(WAN_CFG),
        "--steps", str(WAN_STEPS),
        "--sampling-method", "euler",
        "--scheduler", "lcm",
        "-W", str(vw), "-H", str(vh),
        "--diffusion-fa", "--offload-to-cpu", "--vae-conv-direct",
        "--video-frames", str(frames),
        "--flow-shift", str(WAN_FLOW_SHIFT),
        "-p", prompt,
        "-o", str(raw),
        "-t", "28",
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=3600)

    v = brand.get("visual", {})
    accent = v.get("colors", {}).get("shield_purple", "#7c5cfc").lstrip("#")
    copy = (job.get("copy_text") or brand.get("brand", {}).get(
        "tagline_en", "Ads? Off.")).replace("'", "")
    copy = copy.replace(":", " ").replace("\n", " ")[:90]
    font = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
    if not Path(font).exists():
        font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    fname = f"media-{job['job_id']}.mp4"
    fp = OUT / fname
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,"
        f"crop={w}:{h},fps=30[bg];"
        f"[1:v]scale={int(w*0.14)}:-1[lg];"
        f"[bg][lg]overlay=W-w-{int(w*0.05)}:H-h-{int(h*0.05)}[wm];"
        f"[wm]drawtext=fontfile={font}:text='{copy}':fontcolor=white:"
        f"fontsize={int(w*0.052)}:box=1:boxcolor=0x{accent}@0.55:boxborderw=24:"
        f"x=(w-text_w)/2:y=h*0.78,"
        f"fade=t=in:st=0:d=0.5,fade=t=out:st={dur-0.6}:d=0.6[out]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-stream_loop", "-1", "-t", str(dur), "-i", str(raw),
        "-i", logo_path(job["brand"]),
        "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", vf, "-map", "[out]", "-map", "2:a",
        "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(dur),
        str(fp)
    ], check=True, capture_output=True)
    raw.unlink(missing_ok=True)
    return fname, fp.stat().st_size


def make_reel_kenburns(job, brand, w, h):
    """Legacy fallback: Flux still frames + ffmpeg ken-burns crossfade."""
    mkey = resolve_img_model(job["model"], "reel")
    dur = int(job.get("duration_sec") or 12)
    base = sanitize_topic(job["topic"])
    f1 = OUT / f"media-{job['job_id']}-f1.png"
    f2 = OUT / f"media-{job['job_id']}-f2.png"
    render_upscaled(base + ", hero shield emblem" + brand_style(brand), w, h, f1, mkey)
    render_upscaled(base + ", abstract data protection grid" + brand_style(brand), w, h, f2, mkey)
    v = brand.get("visual", {})
    accent = v.get("colors", {}).get("shield_purple", "#7c5cfc").lstrip("#")
    copy = (job.get("copy_text") or brand.get("brand", {}).get(
        "tagline_en", "Ads? Off.")).replace("'", "")
    copy = copy.replace(":", " ").replace("\n", " ")[:90]
    font = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
    if not Path(font).exists():
        font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    fname = f"media-{job['job_id']}.mp4"
    fp = OUT / fname
    half = dur / 2
    z = SPECS["render_defaults"]["ken_burns_zoom"]
    vf = (
        f"[0:v]scale={w}:{h},zoompan=z='min(zoom+0.0008,{z})':d={int(half*30)}:"
        f"s={w}x{h}:fps=30[v0];"
        f"[1:v]scale={w}:{h},zoompan=z='min(zoom+0.0008,{z})':d={int(half*30)}:"
        f"s={w}x{h}:fps=30[v1];"
        f"[v0][v1]xfade=transition=fade:duration=1:offset={half-0.5}[xf];"
        f"[2:v]scale={int(w*0.14)}:-1[lg];"
        f"[xf][lg]overlay=W-w-{int(w*0.05)}:H-h-{int(h*0.05)}[wm];"
        f"[wm]drawtext=fontfile={font}:text='{copy}':fontcolor=white:"
        f"fontsize={int(w*0.052)}:box=1:boxcolor=0x{accent}@0.55:boxborderw=24:"
        f"x=(w-text_w)/2:y=h*0.78:enable='between(t,1,{dur})',"
        f"fade=t=in:st=0:d=0.6,fade=t=out:st={dur-0.6}:d=0.6[out]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-loop", "1", "-t", str(half), "-i", str(f1),
        "-loop", "1", "-t", str(half), "-i", str(f2),
        "-i", logo_path(job["brand"]),
        "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", vf, "-map", "[out]", "-map", "3:a",
        "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(dur),
        str(fp)
    ], check=True, capture_output=True)
    for tmp in (f1, f2):
        tmp.unlink(missing_ok=True)
    return fname, fp.stat().st_size


def make_video(job, brand, w, h):
    """Video dispatch: real FastWan unless model=kenburns explicitly requested."""
    m = (job.get("model") or "auto").lower()
    if m == "kenburns":
        return make_reel_kenburns(job, brand, w, h)
    try:
        return make_video_fastwan(job, brand, w, h)
    except Exception as e:
        print(f"  FastWan failed ({e}); falling back to ken-burns", flush=True)
        return make_reel_kenburns(job, brand, w, h)


HANDLERS = {
    "photo": make_photo, "carousel": make_carousel,
    "reel": make_video, "story": make_video, "video": make_video,
}


def claim():
    out = q(
        f"UPDATE {SCHEMA} SET status='processing', started_at=NOW() "
        f"WHERE job_id=(SELECT job_id FROM {SCHEMA} WHERE status='queued' "
        f"ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) "
        f"RETURNING job_id||'~'||brand||'~'||platform||'~'||format_type||'~'||"
        f"COALESCE(topic,'')||'~'||COALESCE(copy_text,'')||'~'||"
        f"COALESCE(slides::text,'1')||'~'||COALESCE(duration_sec::text,'0')||'~'||"
        f"COALESCE(model,'auto');"
    )
    if not out:
        return None
    p = out.split("~", 8)
    return {
        "job_id": p[0], "brand": p[1], "platform": p[2], "format_type": p[3],
        "topic": p[4], "copy_text": p[5],
        "slides": int(p[6] or 1), "duration_sec": int(p[7] or 0),
        "model": p[8] if len(p) > 8 else "auto",
    }


def reclaim_orphans():
    """Single-worker model: any 'processing' job at startup was orphaned by a
    restart. Requeue it so it is not stuck forever."""
    n = qx(f"UPDATE {SCHEMA} SET status='queued', started_at=NULL "
           f"WHERE status='processing' RETURNING job_id;")
    if n:
        print(f"reclaimed orphaned jobs: {n.count(chr(10)) + 1}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"[{datetime.now(timezone.utc).isoformat()}] media-worker v2 started "
          f"(models: flux2/qwen/zimage/sdxl + FastWan video)", flush=True)
    try:
        reclaim_orphans()
    except Exception as e:
        print("reclaim err:", e, flush=True)
    while True:
        try:
            job = claim()
        except Exception as e:
            print("claim err:", e, flush=True)
            time.sleep(POLL)
            continue
        if not job:
            time.sleep(POLL)
            continue
        jid, ft = job["job_id"], job["format_type"]
        print(f"[{datetime.now(timezone.utc).isoformat()}] job {jid} {ft} "
              f"{job['platform']} model={job['model']}", flush=True)
        t0 = time.time()
        try:
            brand = load_brand(job["brand"])
            w, h = dims(job["platform"], ft)
            handler = HANDLERS.get(ft, make_photo)
            fname, size = handler(job, brand, w, h)
            secs = int(time.time() - t0)
            qx(f"UPDATE {SCHEMA} SET status='done', "
               f"output_path='{CONTAINER_PREFIX}/{esc(fname)}', file_size={size}, "
               f"width={w}, height={h}, gen_seconds={secs}, completed_at=NOW() "
               f"WHERE job_id='{jid}';")
            print(f"  done {secs}s -> {fname} ({size}B)", flush=True)
        except subprocess.CalledProcessError as e:
            secs = int(time.time() - t0)
            err = (e.stderr.decode()[:400] if e.stderr else str(e))
            qx(f"UPDATE {SCHEMA} SET status='error', error='{esc(err)}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {err}", flush=True)
        except Exception as e:
            secs = int(time.time() - t0)
            qx(f"UPDATE {SCHEMA} SET status='error', error='{esc(e)[:400]}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {e}", flush=True)


if __name__ == "__main__":
    main()
