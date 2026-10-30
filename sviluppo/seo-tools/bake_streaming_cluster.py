#!/usr/bin/env python3
"""Bake meccanico delle landing SEO streaming cluster.

Legge i template site/youtube-ad-blocker.html (EN) e site/it/youtube-ad-blocker.html (IT),
estrae VERBATIM le parti invarianti (critical CSS, preload, style locale, script finali)
e le ricombina con i contenuti in sviluppo/seo-tools/streaming-cluster/content/<slug>.<lang>.json.

Uso: python3 bake_streaming_cluster.py [--dry-run] [--only SLUG] [--selfcheck]
"""
import argparse
import html as htmllib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
CONTENT = ROOT / "sviluppo/seo-tools/streaming-cluster/content"
BASE = "https://adoff.app"

TEMPLATES = {"en": SITE / "youtube-ad-blocker.html", "it": SITE / "it/youtube-ad-blocker.html"}

REQUIRED_FIELDS = ["slug", "lang", "title", "description", "h1", "answer",
                   "sections", "faq", "related", "cta", "date_published", "date_modified"]

# Limiti per-lingua: ja/ko/zh usano ideogrammi (2-3 char = una parola latina),
# i limiti latini (70/120-165) costringerebbero a gonfiare il testo.
# ponytail: soglia fissa per famiglia, aggiungi lingue qui se il cluster cresce.
CJK_LANGS = {"ja", "ko", "zh"}
TITLE_MAX, TITLE_MAX_CJK = 70, 40
# Il minimo è una linea guida morbida (description troppo magre rendono poco in SERP):
# 117 vs 120 non ha effetto reale su Google. Il MASSIMO è un limite di rendering
# (Google tronca in SERP): non si tocca.
DESC_MIN, DESC_MAX = 100, 165
DESC_MIN_CJK, DESC_MAX_CJK = 50, 100
# Limite answer per-lingua. Misurato sul cluster: en 261-372 (media 312), it 273-399;
# le traduzioni latine sono del 20-35% più lunghe (de 375-432, es 430, fr 450, pt 411,
# ru 429), mentre gli ideogrammi sono compatti (ja 168). 500 lascia margine sul massimo
# osservato (450) e resta una risposta estraibile da un motore di risposta; alzare oltre
# snaturerebbe il formato answer-first.
ANSWER_MAX_CJK = 260
ANSWER_MAX = 400       # en, it
ANSWER_MAX_WIDE = 500  # tutte le altre lingue
FAQ_MIN = 3
BANNED = ["100%", "guaranteed", "garantito", "garantisce", "eroslifestyle", "erosdegrande", "github.com/"]

FAQ_H2 = {
    "en": "Frequently asked questions", "it": "Domande frequenti",
    "ar": "الأسئلة الشائعة", "de": "Häufige Fragen", "es": "Preguntas frecuentes",
    "fr": "Questions fréquentes", "hi": "अक्सर पूछे जाने वाले प्रश्न",
    "id": "Pertanyaan umum", "ja": "よくある質問", "ko": "자주 묻는 질문",
    "pl": "Często zadawane pytania", "pt": "Perguntas frequentes",
    "ru": "Часто задаваемые вопросы", "tr": "Sıkça sorulan sorular", "zh": "常见问题",
}
RELATED_LEAD = {
    "en": "More on this:", "it": "Approfondimenti:",
    "ar": "مزيد حول هذا الموضوع:", "de": "Mehr dazu:", "es": "Más sobre esto:",
    "fr": "Pour en savoir plus :", "hi": "इस पर और पढ़ें:", "id": "Selengkapnya:",
    "ja": "関連記事:", "ko": "관련 글:", "pl": "Więcej na ten temat:",
    "pt": "Saiba mais:", "ru": "Подробнее:", "tr": "İlgili yazılar:", "zh": "延伸阅读:",
}


def fail(msg):
    sys.exit(f"ERRORE: {msg}")


def _between(text, start_marker, end_marker, from_pos=0, include_start=True):
    """Estrae la sottostringa fra start_marker e il primo end_marker dopo di esso."""
    i = text.find(start_marker, from_pos)
    if i < 0:
        fail(f"delimitatore non trovato nel template: {start_marker[:60]!r}")
    j = text.find(end_marker, i + len(start_marker))
    if j < 0:
        fail(f"delimitatore di chiusura non trovato: {end_marker[:60]!r}")
    j += len(end_marker)
    return text[i:j] if include_start else text[i + len(start_marker):j - len(end_marker)]


