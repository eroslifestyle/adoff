#!/usr/bin/env python3
"""Test seo_audit.py: assert-based, eseguibile con python3, zero framework.

Copre: stabilità id, health_score, hreflang dupes su XML inline,
falsi positivi model_claims (tedesco "pro Plan" non produce finding).
"""

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "seo_audit", HERE.parent / "seo-tools" / "seo_audit.py")
seo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seo)


def test_finding_id_stable():
    """Stesso problema = stesso id tra due run (anche se file lista cambia ordine)."""
    a = seo.finding_id("crawlability", "Orphan pages", "site/index.html")
    b = seo.finding_id("crawlability", "Orphan pages", "site/index.html")
    assert a == b, "stesso problema deve dare stesso id"
    assert len(a) == 12 and all(c in "0123456789abcdef" for c in a), "12 char hex"
    assert a != seo.finding_id("crawlability", "Orphan pages", "site/other.html")
    assert a != seo.finding_id("onpage", "Orphan pages", "site/index.html")
    # stabilità attraverso make_finding: campi indipendenti dall'ordine dei files
    f1 = seo.make_finding("technical", "high", "Titolo", "ev", "fix", True, ["site/a", "site/b"])
    f2 = seo.make_finding("technical", "high", "Titolo", "ev", "fix", True, ["site/b", "site/a"])
    assert f1["id"] == f2["id"], "id non deve dipendere dall'ordine dei files"
    print("  ok: id stabile")


def test_health_score():
    """100 - 10/high - 3/medium - 1/low, minimo 0."""
    mk = lambda sev: {"severity": sev}
    assert seo.health_score([]) == 100
    assert seo.health_score([mk("high")]) == 90
    assert seo.health_score([mk("high"), mk("medium"), mk("low")]) == 86
    assert seo.health_score([mk("low")] * 15) == 85
    assert seo.health_score([mk("high")] * 12) == 0, "minimo 0"
    assert seo.health_score([mk("high")] * 20) == 0
    print("  ok: health_score")


def test_hreflang_dupes_inline_xml():
    """Rileva hreflang duplicato su XML inline di esempio."""
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://adoff.app/en/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://adoff.app/en/about"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://adoff.app/en/about-2"/>
    <xhtml:link rel="alternate" hreflang="it" href="https://adoff.app/it/about"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://adoff.app/about"/>
  </url>
  <url>
    <loc>https://adoff.app/it/about</loc>
    <xhtml:link rel="alternate" hreflang="it" href="https://adoff.app/it/about"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://adoff.app/en/about"/>
  </url>
