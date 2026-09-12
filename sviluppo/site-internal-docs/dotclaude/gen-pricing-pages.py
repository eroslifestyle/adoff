#!/usr/bin/env python3
"""
Generate static localized pricing pages /{lang}/pricing.html from the IT template pricing.html.

Run from site/ root: python3 .claude/gen-pricing-pages.py
"""
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parents[1]
TEMPLATE = SITE / "pricing.html"
I18N = SITE / "i18n"
BASE = "https://adoff.app"

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


def absolutize_assets(soup, lang):
    """Fix asset paths for subdir lang pages."""
    for el in soup.find_all(href=True):
        h = el["href"]
        if h.startswith(("style.css", "assets/", "/adoff-nav", "/adoff-footer")):
            el["href"] = "/" + h.lstrip("/")
    for el in soup.find_all(src=True):
        s = el["src"]
        if s.startswith(("style.css", "assets/", "/adoff-nav", "/adoff-footer")):
            el["src"] = "/" + s.lstrip("/")


# Mapping: (tag, attr, i18n_key) or (css_selector, i18n_key)
# For texts that appear in pricing page
TRANSLATIONS = [
    # Meta tags
    ("title", "text", "pricing.meta.title"),
    ('meta[name="description"]', "content", "pricing.meta.description"),
    ('meta[property="og:title"]', "content", "pricing.meta.og.title"),
    ('meta[property="og:description"]', "content", "pricing.meta.og.description"),
    ('meta[name="twitter:title"]', "content", "pricing.meta.og.title"),
    ('meta[name="twitter:description"]', "content", "pricing.meta.twitter.description"),
    # Hero section
    (".hero__tagline", "text", "home.trust.trial"),
    ("h1", "text", "pricing.hero.title"),
    (".hero__sub", "text", "pricing.hero.sub"),
    # Trial badge
    (".trial-badge", "text", "pricing.trial.badge"),
    # Plan names
    (".plan-card:first-child .plan-name", "text", "pricing.free.name"),
    (".plan-card:nth-child(2) .plan-name", "text", "pricing.pro.name"),
    (".plan-card:nth-child(3) .plan-name", "text", "pricing.vpn.name"),
    # Plan prices
    (".plan-card:nth-child(2) .plan-price__annual", "text", "pricing.pro.annual.note"),
    (".plan-card:nth-child(3) .plan-price__annual", "text", "pricing.vpn.annual.note"),
    # Plan features
    (".plan-card:first-child .plan-features", "html", "pricing.free.features"),
    (".plan-card:nth-child(2) .plan-features", "html", "pricing.pro.features"),
    (".plan-card:nth-child(3) .plan-features", "html", "pricing.vpn.features"),
    # Plan CTAs
    (".plan-card:first-child .plan-cta", "html", "pricing.free.cta"),
    (".plan-card:nth-child(2) .plan-cta", "html", "pricing.pro.cta"),
    (".plan-card:nth-child(3) .plan-cta", "html", "pricing.vpn.cta"),
    # Comparison table
    ("h2:contains('Cosa include')", "text", "pricing.compare.title"),
    (".compare-table th:nth-child(1)", "text", "pricing.compare.featureCol"),
    (".compare-table th:nth-child(2)", "text", "pricing.compare.free"),
    (".compare-table th:nth-child(3)", "text", "pricing.compare.pro"),
    (".compare-table th:nth-child(4)", "text", "pricing.compare.vpn"),
    # Guarantee
    ("h2:contains('Zero rischio')", "text", "pricing.guarantee.title"),
    (".guarantee-item:nth-child(1)", "html", "pricing.guarantee.trial"),
    (".guarantee-item:nth-child(2)", "html", "pricing.guarantee.refund"),
    (".guarantee-item:nth-child(3)", "html", "pricing.guarantee.cancel"),
    # FAQ
    (".faq-section + * h2", "text", "pricing.faq.title"),
    (".section-label:contains('Domande')", "text", "pricing.faq.label"),
    (".section-label:contains('Confronto')", "text", "pricing.compare.label"),
    (".section-label:contains('Garanzia')", "text", "pricing.guarantee.label"),
    # CTA finale
    (".cta-final h2", "text", "pricing.cta.title"),
    (".cta-final p", "text", "pricing.cta.sub"),
    (".cta-final .btn", "text", "pricing.cta.btn"),
    (".cta-final p:last-of-type", "text", "pricing.cta.note"),
]


