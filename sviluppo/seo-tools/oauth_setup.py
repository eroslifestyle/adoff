#!/usr/bin/env python3
"""
Ottiene un refresh token OAuth per la Search Console API riusando il client
desktop esistente (CWS_CLIENT_ID/SECRET). Flusso loopback: avvia un server
locale, l'utente autorizza nel browser, cattura il code e lo scambia.

Scrive il refresh token in ~/.secrets/adoff-gsc-oauth-refresh.txt
Uso: source ~/.secrets/adoff-stores.env && python3 oauth_setup.py
"""
import http.server
import json
import os
import sys
import urllib.parse

import requests

CLIENT_ID = os.environ.get("CWS_CLIENT_ID")
CLIENT_SECRET = os.environ.get("CWS_CLIENT_SECRET")
PORT = 8765
REDIRECT = f"http://127.0.0.1:{PORT}"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
AUTH_EP = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_EP = "https://oauth2.googleapis.com/token"
OUT = "/home/mrxxx/.secrets/adoff-gsc-oauth-refresh.txt"

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERR: CWS_CLIENT_ID/SECRET non in env (source ~/.secrets/adoff-stores.env)")
    sys.exit(1)

params = urllib.parse.urlencode({
    "client_id": CLIENT_ID,
    "redirect_uri": REDIRECT,
    "response_type": "code",
    "scope": SCOPE,
    "access_type": "offline",
    "prompt": "consent",
})
print("AUTH_URL:" + f"{AUTH_EP}?{params}", flush=True)

holder = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        holder["code"] = q.get("code", [None])[0]
        holder["error"] = q.get("error", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        msg = "Autorizzazione ricevuta. Puoi chiudere questa scheda e tornare al terminale."
        if holder.get("error"):
            msg = "Errore: " + holder["error"]
        self.wfile.write(f"<html><body style='font-family:sans-serif'><h2>{msg}</h2></body></html>".encode())

    def log_message(self, *a):
        pass


srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
srv.timeout = 300
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