class Template:
    """Parti invarianti estratte verbatim da un template."""

    def __init__(self, path):
        t = path.read_text(encoding="utf-8")
        self.theme_script = _between(t, "<script>", "</script>")
        self.critical = _between(t, '<link rel="preload" id="adoff-font"', "</style>")
        self.css_link = _between(t, '<link rel="preload" href="/style.css', "</noscript>")
        self.local_style = _between(t, "<style>", "</style>", from_pos=t.find(self.critical) + len(self.critical))
        self.head_static = "\n".join([
            '<link rel="icon" href="/assets/icon128.png" type="image/png" />',
            '<link rel="manifest" href="/manifest.webmanifest" />',
            '<meta name="theme-color" content="#0a0a1a" />',
        ])
        self.body_scripts = _between(t, '<script src="/adoff-i18n.js', "</html>")
        # sanity
        if len(self.critical) < 5000:
            fail(f"critical CSS estratto troppo corto ({len(self.critical)} byte) da {path}")


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def esc(s):
    return htmllib.escape(s, quote=True)


def limits_for(lang):
    if lang in CJK_LANGS:
        return TITLE_MAX_CJK, DESC_MIN_CJK, DESC_MAX_CJK
    return TITLE_MAX, DESC_MIN, DESC_MAX


def validate(data):
    for f in REQUIRED_FIELDS:
        if f not in data:
            fail(f"{data.get('slug', '?')}.{data.get('lang', '?')}.json: campo obbligatorio mancante: {f}")
    slug, lang = data["slug"], data["lang"]
    t_max, d_min, d_max = limits_for(lang)
    if len(data["title"]) > t_max:
        fail(f"{slug}.{lang}: title {len(data['title'])} char (max {t_max}): {data['title']!r}")
    if not d_min <= len(data["description"]) <= d_max:
        fail(f"{slug}.{lang}: description {len(data['description'])} char (consentiti {d_min}-{d_max})")
    a_max = (ANSWER_MAX_CJK if lang in CJK_LANGS
             else ANSWER_MAX if lang in ("en", "it") else ANSWER_MAX_WIDE)
    if len(strip_tags(data["answer"])) > a_max:
        fail(f"{slug}.{lang}: answer più lunga di {a_max} char")
    if len(data["faq"]) < FAQ_MIN:
        fail(f"{slug}.{lang}: solo {len(data['faq'])} FAQ (minimo {FAQ_MIN})")
    if lang not in FAQ_H2:
        fail(f"{slug}.{lang}: lang non supportata (disponibili: {', '.join(sorted(FAQ_H2))})")
    hay = json.dumps(data, ensure_ascii=False)
    for bad in BANNED:
        if bad.lower() in hay.lower():
            fail(f"{slug}.{lang}: stringa vietata presente nel contenuto: {bad!r}")
    for sec in data["sections"]:
        if "h2" not in sec or "body" not in sec:
            fail(f"{slug}.{lang}: section senza h2/body")
    for f in data["faq"]:
        if "q" not in f or "a" not in f:
            fail(f"{slug}.{lang}: voce faq senza q/a")
    if "cta" not in data or not all(k in data["cta"] for k in ("h3", "p", "btn")):
        fail(f"{slug}.{lang}: cta incompleta (h3/p/btn)")


def canonical_url(slug, lang):
    return f"{BASE}/{slug}" if lang == "en" else f"{BASE}/{lang}/{slug}"


def langs_for_slug(slug, only_langs=None):
    """Lingue realmente presenti in content/ per questo slug (sempre almeno 'en')."""
    langs = sorted({f.stem.split(".")[-1] for f in CONTENT.glob(f"{slug}.*.json")})
    if only_langs:
        langs = [la for la in langs if la in only_langs]
    return langs


def hreflang_block(slug, langs):
    """hreflang reciproci: una riga per OGNI lingua generata + x-default verso l'en."""
    lines = [f'  <link rel="alternate" hreflang="{la}" href="{canonical_url(slug, la)}" />' for la in langs]
    lines.append(f'  <link rel="alternate" hreflang="x-default" href="{canonical_url(slug, "en")}" />')
    return "\n".join(lines)


