#!/usr/bin/env python3
"""
Rigenera site/sitemap.xml dall'albero REALE delle pagine.

Il sitemap viene ricostruito dal filesystem, così non può più divergere.

Regole:
- si includono solo pagine pubbliche (esclusi pannelli, 404, pagine tecniche)
- URL extensionless, come li serve Cloudflare Pages; le directory-index
  mantengono il trailing slash (es. /blog/) per evitare redirect 308
- la lingua di ogni pagina è letta dal tag <html lang="..."> del file
  (fallback: cartella lingua, altrimenti "it" per la root) — la root NON è
  per forza italiana: alcune pagine root sono in inglese (es. /about)
- una pagina è esclusa se il suo canonical dichiara un'URL diversa
- dentro un cluster, se due file hanno la stessa lingua vince quello in root
  (es. root /guide it + /it/guide it -> resta solo /guide)
- x-default punta sempre alla variante inglese del cluster (dove sia;
  per /about la variante en È la root, quindi x-default = /about)
- lastmod = data dell'ultimo commit git che ha toccato il file
  (fallback: mtime del file)

Uso:  python3 gen_sitemap.py [--dry-run]
"""
import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
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

RE_LANG = re.compile(r'<html[^>]*\blang=["\']([A-Za-z-]+)["\']')
RE_CANON = re.compile(r'rel="canonical"\s+href=["\']([^"\']+)["\']')


def head(path: Path, n: int = 8192) -> str:
    """Primi n caratteri del file (lang e canonical stanno nel <head>)."""
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read(n)


def detect_lang(path: Path, fallback: str) -> str:
    """Lingua reale della pagina dal tag <html lang>, con fallback."""
    m = RE_LANG.search(head(path, 2048))
    return m.group(1).lower() if m else fallback


def canonical_url(path: Path):
    """URL dichiarata nel <link rel="canonical"> del file, se presente."""
    m = RE_CANON.search(head(path))
    return m.group(1) if m else None


def git_date(path: Path) -> str:
    """Data (YYYY-MM-DD) dell'ultimo commit che ha toccato il file; fallback mtime."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", str(path)],
            cwd=ROOT, capture_output=True, text=True, timeout=10,
        ).stdout.strip()
        if out:
            return out[:10]
    except Exception:
        pass
    return datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).date().isoformat()


def page_key(rel: str):
    """
    (cartella-lingua|None, chiave-di-pagina) dal path relativo.
    'de/vs/adguard.html' -> ('de', 'vs/adguard') ; 'guide.html' -> (None, 'guide')
    """
    p = rel[:-len(".html")] if rel.endswith(".html") else rel
    if p.endswith("/index"):
        p = p[: -len("/index")]
    parts = p.split("/")
    if parts[0] in LANGS and len(parts[0]) == 2:
        return parts[0], "/".join(parts[1:]) or "index"
    return None, p or "index"


def url_for(lang: str, key: str, is_index: bool) -> str:
    """URL finale della pagina: le directory-index portano il trailing slash."""
    seg = "" if key == "index" else key
    if is_index and seg:
        seg += "/"
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

    # key -> {lingua: (url, path, is_root)}
    groups: dict = defaultdict(dict)
    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(SITE).as_posix()
        if rel in EXCLUDE_EXACT or any(rel.startswith(x) for x in EXCLUDE_PREFIX):
            continue
        if any(f"/{x}" in f"/{rel}" for x in EXCLUDE_EXACT):
            continue
        lang_dir, key = page_key(rel)
        lang = detect_lang(p, lang_dir or "it")
        url = url_for(lang_dir, key, rel.endswith("index.html"))
        # setdefault: se root e cartella lingua producono la stessa lingua vince la root
        groups[key].setdefault(lang, (url, p, lang_dir is None))

    # escludi le pagine che canonicalizzano altrove (es. /it/privacy -> /privacy)
    for key in list(groups):
        for lang in list(groups[key]):
            url, path, _ = groups[key][lang]
            can = canonical_url(path)
            if can and can.rstrip("/") != url.rstrip("/"):
                print(f"  esclusa (canonical {can}): {url}")
                del groups[key][lang]
        if not groups[key]:
            del groups[key]

    # dentro un cluster, stessa lingua due volte -> vince la pagina in root
    for key in groups:
        dedup: dict = {}
        for lang, entry in sorted(groups[key].items(), key=lambda kv: not kv[1][2]):
            dedup.setdefault(lang, entry)
        groups[key] = dedup

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
        # x-default: sempre la variante inglese del cluster
        xdef = variants.get("en", next(iter(variants.values())))[0]
        for lang in sorted(variants):
            url, path, _ = variants[lang]
            out.append("  <url>")
            out.append(f"    <loc>{url}</loc>")
            out.append(f"    <lastmod>{git_date(path)}</lastmod>")
            out.append(f"    <changefreq>{cf}</changefreq>")
            out.append(f"    <priority>{pr}</priority>")
            if len(variants) > 1:
                out.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{xdef}"/>')
                for l2 in sorted(variants):
                    out.append(f'    <xhtml:link rel="alternate" hreflang="{l2}" href="{variants[l2][0]}"/>')
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
