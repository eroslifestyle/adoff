#!/usr/bin/env python3
"""Prose-page i18n centralizer (SEO-safe, baked).

Estrae il contenuto traducibile delle pagine prosa esistenti in un master
per-lingua (sviluppo/seo-tools/.state/prose/<slug>/<lang>.json) + un template
byte-fedele (_template.html), e rigenera gli HTML baked /{lang}/<slug>.html.
Il master vive FUORI da site/ (non deployato): le prose sono baked, quindi
template/JSON sono sorgente di build, non asset runtime.

Principio: nessuna ri-traduzione e nessuna riserializzazione DOM. Il contenuto
di OGNI lingua viene estratto dal SUO HTML attuale tramite sostituzione di
stringa esatta, così il round-trip è byte-identico (verificato) e non si perde
nulla. Le parti deterministiche (canonical/hreflang/og:url/html-lang) sono
rese dal pattern note.

Uso:
  prose_i18n.py extract <slug>     # crea template + <lang>.json, verifica round-trip
  prose_i18n.py check <slug>       # rigenera in memoria e confronta byte vs attuale
"""
import sys, re, json, pathlib, difflib
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
# Master prose i18n lives OUTSIDE site/ (never deployed), mirroring the
# gap-landings master in sviluppo/seo-tools/.state. The prose HTML is baked,
# so these templates/JSON are a build-time source, not a runtime asset.
PROSE_STORE = ROOT / "sviluppo" / "seo-tools" / ".state" / "prose"
BASE = "https://adoff.app"
LANGS = ["it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "hi", "ja", "ko", "tr", "id", "pl"]
# Baked SEO prose pages centralized by this tool. NOT the 4 gap-landings
# (own gap_landings_master.json) nor 'guide' (IT-root, out of scope).
PAGES = ["how-it-works", "unique-tech", "community", "press", "best-ad-blocker-2026",
         "accessibility", "adblock-detector", "block-video-ads", "bypass-anti-adblock",
         "lightweight-ad-blocker", "manifest-v3-ad-blocker", "private-ad-blocker",
         "undetectable-ad-blocker", "vs/ublock-origin", "vs/adblock-plus", "vs/adguard"]
OG_LOCALE = {"it": "it_IT", "en": "en_US", "de": "de_DE", "fr": "fr_FR", "es": "es_ES",
             "pt": "pt_PT", "ru": "ru_RU", "ar": "ar_SA", "zh": "zh_CN", "hi": "hi_IN",
             "ja": "ja_JP", "ko": "ko_KR", "tr": "tr_TR", "id": "id_ID", "pl": "pl_PL"}

# root EN-baked prose pages live at /<slug>.html (root) + /<lang>/<slug>.html
def page_path(slug, lang):
    return SITE / f"{slug}.html" if lang == "en" else SITE / lang / f"{slug}.html"

def page_url(slug, lang):
    return f"{BASE}/{slug}" if lang == "en" else f"{BASE}/{lang}/{slug}"

def body_text_nodes(html):
    soup = BeautifulSoup(html, "html.parser")
    art = soup.find("article") or soup.find("main") or soup.body
    out = []
    for el in art.find_all(string=True):
        if el.parent.name in ("script", "style"):
            continue
        if el.strip():
            out.append(el.strip())
    return out

def jsonld_strings(html):
    """Return the human-text string values inside JSON-LD blocks, in order."""
    vals = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            data = json.loads(m.group(1))
        except Exception:
            continue
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
            elif isinstance(o, str):
                # keep only human text (skip urls, types, schema tokens)
                if o.startswith(("http", "https", "/", "schema.org")) or o.startswith("@"):
                    return
                if re.fullmatch(r'[A-Za-z]+', o) and o[:1].isupper() and len(o) < 20:
                    # likely a schema enum/type token like "Article"; still may be brand — keep if has space
                    return
                vals.append(o)
        walk(data)
    return vals

HEAD_FIELDS = [
    ("title", r'(<title>)(.*?)(</title>)'),
    ("desc", r'(<meta name="description" content=")(.*?)(")'),
    ("ogtitle", r'(<meta property="og:title" content=")(.*?)(")'),
    ("ogdesc", r'(<meta property="og:description" content=")(.*?)(")'),
    ("twtitle", r'(<meta name="twitter:title" content=")(.*?)(")'),
    ("twdesc", r'(<meta name="twitter:description" content=")(.*?)(")'),
]

def extract_one(slug, lang):
    """Extract content dict from a language's current HTML via exact substitution."""
    html = page_path(slug, lang).read_text(encoding="utf-8")
    content = {}
    # head fields (value group 2)
    for key, pat in HEAD_FIELDS:
        m = re.search(pat, html, re.S)
        content["H_" + key] = m.group(2) if m else ""
    # body nodes + jsonld strings, sequential exact replacement
    seq = [("B%02d" % i, t) for i, t in enumerate(body_text_nodes(html))]
    seq += [("J%02d" % i, t) for i, t in enumerate(jsonld_strings(html))]
    for key, txt in seq:
        content[key] = txt
    content["_n_body"] = sum(1 for k in content if k.startswith("B"))
    content["_n_jsonld"] = sum(1 for k in content if k.startswith("J"))
    return html, content

def build_template(slug, base="en"):
    """Build a byte-fidelity template from <base> lang, placeholders for variable text."""
    html, content = extract_one(slug, base)
    tmpl = html
    # 1. head fields -> placeholder inside the value group
    for key, pat in HEAD_FIELDS:
        def repl(m):
            return m.group(1) + "{{H_" + key + "}}" + m.group(3)
        tmpl = re.sub(pat, repl, tmpl, count=1, flags=re.S)
    # 2. deterministic head -> placeholders
    tmpl = re.sub(r'(<html[^>]*\blang=")[^"]+(")', r'\1{{LANG}}\2', tmpl, count=1)
    tmpl = re.sub(r'(<link rel="canonical" href=")[^"]+(")', r'\1{{CANONICAL}}\2', tmpl, count=1)
    tmpl = re.sub(r'(<meta property="og:url" content=")[^"]+(")', r'\1{{CANONICAL}}\2', tmpl, count=1)
    if re.search(r'og:locale', tmpl):
        tmpl = re.sub(r'(<meta property="og:locale" content=")[^"]+(")', r'\1{{OGLOCALE}}\2', tmpl, count=1)
    # hreflang block: NOT parameterized. The alternate-URL set is identical across
    # all languages of a page (only the ordering drifted between generators), so we
    # keep each page's hreflang verbatim. A language shares the common template only
    # if its hreflang order already matches the base; otherwise it falls to a
    # per-language template that preserves its own order. Both paths stay zero-diff.
    # 3a. body text: monotonic cursor (protects short nodes like "and" from
    #     matching inside unrelated words earlier in the file).
    miss = []
    cur = 0
    for key in [k for k in content if k.startswith("B")]:
        txt = content[key]
        idx = tmpl.find(txt, cur)
        if idx == -1:
            miss.append((key, txt[:50])); continue
        tmpl = tmpl[:idx] + "{{" + key + "}}" + tmpl[idx + len(txt):]
        cur = idx + len(key) + 4
    # 3b. jsonld text: separate pass from start (JSON-LD blocks live in <head>,
    #     before the body cursor). find first still-raw occurrence (body copies
    #     are already placeholders, so this lands on the JSON-LD copy).
    for key in [k for k in content if k.startswith("J")]:
        txt = content[key]
        idx = tmpl.find(txt)
        if idx == -1:
            miss.append((key, txt[:50])); continue
        tmpl = tmpl[:idx] + "{{" + key + "}}" + tmpl[idx + len(txt):]
    # 4. localized internal links: parameterized ONLY for the common (EN-base)
    #    template, which is reused across the languages that share it. A
    #    per-language template is dedicated to one language, so its internal
    #    links are kept verbatim (some languages legitimately link the EN-root
    #    form while others localize it — preserving each keeps the round-trip
    #    byte-identical instead of forcing one convention onto all).
    if base == "en":
        it_html = page_path(slug, "it").read_text(encoding="utf-8")
        loc_slugs = sorted(set(re.findall(r'href="/it/([a-z0-9-]+(?:/[a-z0-9-]+)?(?:\.html)?)"', it_html)),
                           key=len, reverse=True)
        for s in loc_slugs:
            tmpl = tmpl.replace(f'href="/{s}"', f'href="{{{{LP:{s}}}}}"')
    return tmpl, content, miss

def render(tmpl, content, slug, lang):
    out = tmpl
    out = out.replace("{{LANG}}", lang)
    out = out.replace("{{CANONICAL}}", page_url(slug, lang))
    out = out.replace("{{OGLOCALE}}", OG_LOCALE[lang])
    for key, val in content.items():
        if key.startswith("_"):
            continue
        out = out.replace("{{" + key + "}}", val, 1)
    # localized internal links
    def lp(m):
        s = m.group(1)
        return f"/{s}" if lang == "en" else f"/{lang}/{s}"
    out = re.sub(r'\{\{LP:([a-z0-9/-]+)\}\}', lp, out)
    return out

DRIFT_RE = re.compile(r'\?v=|answer-box|border|adblock-detector|defer')

def _tmpl_for(outdir, lang, common):
    own = outdir / f"_template.{lang}.html"
    return own.read_text(encoding="utf-8") if own.exists() else common

def cmd_extract(slug):
    tmpl, en_content, miss = build_template(slug, "en")
    if miss:
        print("[extract] ATTENZIONE placeholder non trovati:", miss)
    rt = render(tmpl, en_content, slug, "en")
    if rt != page_path(slug, "en").read_text(encoding="utf-8"):
        print("[extract] round-trip EN FALLITO — STOP"); return
    print("[extract] round-trip EN byte-identico: True")
    nB, nJ = en_content["_n_body"], en_content["_n_jsonld"]
    outdir = PROSE_STORE / slug
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "_template.html").write_text(tmpl, encoding="utf-8")
    # clear any stale per-language templates from a previous extract
    for stale in outdir.glob("_template.*.html"):
        stale.unlink()
    shared, own, fail = [], [], []
    for lang in LANGS:
        cur = page_path(slug, lang).read_text(encoding="utf-8")
        _, c = extract_one(slug, lang)
        # A language shares the common template ONLY if it regenerates byte-identical.
        if c["_n_body"] == nB and c["_n_jsonld"] == nJ and render(tmpl, c, slug, lang) == cur:
            (outdir / f"{lang}.json").write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
            shared.append(lang)
            continue
        # per-language template: preserva esattamente la struttura di quella lingua
        t2, c2, _ = build_template(slug, lang)
        rt2 = render(t2, c2, slug, lang) == cur
        (outdir / f"_template.{lang}.html").write_text(t2, encoding="utf-8")
        (outdir / f"{lang}.json").write_text(json.dumps(c2, ensure_ascii=False, indent=1), encoding="utf-8")
        (own if rt2 else fail).append(lang)
    print(f"[extract] EN body={nB} jsonld={nJ}")
    print(f"[extract] template COMUNE (byte-identico): {len(shared)} lingue {shared}")
    print(f"[extract] template PER-LINGUA (round-trip OK): {own or 'nessuna'}")
    if fail:
        print(f"[extract] ⚠️ PER-LINGUA round-trip FAIL (NON applicare): {fail}")

