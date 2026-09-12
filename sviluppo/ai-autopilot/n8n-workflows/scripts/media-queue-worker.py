#!/usr/bin/env python3
"""AdOff Media Queue Worker — multimodal asset generator, brand-aware, multi-project.

Processes adoff_autopilot.media_queue. Per format_type:
  photo    -> 1 Flux render at platform size + logo overlay
  carousel -> N Flux renders, brand-consistent + slide numbers + logo
  reel/story/video -> Flux frames -> ffmpeg ken-burns + brand text overlay + logo -> mp4

Brand specs loaded from ~/sdcpp/brands/<brand>.json (multi-project registry).
Social dimensions from ~/sdcpp/brands/social-specs.json.
Output saved in /opt/n8n/local-files (== /files in n8n container).
"""
import base64
import json
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

POLL = 8
# SDXL-Turbo :1235 (18-44s/img, production). Flux :1234 (slow ~600s, hero fallback).
SD = "http://127.0.0.1:1235/sdapi/v1/txt2img"
OUT = Path("/opt/n8n/local-files")
CONTAINER_PREFIX = "/files"
BRANDS = Path("/home/mrxxx/sdcpp/brands")
SCHEMA = "adoff_autopilot.media_queue"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]

SPECS = json.loads((BRANDS / "social-specs.json").read_text())


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
    # map format_type -> spec key
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


BASE_LONG = 768  # SDXL-Lightning long-edge px. ~80s @768, ~40s @512.
LIGHTNING_STEPS = 5     # Juggernaut XL Lightning: 4-6 steps optimal.
LIGHTNING_CFG = 2.0     # Lightning needs low cfg (1.5-2.5).
LIGHTNING_SAMPLER = "dpmpp2m"


