#!/usr/bin/env python3
"""AdOff Remotion Video Worker — sostituisce il NotebookLM worker.

Linea video APPROVATA (vedi memoria feedback_video_line + notebooklm-runbook):
  - NotebookLM-video = vicolo cieco (success ma 0 artifact). NON usarlo.
  - Motore = Remotion `sviluppo/marketing/video-engine` (brand-safe).
  - Formato = `tech-reveal`: voce narrativa SINCRONIZZATA di qualità (Chatterbox
    Multilingual MIT, voce-brand clonata da _brand-ref.wav — NON edge-tts piatto).
  - Contenuto = pain-point: bombardamento pubblicità su streaming + ogni sito.
    MAI prezzi, MAI "a pagamento", MAI brand reali (regole in CONTENT del
    generatore, non per-job freeform).
  - IT + EN, testo a schermo == lingua voce, sincronizzati.

Pattern coda IDENTICO al precedente (drop-in): adoff_autopilot.youtube_queue,
claim FOR UPDATE SKIP LOCKED, status queued->processing->done/error,
output in /opt/n8n/local-files, set video_b_path/duration_sec/transcript.

Uso:
  remotion-video-worker.py              # worker loop (default)
  remotion-video-worker.py --selftest   # verifica engine/voce, NON consuma coda
  remotion-video-worker.py --once       # processa un solo job ed esce
"""
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

POLL = 10
OUT = Path("/opt/n8n/local-files")
CONTAINER_PREFIX = "/files"
SCHEMA = "adoff_autopilot.youtube_queue"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]
VE = Path(os.environ.get(
    "ADOFF_VIDEO_ENGINE",
    "/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/"
    "sviluppo/marketing/video-engine"))
CHATTERBOX_PY = Path(os.environ.get(
    "CHATTERBOX_PY", os.path.expanduser("~/.cache/adoff-chatterbox-venv/bin/python")))
TEMPLATE = os.environ.get("ADOFF_VIDEO_TEMPLATE", "tech-reveal")  # linea approvata
GEN = VE / "gen-voiceover-chatterbox.py"


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


def claim():
    out = q(
        f"UPDATE {SCHEMA} SET status='processing', started_at=NOW() "
        f"WHERE job_id=(SELECT job_id FROM {SCHEMA} WHERE status='queued' "
        f"ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) "
        f"RETURNING job_id||'~'||COALESCE(lang,'it')||'~'||COALESCE(mode,'both');"
    )
    if not out:
        return None
    p = out.split("~", 2)
    return {"job_id": p[0], "lang": (p[1] or "it"), "mode": (p[2] or "both")}


def voice_text(lang):
    """Testo == voce (per transcript DB / descrizione YouTube). Letto dal
    JSON voce sincronizzato già generato (robusto, no parsing Python)."""
    js = VE / "public" / f"vo-{TEMPLATE}-{lang}.json"
    try:
        d = json.loads(js.read_text())
        parts = [d.get("headline", {}).get("text", "")]
        parts += [s.get("text", "") for s in d.get("specs", [])]
        parts += [d.get("outro", {}).get("text", "")]
        return " ".join(p for p in parts if p).strip()
    except Exception:  # noqa: BLE001
        return ""


def ensure_voice(lang):
    """Genera la voce Chatterbox synced se mancante o più vecchia del generatore.
    Voce-brand consistente (clonata), una sola lingua coerente col testo."""
    mp3 = VE / "public" / f"vo-{TEMPLATE}-{lang}.mp3"
    js = VE / "public" / f"vo-{TEMPLATE}-{lang}.json"
    fresh = (mp3.exists() and js.exists()
             and mp3.stat().st_mtime >= GEN.stat().st_mtime)
    if fresh:
        return
    if not CHATTERBOX_PY.exists():
        raise RuntimeError(f"Chatterbox venv assente: {CHATTERBOX_PY}")
    subprocess.run([str(CHATTERBOX_PY), "gen-voiceover-chatterbox.py"],
                   cwd=str(VE), check=True, capture_output=True, text=True,
                   timeout=1800)
    if not (mp3.exists() and js.exists()):
        raise RuntimeError(f"voce non generata per {TEMPLATE}/{lang}")


def render(lang, dest: Path):
    subprocess.run(
        ["npx", "remotion", "render", TEMPLATE, str(dest),
         "--props", json.dumps({"lang": lang})],
        cwd=str(VE), check=True, capture_output=True, text=True, timeout=1200)
    if not dest.exists() or dest.stat().st_size < 100_000:
        raise RuntimeError(f"render fallito o output troppo piccolo: {dest}")


def ffprobe_dur(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def process(job):
    jid, lang = job["job_id"], job["lang"]
    OUT.mkdir(parents=True, exist_ok=True)
    ensure_voice(lang)
    tmp = VE / "output" / f"yt-{jid}.mp4"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    render(lang, tmp)
    final = OUT / f"youtube-{jid}.mp4"
    shutil.copy2(tmp, final)
    dur = int(ffprobe_dur(final))
    tr = esc(voice_text(lang))[:6000]
    return [
        f"video_b_path='{CONTAINER_PREFIX}/{final.name}'",
        f"duration_sec={dur}",
        f"transcript='{tr}'",
    ]


def main_loop(once=False):
    print(f"[{datetime.now(timezone.utc).isoformat()}] remotion-video-worker "
          f"started (template={TEMPLATE})")
    while True:
        try:
            job = claim()
        except Exception as e:  # noqa: BLE001
            print("claim err:", e)
            time.sleep(POLL)
            continue
        if not job:
            if once:
                print("nessun job in coda")
                return
            time.sleep(POLL)
            continue
        jid = job["job_id"]
        t0 = time.time()
        print(f"[{datetime.now(timezone.utc).isoformat()}] job {jid} "
              f"lang={job['lang']}")
        try:
            sets = process(job)
            secs = int(time.time() - t0)
            qx(f"UPDATE {SCHEMA} SET status='done', {','.join(sets)}, "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  done {secs}s")
        except subprocess.CalledProcessError as e:  # noqa: PERF203
            secs = int(time.time() - t0)
            msg = esc((e.stderr or str(e)))[:600]
            qx(f"UPDATE {SCHEMA} SET status='error', error='{msg}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {msg[:200]}")
        except Exception as e:  # noqa: BLE001
            secs = int(time.time() - t0)
            qx(f"UPDATE {SCHEMA} SET status='error', error='{esc(e)[:600]}', "
               f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';")
            print(f"  ERR {secs}s: {e}")
        if once:
            return


def do_selftest():
    ok = True
    if not (VE / "package.json").exists():
        print(f"[FAIL] video-engine assente: {VE}"); ok = False
    if not CHATTERBOX_PY.exists():
        print(f"[FAIL] chatterbox venv assente: {CHATTERBOX_PY}"); ok = False
    if not GEN.exists():
        print(f"[FAIL] generatore voce assente: {GEN}"); ok = False
    try:
        q("SELECT 1;")
    except Exception as e:  # noqa: BLE001
        print(f"[FAIL] coda Postgres non raggiungibile: {e}"); ok = False
    print("[OK] engine+voce+coda pronti" if ok else "[FAIL] vedi sopra")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        do_selftest()
    main_loop(once="--once" in sys.argv)
