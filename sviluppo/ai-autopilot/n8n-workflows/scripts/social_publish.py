#!/usr/bin/env python3
"""AdOff — social publisher (Instagram + Facebook + TikTok).

Due ruoli:
  1. Libreria importata dalla thin admin UI (admin-ui/app.py):
       creator_info_tiktok(), page_info_meta(), publish_post(row)
  2. CLI dispatcher (cron/n8n): pubblica i job approvati dall'umano.
       social_publish.py --dispatch [--platform tiktok|instagram|facebook]
       social_publish.py --once <post_id>

Pattern allineato a youtube-upload.py:
  - Postgres via  docker exec -i n8n-postgres psql -U n8n -d n8n
  - Secrets JSON in n8n-workflows/.secrets/ (chmod 600, gitignored)
  - File media: host /opt/n8n/local-files  ==  container /files

Secrets attesi (.secrets/):
  meta_app.json     {"system_user_token": "...", "ig_user_id": "...",
                     "fb_page_id": "...", "fb_page_token": "...",
                     "graph_version": "v22.0"}
  tiktok_oauth.json {"client_key": "...", "access_token": "...",
                     "refresh_token": "...", "open_id": "..."}

Dipendenze (sul worker/leobox):  pip install requests
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

SCHEMA = "adoff_autopilot.social_posts"
PUBLOG = "adoff_autopilot.social_published"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]
LOCAL_FILES = Path("/opt/n8n/local-files")
SECRETS = Path(__file__).resolve().parent.parent / ".secrets"
HTTP_TIMEOUT = 60

TIKTOK_BASE = "https://open.tiktokapis.com/v2"
TT_CREATOR_INFO = f"{TIKTOK_BASE}/post/publish/creator_info/query/"
TT_VIDEO_INIT = f"{TIKTOK_BASE}/post/publish/video/init/"
TT_INBOX_INIT = f"{TIKTOK_BASE}/post/publish/inbox/video/init/"
TT_STATUS = f"{TIKTOK_BASE}/post/publish/status/fetch/"
TT_REFRESH = f"{TIKTOK_BASE}/oauth/token/"

# Modalità publish TikTok:
#  - "inbox"  → video va in draft inbox dell'account, creator finalizza in app
#               (aggiunge traccia trending al upload, vedi feedback resa video).
#  - "direct" → publish diretto via API (no catalogo audio nativo).
# Default 'inbox' coerente con scelta utente 2026-05-20.
TIKTOK_MODE = os.environ.get("TIKTOK_MODE", "inbox").lower()
# Stati terminali di successo per /status/fetch (TikTok variabile per modalità)
TT_OK_STATES = ("PUBLISH_COMPLETE", "SEND_TO_USER_INBOX")


# ----------------------------------------------------------------------- DB
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


def secret(name):
    f = SECRETS / name
    if not f.exists():
        raise SystemExit(f"Secret assente: {f} (vedi social-api-authorization-runbook.md)")
    return json.loads(f.read_text())


def container_to_host(p: str) -> Path:
    p = str(p)
    if p.startswith("/opt/n8n/local-files"):
        return Path(p)
    return LOCAL_FILES / Path(p).name


def _now():
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------- TIKTOK
def _tiktok_token():
    """Restituisce access_token valido, refresh se il token init fallisce 401."""
    return secret("tiktok_oauth.json")["access_token"]


def _tiktok_refresh():
    d = secret("tiktok_oauth.json")
    app = secret("tiktok_app.json")  # {"client_key","client_secret"}
    r = requests.post(TT_REFRESH, data={
        "client_key": app["client_key"],
        "client_secret": app["client_secret"],
        "grant_type": "refresh_token",
        "refresh_token": d["refresh_token"],
    }, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    tok = r.json()
    d["access_token"] = tok["access_token"]
    d["refresh_token"] = tok.get("refresh_token", d["refresh_token"])
    f = SECRETS / "tiktok_oauth.json"
    f.write_text(json.dumps(d, indent=2))
    f.chmod(0o600)
    return d["access_token"]


def creator_info_tiktok():
    """B3 hard requirement: chiamato dalla UI PRIMA di ogni post.
    Ritorna nickname, avatar, privacy_level_options, max duration, toggle stato.
    """
    tok = _tiktok_token()
    r = requests.post(TT_CREATOR_INFO,
                       headers={"Authorization": f"Bearer {tok}",
                                "Content-Type": "application/json; charset=UTF-8"},
                       timeout=HTTP_TIMEOUT)
    if r.status_code == 401:
        tok = _tiktok_refresh()
        r = requests.post(TT_CREATOR_INFO,
                          headers={"Authorization": f"Bearer {tok}",
                                   "Content-Type": "application/json; charset=UTF-8"},
                          timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    data = r.json().get("data", {})
    return {
        "nickname": data.get("creator_nickname"),
        "username": data.get("creator_username"),
        "avatar_url": data.get("creator_avatar_url"),
        "privacy_level_options": data.get("privacy_level_options", []),
        "comment_disabled": data.get("comment_disabled", False),
        "duet_disabled": data.get("duet_disabled", False),
        "stitch_disabled": data.get("stitch_disabled", False),
        "max_video_post_duration_sec": data.get("max_video_post_duration_sec"),
    }


# TikTok playlist (best-effort, Playwright su Studio Web).
# L'API Content Posting non espone playlist_id (verifica doc 2026-05-19).
# Usiamo tiktok_playlist.py via venv Playwright dedicato, in subprocess con timeout.
_PLAYLIST_PY = os.environ.get(
    "TIKTOK_PLAYLIST_PY",
    str(Path.home() / ".cache/adoff-playwright-venv/bin/python"),
)
_PLAYLIST_TIMEOUT_S = int(os.environ.get("TIKTOK_PLAYLIST_TIMEOUT", "120"))


def _tiktok_assign_playlist_safe(pid: str, lang: str) -> None:
    """Best-effort: assegna il video alla playlist nativa della lingua via Playwright.
    Mai bloccante: tutte le eccezioni vengono catturate e loggate, la pubblicazione
    resta valida anche se l'assegnazione playlist fallisce."""
    if not lang:
        return
    script = Path(__file__).resolve().parent / "tiktok_playlist.py"
    if not Path(_PLAYLIST_PY).exists() or not script.exists():
        print(f"[tt-playlist] SKIP: playwright venv o script mancante", flush=True)
        return
    try:
        r = subprocess.run(
            [_PLAYLIST_PY, str(script), "assign", pid, lang],
            timeout=_PLAYLIST_TIMEOUT_S, capture_output=True, text=True,
        )
        tail = (r.stdout + r.stderr).strip().splitlines()[-2:]
        print(f"[tt-playlist] pid={pid} lang={lang} rc={r.returncode} {tail}",
              flush=True)
    except subprocess.TimeoutExpired:
        print(f"[tt-playlist] pid={pid} lang={lang} TIMEOUT >{_PLAYLIST_TIMEOUT_S}s",
              flush=True)
    except Exception as e:
        print(f"[tt-playlist] pid={pid} lang={lang} ERR {e!r}", flush=True)