def _raw_flux(prompt, w, h, steps=LIGHTNING_STEPS):
    payload = json.dumps({
        "prompt": prompt, "steps": steps, "cfg_scale": LIGHTNING_CFG,
        "width": w, "height": h, "sampler_name": LIGHTNING_SAMPLER,
        "seed": -1, "batch_size": 1,
    }).encode()
    req = urllib.request.Request(SD, data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        data = json.loads(r.read())
    return base64.b64decode(data["images"][0])


def flux_upscaled(prompt, target_w, target_h, dest: Path):
    """Generate Flux at low res (fast), upscale to target via ImageMagick.
    Writes final PNG to dest at exact target_w x target_h."""
    longest = max(target_w, target_h)
    scale = BASE_LONG / longest
    bw = max(256, round(target_w * scale / 16) * 16)
    bh = max(256, round(target_h * scale / 16) * 16)
    png = _raw_flux(prompt, bw, bh)
    tmp = dest.with_suffix(".raw.png")
    tmp.write_bytes(png)
    # Upscale + center-crop to exact target + mild sharpen
    subprocess.run([
        "convert", str(tmp),
        "-resize", f"{target_w}x{target_h}^",
        "-gravity", "center", "-extent", f"{target_w}x{target_h}",
        "-unsharp", "0x0.75+0.75+0.008",
        "-quality", "92", str(dest)
    ], check=True, capture_output=True)
    tmp.unlink(missing_ok=True)
    return dest.stat().st_size


# Words that derail photo-realistic checkpoints into people/hacker imagery.
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
    # Hard anti-human / flat-emblem lock — checkpoint must NOT render people.
    return (f", flat vector emblem icon, abstract geometric symbol only, "
            f"{img_style}, deep space black background ({bg}), "
            f"glowing purple violet accents ({accent}), premium tech branding, "
            f"centered shield motif, cinematic volumetric glow, "
            f"NO people, NO human, NO face, NO person, NO character, "
            f"NO hands, NO body, NO portrait, NO realistic photo, "
            f"NO text, NO words, NO letters, NO logo")


def logo_path(brand_name):
    p = BRANDS / f"{brand_name}-logo.png"
    return str(p) if p.exists() else str(BRANDS / "adoff-logo.png")


def overlay_logo(img_path, brand_name, w, h):
    """Composite brand logo bottom-right via ImageMagick."""
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
    prompt = sanitize_topic(job["topic"]) + brand_style(brand)
    fname = f"media-{job['job_id']}.png"
    fp = OUT / fname
    flux_upscaled(prompt, w, h, fp)
    overlay_logo(fp, job["brand"], w, h)
    return fname, fp.stat().st_size


def make_carousel(job, brand, w, h):
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
        flux_upscaled(prompt, w, h, fpath)
        overlay_logo(fpath, job["brand"], w, h)
        frames.append(fpath)
    # Bundle list (n8n reads each /files path)
    fname = f"media-{job['job_id']}-carousel.json"
    manifest = {
        "type": "carousel", "slides": slides,
        "files": [f"{CONTAINER_PREFIX}/{p.name}" for p in frames]
    }
    (OUT / fname).write_text(json.dumps(manifest))
    total = sum(p.stat().st_size for p in frames)
    return fname, total


def make_reel(job, brand, w, h):
    dur = int(job.get("duration_sec") or SPECS["format_types"]["reel"]["duration_default_sec"])
    base = sanitize_topic(job["topic"])
    # 2 key frames for crossfade ken-burns (low-res Flux + upscale)
    f1 = OUT / f"media-{job['job_id']}-f1.png"
    f2 = OUT / f"media-{job['job_id']}-f2.png"
    flux_upscaled(base + ", hero shield emblem" + brand_style(brand), w, h, f1)
    flux_upscaled(base + ", abstract data protection grid" + brand_style(brand), w, h, f2)

    v = brand.get("visual", {})
    accent = v.get("colors", {}).get("shield_purple", "#7c5cfc").lstrip("#")
    copy = (job.get("copy_text") or brand.get("brand", {}).get("tagline_en", "Ads? Off.")).replace("'", "")
    copy = copy.replace(":", " ").replace("\n", " ")[:90]
    font = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
    if not Path(font).exists():
        font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    fname = f"media-{job['job_id']}.mp4"
    fp = OUT / fname
    half = dur / 2
    z = SPECS["render_defaults"]["ken_burns_zoom"]
    # Ken Burns on each frame, xfade, drawtext brand copy, logo overlay
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


HANDLERS = {
    "photo": make_photo, "carousel": make_carousel,
    "reel": make_reel, "story": make_reel, "video": make_reel,
}


def claim():
    out = q(
        f"UPDATE {SCHEMA} SET status='processing', started_at=NOW() "
        f"WHERE job_id=(SELECT job_id FROM {SCHEMA} WHERE status='queued' "
        f"ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) "
        f"RETURNING job_id||'~'||brand||'~'||platform||'~'||format_type||'~'||"
        f"COALESCE(topic,'')||'~'||COALESCE(copy_text,'')||'~'||"
        f"COALESCE(slides::text,'1')||'~'||COALESCE(duration_sec::text,'0');"
    )
    if not out:
        return None
    p = out.split("~", 7)
    return {
        "job_id": p[0], "brand": p[1], "platform": p[2], "format_type": p[3],
        "topic": p[4], "copy_text": p[5],
        "slides": int(p[6] or 1), "duration_sec": int(p[7] or 0),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"[{datetime.now(timezone.utc).isoformat()}] media-worker started")
    while True:
        try:
            job = claim()
        except Exception as e:
            print("claim err:", e)
            time.sleep(POLL)
            continue
        if not job:
            time.sleep(POLL)
            continue
        jid, ft = job["job_id"], job["format_type"]
        print(f"[{datetime.now(timezone.utc).isoformat()}] job {jid} {ft} {job['platform']}")
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
            print(f"  done {secs}s -> {fname} ({size}B)")
        except subprocess.CalledProcessError as e:
            secs = int(time.time() - t0)
            err = (e.stderr.decode()[:400] if e.stderr else str(e))
            qx(f"UPDATE {SCHEMA} SET status='error', error='{esc(err)}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {err}")
        except Exception as e:
            secs = int(time.time() - t0)
            qx(f"UPDATE {SCHEMA} SET status='error', error='{esc(e)[:400]}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {e}")


if __name__ == "__main__":
    main()
