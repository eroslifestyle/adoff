#!/usr/bin/env python3
"""
AdOff — Sistema i18n UNICO per le pagine i18n-driven: hreflang uniforme 15 lingue
(decisione (b) + direttiva "tutto unico sistema i18n con 15 lingue", 2026-06-08).

MODELLO UNIFORME (index model) per TUTTE le 6 pagine i18n-driven:
  root /page.html (`/` per index) = ITALIANO  · <html lang="it"> · canonical=self
  /en/page.html = EN · /<lang>/page.html = ognuna delle altre 13
  hreflang: it→root · en→/en/ · <lang>→/<lang>/ · x-default→/en/  (path-based, reciproco)

Prerequisiti già applicati a monte:
  • index/install/support: /{lang}/ generate da rebuild-lang-pages.mjs (root IT + matrice 15/15).
  • privacy/terms/withdrawal: root promosso a IT (copia di /it/); /en/ resta EN; /lang/ baked.

Questo script: riscrive in TUTTI i file fisici del cluster <html lang>, canonical, og:url e il
blocco hreflang (rimuovendo qualsiasi schema vecchio: ?lang=, extensionless, blocchi rotti).
Per i legali il vecchio /it/page.html residuo viene consolidato (canonical→root) per evitare URL IT duplicati.
Si elencano SOLO le lingue con file fisico (zero 404); le mancanti vengono loggate (niente silenzioso).

Idempotente. Run:  python3 sviluppo/seo-tools/fix_i18n_driven_hreflang.py [--dry-run]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
BASE = "https://adoff.app"
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
RTL = {'ar'}
PAGES = ['index', 'install', 'support', 'privacy', 'terms', 'withdrawal']
LEGAL = {'privacy', 'terms', 'withdrawal'}   # hanno un /it/page.html residuo da consolidare


def fname(page):
    return "index.html" if page == "index" else f"{page}.html"


def url_for(page, lang):
    """URL path-based extensionless (CF Pages clean-urls). it=root, altri=/lang/."""
    if page == "index":
        return f"{BASE}/" if lang == "it" else f"{BASE}/{lang}/"
    return f"{BASE}/{page}" if lang == "it" else f"{BASE}/{lang}/{page}"


def root_file(page):
    return SITE / fname(page)


def lang_file(page, lang):
    """File fisico per (page, lang). it = root."""
    return root_file(page) if lang == "it" else SITE / lang / fname(page)


def existing_langs(page):
    return [la for la in LANGS if lang_file(page, la).exists()]


def cluster_block(page, langs):
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{url_for(page, la)}" />' for la in langs]
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{url_for(page, "en")}" />')
    return "\n".join(lines)


def rewrite(path, lang, canonical, cluster, dry):
    txt = path.read_text(encoding="utf-8", errors="ignore")
    orig = txt
    dir_attr = ' dir="rtl"' if lang in RTL else ""
    txt = re.sub(r'<html\b[^>]*>', f'<html lang="{lang}"{dir_attr}>', txt, count=1)
    if re.search(r'<link rel="canonical"[^>]*>', txt):
        txt = re.sub(r'<link rel="canonical"[^>]*>',
                     f'<link rel="canonical" href="{canonical}" />', txt, count=1)
    txt = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{canonical}\g<2>', txt)
    # rimuovi TUTTI gli alternate hreflang esistenti (qualsiasi schema)
    txt = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', txt)
    # inserisci il nuovo cluster dopo il canonical
    txt = re.sub(r'(<link rel="canonical"[^>]*>\n)', rf'\1{cluster}\n', txt, count=1)
    if txt != orig and not dry:
        path.write_text(txt, encoding="utf-8")
    return txt != orig


def main():
    dry = "--dry-run" in sys.argv
    changed = 0
    notes = []
    for page in PAGES:
        langs = existing_langs(page)
        missing = [la for la in LANGS if la not in langs]
        cluster = cluster_block(page, langs)
        for la in langs:
            if rewrite(lang_file(page, la), la, url_for(page, la), cluster, dry):
                changed += 1
        # legale: consolida il vecchio /it/page.html residuo → canonical verso la root IT
        if page in LEGAL:
            leftover = SITE / "it" / fname(page)
            if leftover.exists():
                if rewrite(leftover, "it", url_for(page, "it"), cluster, dry):
                    changed += 1
        status = "15/15" if not missing else f"{len(langs)}/15"
        print(f"  {page}: {status}" + (f"  ⚠ mancano {','.join(missing)}" if missing else ""))
        if missing:
            notes.append(f"{page}: lingue senza file fisico → {','.join(missing)}")
    print(f"[fix-i18n-hreflang] {'(dry-run) ' if dry else ''}file riscritti: {changed}")
    for n in notes:
        print("  ⚠", n)


if __name__ == "__main__":
    main()
