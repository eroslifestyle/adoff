#!/usr/bin/env python3
"""
Rigenera site/sitemap.xml dall'albero REALE delle pagine.

Il sitemap attuale (308 URL) contiene 13 URL morti e omette 266 pagine pubbliche.
Questo script lo ricostruisce dal filesystem, così non può più divergere.

Regole:
- si includono solo pagine pubbliche (esclusi pannelli, 404, pagine tecniche)
- URL extensionless, come li serve Cloudflare Pages
- gruppi hreflang costruiti fra le varianti della stessa pagina realmente esistenti
- x-default punta alla variante inglese se esiste, altrimenti alla root

Uso:  python3 gen_sitemap.py [--dry-run]
"""
import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
BASE = "https://adoff.app"

LANGS = ["it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "pl", "hi", "ja", "ko", "id"]

# pagine che non devono comparire nel sitemap
EXCLUDE_EXACT = {
    "404.html", "account.html", "admin-console.html", "panel.html",
    "success.html", "uninstall.html", "salesletter.html",
}
EXCLUDE_PREFIX = ("mgmt-9f4a/", "account/", ".claude/")

# priorità per tipo di pagina
PRIORITY = [
    (re.compile(r"^index$"), "1.0", "weekly"),
    (re.compile(r"^(pricing|premium|install)$"), "0.9", "weekly"),
    (re.compile(r"^(guide|how-it-works|unique-tech|community|support)$"), "0.8", "monthly"),
    (re.compile(r"^vs/"), "0.7", "monthly"),
    (re.compile(r"^blog/"), "0.6", "weekly"),
    (re.compile(r"^(privacy|terms|withdrawal|accessibility|vpn-policy)$"), "0.3", "yearly"),
]
DEFAULT_PRIORITY = ("0.6", "monthly")


def page_key(rel: str):
    """
    (lingua, chiave-di-pagina) a partire dal path relativo.
    'de/vs/adguard.html' -> ('de', 'vs/adguard') ; 'guide.html' -> (None, 'guide')
    """
    p = rel[:-len(".html")] if rel.endswith(".html") else rel
    if p.endswith("/index"):
        p = p[: -len("/index")]
    parts = p.split("/")
    if parts[0] in LANGS and len(parts[0]) == 2:
        return parts[0], "/".join(parts[1:]) or "index"
    return None, p or "index"


def url_for(lang, key):
    seg = "" if key == "index" else key
    if lang is None:
        return f"{BASE}/{seg}" if seg else f"{BASE}/"
    return f"{BASE}/{lang}/{seg}" if seg else f"{BASE}/{lang}/"


def prio_for(key):
    for rx, pr, cf in PRIORITY:
        if rx.search(key):
            return pr, cf
    return DEFAULT_PRIORITY


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    groups = defaultdict(dict)  # chiave-pagina -> {lingua|None: url}
    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(SITE).as_posix()
        if rel in EXCLUDE_EXACT or any(rel.startswith(x) for x in EXCLUDE_PREFIX):
            continue
        if any(f"/{x}" in f"/{rel}" for x in EXCLUDE_EXACT):
            continue
        lang, key = page_key(rel)
        groups[key][lang] = url_for(lang, key)

    today = date.today().isoformat()
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
           '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
           '',
           f'  <!-- Generato da sviluppo/scripts/audit/gen_sitemap.py il {today}',
           '       dall\'albero reale delle pagine: non va modificato a mano. -->',
           '']

    n_url = 0
    for key in sorted(groups):
        variants = groups[key]
        pr, cf = prio_for(key)
        # x-default: inglese se c'è, altrimenti la root, altrimenti la prima
        xdef = variants.get("en") or variants.get(None) or next(iter(variants.values()))
        for lang in sorted(variants, key=lambda x: (x is not None, x or "")):
            out.append("  <url>")
            out.append(f"    <loc>{variants[lang]}</loc>")
            out.append(f"    <lastmod>{today}</lastmod>")
            out.append(f"    <changefreq>{cf}</changefreq>")
            out.append(f"    <priority>{pr}</priority>")
            if len(variants) > 1:
                out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{xdef}"/>')
                for l2 in sorted(variants, key=lambda x: (x is not None, x or "")):
                    code = l2 if l2 else "it"   # la root è la variante italiana
                    out.append(f'    <xhtml:link rel="alternate" hreflang="{code}" href="{variants[l2]}"/>')
            out.append("  </url>")
            n_url += 1
        out.append("")

    out.append("</urlset>")
    xml = "\n".join(out) + "\n"

    old = (SITE / "sitemap.xml").read_text(encoding="utf-8") if (SITE / "sitemap.xml").is_file() else ""
    print(f"URL prima : {old.count('<url>')}")
    print(f"URL dopo  : {n_url}")
    print(f"gruppi di pagina: {len(groups)}")

    if args.dry_run:
        print("\n(dry-run: nessun file scritto)")
        return
    (SITE / "sitemap.xml").write_text(xml, encoding="utf-8")
    print(f"\nscritto {SITE / 'sitemap.xml'}")


if __name__ == "__main__":
    main()