def json_ld_article(d):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": strip_tags(d["h1"]),
        "description": strip_tags(d["description"]),
        "image": f"{BASE}/assets/og-image.png",
        "author": {"@type": "Organization", "name": "AdOff"},
        "publisher": {"@type": "Organization", "name": "AdOff"},
        "datePublished": d["date_published"],
        "dateModified": d["date_modified"],
        "inLanguage": d["lang"],
    }, ensure_ascii=False, indent=2)


def json_ld_faq(d):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": strip_tags(f["q"]),
             "acceptedAnswer": {"@type": "Answer", "text": strip_tags(f["a"])}}
            for f in d["faq"]
        ],
    }, ensure_ascii=False, indent=2)


def json_ld_breadcrumb(d):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "AdOff", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": strip_tags(d["title"]), "item": canonical_url(d["slug"], d["lang"])},
        ],
    }, ensure_ascii=False, indent=2)


def build_body(d):
    p = []
    p.append(f'  <main>\n    <article class="article-page">')
    p.append(f"      <h1>{d['h1']}</h1>")
    p.append(f'      <div class="answer-box"><p>{d["answer"]}</p></div>')
    for sec in d["sections"]:
        p.append(f"      <h2>{sec['h2']}</h2>")
        for para in sec["body"]:
            p.append(f"      <p>{para}</p>")
    rep = d.get("report")
    if rep:
        p.append('      <div class="cta-section">')
        p.append(f"        <p>{rep['intro']}</p>")
        p.append(f'        <a href="{esc(rep["btn_href"])}" class="btn" rel="nofollow">{rep["btn_text"]}</a>')
        p.append("      </div>")
    p.append(f"      <h2>{FAQ_H2[d['lang']]}</h2>")
    for f in d["faq"]:
        p.append(f"      <h3>{f['q']}</h3>\n      <p>{f['a']}</p>")
    rel = ", ".join(f'<a href="{esc(r["href"])}">{r["text"]}</a>' for r in d["related"])
    p.append(f"      <p>{RELATED_LEAD[d['lang']]} {rel}.</p>")
    p.append('      <div class="cta-section">')
    p.append(f"        <h3>{d['cta']['h3']}</h3>")
    p.append(f"        <p>{d['cta']['p']}</p>")
    p.append(f'        <a href="{esc(d["cta"].get("btn_href", "/install.html"))}" class="btn">{d["cta"]["btn"]}</a>')
    p.append("      </div>")
    p.append("    </article>\n  </main>")
    return "\n".join(p)


def bake(tpl, d, langs=None):
    slug, lang = d["slug"], d["lang"]
    canon = canonical_url(slug, lang)
    langs = langs or [lang]
    html_open = f'<html lang="{lang}" dir="rtl">' if lang == "ar" else f'<html lang="{lang}">'
    head = "\n".join([
        "<!DOCTYPE html>",
        html_open,
        "<head>",
        tpl.theme_script,
        '  <meta charset="UTF-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        f"  <title>{esc(d['title'])}</title>",
        f'  <meta name="description" content="{esc(d["description"])}" />',
        '  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
        f'  <link rel="canonical" href="{canon}" />',
        hreflang_block(slug, langs),
        '  <meta property="og:type" content="article" />',
        f'  <meta property="og:title" content="{esc(d["title"])}" />',
        f'  <meta property="og:description" content="{esc(d["description"])}" />',
        f'  <meta property="og:image" content="{BASE}/assets/og-image.png" />',
        f'  <meta property="og:url" content="{canon}" />',
        '  <meta name="twitter:card" content="summary_large_image" />',
        f'  <meta name="twitter:title" content="{esc(d["title"])}" />',
        f'  <meta name="twitter:description" content="{esc(d["description"])}" />',
        f'  <meta name="twitter:image" content="{BASE}/assets/og-image.png" />',
        tpl.head_static,
        tpl.critical,
        tpl.css_link,
        tpl.local_style,
        f'  <script type="application/ld+json">\n  {json_ld_article(d)}\n  </script>',
        f'  <script type="application/ld+json">\n  {json_ld_faq(d)}\n  </script>',
        f'  <script type="application/ld+json">\n  {json_ld_breadcrumb(d)}\n  </script>',
        "</head>",
        "<body>",
        build_body(d),
        tpl.body_scripts,
    ])
    return head + "\n"


