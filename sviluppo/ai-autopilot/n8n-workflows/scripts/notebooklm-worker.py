#!/usr/bin/env python3
"""AdOff NotebookLM Worker — NotebookLM → YouTube asset generator.

Pattern allineato a media-queue-worker.py:
  - coda Postgres adoff_autopilot.youtube_queue, claim FOR UPDATE SKIP LOCKED
  - output in /opt/n8n/local-files  (== /files nel container n8n)
  - loop poll, status queued->processing->done/error

NotebookLM NON ha API: si pilota la web UI con Playwright usando un profilo
Chrome PERSISTENTE già loggato su Google (login manuale una-tantum, vedi runbook).

Modi:
  notebooklm-worker.py --login     # apre browser headful per login Google (1 volta)
  notebooklm-worker.py --selftest  # verifica profilo+sessione, NON consuma coda
  notebooklm-worker.py --probe     # dump struttura DOM Studio (calibrazione selettori)
  notebooklm-worker.py             # worker loop (default, headless)

⚠️ I selettori NotebookLM sono NON ufficiali e cambiano: centralizzati in SEL,
   role/text-based con fallback. Prima messa in opera: usare --login poi --probe
   e ricalibrare SEL se la UI è cambiata. Vedi notebooklm-runbook.md.
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---- config (allineata a media-queue-worker.py) -----------------------------
POLL = 10
OUT = Path("/opt/n8n/local-files")
CONTAINER_PREFIX = "/files"
BRANDS = Path("/home/mrxxx/sdcpp/brands")
SCHEMA = "adoff_autopilot.youtube_queue"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]
PROFILE = Path(os.environ.get("NBLM_PROFILE", "/home/mrxxx/.nblm-profile"))
NBLM_URL = "https://notebooklm.google.com/"
RES_W, RES_H = 1920, 1080
GEN_TIMEOUT_MS = int(os.environ.get("NBLM_GEN_TIMEOUT", "1500")) * 1000  # 25 min default

# Selettori NotebookLM (text/role-based, fallback multipli). RICALIBRARE se UI cambia.
SEL = {
    "create_notebook": ["text=Create new", "text=Nuovo blocco note",
                        "button:has-text('Create')", "[aria-label*='Create']"],
    "add_source": ["text=Add source", "text=Aggiungi fonte",
                   "[aria-label*='Add source']", "button:has-text('Add')"],
    "upload_tab": ["text=Upload", "text=Carica", "text=Choose file"],
    "studio_tab": ["text=Studio", "[aria-label*='Studio']"],
    "audio_overview": ["text=Audio Overview", "text=Panoramica audio",
                       "button:has-text('Audio')"],
    "video_overview": ["text=Video Overview", "text=Panoramica video",
                       "button:has-text('Video')"],
    "generate": ["text=Generate", "text=Genera", "button:has-text('Generate')"],
    "audio_ready": ["audio", "[aria-label*='Play']", "text=Download"],
    "video_ready": ["video", "text=Download", "[aria-label*='Download']"],
    "download": ["text=Download", "[aria-label*='Download']", "text=Scarica"],
    "more_menu": ["[aria-label*='More']", "button:has-text('⋮')",
                  "[aria-label*='Altro']"],
}


# ---- DB helpers (identici a media-queue-worker.py) --------------------------
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
    return json.loads(f.read_text()) if f.exists() else {}


# ---- Playwright helpers -----------------------------------------------------
def _first(page, keys, timeout=8000):
    """Primo selettore della lista che diventa visibile. None se nessuno."""
    last = None
    for css in keys:
        try:
            loc = page.locator(css).first
            loc.wait_for(state="visible", timeout=timeout)
            return loc
        except Exception as e:  # noqa: BLE001
            last = e
            continue
    return None


def _click(page, sel_key, timeout=8000, optional=False):
    loc = _first(page, SEL[sel_key], timeout)
    if loc is None:
        if optional:
            return False
        raise RuntimeError(f"selettore non trovato: {sel_key} ({SEL[sel_key]})")
    loc.click()
    return True


def new_context(headless=True):
    from playwright.sync_api import sync_playwright  # import lazy
    pw = sync_playwright().start()
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE),
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox", "--disable-dev-shm-usage",
        ],
        viewport={"width": 1440, "height": 900},
        accept_downloads=True,
        locale="it-IT",
    )
    return pw, ctx


def ensure_logged_in(page):
    page.goto(NBLM_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    if "accounts.google.com" in page.url or page.locator(
            "input[type=email]").count() > 0:
        raise RuntimeError(
            "Sessione Google ASSENTE/SCADUTA. Esegui: notebooklm-worker.py --login")


# ---- NotebookLM flow --------------------------------------------------------
# notebooklm-pp-cli: engine RPC affidabile per create/upload/trigger.
# Sostituisce i passi Playwright flaky (selettori UI). Playwright resta SOLO
# per attesa-pronto + download dell'MP3/MP4 (nessun RPC retrieval catturato).
NBLM_CLI = Path(os.environ.get(
    "NBLM_CLI", "/home/mrxxx/printing-press/library/notebooklm/notebooklm-pp-cli"))


def _cookie_header(ctx):
    """Bridge auth: estrae i cookie google.com dal context Playwright (già
    loggato via profilo persistente) e li passa al CLI come NOTEBOOKLM_COOKIES.
    Un solo login, niente doppia autenticazione."""
    pairs, seen = [], set()
    for c in ctx.cookies():
        dom = c.get("domain", "") or ""
        n = c.get("name")
        if "google.com" in dom and n and n not in seen:
            seen.add(n)
            pairs.append(f"{n}={c.get('value','')}")
    return "; ".join(pairs)


def _cli(args, cookies, timeout=180):
    """Esegue notebooklm-pp-cli con i cookie bridged. Ritorna stdout JSON."""
    if not NBLM_CLI.exists():
        raise RuntimeError(f"CLI assente: {NBLM_CLI} (vedi runbook)")
    env = dict(os.environ)
    env["NOTEBOOKLM_COOKIES"] = cookies
    r = subprocess.run([str(NBLM_CLI)] + args + ["--json"],
                        capture_output=True, text=True, env=env, timeout=timeout)
    out = (r.stdout or "").strip()
    if r.returncode != 0 or '"success": false' in out or "Error:" in (r.stderr or ""):
        raise RuntimeError(f"CLI {args[:2]} fallito: "
                           f"{(out or r.stderr or '')[:300]}")
    try:
        return json.loads(out) if out.startswith("{") else {}
    except json.JSONDecodeError:
        return {}


def nblm_create_notebook(ctx, page, pdfs, topic, lang="it"):
    """CLI: crea notebook + carica i PDF come fonti. Ritorna notebook_id."""
    cookies = _cookie_header(ctx)
    title = f"AdOff Auto — {datetime.now(timezone.utc):%Y%m%d-%H%M%S}"
    res = _cli(["notebooks", "create", "--title", title], cookies)
    nb = res.get("id") or res.get("notebook_id")
    if not nb:
        raise RuntimeError(f"notebook_id non estratto: {res}")
    for p in pdfs:
        if not Path(p).exists():
            raise RuntimeError(f"PDF mancante: {p}")
        _cli(["sources", "add", nb, "--file", str(p)], cookies, timeout=240)
        time.sleep(2)
    # attesa ingestione (NotebookLM indicizza le fonti caricate)
    time.sleep(20)
    return nb


def _download_to(page, trigger_locator, dest: Path):
    with page.expect_download(timeout=GEN_TIMEOUT_MS) as dl:
        trigger_locator.click()
    download = dl.value
    download.save_as(str(dest))
    return dest


def _cli_wait_completed(ctx, nb, timeout_s=1500, poll_s=20):
    """Completion-detection via CLI `studio status` (rpcid gArtLc,
    CDP-captured). Sostituisce il polling Playwright fragile sui selettori.
    Ritorna l'artifact dict con state_code==3 quando pronto."""
    cookies = _cookie_header(ctx)
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            res = _cli(["studio", "status", nb], cookies, timeout=90)
        except Exception:
            res = {}
        for a in (res.get("artifacts") or []):
            if a.get("state_code") == 3:
                return a
        time.sleep(poll_s)
    raise RuntimeError("artifact non COMPLETED entro timeout (CLI status)")


