#!/usr/bin/env python3
"""Bake meccanico generico di site/{lang}/{SLUG}.html (14 lingue) dalla root EN.

Nessuna chiamata LLM: usa le traduzioni gia' presenti in site/i18n/{lang}.json.
Generico: nessuna chiave o letterale hardcodato. Per ogni valore inglese in
i18n/en.json trovato nella pagina (JSON-LD, testi/attributi HTML), lo sostituisce
con la traduzione della stessa chiave nel JSON di lingua. Title/desc key sono
derivate dal <title> e dal meta description del master EN.
Completa inoltre gli hreflang della root EN a 16.

Uso: python3 bake_landing.py <slug> [prefix]
  slug   = nome file senza .html (es. ad-blocker-firefox)
  prefix = namespace i18n opzionale (es. ad_blocker_firefox); se omesso vengono
           considerate tutte le chiavi di en.json.
"""
import json
import sys
import html as htmllib
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"
BASE = "https://adoff.app"
LANGS = ['it', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
ALL = ['en'] + LANGS

ARGS = sys.argv[1:]
SLUG = ARGS[0] if ARGS else "ad-blocker-firefox"
PREFIX = ARGS[1] if len(ARGS) > 1 and not ARGS[1].startswith("--") else None
def _opt(name):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else None
TITLE_KEY_OPT = _opt("--title-key")
DESC_KEY_OPT = _opt("--desc-key")


def url_for(lang):
    return f"/{SLUG}" if lang == "en" else f"/{lang}/{SLUG}"


def hreflang_block():
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{BASE}{url_for(la)}" />'
             for la in ALL]
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{BASE}{url_for("en")}" />')
    return "\n".join(lines)


def jd(s):
    return json.dumps(s, ensure_ascii=False)


tr_en_full = json.loads((SITE / "i18n/en.json").read_text(encoding="utf-8"))
tr_en = ({k: v for k, v in tr_en_full.items() if k.startswith(PREFIX)}
         if PREFIX else tr_en_full)
master = (SITE / f"{SLUG}.html").read_text(encoding="utf-8")
esc = lambda s: htmllib.escape(s, quote=True)

# Chiavi title/desc derivate dal master EN (nessun hardcoding)
m = re.search(r"<title[^>]*>(.*?)</title>", master, re.S) if (re := __import__("re")) else None
en_title_attr = htmllib.unescape(m.group(1)).strip()
en_title = en_title_attr[:-7].strip() if en_title_attr.endswith(" | AdOff") else en_title_attr
import difflib


def find_key(en_val):
    """Chiave con valore EN uguale (o piu' simile, se en.json ha drift)."""
    if en_val in tr_en.values():
        return next(k for k, v in tr_en.items() if v == en_val)
    best = difflib.get_close_matches(en_val, list(tr_en.values()), 1, 0.6)
    if not best:
        return None
    print(f"NOTA: valore EN con drift, uso fuzzy match: {best[0]!r}")
    return next(k for k, v in tr_en.items() if v == best[0])


if TITLE_KEY_OPT and DESC_KEY_OPT:
    KEY_TITLE, KEY_DESC = TITLE_KEY_OPT, DESC_KEY_OPT
    if KEY_TITLE not in tr_en or KEY_DESC not in tr_en:
        sys.exit(f"Chiavi title/desc non presenti in en.json per {SLUG}")
else:
    KEY_TITLE = find_key(en_title)
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', master)
    KEY_DESC = find_key(m.group(1)) if m else None
    if not KEY_TITLE or not KEY_DESC:
        sys.exit(f"Impossibile derivare title/desc key da {SLUG}.html")


def fit_title(title, lang):
    """<=60 char (34 per CJK), sempre con suffisso ' | AdOff', tronca sull'ultima parola intera."""
    limit = 34 if lang in ("zh", "ja", "ko") else 60
    suffix = " | AdOff"
    full = title + suffix
    if len(full) <= limit:
        return full
    max_len = limit - len(suffix)
    t = title[:max_len]
    if " " in t:
        t = t[:t.rfind(" ")]
    return t.rstrip(" ,;:.-") + suffix

# Headline dell'Article JSON-LD (sostituita con title tradotto + " | AdOff")
mh = re.search(r'"headline": "([^"]*)"', master)
EN_HEADLINE = mh.group(1) if mh else None

# Mappa opzionale domanda->risposta per le FAQ JSON-LD (drift EN master vs en.json).
# File: bake_landing_faq_<slug>.json nella stessa directory dello script.
_faq_path = Path(__file__).resolve().parent / f"bake_landing_faq_{SLUG}.json"
FAQ_PAIRS = json.loads(_faq_path.read_text(encoding="utf-8")) if _faq_path.exists() else {}