def load_contents(only=None, only_langs=None):
    files = sorted(CONTENT.glob("*.json"))
    if only:
        files = [f for f in files if f.stem.split(".")[0] == only]
        if not files:
            fail(f"--only {only}: nessun file content/{only}.<lang>.json")
    data = []
    for f in files:
        m = re.fullmatch(r"([a-z0-9-]+)\.([a-z]{2})", f.stem)
        if not m:
            fail(f"nome file non conforme <slug>.<lang>.json: {f.name}")
        d = json.loads(f.read_text(encoding="utf-8"))
        if only_langs and d.get("lang") not in only_langs:
            continue
        data.append(d)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", metavar="SLUG")
    ap.add_argument("--langs", metavar="LA1,LA2", help="processa solo queste lingue (es. --langs en,ja)")
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="fermati al primo errore di validazione (default: salta la pagina e continua)")
    args = ap.parse_args()
    if args.selfcheck:
        _selfcheck()
        return
    only_langs = {la.strip() for la in args.langs.split(",")} if args.langs else None
    data = load_contents(args.only, only_langs)
    if not data:
        fail("nessun contenuto da processare")
    tpls = {}
    total = 0
    errors = []
    generated = 0
    for d in data:
        lang = d["lang"]
        slug = d["slug"]
        try:
            validate(d)
        except SystemExit as e:
            if args.strict:
                raise
            errors.append(f"{slug}.{lang}: {str(e).replace('ERRORE: ', '')}")
            continue
        # ponytail: le nuove lingue usano il template EN (invarianti identici, solo en/it hanno template proprio)
        tpl_key = lang if lang in TEMPLATES else "en"
        if tpl_key not in tpls:
            tpls[tpl_key] = Template(TEMPLATES[tpl_key])
        tpl = tpls[tpl_key]
        out = SITE / f"{d['slug']}.html" if lang == "en" else SITE / lang / f"{d['slug']}.html"
        langs = langs_for_slug(d["slug"], only_langs)
        html = bake(tpl, d, langs)
        if not args.dry_run:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html, encoding="utf-8")
        generated += 1
        print(f"{slug} {lang} → {out.relative_to(ROOT)} ({len(html.encode())} bytes)")
        total += len(html.encode())
    print(f"\n{generated} pagine, {total} bytes totali" + (" [dry-run]" if args.dry_run else ""))
    if errors:
        print(f"\nERRORI ({len(errors)})")
        for err in errors:
            print(f"- {err}")
    sys.exit(1 if errors else 0)


