#!/usr/bin/env python3
"""
Generate static localized homepages /{lang}/index.html from the IT template index.html.

Why: the root homepage localizes via client-side JS (?lang=), which is weak for SEO/AEO.
This bakes each language's text statically (matching the existing /{lang}/ content-page
pattern), with localized <title>/meta/canonical/hreflang and a localized FAQPage JSON-LD
built from the already-translated visible FAQ items (zero new-translation risk).

Run from site/ root:  python3 .claude/gen-lang-homepages.py
"""
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parents[2] / "site"
TEMPLATE = SITE / "index.html"
I18N = SITE / "i18n"
BASE = "https://adoff.app"

# IT lives at root; these get their own /{lang}/ dir.
LANGS = ["en", "de", "fr", "es", "pt", "ru", "ar", "zh", "hi", "ja", "ko", "tr", "id", "pl"]
ALL_HREFLANG = ["it"] + LANGS
OG_LOCALE = {
    "it": "it_IT", "en": "en_US", "de": "de_DE", "fr": "fr_FR", "es": "es_ES",
    "pt": "pt_PT", "ru": "ru_RU", "ar": "ar_SA", "zh": "zh_CN", "hi": "hi_IN",
    "ja": "ja_JP", "ko": "ko_KR", "tr": "tr_TR", "id": "id_ID", "pl": "pl_PL",
}


def load_dict(lang):
    return json.loads((I18N / f"{lang}.json").read_text(encoding="utf-8"))


def hreflang_url(lang):
    return f"{BASE}/" if lang == "it" else f"{BASE}/{lang}/"


def strip_markup(text):
    """Plain text for JSON-LD: drop HTML tags and **markdown** bold."""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", text).strip()


def extract_faq_items(soup):
    """Return ordered [(question_key, answer_key)] from visible .faq-item blocks."""
    items = []
    for item in soup.select(".faq-item"):
        q = item.select_one(".faq-question span[data-i18n], .faq-question span[data-i18n-html]")
        a = item.select_one(".faq-answer-inner[data-i18n], .faq-answer-inner[data-i18n-html]")
        if not q or not a:
            continue
        qk = q.get("data-i18n") or q.get("data-i18n-html")
        ak = a.get("data-i18n") or a.get("data-i18n-html")
        items.append((qk, ak))
    return items


def build_faqpage_jsonld(faq_items, d):
    entities = []
    for qk, ak in faq_items:
        q = d.get(qk)
        a = d.get(ak)
        if not q or not a:
            continue
        entities.append({
            "@type": "Question",
            "name": strip_markup(q),
            "acceptedAnswer": {"@type": "Answer", "text": strip_markup(a)},
        })
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": entities}


def apply_translations(soup, d):
    for el in soup.select("[data-i18n]"):
        v = d.get(el["data-i18n"])
        if v is not None:
            el.string = v
    for el in soup.select("[data-i18n-html]"):
        v = d.get(el["data-i18n-html"])
        if v is not None:
            el.clear()
            el.append(BeautifulSoup(v, "html.parser"))
    for el in soup.select("[data-i18n-placeholder]"):
        v = d.get(el["data-i18n-placeholder"])
        if v is not None:
            el["placeholder"] = v


def set_meta(soup, name=None, prop=None, content=None):
    sel = f'meta[name="{name}"]' if name else f'meta[property="{prop}"]'
    el = soup.select_one(sel)
    if el and content is not None:
        el["content"] = content


def absolutize_assets(soup):
    """Rewrite root-relative asset refs (style.css, assets/...) to absolute, so they
    resolve from /{lang}/ subdir instead of 404-ing."""
    for el in soup.find_all(href=True):
        h = el["href"]
        if h.startswith(("style.css", "assets/", "affiliate-tracking", "manifest.webmanifest", "i18n/")):
            el["href"] = "/" + h
    for el in soup.find_all(src=True):
        s = el["src"]
        if s.startswith(("style.css", "assets/", "affiliate-tracking", "i18n/")):
            el["src"] = "/" + s


def build_hreflang_block(soup, faq_items):
    """Replace canonical + alternate hreflang links and JSON-LD for a given lang done per call."""
    pass  # handled inline in generate()


def generate(lang, template_html, faq_items):
    soup = BeautifulSoup(template_html, "html.parser")
    d = load_dict(lang)

    # 1. text
    apply_translations(soup, d)

    # 2. <html lang> + dir
    html = soup.find("html")
    html["lang"] = lang
    if lang == "ar":
        html["dir"] = "rtl"

    # 3. title + meta
    if d.get("meta.title"):
        if soup.title:
            soup.title.string = d["meta.title"]
    set_meta(soup, name="description", content=d.get("meta.description"))
    set_meta(soup, prop="og:title", content=d.get("meta.og.title") or d.get("meta.title"))
    set_meta(soup, prop="og:description", content=d.get("meta.og.description") or d.get("meta.description"))
    set_meta(soup, prop="og:url", content=hreflang_url(lang))
    set_meta(soup, prop="og:locale", content=OG_LOCALE.get(lang, "en_US"))
    set_meta(soup, name="twitter:title", content=d.get("meta.og.title") or d.get("meta.title"))
    set_meta(soup, name="twitter:description", content=d.get("meta.og.description") or d.get("meta.description"))

    # 4. canonical
    can = soup.select_one('link[rel="canonical"]')
    if can:
        can["href"] = hreflang_url(lang)

    # 5. hreflang network -> static dirs
    for link in soup.select('link[rel="alternate"][hreflang]'):
        hl = link.get("hreflang")
        if hl == "x-default":
            link["href"] = f"{BASE}/en/"
        elif hl in ALL_HREFLANG:
            link["href"] = hreflang_url(hl)

    # 6. localized FAQPage JSON-LD
    new_faq = build_faqpage_jsonld(faq_items, d)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(data, dict) and data.get("@type") == "FAQPage":
            script.string = json.dumps(new_faq, ensure_ascii=False, indent=4)
            break

    # 7. absolute asset paths from subdir
    absolutize_assets(soup)

    out_dir = SITE / lang
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "index.html"
    out.write_text(str(soup), encoding="utf-8")
    return out, len(new_faq["mainEntity"])


def main():
    template_html = TEMPLATE.read_text(encoding="utf-8")
    faq_items = extract_faq_items(BeautifulSoup(template_html, "html.parser"))
    print(f"Visible FAQ items in template: {len(faq_items)}")
    only = sys.argv[1:] or LANGS
    for lang in only:
        out, n = generate(lang, template_html, faq_items)
        rel = out.relative_to(SITE)
        print(f"  [{lang}] -> {rel}  (FAQ entities: {n})")
    print("Done.")


if __name__ == "__main__":
    main()
