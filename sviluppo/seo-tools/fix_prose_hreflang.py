#!/usr/bin/env python3
"""
AdOff — Unifica canonical/hreflang/og:url delle pagine PROSA multilingue same-slug sul
sistema i18n a 15 lingue, schema PATH-BASED EXTENSIONLESS (decisione 2026-06-08).

Complementare a fix_i18n_driven_hreflang.py (che copre index/install/support/privacy/terms/
withdrawal). Qui le pagine prosa en-root (how-it-works, vs/*, ecc.) + guide (it-root) che
erano rimaste con hreflang `.html` (→308) o `?lang=` (schema vecchio query-param).

Per ogni page-path: il root-lang è LETTO dal file root (<html lang>), non assunto. Le lingue
presenti = root-lang + ogni /<lang>/<path> esistente. URL: root-lang→/<path> (extensionless),
ogni altra→/<lang>/<path>. canonical=self, hreflang reciproco di tutte le lingue presenti +
x-default→en (se presente) altrimenti root. dir=rtl per ar. Tocca SOLO <head>, mai il body.

ESCLUSI (per design): about/chi-sono (bilingui diverso-slug, si linkano a vicenda),
blog (URL dir-style /blog/), index+i18n-driven (già gestiti dal fixer dedicato), pagine
funzionali/private (account/admin/success/...). Idempotente.

Run:  python3 sviluppo/seo-tools/fix_prose_hreflang.py [--dry-run]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
BASE = "https://adoff.app"
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
RTL = {'ar'}

# page-path multilingue same-slug rimaste fuori dal sistema unificato.
PAGES = [
    'how-it-works', 'unique-tech', 'community', 'press', 'best-ad-blocker-2026',
    'bypass-anti-adblock', 'manifest-v3-ad-blocker', 'lightweight-ad-blocker',
    'undetectable-ad-blocker', 'private-ad-blocker', 'adblock-detector', 'block-video-ads',
    'vs/adguard', 'vs/ublock-origin', 'vs/adblock-plus', 'guide', 'license-guide',
    'salesletter',
]


def root_file(page):
    return SITE / f"{page}.html"


def lang_file(page, lang):
    return SITE / lang / f"{page}.html"


def root_lang_of(page):
    txt = root_file(page).read_text(encoding="utf-8", errors="ignore")
    m = re.search(r'<html lang="([a-zA-Z-]+)"', txt)
    return (m.group(1).split('-')[0] if m else 'en')


def url_for(page, lang, root_lang):
    return f"{BASE}/{page}" if lang == root_lang else f"{BASE}/{lang}/{page}"


def present_langs(page, root_lang):
    out = [root_lang]
    out += [la for la in LANGS if la != root_lang and lang_file(page, la).exists()]
    return [la for la in LANGS if la in out]  # ordine canonico


def cluster(page, root_lang, langs):
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{url_for(page, la, root_lang)}" />'
             for la in langs]
    xdef = 'en' if 'en' in langs else root_lang
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{url_for(page, xdef, root_lang)}" />')
    return "\n".join(lines)


def file_for(page, lang, root_lang):
    return root_file(page) if lang == root_lang else lang_file(page, lang)


def rewrite(path, lang, canonical, block, dry):
    txt = path.read_text(encoding="utf-8", errors="ignore")
    orig = txt
    dir_attr = ' dir="rtl"' if lang in RTL else ""
    txt = re.sub(r'<html\b[^>]*>', f'<html lang="{lang}"{dir_attr}>', txt, count=1)
    txt = re.sub(r'<link rel="canonical"[^>]*>',
                 f'<link rel="canonical" href="{canonical}" />', txt, count=1)
    txt = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{canonical}\g<2>', txt)
    txt = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', txt)
    txt = re.sub(r'(<link rel="canonical"[^>]*>\n)', rf'\1{block}\n', txt, count=1)
    if txt != orig and not dry:
        path.write_text(txt, encoding="utf-8")
    return txt != orig


def main():
    dry = "--dry-run" in sys.argv
    changed = 0
    for page in PAGES:
        if not root_file(page).exists():
            print(f"  ⚠ {page}: root mancante, skip"); continue
        rl = root_lang_of(page)
        langs = present_langs(page, rl)
        block = cluster(page, rl, langs)
        for la in langs:
            if rewrite(file_for(page, la, rl), la, url_for(page, la, rl), block, dry):
                changed += 1
        # Duplicato orfano: /<root_lang>/<page>.html (es. /en/how-it-works per pagina en-root).
        # Il nav punta sempre alla root per il root-lang → questa copia non è mai linkata.
        # La si consolida: canonical → root (Google deduplica), niente 404, file preservato.
        orphan = lang_file(page, rl)
        if orphan.exists():
            if rewrite(orphan, rl, url_for(page, rl, rl), block, dry):
                changed += 1
                print(f"    ↳ consolidato duplicato orfano {rl}/{page}.html → canonical root")
        missing = [la for la in LANGS if la not in langs]
        status = f"{len(langs)}/15 (root={rl})"
        print(f"  {page}: {status}" + (f"  ⚠ mancano {','.join(missing)}" if missing else ""))
    print(f"[fix-prose-hreflang] {'(dry-run) ' if dry else ''}file riscritti: {changed}")


if __name__ == "__main__":
    main()