def _selfcheck():
    tpl = Template(TEMPLATES["en"])
    assert len(tpl.critical) > 5000, f"critical CSS {len(tpl.critical)} byte, atteso > 5000"
    d = {
        "slug": "selfcheck-test", "lang": "en",
        "title": "Selfcheck Test Page Title",
        "description": "x" * 130,
        "h1": "H1 <em>test</em>",
        "answer": "Answer with <strong>bold</strong> inline.",
        "sections": [{"h2": "S1", "body": ["One <code>c</code>."]}],
        "faq": [{"q": f"Q{i}?", "a": f"A{i} <a href='/x'>link</a>"} for i in range(1, 5)],
        "related": [{"href": "/rel", "text": "Rel"}],
        "cta": {"h3": "CTA", "p": "Go", "btn": "Install"},
        "report": None,
        "date_published": "2026-09-20", "date_modified": "2026-09-20",
    }
    html = bake(tpl, d)
    assert html.count('type="application/ld+json"') == 3, "attesi esattamente 3 blocchi JSON-LD"
    h3_count = len(re.findall(r"<h3>Q\d+\?</h3>", html))
    faq_ld = json.loads(re.search(r'"@type": "FAQPage".*?"mainEntity": (\[.*?\])\s*\}', html, re.S).group(1).replace("\n  ", "\n"))
    assert h3_count == len(faq_ld), f"{h3_count} <h3> vs {len(faq_ld)} Question"
    try:
        validate({**d, "title": "T" * 71})
        raise AssertionError("title > 70 accettata: validazione non funziona")
    except SystemExit:
        pass
    # limiti CJK: title giapponese 45 char respinta, 35 accettata; description corta ok
    ja = {**d, "lang": "ja", "slug": "selfcheck-ja"}
    try:
        validate({**ja, "title": "あ" * 45})
        raise AssertionError("title ja 45 char accettata: limiti CJK non applicati")
    except SystemExit:
        pass
    validate({**ja, "title": "あ" * 35, "description": "あ" * 80})  # non deve fallire
    try:
        validate({**ja, "title": "あ" * 35, "description": "x" * 130})
        raise AssertionError("description ja 130 char accettata (max CJK 100)")
    except SystemExit:
        pass
    # hreflang reciproci solo per lingue con file: simuliamo slug con en+ja
    content_backup = sorted(CONTENT.glob("selfcheck-href.*.json"))
    for f in content_backup:
        f.unlink()
    for la in ("en", "ja"):
        (CONTENT / f"selfcheck-href.{la}.json").write_text("{}", encoding="utf-8")
    try:
        langs = langs_for_slug("selfcheck-href")
        assert langs == ["en", "ja"], f"langs_for_slug: {langs}"
        block = hreflang_block("selfcheck-href", langs)
        assert 'hreflang="en"' in block and 'hreflang="ja"' in block, block
        assert 'hreflang="it"' not in block, "hreflang it senza file content"
        assert 'hreflang="x-default"' in block
        # tutte le lingue del gruppo ricevono lo stesso set
        assert hreflang_block("selfcheck-href", langs) == block
    finally:
        for f in sorted(CONTENT.glob("selfcheck-href.*.json")):
            f.unlink()
    # arabo: dir="rtl" sul tag html
    ar_html = bake(tpl, {**d, "lang": "ar", "slug": "selfcheck-ar"})
    assert '<html lang="ar" dir="rtl">' in ar_html, 'manca dir="rtl" per ar'
    assert '"inLanguage": "ar"' in ar_html
    # limiti answer per-lingua: de 450 accettata (max 500), 520 respinta; ja 300 respinta (max CJK 260), 200 accettata
    de = {**d, "lang": "de", "slug": "selfcheck-de"}
    validate({**de, "answer": "A" * 450})  # non deve fallire
    try:
        validate({**de, "answer": "A" * 520})
        raise AssertionError("answer de 520 char accettata (max 500)")
    except SystemExit:
        pass
    try:
        validate({**ja, "answer": "あ" * 300})
        raise AssertionError("answer ja 300 char accettata (max CJK 260)")
    except SystemExit:
        pass
    validate({**ja, "description": "あ" * 80, "answer": "あ" * 200})  # non deve fallire
    # bake non-strict: una pagina invalida + una valida → genera la valida, riporta 1 errore, exit 1
    import subprocess
    content_dir = CONTENT
    test_files = []
    for name, bad in (("selfcheck-bake.en.json", False), ("selfcheck-bake.de.json", True)):
        content = {
            **d, "slug": "selfcheck-bake",
            "lang": name.split(".")[1],
            "title": "Selfcheck Bake Title",
            "answer": ("A" * 520) if bad else "Answer.",
            "date_published": "2026-09-20", "date_modified": "2026-09-20",
        }
        p = content_dir / name
        p.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
        test_files.append(p)
    # rimuovi eventuale output precedente per verificare che la valida venga generata
    old_out = SITE / "selfcheck-bake.html"
    if old_out.exists():
        old_out.unlink()
    try:
        r = subprocess.run(
            [sys.executable, __file__, "--only", "selfcheck-bake", "--langs", "en,de"],
            capture_output=True, text=True)
        assert r.returncode == 1, f"exit atteso 1, ottenuto {r.returncode}\n{r.stdout}\n{r.stderr}"
        assert old_out.exists(), "pagina valida non generata in modalità non-strict"
        assert "ERRORI (1)" in r.stdout, r.stdout
        assert "selfcheck-bake.de: " in r.stdout, r.stdout
    finally:
        for p in test_files:
            p.unlink(missing_ok=True)
        if old_out.exists():
            old_out.unlink()
    print("selfcheck OK")


if __name__ == "__main__":
    main()
