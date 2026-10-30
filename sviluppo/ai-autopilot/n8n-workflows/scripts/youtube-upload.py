#!/usr/bin/env python3
"""AdOff YouTube uploader — upload resumable via YouTube Data API v3.

Invocato da n8n (workflow 13) via executeCommand:
    youtube-upload.py --job <job_id> [--variant B|A]

Legge la riga adoff_autopilot.youtube_queue, carica il video (video_b_path
default, fallback video_a_path), usa yt_title/yt_desc/yt_tags già rifiniti
dall'LLM nel workflow, poi marca published + log youtube_published.

OAuth: refresh token in .secrets/youtube_oauth.json (chmod 600, gitignored).
Bootstrap una-tantum: youtube-upload.py --auth   (vedi notebooklm-runbook.md).

Dipendenze (sul worker/leobox):
    pip install google-api-python-client google-auth-oauthlib google-auth-httplib2
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "adoff_autopilot.youtube_queue"
PUBLOG = "adoff_autopilot.youtube_published"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"]
LOCAL_FILES = Path("/opt/n8n/local-files")          # /files lato container
SECRETS = Path(__file__).resolve().parent.parent / ".secrets"
OAUTH_FILE = SECRETS / "youtube_oauth.json"          # {client_id,client_secret,refresh_token}
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


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


def container_to_host(p: str) -> Path:
    # video_*_path è salvato come /files/xxx ; host = /opt/n8n/local-files/xxx
    return LOCAL_FILES / Path(p).name


def get_credentials():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    if not OAUTH_FILE.exists():
        raise SystemExit(f"OAuth assente: {OAUTH_FILE}. Esegui --auth (runbook).")
    d = json.loads(OAUTH_FILE.read_text())
    creds = Credentials(
        token=None,
        refresh_token=d["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=d["client_id"],
        client_secret=d["client_secret"],
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return creds


def do_auth():
    """Bootstrap una-tantum: genera refresh_token. Richiede client_secret.json
    OAuth Desktop scaricato da Google Cloud Console (vedi runbook §OAuth)."""
    from google_auth_oauthlib.flow import InstalledAppFlow
    SECRETS.mkdir(parents=True, exist_ok=True)
    cs = SECRETS / "client_secret.json"
    if not cs.exists():
        raise SystemExit(f"Manca {cs} (OAuth Desktop client da Google Cloud).")
    flow = InstalledAppFlow.from_client_secrets_file(str(cs), SCOPES)
    creds = flow.run_console()  # headless: incolla codice da URL
    info = json.loads(cs.read_text())["installed"]
    OAUTH_FILE.write_text(json.dumps({
        "client_id": info["client_id"],
        "client_secret": info["client_secret"],
        "refresh_token": creds.refresh_token,
    }, indent=2))
    OAUTH_FILE.chmod(0o600)
    print(f"[OK] refresh token salvato in {OAUTH_FILE}")


def upload(job_id, variant):
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    row = q(
        f"SELECT COALESCE(video_b_path,'')||'~'||COALESCE(video_a_path,'')||'~'||"
        f"COALESCE(yt_title,title_hint,'AdOff')||'~'||COALESCE(yt_desc,'')||'~'||"
        f"COALESCE(array_to_string(yt_tags,','),'')||'~'||COALESCE(lang,'it') "
        f"FROM {SCHEMA} WHERE job_id='{esc(job_id)}' AND status='done' "
        f"AND published=false;")
    if not row:
        raise SystemExit(f"job {job_id} non trovato/non pronto/già pubblicato")
    vb, va, title, desc, tags_s, lang = row.split("~", 5)
    src = vb if (variant == "B" and vb) else (va or vb)
    if not src:
        raise SystemExit("nessun path video disponibile")
    path = container_to_host(src)
    if not path.exists():
        raise SystemExit(f"file assente: {path}")
    tags = [t for t in tags_s.split(",") if t]

    creds = get_credentials()
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    body = {
        "snippet": {"title": title[:100], "description": desc[:4900],
                    "tags": tags[:30], "categoryId": "28",
                    "defaultLanguage": lang, "defaultAudioLanguage": lang},
        "status": {"privacyStatus": "private",          # safe default
                   "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(str(path), chunksize=8 * 1024 * 1024, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    resp = None
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            print(f"  upload {int(status.progress()*100)}%")
    vid = resp["id"]
    url = f"https://youtu.be/{vid}"
    used = "B" if src == vb and vb else "A"
    qx(f"UPDATE {SCHEMA} SET published=true, yt_video_id='{esc(vid)}', "
       f"published_at=NOW() WHERE job_id='{esc(job_id)}';"
       f"INSERT INTO {PUBLOG} (job_id,yt_video_id,yt_url,title,variant) "
       f"VALUES ('{esc(job_id)}','{esc(vid)}','{esc(url)}','{esc(title)}',"
       f"'{used}');")
    print(json.dumps({"job_id": job_id, "yt_video_id": vid, "url": url,
                      "variant": used,
                      "at": datetime.now(timezone.utc).isoformat()}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--job")
    ap.add_argument("--variant", default="B", choices=["A", "B"])
    ap.add_argument("--auth", action="store_true")
    a = ap.parse_args()
    if a.auth:
        do_auth()
    elif a.job:
        upload(a.job, a.variant)
    else:
        ap.print_help()
        sys.exit(1)
