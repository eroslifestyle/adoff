#!/usr/bin/env python3
"""
AdOff — Porta a 15 lingue le pagine BAKED rimaste editoriali/parziali (blog, storia founder
about/chi-sono, license-guide, salesletter). Direttiva utente 2026-06-08: "tutto il sito i18n
15 lingue". Motore: Claude Haiku via `claude -p` (qualità + JSON affidabile). Batch MULTI-LINGUA:
una sola chiamata traduce N stringhe in TUTTE le lingue mancanti → poche chiamate totali.

Metodo robusto TEXT-NODE: l'HTML viene spezzato in tag (verbatim) + nodi di testo; solo i nodi
di testo, i meta SEO (title/description/og/twitter) e gli attributi visibili (alt/title/
placeholder/aria-label) vengono tradotti (batch JSON-array). I tag/URL/struttura restano intatti
→ zero rischio di rompere il layout. Per le lingue GIÀ presenti: si rinfresca solo l'<head>
(lang/canonical/hreflang/og) senza ritradurre il body.

Head per pagina: <html lang> (+dir=rtl per ar), canonical=self, hreflang reciproco 15 lingue
PATH-BASED EXTENSIONLESS + x-default→en (mappe URL esplicite, gestiscono about↔chi-sono e /blog/).

Run:  KEY via sudo /etc/litellm/.env (auto).  python3 i18n_translate_bake.py [--only PAGE] [--dry]
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
BASE = "https://adoff.app"
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
RTL = {'ar'}
from concurrent.futures import ThreadPoolExecutor

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/home/mrxxx/.local/bin/claude")
HAIKU = "claude-haiku-4-5"
LANG_NAME = {'it': 'Italian', 'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish',
             'pt': 'Portuguese', 'ru': 'Russian', 'ar': 'Arabic', 'zh': 'Simplified Chinese',
             'hi': 'Hindi', 'ja': 'Japanese', 'ko': 'Korean', 'tr': 'Turkish',
             'id': 'Indonesian', 'pl': 'Polish'}


def _claude(prompt):
    """Una chiamata a Claude Haiku headless. Ritorna il testo `result` (o '')."""
    try:
        p = subprocess.run([CLAUDE_BIN, "-p", "--model", HAIKU, "--output-format", "json"],
                           input=prompt, capture_output=True, text=True, timeout=240)
        return json.loads(p.stdout).get("result", "")
    except Exception:
        return ""


def _parse_obj(txt):
    txt = re.sub(r'^```(?:json)?\s*|\s*```$', '', txt.strip())
    m = re.search(r'\{.*\}', txt, re.S)
    try:
        return json.loads(m.group(0)) if m else {}
    except Exception:
        return {}


def translate_multi_chunk(strings, langs):
    """Traduce `strings` in TUTTE le `langs` con UNA chiamata. Ritorna {lang:[...]} validato."""
    names = ", ".join(f"{la} ({LANG_NAME[la]})" for la in langs)
    prompt = (
        "You are a professional website localizer for a browser ad-blocker called AdOff. "
        f"Translate the JSON array of {len(strings)} content strings into EACH of these target "
        f"languages: {names}.\nRules: keep brand names (AdOff, Chrome, Firefox, Safari, Edge, "
        "Brave, Opera) unchanged; keep HTML entities (&amp; etc.), numbers, URLs and placeholders "
        "intact; natural fluent marketing tone; do NOT add or drop items.\n"
        'Return ONLY a JSON object mapping each language code to a JSON array of EXACTLY '
        f'{len(strings)} translations in the SAME order. Example: {{"de": [...], "fr": [...]}}.\n'
        f"STRINGS:\n{json.dumps(strings, ensure_ascii=False)}"
    )
    obj = _parse_obj(_claude(prompt))
    out = {}
    missing = []
    for la in langs:
        v = obj.get(la)
        if isinstance(v, list) and len(v) == len(strings):
            out[la] = [str(x) for x in v]
        else:
            missing.append(la)
    if missing:  # retry una volta solo le lingue fallite
        obj2 = _parse_obj(_claude(prompt.replace(names, ", ".join(
            f"{la} ({LANG_NAME[la]})" for la in missing))))
        for la in missing:
            v = obj2.get(la)
            out[la] = [str(x) for x in v] if isinstance(v, list) and len(v) == len(strings) else strings
    return out


def translate_multi(strings, langs, chunk=25):
    """Chunk + parallelizza. Ritorna {lang:[... len(strings) ...]}."""
    if not strings:
        return {la: [] for la in langs}
    chunks = [strings[i:i + chunk] for i in range(0, len(strings), chunk)]
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(lambda c: translate_multi_chunk(c, langs), chunks))
    return {la: [s for r in results for s in r[la]] for la in langs}


TAG_SPLIT = re.compile(r'(<[^>]+>)')
SKIP_PARENT = re.compile(r'<\s*(script|style|code|pre)\b', re.I)
CLOSE_SKIP = re.compile(r'<\s*/\s*(script|style|code|pre)\s*>', re.I)
HAS_LETTER = re.compile(r'[A-Za-zÀ-ÿ]')


ATTR_RE = re.compile(r'(\b(?:alt|title|placeholder|aria-label)=")([^"]+)(")')
META_PATS = [
    r'(<meta\s+name="description"\s+content=")([^"]*)(")',
    r'(<meta\s+property="og:title"\s+content=")([^"]*)(")',
    r'(<meta\s+property="og:description"\s+content=")([^"]*)(")',
    r'(<meta\s+name="twitter:title"\s+content=")([^"]*)(")',
    r'(<meta\s+name="twitter:description"\s+content=")([^"]*)(")',
]


def extract_body_nodes(body):
    """Ritorna (parts, [(idx, lead, trail)], [stripped_text]) per i nodi di testo traducibili."""
    parts = TAG_SPLIT.split(body)
    skip = 0
    slots, texts = [], []
    for i, seg in enumerate(parts):
        if i % 2 == 1:
            if SKIP_PARENT.match(seg):
                skip += 1
            elif CLOSE_SKIP.match(seg):
                skip = max(0, skip - 1)
            continue
        if skip or not seg.strip() or not HAS_LETTER.search(seg):
            continue
        lead = seg[:len(seg) - len(seg.lstrip())]
        trail = seg[len(seg.rstrip()):]
        slots.append((i, lead, trail))
        texts.append(seg.strip())
    return parts, slots, texts


def collect_sources(head, body):
    """Tutte le stringhe traducibili della pagina + metadati per reinserirle."""
    title_m = re.search(r'<title[^>]*>(.*?)</title>', head, re.S)
    title = re.sub(r'\s*\|\s*AdOff\s*$', '', title_m.group(1)).strip() if title_m else ""
    metas = []
    for pat in META_PATS:
        m = re.search(pat, head)
        metas.append(m.group(2) if (m and HAS_LETTER.search(m.group(2))) else None)
    parts, slots, body_texts = extract_body_nodes(body)
    attrs = []
    for m in ATTR_RE.finditer(body):
        if HAS_LETTER.search(m.group(2)) and m.group(2) not in attrs:
            attrs.append(m.group(2))
    src = ([title] if title else []) + [x for x in metas if x] + body_texts + attrs
    meta_idx = {"title": title, "metas": metas, "parts": parts, "slots": slots,
                "body_texts": body_texts, "attrs": attrs}
    return src, meta_idx


def rebuild(head, body, lang, src_tr, info):
    """Riassembla head+body con le traduzioni (src_tr = lista parallela a collect_sources)."""
    it = iter(src_tr)
    if info["title"]:
        t = next(it)
        head = re.sub(r'(<title[^>]*>).*?(</title>)', lambda m: m.group(1) + t + " | AdOff" + m.group(2),
                      head, count=1, flags=re.S)
    for pat, orig in zip(META_PATS, info["metas"]):
        if orig is None:
            continue
        tv = next(it)
        head = re.sub(pat, lambda m: m.group(1) + tv + m.group(3), head, count=1)
    parts = list(info["parts"])
    for (idx, lead, trail) in info["slots"]:
        parts[idx] = lead + next(it) + trail
    body = "".join(parts)
    if info["attrs"]:
        amap = {a: next(it) for a in info["attrs"]}
        body = ATTR_RE.sub(lambda m: (m.group(1) + amap.get(m.group(2), m.group(2)) + m.group(3))
                           if HAS_LETTER.search(m.group(2)) else m.group(0), body)
    return head, body


def hreflang_block(url_map):
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{BASE}{url}" />'
             for la, url in url_map.items()]
    xdef = url_map.get('en') or url_map.get('it')
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{BASE}{xdef}" />')
    return "\n".join(lines)


def set_head(html, lang, canonical, block):
    dir_attr = ' dir="rtl"' if lang in RTL else ""
    html = re.sub(r'<html\b[^>]*>', f'<html lang="{lang}"{dir_attr}>', html, count=1)
    if re.search(r'<link rel="canonical"[^>]*>', html):
        html = re.sub(r'<link rel="canonical"[^>]*>',
                      f'<link rel="canonical" href="{BASE}{canonical}" />', html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf'\g<1>{BASE}{canonical}\g<2>', html)
    html = re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*/>\s*\n', '', html)
    html = re.sub(r'(<link rel="canonical"[^>]*>\n)', rf'\1{block}\n', html, count=1)
    return html


def build_pages():
    """Definisce le pagine e le mappe lang→(file, url). url path-based extensionless;
    blog usa dir-style /blog/ e /<lang>/blog/."""
    pages = []

    def same_slug(slug, master_lang, root_url=None):
        # url: master_lang→/slug (root), altri→/<lang>/slug
        umap = {}
        files = {}
        for la in LANGS:
            if la == master_lang:
                umap[la] = root_url or f"/{slug}"
                files[la] = SITE / f"{slug}.html"
            else:
                umap[la] = f"/{la}/{slug}"
                files[la] = SITE / la / f"{slug}.html"
        return umap, files

    # ublock-origin-alternative (en root) → genera le 13 lingue mancanti
    um, fl = same_slug("ublock-origin-alternative", "en")
    pages.append({"name": "ublock-origin-alternative", "master": SITE / "ublock-origin-alternative.html",
                  "master_lang": "en", "urls": um, "files": fl})

    # license-guide (en root) → genera it,ar
    um, fl = same_slug("license-guide", "en")
    pages.append({"name": "license-guide", "master": SITE / "license-guide.html",
                  "master_lang": "en", "urls": um, "files": fl})

    # salesletter (it root) → genera id,pl
    um, fl = same_slug("salesletter", "it")
    pages.append({"name": "salesletter", "master": SITE / "salesletter.html",
                  "master_lang": "it", "urls": um, "files": fl})

    # about/chi-sono: en=about, it=chi-sono, altri=/<lang>/about
    um, fl = {}, {}
    for la in LANGS:
        if la == "en":
            um[la], fl[la] = "/about", SITE / "about.html"
        elif la == "it":
            um[la], fl[la] = "/chi-sono", SITE / "chi-sono.html"
        else:
            um[la], fl[la] = f"/{la}/about", SITE / la / "about.html"
    pages.append({"name": "about", "master": SITE / "about.html",
                  "master_lang": "en", "urls": um, "files": fl})

    # blog index + 3 post (en root, dir-style /blog/)
    blog_files = ["index", "honest-ad-blocker-no-acceptable-ads",
                  "how-to-block-ads-on-chrome", "paid-ad-blocker-when-makes-sense"]
    for bf in blog_files:
        um, fl = {}, {}
        for la in LANGS:
            base_url = "/blog/" if bf == "index" else f"/blog/{bf}"
            if la == "en":
                um[la], fl[la] = base_url, SITE / "blog" / f"{bf}.html"
            else:
                lurl = f"/{la}/blog/" if bf == "index" else f"/{la}/blog/{bf}"
                um[la], fl[la] = lurl, SITE / la / "blog" / f"{bf}.html"
        pages.append({"name": f"blog/{bf}", "master": SITE / "blog" / f"{bf}.html",
                      "master_lang": "en", "urls": um, "files": fl})
    return pages


def split_head_body(html):
    m = re.search(r'(.*?<body[^>]*>)(.*?)(</body>.*)', html, re.S | re.I)
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def process_page(page, dry):
    master_html = page["master"].read_text(encoding="utf-8", errors="ignore")
    block = hreflang_block(page["urls"])
    missing = [la for la in LANGS if not page["files"][la].exists()]
    refreshed = [la for la in LANGS if la not in missing]
    # rinfresca head delle lingue esistenti (canonical/hreflang/lang/og 15-lingue)
    for la in refreshed:
        out = page["files"][la]
        html = set_head(out.read_text(encoding="utf-8", errors="ignore"), la, page["urls"][la], block)
        if not dry:
            out.write_text(html, encoding="utf-8")
    if dry:
        print(f"  {page['name']}: genererebbe {','.join(missing) or '-'} · refresh {len(refreshed)}")
        return
    if missing:
        sp = split_head_body(master_html)
        if not sp:
            print(f"    ✗ {page['name']}: master senza <body>, skip"); return
        head, body, tail = sp
        src, info = collect_sources(head, body)
        tr = translate_multi(src, missing)   # {lang: [...len(src)...]}
        for la in missing:
            nhead, nbody = rebuild(head, body, la, tr[la], info)
            html = set_head(nhead + nbody + tail, la, page["urls"][la], block)
            out = page["files"][la]
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html, encoding="utf-8")
    print(f"  {page['name']}: generate={','.join(missing) or '-'} ({len(src) if missing else 0} stringhe) · refresh-head={len(refreshed)}")


def main():
    dry = "--dry" in sys.argv
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    for page in build_pages():
        if only and page["name"] != only:
            continue
        process_page(page, dry)


if __name__ == "__main__":
    main()
