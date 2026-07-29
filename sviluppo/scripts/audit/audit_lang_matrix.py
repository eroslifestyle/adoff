#!/usr/bin/env python3
"""
Matrice link-menu x lingua: per ogni voce di nav/footer e ogni lingua determina
(1) se il target esiste, (2) in che lingua e' realmente la pagina servita,
(3) il verdetto.

Verdetti:
  OK          target esiste e la lingua servita coincide con quella attiva
  SOFT404     target inesistente -> Cloudflare serve la homepage IT con HTTP 200
  LANG-MISMATCH  target esiste ma e' scritto in un'altra lingua
  RUNTIME     pagina tradotta a runtime via ?lang= (adoff-i18n.js): dipende dal JSON
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from resolve import build_index, resolve, strip_query, OK, SOFT404
from audit_links import nav_links, footer_links, LANGS

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

LANG_RE = re.compile(r"<html[^>]*\blang\s*=\s*[\"']([a-zA-Z-]+)[\"']", re.I)


def page_lang(target):
    """Lingua dichiarata dal <html lang> del file servito."""
    if not target:
        return None
    p = SITE / target.lstrip("/")
    if not p.is_file():
        return None
    try:
        head = p.read_text(encoding="utf-8", errors="replace")[:4000]
    except Exception:
        return None
    m = LANG_RE.search(head)
    return m.group(1).lower() if m else "(nessun lang)"


def loads_i18n(target):
    """La pagina carica adoff-i18n.js? Se si', viene tradotta lato client."""
    if not target:
        return False
    p = SITE / target.lstrip("/")
    if not p.is_file():
        return False
    return "adoff-i18n.js" in p.read_text(encoding="utf-8", errors="replace")


def evaluate(lang, href):
    files = FILES
    clean = strip_query(href) or "/"
    st, target, chain = resolve(clean, files)
    has_q = "?lang=" in href
    if st == SOFT404:
        return "SOFT404", None, None
    served = page_lang(target)
    if has_q:
        return "RUNTIME", target, served
    # Dal fix 2026-07-29 adoff-i18n.js traduce verso QUALSIASI lingua diversa da
    # quella sorgente, italiano incluso: una pagina che lo carica non e' un
    # mismatch, e' una pagina tradotta a runtime.
    if served != lang and loads_i18n(target):
        return "RUNTIME", target, served
    if served is None:
        return "OK", target, served
    if served == "(nessun lang)":
        return "NO-LANG-ATTR", target, served
    if served != lang:
        return "LANG-MISMATCH", target, served
    return "OK", target, served


FILES = build_index(SITE)


def main():
    rows = []
    for src, fn in (("nav", nav_links), ("footer", footer_links)):
        for lang in LANGS:
            for label, href in fn(lang):
                verdict, target, served = evaluate(lang, href)
                rows.append({
                    "src": src, "lang": lang, "label": label, "href": href,
                    "verdict": verdict, "target": target, "served_lang": served,
                })
    (OUT / "lang_matrix.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))

    for src in ("nav", "footer"):
        sub = [r for r in rows if r["src"] == src]
        labels = []
        for r in sub:
            if r["label"] not in labels:
                labels.append(r["label"])
        print("\n" + "=" * 118)
        print(f"MATRICE {src.upper()} — voce x lingua")
        print("=" * 118)
        header = f"{'VOCE':<26}" + "".join(f"{l:>6}" for l in LANGS)
        print(header)
        print("-" * len(header))
        sym = {"OK": "ok", "SOFT404": "404!", "LANG-MISMATCH": "LANG", "RUNTIME": "rt", "NO-LANG-ATTR": "nolg"}
        for label in labels:
            line = f"{label:<26}"
            for lang in LANGS:
                r = next(x for x in sub if x["lang"] == lang and x["label"] == label)
                line += f"{sym[r['verdict']]:>6}"
            print(line)

    print("\n\nLEGENDA: ok = corretto | 404! = soft-404 (serve la HOME IT) | "
          "LANG = pagina in lingua sbagliata | rt = tradotta a runtime via ?lang=")

    print("\n--- DETTAGLIO LANG-MISMATCH ---")
    seen = set()
    for r in rows:
        if r["verdict"] not in ("LANG-MISMATCH", "NO-LANG-ATTR"):
            continue
        k = (r["src"], r["label"], r["target"], r["served_lang"])
        if k in seen:
            continue
        seen.add(k)
        langs = sorted({x["lang"] for x in rows
                        if x["src"] == r["src"] and x["label"] == r["label"]
                        and x["verdict"] == r["verdict"]})
        print(f"  [{r['src']}] {r['label']:<26} -> {str(r['target']):<28} "
              f"pagina in '{r['served_lang']}' | lingue colpite: {','.join(langs)}")

    tot = len(rows)
    for v in ("OK", "RUNTIME", "LANG-MISMATCH", "NO-LANG-ATTR", "SOFT404"):
        n = sum(1 for r in rows if r["verdict"] == v)
        print(f"\n{v:<15}: {n:4d} / {tot}", end="")
    print()


if __name__ == "__main__":
    main()