def _wait_ready_and_download(ctx, page, nb, ready_keys, dest: Path):
    """Completion via CLI (gArtLc). Playwright resta SOLO per il download
    finale: i media artifact NotebookLM (lh3.googleusercontent.com → 302
    rd-notebooklm → ServiceLogin) sono dietro auth browser interattiva che
    il replay header-cookie non supera. Unico passo non-CLI residuo."""
    _cli_wait_completed(ctx, nb)  # affidabile, niente selettori
    page.goto(f"{NBLM_URL}notebook/{nb}",
              wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(4000)
    # l'artifact è già COMPLETED (confermato via CLI): vai diretto al download
    _click(page, "more_menu", timeout=6000, optional=True)
    dl = _first(page, SEL["download"], timeout=20000)
    if dl is None:
        raise RuntimeError("bottone download non trovato (UI cambiata?)")
    _download_to(page, dl, dest)


def nblm_audio_overview(ctx, page, nb, dest_mp3: Path, lang="it"):
    """CLI avvia l'audio overview; Playwright attende+scarica."""
    cookies = _cookie_header(ctx)
    _cli(["studio", "generate", nb, "--kind", "audio"], cookies)
    _wait_ready_and_download(ctx, page, nb, SEL["audio_ready"], dest_mp3)
    transcript = ""
    try:
        t = page.locator("text=/transcript|trascrizione/i").first
        t.click(timeout=5000)
        page.wait_for_timeout(1500)
        transcript = page.locator("article, [role=main]").inner_text()[:20000]
    except Exception:  # noqa: BLE001
        transcript = ""
    return transcript


def nblm_video_overview(ctx, page, nb, dest_mp4: Path, lang="it"):
    """CLI avvia il video overview; Playwright attende+scarica."""
    cookies = _cookie_header(ctx)
    _cli(["studio", "generate", nb, "--kind", "video"], cookies)
    _wait_ready_and_download(ctx, page, nb, SEL["video_ready"], dest_mp4)


# ---- ffmpeg render (mode B: audio Deep Dive -> video 1080p) ------------------
def ffprobe_dur(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def make_srt(transcript: str, duration: float, dest: Path):
    """SRT v1: split testo in righe ~9 parole, distribuite sulla durata.
    Upgrade path (timing reale): Whisper su audio_path — vedi runbook."""
    words = re.sub(r"\s+", " ", transcript or "").strip().split()
    if not words or duration <= 0:
        dest.write_text("")
        return
    per = 9
    chunks = [" ".join(words[i:i + per]) for i in range(0, len(words), per)]
    slot = duration / max(1, len(chunks))

    def ts(s):
        h, s = divmod(s, 3600)
        m, s = divmod(s, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s%1)*1000):03d}"

    lines = []
    for i, c in enumerate(chunks):
        st, en = i * slot, (i + 1) * slot - 0.05
        lines.append(f"{i+1}\n{ts(st)} --> {ts(en)}\n{c}\n")
    dest.write_text("\n".join(lines), encoding="utf-8")


