#!/usr/bin/env python3
"""
AdOff — Ping crawler dopo il deploy SEO.

Dopo aver pubblicato modifiche su site/, avvisa i motori così le ri-scansionano
in fretta invece di aspettare il crawl naturale (giorni):
  1. IndexNow (Bing, Yandex, Seznam, …): submit istantaneo degli URL cambiati.
  2. Google Search Console: resubmit della sitemap (sitemaps.submit API).

La key IndexNow è generata una volta e salvata in .state/indexnow_key.txt; il file
chiave DEVE essere servito su site/<key>.txt (creato qui, deployato al deploy).

Uso:
  python3 ping_crawlers.py --urls https://adoff.app/it/x.html https://adoff.app/en/x.html
  python3 ping_crawlers.py --from-file .state/changed_urls.txt
  python3 ping_crawlers.py            # solo sitemap GSC + homepage IndexNow
Env: ADOFF_GSC_OAUTH_REFRESH + CWS_CLIENT_ID + CWS_CLIENT_SECRET (per GSC).
"""
import argparse
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state")
HOST = "adoff.app"
SITEMAP = f"https://{HOST}/sitemap.xml"
GSC_SITE = "sc-domain:adoff.app"


def _post_json(url, payload, headers=None, method="POST"):
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")


def get_indexnow_key():
    os.makedirs(STATE, exist_ok=True)
    keyfile = os.path.join(STATE, "indexnow_key.txt")
    if os.path.isfile(keyfile):
        key = open(keyfile).read().strip()
    else:
        key = os.urandom(16).hex()
        open(keyfile, "w").write(key)
    # assicura che il file chiave sia servito dal sito
    site_keyfile = os.path.join(SITE, f"{key}.txt")
    if not os.path.isfile(site_keyfile):
        open(site_keyfile, "w").write(key)
    return key


def indexnow(urls):
    if not urls:
        urls = [f"https://{HOST}/"]
    key = get_indexnow_key()
    payload = {
        "host": HOST,
        "key": key,
        "keyLocation": f"https://{HOST}/{key}.txt",
        "urlList": urls[:10000],
    }
    try:
        status, body = _post_json("https://api.indexnow.org/indexnow", payload)
        print(f"[IndexNow] HTTP {status} · {len(urls)} URL inviati (key {key[:8]}…)")
        if status >= 400:
            print(f"  risposta: {body[:200]}")
        return status < 400
    except Exception as e:
        print(f"[IndexNow] errore: {e}")
        return False


def gsc_token():
    refresh = os.environ.get("ADOFF_GSC_OAUTH_REFRESH")
    cid = os.environ.get("CWS_CLIENT_ID")
    csec = os.environ.get("CWS_CLIENT_SECRET")
    if not (refresh and cid and csec):
        return None
    # token endpoint vuole form-urlencoded, non json
    import urllib.parse
    data = urllib.parse.urlencode({
        "client_id": cid, "client_secret": csec,
        "refresh_token": refresh, "grant_type": "refresh_token",
    }).encode()
    try:
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())["access_token"]
    except Exception as e:
        print(f"[GSC] token errore: {e}")
        return None


def gsc_submit_sitemap():
    tok = gsc_token()
    if not tok:
        print("[GSC] credenziali assenti (ADOFF_GSC_OAUTH_REFRESH/CWS_*) → skip sitemap submit")
        return False
    import urllib.parse
    site_enc = urllib.parse.quote(GSC_SITE, safe="")
    feed_enc = urllib.parse.quote(SITEMAP, safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{site_enc}/sitemaps/{feed_enc}"
    try:
        req = urllib.request.Request(url, method="PUT",
                                     headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"[GSC] sitemap resubmit HTTP {r.status} ({SITEMAP})")
            return True
    except Exception as e:
        print(f"[GSC] sitemap submit errore: {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", nargs="*", default=[])
    ap.add_argument("--from-file", default="")
    args = ap.parse_args()

    urls = list(args.urls)
    if args.from_file and os.path.isfile(args.from_file):
        urls += [l.strip() for l in open(args.from_file) if l.strip().startswith("http")]
    urls = list(dict.fromkeys(urls))  # dedup, ordine stabile

    ok_in = indexnow(urls)
    ok_gsc = gsc_submit_sitemap()
    print(f"[ping] IndexNow={'ok' if ok_in else 'fail'} · GSC={'ok' if ok_gsc else 'fail'}")
    sys.exit(0 if (ok_in or ok_gsc) else 1)


if __name__ == "__main__":
    main()
