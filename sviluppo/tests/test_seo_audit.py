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


def main():
    test_finding_id_stable()
    test_health_score()
    test_hreflang_dupes_inline_xml()
    test_model_claims_false_positives()
    test_rules_num_thousands_separator()
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
