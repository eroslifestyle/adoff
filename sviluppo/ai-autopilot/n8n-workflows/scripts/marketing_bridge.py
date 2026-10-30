#!/usr/bin/env python3
"""
AdOff — marketing bridge HTTP service.

Esposto su 0.0.0.0:8792 (host gateway raggiungibile da n8n container come
http://172.17.0.1:8792). Bridge fra n8n (no python/ffmpeg/Chatterbox dentro
container) e gli orchestrator host-side che richiedono il pieno ambiente host
(FLUX :1237, Chatterbox venv, Remotion).

Endpoints:
  GET  /healthz                       → {"ok":true,"service":"adoff-marketing-bridge"}
  POST /build/cyber-purge             → corpo: {"lang":"it","concept":"c1-story-arc","force":false}
                                         risposta: JSON summary di cyber-purge-build.py
                                         timeout default 1500s (25 min)
"""
from __future__ import annotations
import json, os, subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent
# Path al venv Chatterbox (ha torchaudio + chatterbox + ffmpeg-shim via PATH).
CHATTERBOX_PY = Path(
    os.environ.get(
        "CYBER_PY",
        str(Path.home() / ".cache/adoff-chatterbox-venv/bin/python"),
    )
)
BUILD_SCRIPT = Path(
    os.environ.get(
        "CYBER_BUILD",
        "/home/mrxxx/adoff/sviluppo/marketing/video-engine/cyber-purge-build.py",
    )
)
TIMEOUT_S = int(os.environ.get("CYBER_TIMEOUT", "1500"))

app = FastAPI(title="AdOff Marketing Bridge", version="1.0")


class BuildReq(BaseModel):
    lang: str
    concept: str
    force: bool = False


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "service": "adoff-marketing-bridge",
        "py": str(CHATTERBOX_PY),
        "py_exists": CHATTERBOX_PY.exists(),
        "build_script": str(BUILD_SCRIPT),
        "build_exists": BUILD_SCRIPT.exists(),
    }


@app.post("/build/cyber-purge")
def build_cyber_purge(req: BuildReq):
    if not CHATTERBOX_PY.exists():
        raise HTTPException(500, f"Chatterbox venv mancante: {CHATTERBOX_PY}")
    if not BUILD_SCRIPT.exists():
        raise HTTPException(500, f"Script orchestrator mancante: {BUILD_SCRIPT}")
    if req.lang not in {"it","en","de","fr","es","pt","ru","ar","zh","tr",
                         "id","pl","hi","ja","ko"}:
        raise HTTPException(400, f"lang non supportata: {req.lang}")
    cmd = [str(CHATTERBOX_PY), str(BUILD_SCRIPT),
           "--lang", req.lang, "--concept", req.concept]
    if req.force:
        cmd.append("--force")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired as e:
        raise HTTPException(504, f"build timeout >{TIMEOUT_S}s: {e!r}")

    tail = (r.stdout + "\n" + r.stderr).strip().splitlines()
    # L'orchestrator emette un'unica riga JSON finale su stdout.
    summary = None
    for line in reversed(r.stdout.strip().splitlines()):
        try:
            summary = json.loads(line)
            break
        except Exception:
            continue
    if summary is None:
        raise HTTPException(500, {
            "error": "no JSON summary on stdout",
            "rc": r.returncode,
            "tail": tail[-20:],
        })
    summary["rc"] = r.returncode
    if r.returncode != 0 and "error" not in summary:
        summary["error"] = f"rc={r.returncode}"
        summary["tail"] = tail[-20:]
    return summary
