#!/usr/bin/env python3
"""
AdOff — Generatore gap-landing multilingua (15 lingue, hreflang completo).

A differenza di gen-landing-pages.py (solo EN+IT), questo emette TUTTE le 15 lingue
del sito per le pagine nate dai gap_candidates dell'agente SEO settimanale.

SSOT contenuto:
  - EN + IT  → .state/gap_landings_master.json  (autorale, fatti ancorati)
  - 13 lingue → .state/gap_tr_{a,b,c,d}.json     (tradotte da sub-agent, struttura == EN)

Output: site/<slug>.html (en root) · site/it/<slug>.html · site/<lang>/<slug>.html
Ogni pagina: <html lang> corretto (dir=rtl per ar), canonical=self, hreflang 15 lingue
+ x-default→en, JSON-LD Article + FAQPage. Struttura HTML identica alle altre prose page.

GUARDRAIL: valida che ogni lingua abbia la STESSA struttura dell'EN (numero sezioni,
paragrafi per sezione, FAQ). Se manca o diverge → errore esplicito (niente silenzioso).

Run:  python3 sviluppo/scripts/gen-gap-landings.py
"""
import html as _html
import json
import re
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve()
ROOT = SCRIPT.parents[2]
SITE = ROOT / "site"
STATE = ROOT / "sviluppo" / "seo-tools" / ".state"
MASTER = STATE / "gap_landings_master.json"
TR_FILES = [STATE / f"gap_tr_{g}.json" for g in ("a", "b", "c", "d")]

BASE = "https://adoff.app"
CSSV = "260520-205323"
SCRIPTV = "260608a"
PUB_DATE = "2026-06-08"

# Ordine canonico lingue del sito (== i18n_manager.LANGS).
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
RTL = {'ar'}

# Stringhe UI per-lingua: (heading FAQ, label bottone install).
UI = {
    'it': ("Domande frequenti", "Installa AdOff — gratis →"),
    'en': ("Frequently asked questions", "Install AdOff — free →"),
    'de': ("Häufige Fragen", "AdOff installieren — kostenlos →"),
    'fr': ("Questions fréquentes", "Installer AdOff — gratuit →"),
    'es': ("Preguntas frecuentes", "Instalar AdOff — gratis →"),
    'pt': ("Perguntas frequentes", "Instalar o AdOff — grátis →"),
    'ru': ("Частые вопросы", "Установить AdOff — бесплатно →"),
    'ar': ("الأسئلة الشائعة", "ثبّت AdOff — مجانًا →"),
    'zh': ("常见问题", "安装 AdOff — 免费 →"),
    'hi': ("अक्सर पूछे जाने वाले प्रश्न", "AdOff इंस्टॉल करें — मुफ़्त →"),
    'ja': ("よくある質問", "AdOff をインストール — 無料 →"),
    'ko': ("자주 묻는 질문", "AdOff 설치 — 무료 →"),
    'tr': ("Sıkça sorulan sorular", "AdOff'u yükle — ücretsiz →"),
    'id': ("Pertanyaan umum", "Pasang AdOff — gratis →"),
    'pl': ("Często zadawane pytania", "Zainstaluj AdOff — za darmo →"),
}


def load_content():
    """topic-slug → lang → content dict. EN/IT dal master, resto dai tr file."""
    master = json.loads(MASTER.read_text(encoding="utf-8"))
    topics = {t["slug"]: {"en": t["en"], "it": t["it"]} for t in master["topics"]}
    order = [t["slug"] for t in master["topics"]]
    for f in TR_FILES:
        if not f.exists():
            sys.exit(f"[gap-landings] manca {f.name} — esegui prima gli agenti di traduzione")
        data = json.loads(f.read_text(encoding="utf-8"))
        for lang, per_slug in data.items():
            for slug, c in per_slug.items():
                if slug not in topics:
                    sys.exit(f"[gap-landings] slug ignoto '{slug}' in {f.name}")
                topics[slug][lang] = c
    return order, topics


def validate(order, topics):
    """Ogni lingua deve avere la stessa struttura dell'EN. Errore esplicito se no."""
    problems = []
    for slug in order:
        en = topics[slug]["en"]
        sig = (len(en["sections"]), [len(p) for _, p in en["sections"]], len(en["faq"]))
        for lang in LANGS:
            c = topics[slug].get(lang)
            if not c:
                problems.append(f"{slug}:{lang} MANCANTE")
                continue
            try:
                s = (len(c["sections"]), [len(p) for _, p in c["sections"]], len(c["faq"]))
            except Exception as e:
                problems.append(f"{slug}:{lang} STRUTTURA-ROTTA ({e})")
                continue
            for field in ("title", "desc", "h1", "answer", "cta"):
                if not c.get(field):
                    problems.append(f"{slug}:{lang} campo vuoto '{field}'")
            if s != sig:
                problems.append(f"{slug}:{lang} struttura {s} != EN {sig}")
    if problems:
        print("VALIDAZIONE FALLITA:")
        for p in problems:
            print("  ✗", p)
        sys.exit(1)
    print(f"[gap-landings] validazione OK: {len(order)} topic × {len(LANGS)} lingue, struttura congruente")


# URL extensionless (Cloudflare Pages clean-urls: /slug.html → 308 → /slug). Canonical e
# hreflang puntano alla URL finale 200, non a quella che redirige.
def page_url(slug, lang):
    return f"{BASE}/{slug}" if lang == "en" else f"{BASE}/{lang}/{slug}"


