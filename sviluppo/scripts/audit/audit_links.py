#!/usr/bin/env python3
"""
FASE 1 — audit link completo (568 HTML + nav/footer generati a runtime x 15 lingue).

Uso:
    python3 audit_links.py            # solo sorgenti locali
    python3 audit_links.py --live     # verifica anche sul live adoff.app

Output: sviluppo/scripts/audit/out/links.json + report testuale su stdout.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from resolve import build_index, resolve, classify, strip_query, OK, REDIRECT, SOFT404, EXTERNAL, SKIP

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

LANGS = ["de", "en", "es", "fr", "id", "it", "ja", "ko", "pl", "pt", "tr", "zh", "ar", "hi", "ru"]

HREF_RE = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']""", re.I | re.S)
SRC_RE = re.compile(r"""<(?:script|img|link|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']""", re.I | re.S)


# ─────────────────────────────────────────────────────────────────────────────
# Simulazione di adoff-nav.js (righe 250-330) per una data lingua
# ─────────────────────────────────────────────────────────────────────────────
def nav_links(lang):
    """Rispecchia site/adoff-nav.js dopo il fix del 2026-07-29."""
    lq = ("?lang=" + lang) if (lang and lang != "it") else ""

    def en_root(page):
        return ("/" + page) if lang == "en" else ("/" + lang + "/" + page)

    def it_root(page):
        return ("/" + page) if lang == "it" else ("/" + lang + "/" + page)

    premium = "/premium"
    vpnpol = "/vpn-policy"
    pricing = "/pricing.html" + lq
    install = "/install.html" + lq
    support = "/support.html" + lq
    community = en_root("community")
    guide = it_root("guide.html")
    privacy = it_root("privacy.html")
    return [
        ("logo", "/" + lq),
        ("Home", "/" + lq),
        ("Features", "/" + lq + "#features"),
        ("Pricing", pricing),
        ("Premium VPN", premium),
        ("VPN Policy", vpnpol),
        ("Community", community),
        ("Support", support),
        ("Install", install),
        ("Install Free (CTA)", "/" + lq + "#pricing"),
        ("Guide (mobile)", guide),
        ("Privacy (mobile)", privacy),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Simulazione di adoff-footer.js (righe 51-117) per una data lingua
# ─────────────────────────────────────────────────────────────────────────────
def footer_links(lang):
    fq = ("?lang=" + lang) if (lang and lang != "it") else ""

    def en_root(page):
        return ("/" + page) if (lang == "en" or not lang) else ("/" + lang + "/" + page)

    def it_root(page):
        return ("/" + page) if (lang == "it" or not lang) else ("/" + lang + "/" + page)

    def lp(page):
        return ("/" + page) if lang == "en" else ("/" + lang + "/" + page)

    return [
        ("Prezzi", "/pricing.html" + fq),
        ("Premium VPN", "/premium" + fq),
        ("Installa", "/install" + fq),
        ("Come funziona", en_root("how-it-works")),
        ("Guida utente", it_root("guide")),
        ("Migliori Ad Blocker 2026", en_root("best-ad-blocker-2026")),
        ("Test detector", en_root("adblock-detector")),
        ("vs uBlock Origin", lp("vs/ublock-origin")),
        ("vs AdBlock Plus", lp("vs/adblock-plus")),
        ("vs AdGuard", lp("vs/adguard")),
        ("Community", en_root("community")),
        ("Blog", "/blog/" if lang == "en" else "/" + lang + "/blog/"),
        ("Tutti i confronti", "/vs/"),
        ("Chi sono", ("/chi-sono.html" if (lang == "it" or not lang) else "/about.html" + fq)),
        ("Live data", ("/it/about-data/" if lang == "it" else "/about-data/")),
        ("Supporto", "/support" + fq),
        ("Press Kit", en_root("press")),
        ("Privacy Policy", it_root("privacy")),
        ("Termini", it_root("terms")),
        ("Recesso", it_root("withdrawal")),
    ]


def main():
    files = build_index(SITE)
    results = {"static": [], "nav": [], "footer": []}

    # ── link statici in tutti gli HTML ───────────────────────────────────────
    html_files = sorted(
        p for p in SITE.rglob("*.html")
        if p.relative_to(SITE).parts[0] not in {"graphify-out"}
    )
    for p in html_files:
        rel = p.relative_to(SITE).as_posix()
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            print(f"!! read error {rel}: {e}")
            continue
        lines = text.splitlines()
        seen = set()
        for m in list(HREF_RE.finditer(text)) + list(SRC_RE.finditer(text)):
            href = m.group(1).strip()
            lineno = text[: m.start()].count("\n") + 1
            key = (href, lineno)
            if key in seen:
                continue
            seen.add(key)
            kind, val = classify(href)
            if kind in (SKIP, EXTERNAL):
                results["static"].append(
                    {"file": rel, "line": lineno, "href": href, "status": kind, "target": val}
                )
                continue
            # link interno: relativo o assoluto
            path = val
            if not path.startswith("/"):
                base = "/" + p.relative_to(SITE).parent.as_posix()
                base = "/" if base == "/." else base + "/"
                path = base + path
            clean = strip_query(path)
            # normalizza ../
            parts = []
            for seg in clean.split("/"):
                if seg == "..":
                    if parts:
                        parts.pop()
                elif seg not in (".", ""):
                    parts.append(seg)
            clean = "/" + "/".join(parts) + ("/" if clean.endswith("/") and parts else "")
            st, target, chain = resolve(clean, files)
            results["static"].append({
                "file": rel, "line": lineno, "href": href, "resolved": clean,
                "status": st, "target": target, "redirects": len(chain),
            })

    # ── nav + footer generati, per ogni lingua ──────────────────────────────
    for lang in LANGS:
        for label, href in nav_links(lang):
            clean = strip_query(href)
            if clean == "":
                clean = "/"
            st, target, chain = resolve(clean, files)
            results["nav"].append({
                "lang": lang, "label": label, "href": href, "resolved": clean,
                "status": st, "target": target, "redirects": len(chain),
            })
        for label, href in footer_links(lang):
            clean = strip_query(href)
            if clean == "":
                clean = "/"
            st, target, chain = resolve(clean, files)
            results["footer"].append({
                "lang": lang, "label": label, "href": href, "resolved": clean,
                "status": st, "target": target, "redirects": len(chain),
            })

    (OUT / "links.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))

    # ── report ──────────────────────────────────────────────────────────────
    print("=" * 78)
    print("FASE 1 — AUDIT LINK")
    print("=" * 78)
    print(f"HTML analizzati      : {len(html_files)}")
    print(f"link statici estratti: {len(results['static'])}")

    stat = defaultdict(int)
    for r in results["static"]:
        stat[r["status"]] += 1
    print("  " + "  ".join(f"{k}={v}" for k, v in sorted(stat.items())))

    print("\n--- NAV: soft-404 per lingua (link del menu che servono la HOME IT) ---")
    nav_bad = defaultdict(list)
    for r in results["nav"]:
        if r["status"] == SOFT404:
            nav_bad[r["lang"]].append(f"{r['label']} -> {r['href']}")
    for lang in LANGS:
        if nav_bad[lang]:
            print(f"  [{lang}] {len(nav_bad[lang])} rotti: " + " | ".join(nav_bad[lang]))
    if not nav_bad:
        print("  nessuno")

    print("\n--- FOOTER: soft-404 per lingua ---")
    f_bad = defaultdict(list)
    for r in results["footer"]:
        if r["status"] == SOFT404:
            f_bad[r["lang"]].append(f"{r['label']} -> {r['href']}")
    for lang in LANGS:
        if f_bad[lang]:
            print(f"  [{lang}] {len(f_bad[lang])} rotti: " + " | ".join(f_bad[lang]))
    if not f_bad:
        print("  nessuno")

    print("\n--- STATIC: soft-404 aggregati per target (top 40) ---")
    agg = defaultdict(list)
    for r in results["static"]:
        if r["status"] == SOFT404:
            agg[r.get("resolved")].append(f"{r['file']}:{r['line']}")
    for tgt, srcs in sorted(agg.items(), key=lambda kv: -len(kv[1]))[:40]:
        print(f"  {len(srcs):4d}x  {tgt}")
        print(f"          es. {srcs[0]}" + (f"  (+{len(srcs)-1} altri)" if len(srcs) > 1 else ""))
    print(f"\n  totale target rotti distinti: {len(agg)}")
    print(f"  totale occorrenze rotte      : {sum(len(v) for v in agg.values())}")


if __name__ == "__main__":
    main()
