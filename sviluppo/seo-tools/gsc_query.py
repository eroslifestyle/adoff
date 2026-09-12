#!/usr/bin/env python3
"""
GSC Search Analytics fetcher per AdOff — autenticazione via service account
(JWT firmato con requests + pyjwt, nessuna libreria google-api-* richiesta).

Setup (vedi README-SETUP.md):
  1. Crea un service account nel progetto GCP AdOff + scarica la JSON key
  2. Abilita "Google Search Console API" nel progetto
  3. In Search Console aggiungi l'email del service account come utente (Full o Restricted)
  4. Salva il path della JSON key in ~/.secrets/adoff-stores.env come ADOFF_GSC_SA_JSON

Uso:
  python3 gsc_query.py                      # ultimi 28 giorni, top query + top page
  python3 gsc_query.py --days 90 --dim query --limit 200
  python3 gsc_query.py --dim page
  python3 gsc_query.py --opportunities      # query in pos 5-20 da spingere
  python3 gsc_query.py --json > out.json    # output grezzo per pipeline
"""
import argparse
import json
import os
import sys
import time
from datetime import date, timedelta

import jwt
import requests

SITE_URL = "sc-domain:adoff.app"  # proprieta' Dominio (verifica DNS)
TOKEN_URI = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
API = "https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
SA_JSON_ENV = "ADOFF_GSC_SA_JSON"
OAUTH_REFRESH_ENV = "ADOFF_GSC_OAUTH_REFRESH"


def get_access_token():
    """OAuth refresh token (preferito, account proprietario) con fallback su service account."""
    refresh = os.environ.get(OAUTH_REFRESH_ENV)
    if refresh:
        return _token_from_refresh(refresh)
    sa_path = os.environ.get(SA_JSON_ENV)
    if sa_path and os.path.isfile(sa_path):
        return _token_from_sa(sa_path)
    sys.exit(
        "[ERRORE] Nessuna credenziale GSC in env.\n"
        f"  Imposta {OAUTH_REFRESH_ENV} (consigliato) o {SA_JSON_ENV}.\n"
        "  source ~/.secrets/adoff-stores.env"
    )


def _token_from_refresh(refresh):
    resp = requests.post(
        TOKEN_URI,
        data={
            "client_id": os.environ.get("CWS_CLIENT_ID"),
            "client_secret": os.environ.get("CWS_CLIENT_SECRET"),
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if resp.status_code != 200:
        sys.exit(f"[OAUTH {resp.status_code}] {resp.text[:300]}\n  (refresh token scaduto? rilancia oauth_setup.py)")
    return resp.json()["access_token"]


def _token_from_sa(sa_path):
    with open(sa_path) as fh:
        sa = json.load(fh)
    now = int(time.time())
    claim = {
        "iss": sa["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URI,
        "iat": now,
        "exp": now + 3600,
    }
    assertion = jwt.encode(claim, sa["private_key"], algorithm="RS256")
    resp = requests.post(
        TOKEN_URI,
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def query(token, start, end, dimensions, limit):
    url = API.format(site=requests.utils.quote(SITE_URL, safe=""))
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": dimensions,
        "rowLimit": limit,
        "dataState": "all",
    }
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    if resp.status_code != 200:
        sys.exit(f"[API {resp.status_code}] {resp.text[:500]}")
    return resp.json().get("rows", [])


def fmt_rows(rows, dims):
    out = []
    for r in rows:
        keys = r.get("keys", [])
        out.append(
            {
                **{dims[i]: keys[i] for i in range(len(dims))},
                "clicks": int(r.get("clicks", 0)),
                "impressions": int(r.get("impressions", 0)),
                "ctr": round(r.get("ctr", 0) * 100, 2),
                "position": round(r.get("position", 0), 1),
            }
        )
    return out


def print_table(rows, dim):
    if not rows:
        print("  (nessun dato — la proprieta' potrebbe essere nuova o senza traffico nel periodo)")
        return
    w = max((len(str(r[dim])) for r in rows), default=10)
    w = min(w, 60)
    print(f"  {'#':>3}  {dim:<{w}}  {'clk':>5} {'impr':>7} {'ctr%':>6} {'pos':>5}")
    for i, r in enumerate(rows, 1):
        label = str(r[dim])[:w]
        print(f"  {i:>3}  {label:<{w}}  {r['clicks']:>5} {r['impressions']:>7} {r['ctr']:>6} {r['position']:>5}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--dim", default=None, help="query | page | country | device")
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--opportunities", action="store_true",
                    help="query in posizione 5-20 con impression alte: quick win SEO")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    end = date.today() - timedelta(days=2)        # GSC ha ~2gg di ritardo
    start = end - timedelta(days=args.days)
    token = get_access_token()

    if args.opportunities:
        rows = fmt_rows(query(token, str(start), str(end), ["query"], 1000), ["query"])
        opp = [r for r in rows if 5 <= r["position"] <= 20 and r["impressions"] >= 20]
        opp.sort(key=lambda r: r["impressions"], reverse=True)
        if args.json:
            print(json.dumps(opp, indent=2, ensure_ascii=False))
            return
        print(f"\n=== OPPORTUNITA' SEO (pos 5-20, impr>=20) — {start} -> {end} ===")
        print("    Query gia' visibili ma non in vetta: spingere = guadagno rapido di click\n")
        print_table(opp[:args.limit], "query")
        return

    dims = [args.dim] if args.dim else None
    if args.json:
        result = {}
        for d in (dims or ["query", "page"]):
            result[d] = fmt_rows(query(token, str(start), str(end), [d], args.limit), [d])
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    for d in (dims or ["query", "page"]):
        rows = fmt_rows(query(token, str(start), str(end), [d], args.limit), [d])
        rows.sort(key=lambda r: r["impressions"], reverse=True)
        print(f"\n=== TOP {d.upper()} — {start} -> {end} ({args.days}gg) ===")
        print_table(rows, d)


if __name__ == "__main__":
    main()