def render_b(job, audio: Path, transcript: str, dest: Path):
    brand = load_brand(job["brand"])
    v = brand.get("visual", {})
    colors = v.get("colors", {})
    accent = colors.get("shield_purple", "#7c5cfc")
    bg = colors.get("deep_space", "#0a0a1a")
    dur = ffprobe_dur(audio)
    srt = dest.with_suffix(".srt")
    make_srt(transcript, dur, srt)
    logo = BRANDS / f"{job['brand']}-logo.png"
    if not logo.exists():
        logo = BRANDS / "adoff-logo.png"
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    inputs = ["ffmpeg", "-y",
              "-f", "lavfi", "-i", f"color=c={bg}:s={RES_W}x{RES_H}:d={dur}",
              "-i", str(audio)]
    have_logo = logo.exists()
    if have_logo:
        inputs += ["-i", str(logo)]
    acc = accent.lstrip("#")
    # waveform centrale + sottotitoli burned + logo angolo
    fc = (
        f"[1:a]showwaves=s={RES_W}x320:mode=cline:colors=0x{acc}:rate=25[wv];"
        f"[0:v][wv]overlay=(W-w)/2:(H-h)/2+120[bgv];"
    )
    last = "bgv"
    if srt.read_text().strip():
        sub = str(srt).replace(":", r"\:").replace("'", r"\'")
        fc += (f"[{last}]subtitles='{sub}':force_style="
               f"'FontName=DejaVu Sans,Fontsize=22,PrimaryColour=&Hffffff,"
               f"BackColour=&H80000000,BorderStyle=4,Alignment=2,MarginV=70'[sb];")
        last = "sb"
    if have_logo:
        fc += (f"[2:v]scale={int(RES_W*0.10)}:-1[lg];"
               f"[{last}][lg]overlay=W-w-60:60[vout]")
    else:
        fc += f"[{last}]drawtext=fontfile={font}:text='AdOff':fontcolor=white:" \
              f"fontsize=42:x=W-tw-60:y=60[vout]"
    subprocess.run(
        inputs + ["-filter_complex", fc, "-map", "[vout]", "-map", "1:a",
                  "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                  "-shortest", str(dest)],
        check=True, capture_output=True)
    srt.unlink(missing_ok=True)
    return dur


# ---- claim / process --------------------------------------------------------
def claim():
    out = q(
        f"UPDATE {SCHEMA} SET status='processing', started_at=NOW() "
        f"WHERE job_id=(SELECT job_id FROM {SCHEMA} WHERE status='queued' "
        f"ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) "
        f"RETURNING job_id||'~'||brand||'~'||mode||'~'||lang||'~'||"
        f"COALESCE(topic,'')||'~'||COALESCE(array_to_string(source_pdfs,'|'),'');"
    )
    if not out:
        return None
    p = out.split("~", 5)
    return {"job_id": p[0], "brand": p[1], "mode": p[2], "lang": p[3],
            "topic": p[4], "pdfs": [x for x in p[5].split("|") if x]}


def process(job, ctx):
    page = ctx.new_page()
    jid = job["job_id"]
    sets = []
    try:
        ensure_logged_in(page)
        missing = [p for p in job["pdfs"] if not Path(p).exists()]
        if missing:
            raise RuntimeError(f"PDF mancanti: {missing}")
        lang = job.get("lang", "it")
        nb = nblm_create_notebook(ctx, page, job["pdfs"], job["topic"], lang)

        if job["mode"] in ("A", "both"):
            va = OUT / f"youtube-{jid}-overview.mp4"
            nblm_video_overview(ctx, page, nb, va, lang)
            sets.append(f"video_a_path='{CONTAINER_PREFIX}/{va.name}'")

        if job["mode"] in ("B", "both"):
            amp3 = OUT / f"youtube-{jid}.mp3"
            transcript = nblm_audio_overview(ctx, page, nb, amp3, lang)
            vb = OUT / f"youtube-{jid}.mp4"
            dur = render_b(job, amp3, transcript, vb)
            sets.append(f"audio_path='{CONTAINER_PREFIX}/{amp3.name}'")
            sets.append(f"video_b_path='{CONTAINER_PREFIX}/{vb.name}'")
            sets.append(f"transcript='{esc(transcript)}'")
            sets.append(f"duration_sec={int(dur)}")
        return sets
    finally:
        try:
            page.close()
        except Exception:  # noqa: BLE001
            pass


def main_loop():
    OUT.mkdir(parents=True, exist_ok=True)
    if not PROFILE.exists():
        print(f"[FATAL] profilo {PROFILE} assente. Esegui --login (vedi runbook).")
        sys.exit(2)
    print(f"[{datetime.now(timezone.utc).isoformat()}] notebooklm-worker started")
    pw, ctx = new_context(headless=True)
    try:
        while True:
            try:
                job = claim()
            except Exception as e:  # noqa: BLE001
                print("claim err:", e)
                time.sleep(POLL)
                continue
            if not job:
                time.sleep(POLL)
                continue
            jid = job["job_id"]
            t0 = time.time()
            print(f"[{datetime.now(timezone.utc).isoformat()}] job {jid} "
                  f"mode={job['mode']} pdfs={len(job['pdfs'])}")
            try:
                sets = process(job, ctx)
                secs = int(time.time() - t0)
                qx(f"UPDATE {SCHEMA} SET status='done', "
                   f"{','.join(sets)}, gen_seconds={secs}, completed_at=NOW() "
                   f"WHERE job_id='{jid}';")
                print(f"  done {secs}s")
            except Exception as e:  # noqa: BLE001
                secs = int(time.time() - t0)
                qx(f"UPDATE {SCHEMA} SET status='error', "
                   f"error='{esc(e)[:600]}', gen_seconds={secs}, "
                   f"completed_at=NOW() WHERE job_id='{jid}';")
                print(f"  ERR {secs}s: {e}")
    finally:
        ctx.close()
        pw.stop()


def do_login():
    PROFILE.mkdir(parents=True, exist_ok=True)
    print("Apro browser headful. Fai login Google → apri NotebookLM → chiudi.")
    pw, ctx = new_context(headless=False)
    page = ctx.new_page()
    page.goto(NBLM_URL)
    input("Completato il login e caricato NotebookLM, premi INVIO qui...")
    ctx.close()
    pw.stop()
    print(f"[OK] profilo salvato in {PROFILE}")


def do_selftest():
    if not PROFILE.exists():
        print("[FAIL] profilo assente")
        sys.exit(1)
    pw, ctx = new_context(headless=True)
    page = ctx.new_page()
    try:
        ensure_logged_in(page)
        print("[OK] sessione Google valida, NotebookLM raggiungibile")
    except Exception as e:  # noqa: BLE001
        print(f"[FAIL] {e}")
        sys.exit(1)
    finally:
        ctx.close()
        pw.stop()


def do_probe():
    pw, ctx = new_context(headless=True)
    page = ctx.new_page()
    page.goto(NBLM_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    print(page.content()[:8000])
    ctx.close()
    pw.stop()


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--login":
        do_login()
    elif arg == "--selftest":
        do_selftest()
    elif arg == "--probe":
        do_probe()
    else:
        main_loop()