def _publish_tiktok(row):
    """TikTok upload. Due regimi (env TIKTOK_MODE):
      - inbox  (default): video va nel draft inbox app, creator aggiunge
                          traccia trending + publish dall'app (regime B).
      - direct: publish via API senza intervento (regime A).
    row = dict colonne social_posts."""
    tok = _tiktok_token()
    path = container_to_host(row["media_path"])
    if not path.exists():
        raise RuntimeError(f"file assente: {path}")
    if row.get("no_logo_variant") is not True:
        raise RuntimeError("TikTok: vietato pubblicare media con logo/watermark "
                           "(ToS). Richiesta variante no_logo_variant=TRUE.")

    inbox = TIKTOK_MODE == "inbox"
    size = path.stat().st_size

    if inbox:
        # Inbox: SOLO source_info, niente post_info (lo setta il creator in app)
        init = {
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": size,
                "chunk_size": size,
                "total_chunk_count": 1,
            },
        }
        endpoint = TT_INBOX_INIT
    else:
        # Direct: privacy_level obbligatorio, post_info al completo
        if not row.get("privacy_level"):
            raise RuntimeError("TikTok direct: privacy_level obbligatorio "
                               "(nessun default).")
        post_info = {
            "title": (row.get("caption") or "")[:2200],
            "privacy_level": row["privacy_level"],
            "disable_comment": not row.get("allow_comment", False),
            "disable_duet": not row.get("allow_duet", False),
            "disable_stitch": not row.get("allow_stitch", False),
        }
        if row.get("commercial_disclosure"):
            post_info["brand_content_toggle"] = bool(row.get("branded_content"))
            post_info["brand_organic_toggle"] = bool(row.get("your_brand"))
        init = {
            "post_info": post_info,
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": size,
                "chunk_size": size,
                "total_chunk_count": 1,
            },
        }
        endpoint = TT_VIDEO_INIT

    r = requests.post(endpoint,
                      headers={"Authorization": f"Bearer {tok}",
                               "Content-Type": "application/json; charset=UTF-8"},
                      data=json.dumps(init), timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    d = r.json()["data"]
    publish_id, upload_url = d["publish_id"], d["upload_url"]

    with open(path, "rb") as fh:
        up = requests.put(upload_url, data=fh.read(), timeout=300, headers={
            "Content-Type": "video/mp4",
            "Content-Range": f"bytes 0-{size - 1}/{size}",
        })
    up.raise_for_status()

    # poll stato (audit: "elaborazione richiede qualche minuto")
    for _ in range(40):
        time.sleep(6)
        s = requests.post(TT_STATUS,
                          headers={"Authorization": f"Bearer {tok}",
                                   "Content-Type": "application/json; charset=UTF-8"},
                          data=json.dumps({"publish_id": publish_id}),
                          timeout=HTTP_TIMEOUT)
        s.raise_for_status()
        st = s.json()["data"]
        status = st.get("status")
        if status in TT_OK_STATES:
            pid = (st.get("publicaly_available_post_id") or [publish_id])[0]
            if status == "PUBLISH_COMPLETE":
                # Solo regime direct: video già pubblico → aggiungi a playlist lingua
                _tiktok_assign_playlist_safe(str(pid), row.get("lang") or "")
                return str(pid), f"https://www.tiktok.com/@{row.get('account_ref','')}/video/{pid}"
            # SEND_TO_USER_INBOX = regime B: video nell'inbox app, creator
            # finalizza (aggiunge traccia trending + publish). Niente URL pubblico.
            print(f"[tt-inbox] pid={publish_id} → draft nell'inbox: "
                  f"il creator deve aprire l'app TikTok, aggiungere il sound "
                  f"trending e pubblicare.", flush=True)
            return str(publish_id), f"tiktok-inbox://draft/{publish_id}"
        if status in ("FAILED", "PUBLISH_FAILED"):
            raise RuntimeError(f"TikTok publish FAILED: {st}")
    raise RuntimeError(f"TikTok publish timeout (publish_id={publish_id})")


# --------------------------------------------------------------------- META
def _graph(meta):
    return f"https://graph.facebook.com/{meta.get('graph_version', 'v22.0')}"


def page_info_meta():
    """Info Pagina FB + account IG Business (per la UI / verifica collegamento)."""
    meta = secret("meta_app.json")
    g = _graph(meta)
    out = {}
    rp = requests.get(f"{g}/{meta['fb_page_id']}",
                      params={"fields": "name,username,fan_count",
                              "access_token": meta["fb_page_token"]},
                      timeout=HTTP_TIMEOUT)
    rp.raise_for_status()
    out["facebook"] = rp.json()
    ri = requests.get(f"{g}/{meta['ig_user_id']}",
                      params={"fields": "username,name,profile_picture_url,followers_count",
                              "access_token": meta["system_user_token"]},
                      timeout=HTTP_TIMEOUT)
    ri.raise_for_status()
    out["instagram"] = ri.json()
    return out


def _publish_instagram(row, meta):
    """IG Business: container -> publish. Richiede media_public_url."""
    g = _graph(meta)
    url = row.get("media_public_url")
    if not url:
        raise RuntimeError("Instagram: media_public_url obbligatorio (IG scarica da URL pubblico).")
    params = {"caption": _full_caption(row), "access_token": meta["system_user_token"]}
    if row["media_type"] == "video":
        params["media_type"] = "REELS"
        params["video_url"] = url
    else:
        params["image_url"] = url
    c = requests.post(f"{g}/{meta['ig_user_id']}/media", data=params, timeout=HTTP_TIMEOUT)
    c.raise_for_status()
    creation_id = c.json()["id"]

    if row["media_type"] == "video":
        for _ in range(40):
            time.sleep(6)
            st = requests.get(f"{g}/{creation_id}",
                              params={"fields": "status_code",
                                      "access_token": meta["system_user_token"]},
                              timeout=HTTP_TIMEOUT)
            st.raise_for_status()
            if st.json().get("status_code") == "FINISHED":
                break
            if st.json().get("status_code") == "ERROR":
                raise RuntimeError(f"IG container ERROR: {st.json()}")
        else:
            raise RuntimeError("IG container timeout")

    p = requests.post(f"{g}/{meta['ig_user_id']}/media_publish",
                      data={"creation_id": creation_id,
                            "access_token": meta["system_user_token"]},
                      timeout=HTTP_TIMEOUT)
    p.raise_for_status()
    mid = p.json()["id"]
    perm = requests.get(f"{g}/{mid}",
                        params={"fields": "permalink",
                                "access_token": meta["system_user_token"]},
                        timeout=HTTP_TIMEOUT)
    link = perm.json().get("permalink", f"https://instagram.com/p/{mid}") if perm.ok else ""
    return str(mid), link


def _publish_facebook(row, meta):
    """Pagina FB: video da file_url o foto da url. Usa page token."""
    g = _graph(meta)
    cap = _full_caption(row)
    if row["media_type"] == "video":
        url = row.get("media_public_url")
        if not url:
            raise RuntimeError("Facebook video: media_public_url obbligatorio.")
        r = requests.post(f"{g}/{meta['fb_page_id']}/videos",
                          data={"file_url": url, "description": cap,
                                "access_token": meta["fb_page_token"]},
                          timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        vid = r.json()["id"]
        return str(vid), f"https://facebook.com/{vid}"
    url = row.get("media_public_url")
    if not url:
        raise RuntimeError("Facebook photo: media_public_url obbligatorio.")
    r = requests.post(f"{g}/{meta['fb_page_id']}/photos",
                      data={"url": url, "message": cap,
                            "access_token": meta["fb_page_token"]},
                      timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    j = r.json()
    pid = j.get("post_id") or j["id"]
    return str(pid), f"https://facebook.com/{pid}"


# ------------------------------------------------------------------- common
def _full_caption(row):
    cap = (row.get("caption") or "").strip()
    tags = (row.get("hashtags") or "").strip()
    parts = [cap]
    if row.get("ai_generated"):
        parts.append("")  # AI-label gestito anche a livello piattaforma
    if tags:
        parts.append(tags)
    return "\n\n".join(p for p in parts if p != "" or p == parts[0]).strip()


def publish_post(row: dict):
    """Pubblica un job (dict colonne). Ritorna (platform_post_id, url)."""
    plat = row["platform"]
    if plat == "tiktok":
        return _publish_tiktok(row)
    meta = secret("meta_app.json")
    if plat == "instagram":
        return _publish_instagram(row, meta)
    if plat == "facebook":
        return _publish_facebook(row, meta)
    raise RuntimeError(f"piattaforma sconosciuta: {plat}")


# ---------------------------------------------------------------- dispatcher
COLS = ("id,brand,platform,account_ref,media_type,media_path,media_public_url,"
        "no_logo_variant,caption,hashtags,lang,privacy_level,allow_comment,"
        "allow_duet,allow_stitch,commercial_disclosure,your_brand,"
        "branded_content,ai_generated,consent_by")


def _row_to_dict(line):
    v = line.split("|")
    keys = COLS.split(",")
    d = dict(zip(keys, v))
    for b in ("no_logo_variant", "allow_comment", "allow_duet", "allow_stitch",
              "commercial_disclosure", "your_brand", "branded_content",
              "ai_generated"):
        d[b] = d.get(b) == "t"
    d["id"] = int(d["id"])
    return d


def _claim_one(platform=None):
    where = "status='approved'"
    if platform:
        where += f" AND platform='{esc(platform)}'"
    sql = (f"UPDATE {SCHEMA} SET status='publishing', publishing_at=NOW() "
           f"WHERE id = (SELECT id FROM {SCHEMA} WHERE {where} "
           f"ORDER BY approved_at FOR UPDATE SKIP LOCKED LIMIT 1) "
           f"RETURNING {COLS};")
    out = q(sql)
    return _row_to_dict(out) if out else None


def dispatch(platform=None, max_jobs=10):
    done = 0
    while done < max_jobs:
        row = _claim_one(platform)
        if not row:
            break
        pid = row["id"]
        try:
            ppid, url = publish_post(row)
            qx(f"UPDATE {SCHEMA} SET status='published', published_at=NOW(), "
               f"platform_post_id='{esc(ppid)}', published_url='{esc(url)}' "
               f"WHERE id={pid};"
               f"INSERT INTO {PUBLOG} (post_id,platform,account_ref,"
               f"platform_post_id,published_url,caption,consent_by) VALUES "
               f"({pid},'{esc(row['platform'])}','{esc(row['account_ref'])}',"
               f"'{esc(ppid)}','{esc(url)}','{esc((row.get('caption') or '')[:500])}',"
               f"'{esc(row.get('consent_by') or '')}');")
            print(json.dumps({"id": pid, "platform": row["platform"],
                              "post_id": ppid, "url": url, "at": _now()}))
        except Exception as e:  # noqa: BLE001 - log e continua col prossimo job
            qx(f"UPDATE {SCHEMA} SET status='failed', error='{esc(str(e)[:900])}', "
               f"retry_count=retry_count+1 WHERE id={pid};")
            print(json.dumps({"id": pid, "error": str(e)[:300]}), file=sys.stderr)
        done += 1
    return done


def publish_once(post_id):
    out = q(f"SELECT {COLS} FROM {SCHEMA} WHERE id={int(post_id)} "
            f"AND status IN ('approved','failed');")
    if not out:
        raise SystemExit(f"post {post_id} non trovato/non in approved|failed")
    row = _row_to_dict(out)
    qx(f"UPDATE {SCHEMA} SET status='publishing', publishing_at=NOW() WHERE id={row['id']};")
    try:
        ppid, url = publish_post(row)
        qx(f"UPDATE {SCHEMA} SET status='published', published_at=NOW(), "
           f"platform_post_id='{esc(ppid)}', published_url='{esc(url)}' "
           f"WHERE id={row['id']};"
           f"INSERT INTO {PUBLOG} (post_id,platform,account_ref,platform_post_id,"
           f"published_url,caption,consent_by) VALUES ({row['id']},"
           f"'{esc(row['platform'])}','{esc(row['account_ref'])}','{esc(ppid)}',"
           f"'{esc(url)}','{esc((row.get('caption') or '')[:500])}',"
           f"'{esc(row.get('consent_by') or '')}');")
        print(json.dumps({"id": row["id"], "post_id": ppid, "url": url}))
    except Exception as e:  # noqa: BLE001
        qx(f"UPDATE {SCHEMA} SET status='failed', error='{esc(str(e)[:900])}', "
           f"retry_count=retry_count+1 WHERE id={row['id']};")
        raise


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="AdOff social publisher / dispatcher")
    ap.add_argument("--dispatch", action="store_true",
                    help="pubblica i job approvati")
    ap.add_argument("--platform", choices=["tiktok", "instagram", "facebook"])
    ap.add_argument("--once", type=int, help="pubblica un singolo post_id")
    ap.add_argument("--max", type=int, default=10)
    a = ap.parse_args()
    if a.once:
        publish_once(a.once)
    elif a.dispatch:
        n = dispatch(a.platform, a.max)
        print(f"[dispatch] {n} job processati", file=sys.stderr)
    else:
        ap.print_help()
        sys.exit(1)