def bake(html, lang, tr):
    en_title_v = tr_en[KEY_TITLE]
    title = tr.get(KEY_TITLE, en_title_v)
    title_attr = fit_title(title, lang)
    ld_title = title_attr
    desc = tr.get(KEY_DESC, tr_en[KEY_DESC])

    # Mappa valore EN -> valore tradotto (solo chiavi presenti anche in tr)
    vm = {v: tr[k] for k, v in tr_en.items() if k in tr and v != tr[k]}

    html = re.sub(r'<html\b[^>]*>',
                  f'<html lang="{lang}"{" dir=\"rtl\"" if lang == "ar" else ""}>',
                  html, count=1)
    html = re.sub(r'(<title[^>]*>).*?(</title>)', lambda mm: mm.group(1) + esc(title_attr) + mm.group(2),
                  html, count=1, flags=re.S)

    def set_meta(pattern, value):
        nonlocal html
        html = re.sub(pattern, lambda mm: mm.group(1) + esc(value) + mm.group(3), html, count=1)

    set_meta(r'(<meta\s+name="description"\s+content=")([^"]*)(")', desc)
    set_meta(r'(<meta\s+property="og:title"\s+content=")([^"]*)(")', title_attr)
    set_meta(r'(<meta\s+property="og:description"\s+content=")([^"]*)(")', desc)
    set_meta(r'(<meta\s+name="twitter:title"\s+content=")([^"]*)(")', title_attr)
    set_meta(r'(<meta\s+name="twitter:description"\s+content=")([^"]*)(")', desc)

    u = f"{BASE}{url_for(lang)}"
    html = re.sub(r'<link rel="canonical"[^>]*/>', f'<link rel="canonical" href="{u}" />', html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{u}\g<2>', html)
    html = html.replace(f'"item": "{BASE}/{SLUG}"', f'"item": "{u}"')
    html = html.replace('"inLanguage": "en"', f'"inLanguage": "{lang}"')

    # JSON-LD: headline + breadcrumb name -> title tradotto | AdOff
    if EN_HEADLINE:
        html = html.replace(jd(EN_HEADLINE), jd(ld_title))
    # JSON-LD: descrizione Article con drift EN (chiave via mappa "article_description")
    art_key = FAQ_PAIRS.get("article_description")
    if art_key and art_key in tr:
        html = re.sub(r'("description": ")[^"]*(")',
                      lambda mm: mm.group(1) + jd(tr[art_key])[1:-1] + mm.group(2),
                      html, count=1)
    # CTA button (drift EN: il literal del master non e' in en.json)
    mbtn = re.search(r'<a href="[^"]*" class="btn">([^<]+)</a>', html)
    if mbtn and "compare.cta" in tr:
        html = html.replace(mbtn.group(1), tr["compare.cta"], 1)

    # FAQ JSON-LD: coppia domanda->risposta. La mappa (opzionale) associa la
    # chiave i18n della domanda alla chiave i18n della risposta; il testo EN
    # della risposta nel master puo' differire dal valore en.json (drift), quindi
    # si sostituisce per posizione: '"name": <domanda EN>' -> '"text": <qualsiasi>'
    # diventa la traduzione della risposta.
    for qk, ak in FAQ_PAIRS.items():
        if qk not in tr_en or qk not in tr or ak not in tr:
            continue
        html = html.replace('"name": ' + jd(tr_en[qk]),
                            '"name": ' + jd(tr[qk]) + '\x00FAQ\x00')
        html = re.sub(r'("name": ' + re.escape(jd(tr[qk])) + r'\x00FAQ\x00,\s*'
                      r'"acceptedAnswer": \{\s*"@type": "Answer",\s*"text": ")[^"]*',
                      lambda mm: mm.group(1) + jd(tr[ak])[1:-1], html, count=1)
        html = html.replace('\x00FAQ\x00', '')
    # JSON-LD + contenuti: sostituzione per valore EN -> traduzione
    for en_v, loc_v in vm.items():
        html = html.replace(jd(en_v), jd(loc_v))
        if len(en_v) >= 20:
            html = html.replace(esc(en_v), esc(loc_v))

    # Body: nodi data-i18n. Il contenuto puo' contenere markup inline (<code>, <a>),
    # quindi si matcha il tag di apertura data-i18n e il tag di chiusura corrispondente.
    out_parts, pos = [], 0
    for m in re.finditer(r'(<[^>]*data-i18n="([^"]+)"[^>]*>)', html):
        if m.start() < pos:
            continue
        open_tag, key = m.group(1), m.group(2)
        name = re.match(r'<(\w+)', open_tag).group(1)
        close = '</' + name + '>'
        end = html.find(close, m.end())
        if end < 0:
            continue
        val = tr.get(key)
        if val is None:
            continue
        content = html[m.end():end]
        if content != esc(tr_en.get(key, "")) and content != tr_en.get(key, ""):
            continue
        out = val if "<code>" in val else esc(val)
        out_parts.append(html[pos:m.start()])
        out_parts.append(open_tag + out + close)
        pos = end + len(close)
    out_parts.append(html[pos:])
    html = ''.join(out_parts)

    return html


import re  # noqa: E402  (usato sopra via import locale,qui normalizzato)

for lang in LANGS:
    tr = json.loads((SITE / f"i18n/{lang}.json").read_text(encoding="utf-8"))
    out = SITE / lang / f"{SLUG}.html"
    out.write_text(bake(master, lang, tr), encoding="utf-8")
    print(f"OK {out}")

# Root EN: hreflang -> 16
root = (SITE / f"{SLUG}.html").read_text(encoding="utf-8")
root = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', root)
root = re.sub(r'(<link rel="canonical" href="[^"]*" />)',
              r'\1\n' + hreflang_block(), root, count=1)
(SITE / f"{SLUG}.html").write_text(root, encoding="utf-8")
print("OK root hreflang")
