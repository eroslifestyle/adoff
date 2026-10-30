#!/usr/bin/env python3
"""AdOff — TikTok OAuth bootstrap (Login Kit → Content Posting API).

Flusso una-tantum per ottenere access_token/refresh_token/open_id
dell'account brand (in sandbox: l'account dev'essere un Target User
autorizzato del sandbox). Salva .secrets/tiktok_oauth.json (chmod 600).

USO
  1) genera l'URL di autorizzazione:
       tiktok_oauth.py --auth-url
     apri l'URL nel browser, accedi con l'account TikTok del brand
     (quello aggiunto come Target User del sandbox), autorizza.
  2) verrai rediretto a redirect_uri?code=XXX&scopes=...&state=...
     (la pagina può dare 404: NON importa, conta solo l'URL nella barra).
     Copia tutto l'URL (o solo il valore di code=) e:
       tiktok_oauth.py --exchange "<url_o_code>"
  3) (rinnovo, se serve)  tiktok_oauth.py --refresh

Legge client_key/secret/redirect_uri da .secrets/tiktok_app.json.
Dipendenze: pip install requests
"""
import argparse
import json
import secrets as pysecrets
import sys
import urllib.parse as up
from pathlib import Path

import requests

SECRETS = Path(__file__).resolve().parent.parent / ".secrets"
APP = SECRETS / "tiktok_app.json"
OUT = SECRETS / "tiktok_oauth.json"
AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN = "https://open.tiktokapis.com/v2/oauth/token/"
TIMEOUT = 30


def _app():
    if not APP.exists():
        raise SystemExit(f"Manca {APP} (client_key/secret).")
    return json.loads(APP.read_text())


def auth_url():
    a = _app()
    state = pysecrets.token_urlsafe(16)
    q = {
        "client_key": a["client_key"],
        "scope": a.get("scopes", "user.info.basic,video.publish,video.upload"),
        "response_type": "code",
        "redirect_uri": a["redirect_uri"],
        "state": state,
    }
    url = AUTHORIZE + "?" + up.urlencode(q)
    print("\n1) Apri questo URL nel browser (accedi con l'account brand "
          "= Target User del sandbox) e autorizza:\n")
    print(url)
    print("\n2) Dopo l'autorizzazione sarai rediretto a:")
    print(f"   {a['redirect_uri']}?code=...&scopes=...&state={state}")
    print("   (404 sulla pagina = NORMALE: conta solo l'URL nella barra)\n")
    print("3) Poi:  tiktok_oauth.py --exchange \"<URL_completo_o_code>\"\n")


def _extract_code(s: str) -> str:
    s = s.strip()
    if s.startswith("http"):
        qs = up.parse_qs(up.urlparse(s).query)
        if "error" in qs:
            raise SystemExit(f"Authorize error: {qs}")
        if "code" not in qs:
            raise SystemExit(f"Nessun 'code' nell'URL: {qs}")
        # parse_qs già URL-decodifica e isola il param: il code TikTok
        # contiene legittimamente '*' e '!', NON va troncato.
        return qs["code"][0]
    return s


def exchange(arg: str):
    a = _app()
    code = _extract_code(arg)
    r = requests.post(TOKEN, headers={
        "Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_key": a["client_key"],
            "client_secret": a["client_secret"],
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": a["redirect_uri"],
        }, timeout=TIMEOUT)
    j = r.json()
    if "access_token" not in j:
        raise SystemExit(f"Exchange fallito: {json.dumps(j, indent=2)}")
    _save(a, j)


def refresh():
    a = _app()
    if not OUT.exists():
        raise SystemExit(f"Manca {OUT}: fai prima --auth-url/--exchange.")
    cur = json.loads(OUT.read_text())
    r = requests.post(TOKEN, headers={
        "Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_key": a["client_key"],
            "client_secret": a["client_secret"],
            "grant_type": "refresh_token",
            "refresh_token": cur["refresh_token"],
        }, timeout=TIMEOUT)
    j = r.json()
    if "access_token" not in j:
        raise SystemExit(f"Refresh fallito: {json.dumps(j, indent=2)}")
    _save(a, j, prev=cur)


def _save(app, tok, prev=None):
    data = {
        "client_key": app["client_key"],
        "access_token": tok["access_token"],
        "refresh_token": tok.get("refresh_token",
                                  (prev or {}).get("refresh_token", "")),
        "open_id": tok.get("open_id", (prev or {}).get("open_id", "")),
        "scope": tok.get("scope", ""),
        "expires_in": tok.get("expires_in"),
        "env": app.get("env", "sandbox"),
    }
    SECRETS.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2))
    OUT.chmod(0o600)
    m = dict(data)
    m["access_token"] = data["access_token"][:8] + "…"
    m["refresh_token"] = (data["refresh_token"][:8] + "…") if data["refresh_token"] else ""
    print(f"[OK] scritto {OUT} (chmod 600):")
    print(json.dumps(m, indent=2))
    print("\nProssimo: test creator_info via social_publish.creator_info_tiktok()")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="AdOff TikTok OAuth bootstrap")
    ap.add_argument("--auth-url", action="store_true")
    ap.add_argument("--exchange", metavar="URL_OR_CODE")
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    if a.auth_url:
        auth_url()
    elif a.exchange:
        exchange(a.exchange)
    elif a.refresh:
        refresh()
    else:
        ap.print_help()
        sys.exit(1)