def hreflang_block(slug):
    out = [f'  <link rel="alternate" hreflang="{la}" href="{page_url(slug, la)}" />' for la in LANGS]
    out.append(f'  <link rel="alternate" hreflang="x-default" href="{page_url(slug, "en")}" />')
    return "\n".join(out)


def self_url(slug, lang):
    return page_url(slug, lang)


def render(slug, lang, c):
    faq_head, install_btn = UI[lang]
    su = self_url(slug, lang)
    dir_attr = ' dir="rtl"' if lang in RTL else ""

    sections_html = ""
    for h2, paras in c["sections"]:
        ps = "".join(f"<p>{p}</p>\n      " for p in paras)
        sections_html += f"      <h2>{h2}</h2>\n      {ps}\n"

    tool_html = ""
    if c.get("tool"):
        label, href = c["tool"]
        tool_html = f'      <p><a href="{href}" style="color:#7c5cfc;font-weight:600">→ {label}</a></p>\n'

    faq_html = "".join(f'      <h3>{q}</h3>\n      <p>{a}</p>\n' for q, a in c["faq"])

    def strip(t):
        return _html.unescape(re.sub("<[^>]+>", "", t))

    faq_schema = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": strip(q),
                        "acceptedAnswer": {"@type": "Answer", "text": strip(a)}}
                       for q, a in c["faq"]]
    }
    art_schema = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": c["title"], "description": c["desc"],
        "image": f"{BASE}/assets/og-image.png",
        "author": {"@type": "Organization", "name": "AdOff"},
        "publisher": {"@type": "Organization", "name": "AdOff"},
        "datePublished": PUB_DATE, "dateModified": PUB_DATE,
        "inLanguage": lang,
    }
    cta_t, cta_p = c["cta"]
    return f"""<!DOCTYPE html>
<html lang="{lang}"{dir_attr}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{c['title']} | AdOff</title>
  <meta name="description" content="{c['desc']}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="{su}" />
{hreflang_block(slug)}
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{c['title']}" />
  <meta property="og:description" content="{c['desc']}" />
  <meta property="og:image" content="{BASE}/assets/og-image.png" />
  <meta property="og:url" content="{su}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{c['title']}" />
  <meta name="twitter:description" content="{c['desc']}" />
  <meta name="twitter:image" content="{BASE}/assets/og-image.png" />
  <link rel="icon" href="/assets/icon128.png" type="image/png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#0a0a1a" />
  <link rel="stylesheet" href="/style.css?v={CSSV}" />
  <style>
    .article-page {{ max-width: 780px; margin: 0 auto; padding: 84px 24px 100px; }}
    .article-page h1 {{ font-size: clamp(1.8rem, 4vw, 2.6rem); color: #fff; margin-bottom: 16px; line-height: 1.2; }}
    .article-page h2 {{ font-size: 1.5rem; color: #fff; margin: 44px 0 14px; }}
    .article-page h3 {{ font-size: 1.15rem; color: #e2e2f0; margin: 28px 0 10px; }}
    .article-page p {{ color: #b0b0c8; line-height: 1.8; margin-bottom: 16px; }}
    .article-page strong {{ color: #fff; }}
    .article-page code {{ background:#1f1f3a; padding:2px 6px; border-radius:5px; color:#c9b8ff; font-size:0.92em; }}
    .answer-box {{ background:#12122a; border:1px solid rgba(124,92,252,0.25); border-radius:8px; padding:24px; margin:0 0 36px; }}
    .answer-box p {{ margin:0; color:#d8d8ea; font-size:1.05rem; }}
    .cta-section {{ background:linear-gradient(135deg,rgba(124,92,252,.14),rgba(124,92,252,.03)); border:1px solid #2a2a4a; border-radius:16px; padding:32px; text-align:center; margin-top:48px; }}
    .cta-section h3 {{ color:#fff; margin:0 0 8px; }}
    .cta-section p {{ margin:0 0 20px; color:#b0b0c8; }}
    .cta-section .btn {{ display:inline-block; padding:14px 28px; background:#fff; color:#0a0a1a; font-weight:700; border-radius:12px; text-decoration:none; }}
  </style>
  <script type="application/ld+json">
  {json.dumps(art_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
  {json.dumps(faq_schema, ensure_ascii=False, indent=2)}
  </script>
  <script src="/adoff-i18n.js?v={SCRIPTV}"></script>
</head>
<body>
  <main>
    <article class="article-page">
      <h1>{c['h1']}</h1>
      <div class="answer-box"><p>{c['answer']}</p></div>
{sections_html}{tool_html}      <h2>{faq_head}</h2>
{faq_html}      <div class="cta-section">
        <h3>{cta_t}</h3>
        <p>{cta_p}</p>
        <a href="/install.html" class="btn">{install_btn}</a>
      </div>
    </article>
  </main>
  <script src="/adoff-nav.js?v={SCRIPTV}"></script>
  <script src="/adoff-footer.js?v={SCRIPTV}"></script>
  <script>if("serviceWorker" in navigator){{window.addEventListener("load",()=>{{navigator.serviceWorker.register("/sw.js").catch(()=>{{}})}});}}</script>
</body>
</html>
"""


def main():
    order, topics = load_content()
    validate(order, topics)
    n = 0
    for slug in order:
        for lang in LANGS:
            c = topics[slug][lang]
            out = SITE / f"{slug}.html" if lang == "en" else SITE / lang / f"{slug}.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(render(slug, lang, c), encoding="utf-8")
            n += 1
    print(f"[gap-landings] generate {n} pagine ({len(order)} topic × {len(LANGS)} lingue)")
    print("  slug:", ", ".join(order))


if __name__ == "__main__":
    main()
