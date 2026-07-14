#!/usr/bin/env python3
"""AdOff — Meta bootstrap: da 1 token a .secrets/meta_app.json completo.

Tu fai SOLO i 3 click inevitabili su developers.facebook.com /
business.facebook.com (creare app, creare System User, generare token).
Poi questo script scopre da solo via Graph API:
  - la Pagina FB del brand (fb_page_id) + relativo Page access token
  - l'account Instagram Business collegato (ig_user_id)
e scrive .secrets/meta_app.json (chmod 600), pronto per la thin admin UI.

USO:
  # verifica un token e mostra cosa vede (nessuna scrittura)
  meta_bootstrap.py --probe --token "<SYSTEM_USER_TOKEN>"

  # scrive .secrets/meta_app.json (sceglie la Pagina se ce n'è una sola,
  # altrimenti chiede quale con --page-id)
  meta_bootstrap.py --write --token "<SYSTEM_USER_TOKEN>" \\
      [--app-id <id> --app-secret <secret>] [--page-id <id>] \\
      [--graph-version v22.0]

Il token può essere:
  - System User token long-lived (consigliato, non scade) — vedi runbook A4
  - oppure un User token (verrà solo usato per scoprire gli ID; per la
    produzione usa il System User token).

Dipendenze: pip install requests
"""
import argparse
import json
import sys
from pathlib import Path

import requests

SECRETS = Path(__file__).resolve().parent.parent / ".secrets"
OUT = SECRETS / "meta_app.json"
TIMEOUT = 30


def g(gv, path, token, **params):
    params["access_token"] = token
    r = requests.get(f"https://graph.facebook.com/{gv}/{path}",
                     params=params, timeout=TIMEOUT)
    try:
        j = r.json()
    except Exception:
        r.raise_for_status()
        raise
    if isinstance(j, dict) and j.get("error"):
        raise SystemExit(f"Graph error: {json.dumps(j['error'], indent=2)}")
    return j


def discover(gv, token):
    me = g(gv, "me", token, fields="id,name")
    pages = g(gv, "me/accounts", token,
              fields="id,name,access_token,instagram_business_account").get("data", [])
    return me, pages


def probe(gv, token):
    me, pages = discover(gv, token)
    print(f"Identità token: {me.get('name')} (id={me.get('id')})")
    if not pages:
        print("⚠️  Nessuna Pagina visibile da questo token. Assicurati che il "
              "System User abbia la Pagina assegnata come asset (runbook A4).")
        return
    print(f"Pagine visibili: {len(pages)}")
    for p in pages:
        iga = p.get("instagram_business_account", {})
        igid = iga.get("id") if isinstance(iga, dict) else None
        print(f"  • {p['name']}  fb_page_id={p['id']}  "
              f"ig_business={igid or 'NON COLLEGATO'}")
        if igid:
            ig = g(gv, igid, token,
                   fields="username,followers_count,name")
            print(f"      IG @{ig.get('username')} "
                  f"({ig.get('followers_count', 0)} follower)")


def write(gv, token, page_id, app_id, app_secret):
    me, pages = discover(gv, token)
    if not pages:
        raise SystemExit("Nessuna Pagina visibile: assegna la Pagina al System "
                         "User (runbook A4) e rigenera il token.")
    if page_id:
        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            raise SystemExit(f"page-id {page_id} non tra le Pagine visibili: "
                             f"{[p['id'] for p in pages]}")
    elif len(pages) == 1:
        page = pages[0]
    else:
        raise SystemExit("Più Pagine visibili — specifica --page-id tra: " +
                         ", ".join(f"{p['id']}({p['name']})" for p in pages))

    iga = page.get("instagram_business_account") or {}
    ig_id = iga.get("id") if isinstance(iga, dict) else None
    if not ig_id:
        raise SystemExit(f"La Pagina '{page['name']}' non ha un account "
                         "Instagram Business collegato. Collega l'IG Business "
                         "alla Pagina (runbook A0/Prerequisiti) e riprova.")

    data = {
        "system_user_token": token,
        "ig_user_id": str(ig_id),
        "fb_page_id": str(page["id"]),
        "fb_page_token": page.get("access_token", ""),
        "graph_version": gv,
    }
    if app_id:
        data["app_id"] = app_id
    if app_secret:
        data["app_secret"] = app_secret

    SECRETS.mkdir(parents=True, exist_ok=True)
    try:
        SECRETS.chmod(0o700)
    except OSError:
        pass
    OUT.write_text(json.dumps(data, indent=2))
    OUT.chmod(0o600)
    masked = dict(data)
    masked["system_user_token"] = data["system_user_token"][:8] + "…"
    if masked.get("fb_page_token"):
        masked["fb_page_token"] = data["fb_page_token"][:8] + "…"
    if masked.get("app_secret"):
        masked["app_secret"] = "…"
    print(f"[OK] scritto {OUT} (chmod 600):")
    print(json.dumps(masked, indent=2))
    print("\nProssimo test: apri la thin admin UI e seleziona un job IG/FB → "
          "verrà chiamato page_info_meta() con questi valori.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="AdOff Meta bootstrap")
    ap.add_argument("--token", required=True, help="System User / User token")
    ap.add_argument("--probe", action="store_true",
                    help="solo diagnostica, nessuna scrittura")
    ap.add_argument("--write", action="store_true",
                    help="scrive .secrets/meta_app.json")
    ap.add_argument("--page-id", help="se più Pagine visibili")
    ap.add_argument("--app-id")
    ap.add_argument("--app-secret")
    ap.add_argument("--graph-version", default="v22.0")
    a = ap.parse_args()
    if not (a.probe or a.write):
        ap.error("usa --probe oppure --write")
    if a.probe:
        probe(a.graph_version, a.token)
    if a.write:
        write(a.graph_version, a.token, a.page_id, a.app_id, a.app_secret)
