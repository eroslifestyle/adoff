#!/usr/bin/env python3
"""AdOff — Thin admin UI per pubblicazione social (IG/FB/TikTok).

Scopo doppio (vedi social-api-authorization-runbook.md, Parte C):
  1. UX visibile che SUPERA gli audit TikTok + Meta App Review (un revisore
     umano apre questa pagina e replica il flusso end-to-end).
  2. Gate di approvazione umana: l'automazione n8n riempie social_posts in
     status='draft'; qui un umano vede preview + creator_info, sceglie
     privacy/disclosure, dà consenso esplicito -> status='approved';
     il dispatcher (social_publish.py --dispatch) pubblica dietro.

Audit hard requirements TikTok implementati (B3 del runbook):
  - creator_info chiamato PRIMA del post; nickname+avatar mostrati
  - dropdown privacy SENZA default (opzioni = privacy_level_options)
  - checkbox comment/duet/stitch default OFF, grigiate se disabilitate
  - enforcement max_video_post_duration_sec (server-side)
  - toggle disclosure commerciale default OFF -> Your Brand / Branded Content
    (branded_content NON può essere Private)
  - preview media + caption/hashtag editabili
  - testo legale Music Usage Confirmation (+ Branded Content Policy)
  - consenso esplicito obbligatorio + avviso elaborazione
  - flag AI-generated (default ON: i nostri video sono sintetici)
  - NESSUN watermark/logo aggiunto dall'app

Run:
  pip install -r requirements.txt
  ADOFF_ADMIN_USER=admin ADOFF_ADMIN_PASS=*** uvicorn app:app --host 127.0.0.1 --port 8790

Esporre dietro Caddy/Cloudflare con auth (basic auth integrata come fallback).
"""
import os
import secrets as pysecrets
import sys
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import social_publish as sp  # noqa: E402

BASE = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE / "templates"))
app = FastAPI(title="AdOff Social Admin", docs_url=None, redoc_url=None)
security = HTTPBasic()

ADMIN_USER = os.environ.get("ADOFF_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADOFF_ADMIN_PASS", "")

PRIVACY_LABELS = {
    "PUBLIC_TO_EVERYONE": "Pubblico",
    "MUTUAL_FOLLOW_FRIENDS": "Amici (follow reciproco)",
    "FOLLOWER_OF_CREATOR": "Follower",
    "SELF_ONLY": "Privato (solo io)",
}


def auth(creds: HTTPBasicCredentials = Depends(security)) -> str:
    if not ADMIN_PASS:
        raise HTTPException(500, "ADOFF_ADMIN_PASS non configurata")
    ok_u = pysecrets.compare_digest(creds.username, ADMIN_USER)
    ok_p = pysecrets.compare_digest(creds.password, ADMIN_PASS)
    if not (ok_u and ok_p):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenziali non valide",
                            {"WWW-Authenticate": "Basic"})
    return creds.username


def _inbox():
    out = sp.q(
        "SELECT id||'|'||platform||'|'||COALESCE(account_ref,'')||'|'||status||'|'||"
        "COALESCE(LEFT(caption,60),'')||'|'||COALESCE(published_url,'')||'|'||"
        "COALESCE(error,'')||'|'||to_char(created_at,'YYYY-MM-DD HH24:MI') "
        f"FROM {sp.SCHEMA} WHERE status IN ('draft','approved','publishing','failed') "
        "OR published_at > NOW() - INTERVAL '3 days' ORDER BY created_at DESC LIMIT 50;")
    rows = []
    for ln in filter(None, out.splitlines()):
        p = ln.split("|")
        rows.append({"id": p[0], "platform": p[1], "account": p[2],
                     "status": p[3], "caption": p[4], "url": p[5],
                     "error": p[6], "created": p[7]})
    return rows