</urlset>"""
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False, mode="w") as fh:
        fh.write(xml)
        tmp = fh.name
    try:
        orig = seo.SITEMAP_PATH
        seo.SITEMAP_PATH = Path(tmp)
        urls = seo.parse_sitemap()
        seo.SITEMAP_PATH = orig
        assert len(urls) == 2
        check, findings = seo.check_tech_hreflang_dupes(urls)
        assert check["measured"] == 1, f"1 cluster affetto, got {check}"
        assert check["status"] == "fail"
        assert len(findings) == 1 and findings[0]["auto"] is True
        assert "en" in findings[0]["evidence"]
        # il cluster pulito non produce falsi positivi
        check2, f2 = seo.check_tech_hreflang_dupes([urls[1]])
        assert check2["status"] == "pass" and not f2
    finally:
        os.unlink(tmp)
    print("  ok: hreflang dupes su XML inline")


def test_model_claims_false_positives():
    """Il tedesco 'pro Plan' NON produce finding; 'AdOff Pro' sì."""
    assert seo.GENERIC_PRO_RE.search("Der Umsatz pro Plan steigt") is None, \
        '"pro Plan" minuscolo non deve matchare'
    assert seo.ADOFF_PRO_RE.search("AdOff Pro ist teuer") is not None
    assert seo.ADOFF_PRO_RE.search("AdOff Premium") is not None
    # hindi: प्रो in parole comuni NON matcha (nessun AdOff davanti)
    assert seo.ADOFF_PRO_RE.search("यह एक प्रोग्राम है") is None
    assert seo.ADOFF_PRO_RE.search("मेरी प्रोफाइल") is None
    # trial: serve contesto trial + giorni
    hits_via_run(seo, expect_none=[
        ("test.html", "Der Umsatz pro Plan ist steigend"),
        ("test.html", "यह प्रोग्राम 30 दिन चलता है"),
        ("vs/adguard.html", "AdGuard Pro plan costs money"),
    ], expect_some=[
        ("guide.html", "AdOff Pro unlocks advanced features"),
        ("guide.html", "Free trial of 15 days then pay"),
        ("index.html", "AdOff Premium version costs 19,99 EUR"),
    ])


def test_rules_num_thousands_separator():
    """'30,000 rules' (limite Chrome) NON matcha; il conteggio AdOff sì."""
    for text in (
        "Chrome caps extensions at a maximum of 30,000 static rules",
        "Chrome impone un massimo di 30.000 regole statiche per estensione",
        "caricano liste di filtri con oltre 80.000 regole",
    ):
        assert seo.RULES_NUM_RE.search(text) is None, f"falso positivo: {text}"
    assert seo.RULES_NUM_RE.search("130 precise rules").group(1) == "130"
    assert seo.RULES_NUM_RE.search("180 regole").group(1) == "180"
    print("  ok: RULES_NUM_RE ignora frammenti di numeri con separatore migliaia")


def test_freshness_re_multilingual():
    """FRESHNESS_RE matcha le forme reali usate sul sito, incl. CJK/arabo/hindi."""
    for text in (
        "Last updated September 2026",
        "Ultimo aggiornamento settembre 2026",
        "آخر تحديث: سبتمبر 2026",
        "अंतिम अपडेट: सितंबर 2026",
        "Son güncelleme: Eylül 2026",
        "Ostatnia aktualizacja: wrzesień 2026",
        "Atualizado em setembro de 2026",
        "Terakhir diperbarui: September 2026",
        "업데이트: 2026년 9월",
        "最終更新日 2026年9月",
    ):
        assert seo.FRESHNESS_RE.search(text) is not None, f"non matcha: {text}"
    print("  ok: FRESHNESS_RE copre le 15 lingue del sito (CJK senza \\b)")


def hits_via_run(seo, expect_none, expect_some):
    """Esegue check_content_model_claims su file fake sotto site/ temporanei."""
    import tempfile
    orig_site, orig_root = seo.SITE, seo.ROOT
    try:
        with tempfile.TemporaryDirectory() as tmp:
            seo.SITE = Path(tmp)
            seo.ROOT = Path(tmp)
            orig_htmlfiles = seo.html_files
            for rel, text in expect_none + expect_some:
                p = Path(tmp) / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(f"<html><title>t</title><body>{text}</body></html>")
            seo.html_files = lambda: [Path(tmp) / rel for rel, _ in expect_none + expect_some]
            check, findings = seo.check_content_model_claims()
            seo.html_files = orig_htmlfiles
            files_hit = {Path(x) for f in findings for x in f["files"]}
            for rel, _ in expect_none:
                assert Path(rel) not in files_hit, f"falso positivo su {rel}: {findings}"
            for rel, _ in expect_some:
                assert Path(rel) in files_hit, f"finding mancante su {rel}: {findings}"
    finally:
        seo.SITE, seo.ROOT = orig_site, orig_root
    print("  ok: model_claims falsi positivi esclusi, veri positivi trovati")


def test_i18n_link_destruct():
    """<a> dentro data-i18n = finding; data-i18n-html / link fuori = pulito;
    </h1> che chiude <h2> (account.html) NON deve inglobare il link successivo."""
    import tempfile
    orig_site, orig_root = seo.SITE, seo.ROOT
    try:
        with tempfile.TemporaryDirectory() as tmp:
            seo.SITE = Path(tmp)
            seo.ROOT = Path(tmp)
            pages = {
                "bad.html": "<html><body><p data-i18n=\"k\">testo <a href=\"/x\">link</a></p></body></html>",
                "ok-html-attr.html": "<html><body><p data-i18n-html=\"k\">testo <a href=\"/x\">link</a></p></body></html>",
                "ok-text-only.html": "<html><body><p data-i18n=\"k\">solo testo</p></body></html>",
                "ok-link-outside.html": "<html><body><p data-i18n=\"k\">testo</p><a href=\"/x\">link</a></body></html>",
                "malformed-h2.html": "<html><body><h2 data-i18n=\"k\">titolo</h1> <a href=\"/x\">link</a></body></html>",
            }
            orig_htmlfiles = seo.html_files
            for rel, text in pages.items():
                p = Path(tmp) / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(text)
            seo.html_files = lambda: [Path(tmp) / rel for rel in pages]
            try:
                check, findings = seo.check_content_i18n_link_destruct()
                files_hit = {f for fnd in findings for f in fnd["files"]}
                assert check["measured"] == 1, f"1 solo hit atteso, got {check}"
                assert check["status"] == "warn"
                assert len(findings) == 1
                assert findings[0]["severity"] == "medium" and findings[0]["auto"] is False
                assert files_hit == {"bad.html"}, f"solo bad.html, got {files_hit}"
                assert "'k'" in findings[0]["evidence"], "evidence cita la chiave"
                # regressione parser: h1..h6 intercambiabili + void + end tag orfano
                p = seo._I18nLinkParser()
                p.feed("<h2 data-i18n=\"k\">a</h1> <a href=\"/x\">l</a>")
                p.close()
                assert p.hits == [], f"</h1> chiude <h2>, nessun hit: {p.hits}"
                p.feed("<div data-i18n=\"k\"><br><img src=\"x\"> <a href=\"/y\">l</a>")
                assert len(p.hits) == 1, "i void non devono rompere lo stack"
                p.feed("</span></div> <a href=\"/z\">l</a>")
                p.close()
                assert len(p.hits) == 1, "end tag orfani/non corrispondenti ignorati"
            finally:
                seo.html_files = orig_htmlfiles
    finally:
        seo.SITE, seo.ROOT = orig_site, orig_root
    print("  ok: i18n_link_destruct (text vs html attr, h2/h1, void, end tag orfani)")


def test_i18n_link_destruct_line_number():
    """L'evidence riporta la riga REALE dell'<a> nel file: i blocchi <script>
    multi-riga PRIMA del link non devono sfasarla (regressione strip_scripts)."""
    import tempfile
    # <a> del caso cattivo a riga 12 (contando da 1)
    bad = "\n".join([
        "<html><head>",
        '<script type="application/ld+json">',
        "{",
        '  "@type": "Answer",',
        '  "text": "bla",',
        "},",
        "];",
        "</script>",
        "<style>",
        ".x { color: red }",
        "</style>",
        '</head><body><p data-i18n="k">testo <a href="/x">link</a></p></body></html>',
    ]) + "\n"
    assert '<p data-i18n="k"' in bad.splitlines()[11], "setup: <a> a riga 12"
    orig_site, orig_root = seo.SITE, seo.ROOT
    try:
        with tempfile.TemporaryDirectory() as tmp:
            seo.SITE = Path(tmp)
            seo.ROOT = Path(tmp)
            p = Path(tmp) / "line.html"
            p.write_text(bad)
            orig_htmlfiles = seo.html_files
            seo.html_files = lambda: [p]
            try:
                check, findings = seo.check_content_i18n_link_destruct()
                assert len(findings) == 1, findings
                assert "line.html:12 " in findings[0]["evidence"], \
                    f"riga reale 12 nell'evidence, got: {findings[0]['evidence']}"
            finally:
                seo.html_files = orig_htmlfiles
    finally:
        seo.SITE, seo.ROOT = orig_site, orig_root
    print("  ok: i18n_link_destruct riporta la riga reale nonostante <script> multi-riga")


def test_i18n_html_links():
    """data-i18n-html con <a>: i dizionari devono avere gli STESSI href nello
    stesso ordine. Casi: ok / senza markup / href diverso / anchor annidati /
    chiave assente in una lingua. Anche <a> in data-i18n semplice NON entra qui."""
    import tempfile
    html = ('<html><body>'
            '<p data-i18n-html="k.ok">t <a href="/a">x</a> <a href="/b">y</a></p>'
            '<p data-i18n="k.plain">solo testo <a href="/c">z</a></p>'
            '</body></html>')
    orig_site, orig_root, orig_i18n = seo.SITE, seo.ROOT, seo.I18N_DIR
    try:
        with tempfile.TemporaryDirectory() as tmp:
            seo.SITE = Path(tmp)
            seo.ROOT = Path(tmp)
            seo.I18N_DIR = Path(tmp) / "i18n"
            seo.I18N_DIR.mkdir()
            p = Path(tmp) / "p.html"
            p.write_text(html)
            orig_htmlfiles = seo.html_files
            seo.html_files = lambda: [p]
            dicts = {
                # en: TUTTO ok (stessi href, stesso ordine)
                "en": {"k.ok": 't <a href="/a">X</a> <a href="/b">Y</a>', "k.plain": "t"},
                # it: valore senza markup
                "it": {"k.ok": "testo senza markup", "k.plain": "t"},
                # de: href diverso dall'HTML
                "de": {"k.ok": 'vedi <a href="/altro">link</a>', "k.plain": "t"},
                # fr: anchor annidati (href giusti ma HTML invalido)
                "fr": {"k.ok": 'vai <a href="/a"><a href="/b">entrambi</a></a>', "k.plain": "t"},
                # es: chiave k.ok assente
                "es": {"k.plain": "t"},
            }
            for lang, d in dicts.items():
                (seo.I18N_DIR / f"{lang}.json").write_text(json.dumps(d))
            try:
                check, findings = seo.check_content_i18n_html_links()
                assert check["status"] == "warn" and len(findings) == 1, check
                # k.plain (data-i18n semplice) NON deve comparire nel confronto
                assert check["measured"] == 1, f"solo k.ok, got {check}"
                detail = str(check["detail"])
                assert ("'k.ok', 'it'" in detail), "senza markup non rilevato"
                assert ("'k.ok', 'de'" in detail), "href diverso non rilevato"
                assert ("'k.ok', 'fr'" in detail and "annidati" in detail), "annidati non rilevati"
                assert ("'k.ok', 'es'" in detail and "assente" in detail), "chiave assente non rilevata"
                # en pulita: nessuna riga per en
                assert "'k.ok', 'en'" not in detail, "falso positivo su lingua corretta"
                # evidence: chiave, file, href attesi, elenco lingue
                ev = findings[0]["evidence"]
                assert "'k.ok'" in ev and "p.html" in ev and "/a" in ev and "['de'" in ev, ev
                assert findings[0]["severity"] == "medium" and findings[0]["auto"] is False
                assert findings[0]["files"] == ["p.html"]
                # caso pulito: dizionari tutti conformi -> 0 finding
                for lang, d in dicts.items():
                    (seo.I18N_DIR / f"{lang}.json").write_text(json.dumps(
                        {**d, "k.ok": 't <a href="/a">X</a> <a href="/b">Y</a>'}))
                check2, f2 = seo.check_content_i18n_html_links()
                assert check2["status"] == "pass" and not f2, check2
            finally:
                seo.html_files = orig_htmlfiles
    finally:
        seo.SITE, seo.ROOT, seo.I18N_DIR = orig_site, orig_root, orig_i18n
    print("  ok: i18n_html_links (href uguali ok, markup assente/differenti/annidati/assente)")


def main():
    test_finding_id_stable()
    test_health_score()
    test_hreflang_dupes_inline_xml()
    test_model_claims_false_positives()
    test_rules_num_thousands_separator()
    test_freshness_re_multilingual()
    test_i18n_link_destruct()
    test_i18n_link_destruct_line_number()
    test_i18n_html_links()
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
