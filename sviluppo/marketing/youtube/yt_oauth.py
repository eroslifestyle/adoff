#!/usr/bin/env python3
"""OAuth consent YouTube (riusa client desktop CWS_CLIENT_ID/SECRET).
Flusso loopback: avvia server locale, apre il browser, cattura il code, salva il refresh token.
Scope: upload video + gestione canale (banner/branding/thumbnail).

Uso: source ~/.secrets/adoff-stores.env && python3 yt_oauth.py
Output: ~/.secrets/adoff-youtube-oauth-refresh.txt
"""
import http.server
import json
import os
import subprocess
import sys
import urllib.parse

import requests

CLIENT_ID = os.environ.get("CWS_CLIENT_ID")
CLIENT_SECRET = os.environ.get("CWS_CLIENT_SECRET")
PORT = 8766
REDIRECT = f"http://127.0.0.1:{PORT}"
SCOPE = " ".join([
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
])
AUTH_EP = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_EP = "https://oauth2.googleapis.com/token"
OUT = "/home/mrxxx/.secrets/adoff-youtube-oauth-refresh.txt"

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERR: CWS_CLIENT_ID/SECRET non in env (source ~/.secrets/adoff-stores.env)")
    sys.exit(1)

params = urllib.parse.urlencode({
    "client_id": CLIENT_ID,
    "redirect_uri": REDIRECT,
    "response_type": "code",
    "scope": SCOPE,
    "access_type": "offline",
    "prompt": "select_account consent",
    "include_granted_scopes": "true",
})
auth_url = f"{AUTH_EP}?{params}"
print("AUTH_URL:" + auth_url, flush=True)
try:
    subprocess.Popen(["xdg-open", auth_url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except Exception:
    pass

holder = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        holder["code"] = q.get("code", [None])[0]
        holder["error"] = q.get("error", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        msg = "Autorizzazione ricevuta per AdOff su YouTube. Puoi chiudere questa scheda."
        if holder.get("error"):
            msg = "Errore: " + holder["error"]
        self.wfile.write(
            f"<html><body style='font-family:sans-serif;background:#0a0a1a;color:#fff;text-align:center;padding-top:80px'>"
            f"<h2>{msg}</h2></body></html>".encode())

    def log_message(self, *a):
        pass


srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
srv.timeout = 280
srv.handle_request()

if holder.get("error"):
    print("OAUTH_ERROR:" + holder["error"], flush=True)
    sys.exit(1)
code = holder.get("code")
if not code:
    print("NO_CODE (timeout o nessun redirect ricevuto)", flush=True)
    sys.exit(1)

resp = requests.post(TOKEN_EP, data={
    "code": code,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT,
    "grant_type": "authorization_code",
}, timeout=30)
data = resp.json()
if "refresh_token" not in data:
    print("ERR_TOKEN:" + json.dumps(data), flush=True)
    sys.exit(1)

with open(OUT, "w") as fh:
    fh.write(data["refresh_token"])
os.chmod(OUT, 0o600)
print("OK refresh token salvato in " + OUT, flush=True)