def _draft(post_id):
    out = sp.q("SELECT id||'~'||platform||'~'||COALESCE(account_ref,'')||'~'||"
               "media_type||'~'||media_path||'~'||COALESCE(media_public_url,'')||'~'||"
               "no_logo_variant||'~'||COALESCE(caption,'')||'~'||COALESCE(hashtags,'')||"
               "'~'||lang||'~'||ai_generated "
               f"FROM {sp.SCHEMA} WHERE id={int(post_id)};")
    if not out:
        return None
    v = out.split("~", 10)
    return {"id": int(v[0]), "platform": v[1], "account_ref": v[2],
            "media_type": v[3], "media_path": v[4], "media_public_url": v[5],
            "no_logo_variant": v[6] == "t", "caption": v[7], "hashtags": v[8],
            "lang": v[9], "ai_generated": v[10] == "t"}


@app.get("/", response_class=HTMLResponse)
def home(request: Request, user: str = Depends(auth)):
    return templates.TemplateResponse(request, "publish.html", {
        "user": user, "inbox": _inbox(),
        "draft": None, "creator": None, "privacy_labels": PRIVACY_LABELS})


@app.get("/post/{post_id}", response_class=HTMLResponse)
def post_form(post_id: int, request: Request, user: str = Depends(auth)):
    draft = _draft(post_id)
    if not draft:
        raise HTTPException(404, "post non trovato")
    creator = None
    if draft["platform"] == "tiktok":
        try:
            creator = sp.creator_info_tiktok()
        except Exception as e:  # noqa: BLE001
            creator = {"error": str(e)}
    elif draft["platform"] in ("instagram", "facebook"):
        try:
            creator = sp.page_info_meta()
        except Exception as e:  # noqa: BLE001
            creator = {"error": str(e)}
    return templates.TemplateResponse(request, "publish.html", {
        "user": user, "inbox": _inbox(),
        "draft": draft, "creator": creator, "privacy_labels": PRIVACY_LABELS})


@app.post("/creator-info")
def creator_info_api(platform: str = Form(...), user: str = Depends(auth)):
    try:
        if platform == "tiktok":
            return JSONResponse(sp.creator_info_tiktok())
        return JSONResponse(sp.page_info_meta())
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/media/{post_id}")
def media(post_id: int, user: str = Depends(auth)):
    d = _draft(post_id)
    if not d:
        raise HTTPException(404)
    path = sp.container_to_host(d["media_path"])
    if not path.exists():
        raise HTTPException(404, f"file assente: {path}")
    mt = "video/mp4" if d["media_type"] == "video" else "image/jpeg"
    return FileResponse(str(path), media_type=mt)


