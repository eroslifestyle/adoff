#!/usr/bin/env python3
"""
AdOff — Completa l'hreflang delle pagine prose multilingua (debito SEO).

Per ogni pagina prose presente in root + molte /{lang}/ versioni, ma con hreflang
PARZIALE, rigenera il blocco hreflang COMPLETO replicando il formato della pagina
di riferimento (best-ad-blocker-2026.html), existence-driven (solo lingue il cui
file esiste davvero). Sicuro perché punta solo a pagine reali.

Salta le pagine speciali bi-lingua (es. about.html/chi-sono.html, cross-slug) e
quelle con < MIN_LANGS versioni localizzate (non sono prose multilingua piene).

Formato (identico al reference):
  en        → https://adoff.app/{slug}.html       (root = EN)
  {lang}    → https://adoff.app/{lang}/{slug}.html
  x-default → https://adoff.app/{slug}.html
Uso: python3 fix_hreflang.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
DRY = "--dry-run" in sys.argv
BASE = "https://adoff.app"
MIN_LANGS = 8
# Ordine come la pagina di riferimento
ORDER = ["it", "de", "fr", "es", "pt", "ru", "ar", "zh", "hi", "ja", "ko", "tr", "id", "pl"]
ALL_LANGS = set(ORDER) | {"en"}
# Pagine i18n-driven (root=IT, hreflang gestito altrove) o non-prose: NON toccare.
# La convenzione prose qui è root=EN; applicarla a queste romperebbe l'hreflang.
EXCLUDE = {"index.html", "install.html", "support.html", "privacy.html", "terms.html",
           "withdrawal.html", "account.html", "admin.html", "affiliati.html", "success.html"}

HREFLANG_LINE = re.compile(r'[ \t]*<link[^>]+rel=["\']alternate["\'][^>]*hreflang=["\'][^"\']+["\'][^>]*>\s*\n?', re.I)


def existing():
    s = set()
    for dp, _, names in os.walk(SITE):
        for n in names:
            s.add(os.path.relpath(os.path.join(dp, n), SITE).replace("\\", "/"))
    return s


def root_lang_of(slug, ex):
    """Lingua reale della pagina root {slug}.html (da <html lang>). Default 'en'."""
    p = os.path.join(SITE, slug)
    try:
        head = open(p, encoding="utf-8").read(2000)
        m = re.search(r'<html[^>]*\blang=["\']([a-zA-Z-]+)["\']', head)
        if m:
            return m.group(1).split("-")[0].lower()
    except Exception:
        pass
    return "en"


def build_block(slug, ex, root_lang, indent="    "):
    """Blocco hreflang completo. La root serve la lingua root_lang; le altre lingue
    stanno in /{lang}/{slug}. La versione {root_lang}/ (se esiste) si ignora a
    favore della root (come fa la pagina di riferimento)."""
    lines = []
    def link(lang, href):
        lines.append(f'{indent}<link rel="alternate" hreflang="{lang}" href="{href}" />')
    link(root_lang, f"{BASE}/{slug}")                  # root serve la sua lingua reale
    for L in (["en"] + ORDER):
        if L == root_lang:
            continue
        if f"{L}/{slug}" in ex:
            link(L, f"{BASE}/{L}/{slug}")
    link("x-default", f"{BASE}/{slug}")
    return "\n".join(lines) + "\n"


def is_special(text, slug):
    """Pagina cross-slug (hreflang punta a un basename diverso) → non toccare."""
    for href in re.findall(r'hreflang=["\'][^"\']+["\']\s+href=["\']([^"\']+)["\']', text):
        b = os.path.basename(href.split("?")[0].split("#")[0])
        if b and b != slug and b != slug.replace(".html", ""):
            return True
    return False


def main():
    ex = existing()
    fixed = 0
    for dp, _, names in os.walk(SITE):
        for n in names:
            if not n.endswith(".html"):
                continue
            path = os.path.join(dp, n)
            rel = os.path.relpath(path, SITE).replace("\\", "/")
            slug = os.path.basename(rel)
            if slug in EXCLUDE:
                continue                                   # pagina i18n-driven (root=IT)
            langs_present = [L for L in ORDER if f"{L}/{slug}" in ex]
            if slug not in ex or len(langs_present) < MIN_LANGS:
                continue                                   # non è prose multilingua piena
            text = open(path, encoding="utf-8").read()
            if "hreflang" not in text or is_special(text, slug):
                continue
            cur = HREFLANG_LINE.findall(text)
            if not cur:
                continue
            rlang = root_lang_of(slug, ex)
            # già completa nel formato corretto? salta (evita churn inutile)
            cur_langs = set(re.findall(r'hreflang=["\']([a-zA-Z-]+)["\']', text))
            expected_langs = {rlang, "en", "x-default"} | set(langs_present)
            if cur_langs == expected_langs and f'hreflang="{rlang}" href="{BASE}/{slug}"' in text:
                continue
            # indent dal primo tag esistente
            m = HREFLANG_LINE.search(text)
            indent = re.match(r"[ \t]*", m.group(0)).group(0)
            block = build_block(slug, ex, rlang, indent)
            # rimuovi tutti i vecchi tag hreflang e inserisci il blocco al posto del primo
            start = m.start()
            without = HREFLANG_LINE.sub("", text)
            # reinserisci: trova di nuovo il punto (prima riga <link canonical> o </head>)
            anchor = re.search(r'[ \t]*<link[^>]+rel=["\']canonical["\'][^>]*>\s*\n', without, re.I)
            if anchor:
                pos = anchor.end()
            else:
                hm = re.search(r"</head>", without, re.I)
                pos = hm.start() if hm else start
            new_text = without[:pos] + block + without[pos:]
            if new_text != text:
                fixed += 1
                print(f"  {rel}: hreflang → {len(langs_present)+1} lingue")
                if not DRY:
                    open(path, "w", encoding="utf-8").write(new_text)
    print(f"\n{'[DRY] ' if DRY else ''}{fixed} pagine hreflang completate")


if __name__ == "__main__":
    main()