def cmd_check(slug):
    outdir = PROSE_STORE / slug
    common = (outdir / "_template.html").read_text(encoding="utf-8")
    bad = 0
    for lang in LANGS:
        content = json.loads((outdir / f"{lang}.json").read_text(encoding="utf-8"))
        gen = render(_tmpl_for(outdir, lang, common), content, slug, lang)
        cur = page_path(slug, lang).read_text(encoding="utf-8")
        if gen == cur:
            print(f"  {lang}: byte-identico ✓"); continue
        diff = [d for d in difflib.unified_diff(cur.splitlines(), gen.splitlines(), lineterm="", n=0)
                if d[:1] in "+-" and d[:2] not in ("++", "--")]
        other = sum(1 for d in diff if not DRIFT_RE.search(d) and d[1:].strip())
        if other == 0:
            print(f"  {lang}: {len(diff)} righe = solo-drift (normalizza) ✓")
        else:
            print(f"  {lang}: {len(diff)} righe, ⚠️ {other} NON-drift"); bad += 1
    print(f"[check] lingue con contenuto a rischio: {bad}")

def cmd_apply(slug):
    outdir = PROSE_STORE / slug
    common = (outdir / "_template.html").read_text(encoding="utf-8")
    n = 0
    for lang in LANGS:
        content = json.loads((outdir / f"{lang}.json").read_text(encoding="utf-8"))
        gen = render(_tmpl_for(outdir, lang, common), content, slug, lang)
        page_path(slug, lang).write_text(gen, encoding="utf-8")
        n += 1
    print(f"[apply] scritti {n} HTML di produzione per {slug}")

