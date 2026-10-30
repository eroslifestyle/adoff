#!/usr/bin/env python3
"""Bake meccanico di site/{lang}/ad-blocker-firefox.html (14 lingue) dalla root EN.

Le traduzioni esistono già in site/i18n/{lang}.json (27 chiavi ad_blocker_firefox.*):
nessuna chiamata LLM. Sostituisce i nodi data-i18n, title/desc/og/twitter, canonical,
hreflang 16-tag (schema di it/ad-blocker-chrome.html) e localizza i JSON-LD.
Completa inoltre gli hreflang della root EN a 16.
"""
import json
import re
import html as htmllib
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"
BASE = "https://adoff.app"
SLUG = "ad-blocker-firefox"
LANGS = ['it', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
ALL = ['en'] + LANGS
P = "ad_blocker_firefox."

KEY_TITLE = P + "an.ad.blocker.for.firefox.that.fills.the.g"
KEY_DESC = P + "firefox.blocks.many.trackers.by.default.b"
KEY_CTA = "compare.cta"

# JSON-LD: Question key -> (answer key nel body)
FAQ_MAP = {
    P + "does.firefox.need.an.ad.blocker": P + "firefox.s.built.in.protections.block.many.t",
    P + "how.do.i.install.adoff.on.firefox": P + "download.adoff.firefox.zip.extract.it.an",
    P + "which.firefox.versions.are.supported": P + "adoff.requires.firefox.128.0.or.later.th",
    P + "does.adoff.for.firefox.work.on.android": P + "no.the.firefox.build.of.adoff.targets.de",
    P + "is.adoff.for.firefox.free": P + "yes.adoff.is.100.free.the.first.30.days",
}


def url_for(lang):
    return f"/{SLUG}" if lang == "en" else f"/{lang}/{SLUG}"


def hreflang_block():
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{BASE}{url_for(la)}" />'
             for la in ALL]
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{BASE}{url_for("en")}" />')
    return "\n".join(lines)


def bake(html, lang, tr):
    title = tr[KEY_TITLE]
    title_attr = title if len(title + " | AdOff") > 60 else title + " | AdOff"
    ld_title = title + " | AdOff"
    desc = tr[KEY_DESC]
    esc = lambda s: htmllib.escape(s, quote=True)

    html = re.sub(r'<html\b[^>]*>',
                  f'<html lang="{lang}"{" dir=\"rtl\"" if lang == "ar" else ""}>',
                  html, count=1)
    html = re.sub(r'(<title[^>]*>).*?(</title>)', lambda m: m.group(1) + esc(title_attr) + m.group(2),
                  html, count=1, flags=re.S)

    def set_meta(pattern, value):
        nonlocal html
        html = re.sub(pattern, lambda m: m.group(1) + esc(value) + m.group(3), html, count=1)

    set_meta(r'(<meta\s+name="description"\s+content=")([^"]*)(")', desc)
    set_meta(r'(<meta\s+property="og:title"\s+content=")([^"]*)(")', title_attr)
    set_meta(r'(<meta\s+property="og:description"\s+content=")([^"]*)(")', desc)
    set_meta(r'(<meta\s+name="twitter:title"\s+content=")([^"]*)(")', title_attr)
    set_meta(r'(<meta\s+name="twitter:description"\s+content=")([^"]*)(")', desc)

    u = f"{BASE}{url_for(lang)}"
    html = re.sub(r'<link rel="canonical"[^>]*/>', f'<link rel="canonical" href="{u}" />', html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{u}\g<2>', html)
    html = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', html)
    html = re.sub(r'(<link rel="canonical"[^>]*/>\n)', rf'\1{hreflang_block()}\n', html, count=1)

    # JSON-LD: Article headline/description/inLanguage, FAQ Q/A, breadcrumb
    html = html.replace('"headline": "Ad Blocker for Firefox: What AdOff Adds (2026)"',
                        f'"headline": {json.dumps(ld_title, ensure_ascii=False)}')
    art_desc = tr[P + "firefox.s.built.in.protections.block.many.t"]
    html = html.replace('"description": "Firefox blocks many trackers by default, but not video ads or anti-adblock walls. AdOff adds network, cosmetic and video ad blocking on Firefox."',
                        f'"description": {json.dumps(art_desc, ensure_ascii=False)}')
    html = html.replace('"inLanguage": "en"', f'"inLanguage": "{lang}"')
    for qk, ak in FAQ_MAP.items():
        html = html.replace(f'"name": {json.dumps(tr_en[qk], ensure_ascii=False)}',
                            f'"name": {json.dumps(tr[qk], ensure_ascii=False)}')
        html = html.replace(f'"text": {json.dumps(tr_en[ak], ensure_ascii=False)}',
                            f'"text": {json.dumps(tr[ak], ensure_ascii=False)}')
    html = html.replace('"name": "Ad Blocker for Firefox: What AdOff Adds (2026)", "item"',
                        f'"name": {json.dumps(ld_title, ensure_ascii=False)}, "item"')
    html = html.replace(f'"item": "{BASE}/{SLUG}"', f'"item": "{u}"')

    # Body: nodi data-i18n
    def repl_node(m):
        key = m.group(1)
        val = tr.get(key)
        return m.group(0).replace(m.group(2), esc(val)) if val else m.group(0)
    html = re.sub(r'(<[^>]*data-i18n="([^"]+)"[^>]*>)((?:(?!</?[a-z]).)*?)(</)',
                  lambda m: m.group(1) + esc(tr[m.group(2)]) + m.group(4),
                  html, flags=re.S)
    # CTA button
    html = html.replace('Install AdOff — free →', tr[KEY_CTA])
    return html


master = (SITE / f"{SLUG}.html").read_text(encoding="utf-8")
tr_en = json.loads((SITE / "i18n/en.json").read_text(encoding="utf-8"))

for lang in LANGS:
    tr = json.loads((SITE / f"i18n/{lang}.json").read_text(encoding="utf-8"))
    out = SITE / lang / f"{SLUG}.html"
    out.write_text(bake(master, lang, tr), encoding="utf-8")
    print(f"OK {out}")

# Root EN: hreflang 2 → 16
root = (SITE / f"{SLUG}.html").read_text(encoding="utf-8")
root = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', root)
root = root.replace('<link rel="canonical" href="https://adoff.app/ad-blocker-firefox" />',
                    '<link rel="canonical" href="https://adoff.app/ad-blocker-firefox" />\n' + hreflang_block(), 1)
(SITE / f"{SLUG}.html").write_text(root, encoding="utf-8")
print("OK root hreflang")