def apply_text(soup, selector, key, d, lang):
    """Apply a single i18n translation."""
    val = d.get(key)
    if val is None:
        return False
    val = val.strip()

    if selector.startswith("."):
        el = soup.select_one(selector)
    elif selector.startswith("h1"):
        el = soup.find("h1")
    elif selector.startswith("h2"):
        el = soup.find("h2")
    elif selector.startswith('meta'):
        from bs4.dammit import AttributeValueWithSubsetOverrideList
        el = soup.select_one(selector)
    else:
        el = soup.select_one(selector)

    if not el:
        return False

    if "html" in key:
        el.clear()
        el.append(BeautifulSoup(val, "html.parser"))
    else:
        el.string = val
    return True


def generate_pricing(lang):
    """Generate a localized pricing.html for the given language."""
    if lang == "it":
        # IT is the template, just copy with updated canonical
        template_html = TEMPLATE.read_text(encoding="utf-8")
        soup = BeautifulSoup(template_html, "html.parser")
        html = soup.find("html")
        html["lang"] = "it"
        if "dir" in html:
            del html["dir"]
        # canonical already correct
        out = SITE / "pricing.html"
        out.write_text(str(soup), encoding="utf-8")
        return out

    d = load_dict(lang)
    template_html = TEMPLATE.read_text(encoding="utf-8")
    soup = BeautifulSoup(template_html, "html.parser")

    # 1. <html lang>
    html = soup.find("html")
    html["lang"] = lang
    if lang == "ar":
        html["dir"] = "rtl"
    elif "dir" in html:
        del html["dir"]

    # 2. Canonical
    can = soup.select_one('link[rel="canonical"]')
    if can:
        can["href"] = f"https://adoff.app/{lang}/pricing.html"

    # 3. hreflang links
    for link in soup.select('link[rel="alternate"][hreflang]'):
        hl = link.get("hreflang")
        if hl in ALL_HREFLANG:
            link["href"] = hreflang_url(hl) + "pricing.html"

    # 4. Meta tags
    if d.get("pricing.meta.title"):
        if soup.title:
            soup.title.string = d["pricing.meta.title"]
    set_meta(soup, 'meta[name="description"]', "content", d.get("pricing.meta.description"))
    set_meta(soup, 'meta[property="og:title"]', "content", d.get("pricing.meta.og.title"))
    set_meta(soup, 'meta[property="og:description"]', "content", d.get("pricing.meta.og.description"))
    set_meta(soup, 'meta[property="og:url"]', "content", f"https://adoff.app/{lang}/pricing.html")
    set_meta(soup, 'meta[property="og:locale"]', "content", OG_LOCALE.get(lang, "en_US"))
    set_meta(soup, 'meta[name="twitter:title"]', "content", d.get("pricing.meta.og.title"))
    set_meta(soup, 'meta[name="twitter:description"]', "content", d.get("pricing.meta.twitter.description"))

    # 5. Hero
    if d.get("pricing.hero.tag"):
        for el in soup.select(".hero__tagline"):
            el.string = d["pricing.hero.tag"]
    if d.get("pricing.hero.title"):
        h1 = soup.find("h1")
        if h1:
            h1.string = d["pricing.hero.title"]
    if d.get("pricing.hero.sub"):
        for el in soup.select(".hero__sub"):
            el.string = d["pricing.hero.sub"]

    # 6. Trial badge
    if d.get("pricing.trial.badge"):
        for el in soup.select(".trial-badge"):
            # keep svg, replace text
            for child in el.find_all(string=True):
                if child.strip():
                    child.replace_with(d["pricing.trial.badge"])
                    break

    # 7. Plan cards — Free
    if d.get("pricing.free.name"):
        for el in soup.select(".plan-card:nth-child(1) .plan-name"):
            el.string = d["pricing.free.name"]
    if d.get("pricing.free.features"):
        for el in soup.select(".plan-card:nth-child(1) .plan-features"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.free.features"], "html.parser"))

    # 8. Plan cards — Pro
    if d.get("pricing.pro.name"):
        for el in soup.select(".plan-card:nth-child(2) .plan-name"):
            el.string = d["pricing.pro.name"]
    if d.get("pricing.pro.annual.note"):
        for el in soup.select(".plan-card:nth-child(2) .plan-price__annual"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.pro.annual.note"], "html.parser"))
    if d.get("pricing.pro.features"):
        for el in soup.select(".plan-card:nth-child(2) .plan-features"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.pro.features"], "html.parser"))
    if d.get("pricing.pro.cta"):
        for el in soup.select(".plan-card:nth-child(2) .plan-cta"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.pro.cta"], "html.parser"))

    # 9. Plan cards — VPN
    if d.get("pricing.vpn.name"):
        for el in soup.select(".plan-card:nth-child(3) .plan-name"):
            el.string = d["pricing.vpn.name"]
    if d.get("pricing.vpn.annual.note"):
        for el in soup.select(".plan-card:nth-child(3) .plan-price__annual"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.vpn.annual.note"], "html.parser"))
    if d.get("pricing.vpn.features"):
        for el in soup.select(".plan-card:nth-child(3) .plan-features"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.vpn.features"], "html.parser"))
    if d.get("pricing.vpn.cta"):
        for el in soup.select(".plan-card:nth-child(3) .plan-cta"):
            el.clear()
            el.append(BeautifulSoup(d["pricing.vpn.cta"], "html.parser"))

    # 10. Comparison table
    if d.get("pricing.compare.label"):
        for el in soup.select(".section-label"):
            if "Cosa include" in el.text or "Confronto" in el.text or "confront" in el.text.lower():
                el.string = d["pricing.compare.label"]
    if d.get("pricing.compare.title"):
        for el in soup.select(".section-title"):
            if "Cosa include" in el.text:
                el.string = d["pricing.compare.title"]

    # 11. Guarantee
    if d.get("pricing.guarantee.label"):
        for el in soup.select(".section-label"):
            if "Garanzia" in el.text or "Zero rischio" in el.text:
                el.string = d["pricing.guarantee.label"]
    if d.get("pricing.guarantee.title"):
        for el in soup.select(".section-title"):
            if "Zero rischio" in el.text:
                el.string = d["pricing.guarantee.title"]

    # 12. FAQ
    if d.get("pricing.faq.label"):
        for el in soup.select(".section-label"):
            if "Domande" in el.text or "FAQ" in el.text or "faq" in el.text.lower():
                el.string = d["pricing.faq.label"]
    if d.get("pricing.faq.title"):
        for el in soup.select(".section-title"):
            if "dubbi" in el.text.lower() or "rispondiamo" in el.text or "faq" in el.text.lower():
                el.string = d["pricing.faq.title"]

    # 13. FAQ accordion content
    faq_map = [
        ("Posso annullare", "pricing.faq.cancel.q", "pricing.faq.cancel.a"),
        ("trial", "pricing.faq.trial.q", "pricing.faq.trial.a"),
        ("dati", "pricing.faq.data.q", "pricing.faq.data.a"),
        ("passare", "pricing.faq.upgrade.q", "pricing.faq.upgrade.a"),
    ]
    for i, (search, qkey, akey) in enumerate(faq_map):
        q = d.get(qkey)
        a = d.get(akey)
        faq_items = soup.select(".faq-item")
        if i < len(faq_items) and q:
            btn = faq_items[i].select_one(".faq-question")
            if btn:
                # keep svg, replace text
                text_node = None
                for child in btn.children:
                    if isinstance(child, str) and child.strip():
                        text_node = child
                        break
                if text_node:
                    text_node.replace_with(q)
                elif btn.string:
                    btn.string = q
            ans = faq_items[i].select_one(".faq-answer p")
            if ans and a:
                ans.string = a

    # 14. CTA finale
    if d.get("pricing.cta.title"):
        for el in soup.select(".cta-final h2"):
            el.string = d["pricing.cta.title"]
    if d.get("pricing.cta.sub"):
        paras = soup.select(".cta-final > .container > p")
        if len(paras) >= 1:
            paras[0].string = d["pricing.cta.sub"]
    if d.get("pricing.cta.btn"):
        for el in soup.select(".cta-final .btn"):
            el.string = d["pricing.cta.btn"]
    if d.get("pricing.cta.note"):
        notes = soup.select(".cta-final p")
        for el in notes:
            if "open source" in el.text.lower() or "nessun account" in el.text.lower():
                el.string = d["pricing.cta.note"]
                break

    # 15. Fix asset paths
    absolutize_assets(soup, lang)

    # 16. Write output
    out_dir = SITE / lang
    out_dir.mkdir(exist_ok=True)
    out = out_dir / "pricing.html"
    out.write_text(str(soup), encoding="utf-8")
    return out


def set_meta(soup, selector, attr, value):
    if not value:
        return
    el = soup.select_one(selector)
    if el:
        el[attr] = value


def main():
    only = sys.argv[1:] or LANGS
    for lang in only:
        try:
            out = generate_pricing(lang)
            print(f"  [{lang}] -> {out.relative_to(SITE)}")
        except Exception as e:
            print(f"  ERROR [{lang}]: {e}")
    print("Done.")


if __name__ == "__main__":
    main()