def cmd_check_all(_=None):
    """Deploy gate: regenerate every prose page in memory; non-zero if any drifts."""
    bad = 0
    for slug in PAGES:
        outdir = PROSE_STORE / slug
        if not (outdir / "_template.html").exists():
            print(f"  {slug}: master MANCANTE — esegui extract"); bad += 1; continue
        common = (outdir / "_template.html").read_text(encoding="utf-8")
        risk = 0
        for lang in LANGS:
            content = json.loads((outdir / f"{lang}.json").read_text(encoding="utf-8"))
            gen = render(_tmpl_for(outdir, lang, common), content, slug, lang)
            cur = page_path(slug, lang).read_text(encoding="utf-8")
            if gen == cur:
                continue
            diff = [d for d in difflib.unified_diff(cur.splitlines(), gen.splitlines(), lineterm="", n=0)
                    if d[:1] in "+-" and d[:2] not in ("++", "--")]
            if any(not DRIFT_RE.search(d) for d in diff):
                risk += 1
        flag = "✓" if risk == 0 else f"⚠️ {risk} lingue a rischio"
        print(f"  {slug}: {flag}")
        bad += 1 if risk else 0
    print(f"[check-all] pagine a rischio: {bad}")
    if bad:
        sys.exit(1)

def cmd_apply_all(_=None):
    for slug in PAGES:
        cmd_apply(slug)

if __name__ == "__main__":
    NO_SLUG = {"check-all": cmd_check_all, "apply-all": cmd_apply_all}
    if len(sys.argv) >= 2 and sys.argv[1] in NO_SLUG:
        NO_SLUG[sys.argv[1]](); sys.exit(0)
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    cmd, slug = sys.argv[1], sys.argv[2]
    {"extract": cmd_extract, "check": cmd_check, "apply": cmd_apply}[cmd](slug)