@app.post("/publish")
def publish(
    post_id: int = Form(...),
    caption: str = Form(""),
    hashtags: str = Form(""),
    privacy_level: str = Form(""),
    allow_comment: bool = Form(False),
    allow_duet: bool = Form(False),
    allow_stitch: bool = Form(False),
    commercial_disclosure: bool = Form(False),
    your_brand: bool = Form(False),
    branded_content: bool = Form(False),
    ai_generated: bool = Form(True),
    consent: bool = Form(False),
    user: str = Depends(auth),
):
    d = _draft(post_id)
    if not d:
        raise HTTPException(404, "post non trovato")
    plat = d["platform"]

    if not consent:
        raise HTTPException(400, "Consenso esplicito obbligatorio prima della pubblicazione.")

    if plat == "tiktok":
        ci = sp.creator_info_tiktok()
        opts = ci.get("privacy_level_options", [])
        if not privacy_level or privacy_level not in opts:
            raise HTTPException(400, f"privacy_level obbligatorio; ammessi: {opts}")
        if not d["no_logo_variant"]:
            raise HTTPException(400, "TikTok: serve variante SENZA logo (ToS). "
                                     "Rigenera il media con no_logo_variant=TRUE.")
        if commercial_disclosure and not (your_brand or branded_content):
            raise HTTPException(400, "Disclosure attiva: scegli 'Your Brand' e/o "
                                     "'Branded Content'.")
        if branded_content and privacy_level == "SELF_ONLY":
            raise HTTPException(400, "Branded Content non può essere Privato (SELF_ONLY).")
        if ci.get("comment_disabled") and allow_comment:
            raise HTTPException(400, "Commenti disabilitati lato creator.")
        if ci.get("duet_disabled") and allow_duet:
            raise HTTPException(400, "Duet disabilitato lato creator.")
        if ci.get("stitch_disabled") and allow_stitch:
            raise HTTPException(400, "Stitch disabilitato lato creator.")

    e = sp.esc
    sets = (
        f"caption='{e(caption)}', hashtags='{e(hashtags)}', "
        f"ai_generated={'true' if ai_generated else 'false'}, "
        f"allow_comment={'true' if allow_comment else 'false'}, "
        f"allow_duet={'true' if allow_duet else 'false'}, "
        f"allow_stitch={'true' if allow_stitch else 'false'}, "
        f"commercial_disclosure={'true' if commercial_disclosure else 'false'}, "
        f"your_brand={'true' if your_brand else 'false'}, "
        f"branded_content={'true' if branded_content else 'false'}, "
        f"status='approved', approved_at=NOW(), consent_at=NOW(), "
        f"consent_by='{e(user)}'"
    )
    if plat == "tiktok":
        sets += f", privacy_level='{e(privacy_level)}'"
    sp.qx(f"UPDATE {sp.SCHEMA} SET {sets} WHERE id={int(post_id)} "
          f"AND status IN ('draft','failed');")
    return RedirectResponse("/", status_code=303)


@app.post("/skip")
def skip(post_id: int = Form(...), user: str = Depends(auth)):
    sp.qx(f"UPDATE {sp.SCHEMA} SET status='skipped' WHERE id={int(post_id)};")
    return RedirectResponse("/", status_code=303)


@app.post("/bulk")
def bulk(
    action: str = Form(...),
    ids: List[int] = Form(default=[]),
    user: str = Depends(auth),
):
    """Operazioni multiple sui job selezionati.
    action: approve | skip | delete.
    - approve: status=approved (TikTok senza privacy → default SELF_ONLY,
      coerente col sandbox; il form per-post resta per l'audit dettagliato).
    - skip: status=skipped (non pubblicare / parcheggia).
    - delete: rimuove le righe (mai quelle in 'publishing' in volo).
    Il dispatcher pubblica SOLO gli 'approved' e solo se riabilitato.
    """
    clean = [int(i) for i in ids if str(i).strip().lstrip("-").isdigit()]
    if not clean:
        return RedirectResponse("/", status_code=303)
    idlist = ",".join(str(i) for i in clean)
    e = sp.esc
    if action == "delete":
        sp.qx(f"DELETE FROM {sp.SCHEMA} WHERE id IN ({idlist}) "
              f"AND status <> 'publishing';")
    elif action == "skip":
        sp.qx(f"UPDATE {sp.SCHEMA} SET status='skipped' "
              f"WHERE id IN ({idlist}) AND status <> 'publishing';")
    elif action == "approve":
        # TikTok: privacy obbligatoria per il publish → default SELF_ONLY
        # (sandbox ammette solo questo). IG/FB non la usano.
        sp.qx(
            f"UPDATE {sp.SCHEMA} SET status='approved', approved_at=NOW(), "
            f"consent_at=NOW(), consent_by='{e(user)}', "
            f"privacy_level=CASE WHEN platform='tiktok' "
            f"AND (privacy_level IS NULL OR privacy_level='') "
            f"THEN 'SELF_ONLY' ELSE privacy_level END "
            f"WHERE id IN ({idlist}) AND status IN ('draft','failed') "
            f"AND (platform<>'tiktok' OR no_logo_variant=true);")
    else:
        raise HTTPException(400, f"azione sconosciuta: {action}")
    return RedirectResponse("/", status_code=303)


@app.get("/healthz")
def healthz():
    return {"ok": True}
