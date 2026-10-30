#!/usr/bin/env python3
"""
FASE 2 — audit i18n completo su tutti i 568 HTML e i 15 dizionari /i18n/*.json.

Controlla:
  A. chiavi usate negli HTML ma assenti dal dizionario della lingua  -> testo resta in IT
  B. chiavi presenti nel dizionario ma mai usate in nessun HTML      -> orfane
  C. valori vuoti ("")                                              -> testo sparisce/resta IT
  D. valori identici all'italiano                                   -> non tradotto
  E. pagine che includono nav/footer ma NON adoff-i18n.js            -> footer bloccato in IT
  F. chiavi del footer generato a runtime, per lingua
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
I18N = SITE / "i18n"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

LANGS = ["it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "pl", "hi", "ja", "ko", "id"]

KEY_RE = re.compile(r"""\bdata-i18n(?:-html|-placeholder)?\s*=\s*["']([^"']+)["']""")

# chiavi che l'HTML non contiene ma che il footer/nav iniettano a runtime
FOOTER_KEYS = [
    "footer.tagline", "footer.desc", "footer.col.product", "footer.pricing",
    "footer.premium", "footer.install", "footer.howit", "footer.guide",
    "footer.best", "footer.tool", "footer.col.compare", "footer.vs.ublock",
    "footer.vs.abp", "footer.vs.adguard", "footer.col.company", "footer.community",
    "footer.blog", "footer.vs.all", "footer.about", "footer.aboutdata",
    "footer.support", "footer.press", "footer.copy", "footer.privacy",
    "footer.terms", "footer.withdrawal",
]


def load_dicts():
    d = {}
    for lang in LANGS:
        p = I18N / f"{lang}.json"
        if not p.is_file():
            print(f"!! MANCA {p}")
            continue
        d[lang] = json.loads(p.read_text(encoding="utf-8"))
    return d


def page_lang_of(rel: str):
    """La lingua con cui verra' tradotta la pagina, dedotta dal path."""
    first = rel.split("/")[0]
    return first if first in LANGS and len(first) == 2 else "it"


def main():
    dicts = load_dicts()
    same_ok = set(json.loads((I18N / "_same_ok.json").read_text()))
    it = dicts["it"]

    html_files = sorted(
        p for p in SITE.rglob("*.html")
        if p.relative_to(SITE).parts[0] != "graphify-out"
    )

    # ── raccolta chiavi usate ────────────────────────────────────────────────
    used_by_lang = defaultdict(set)          # lingua -> chiavi richieste
    used_where = defaultdict(list)           # chiave -> [file:riga]
    all_used = set()
    pages_with_i18n = set()
    pages_with_footer = set()

    for p in html_files:
        rel = p.relative_to(SITE).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace")
        if "adoff-i18n.js" in text:
            pages_with_i18n.add(rel)
        if "adoff-footer.js" in text:
            pages_with_footer.add(rel)
        lang = page_lang_of(rel)
        for m in KEY_RE.finditer(text):
            k = m.group(1).strip()
            lineno = text[: m.start()].count("\n") + 1
            used_by_lang[lang].add(k)
            used_where[k].append(f"{rel}:{lineno}")
            all_used.add(k)

    report = {}

    print("=" * 78)
    print("FASE 2 — AUDIT i18n")
    print("=" * 78)
    print(f"HTML analizzati            : {len(html_files)}")
    print(f"chiavi data-i18n distinte  : {len(all_used)}")
    print(f"pagine con adoff-footer.js : {len(pages_with_footer)}")
    print(f"pagine con adoff-i18n.js   : {len(pages_with_i18n)}")
    print(f"  -> pagine col footer ma SENZA i18n.js (footer bloccato in IT): "
          f"{len(pages_with_footer - pages_with_i18n)}")

    # ── A. chiavi mancanti ───────────────────────────────────────────────────
    print("\n--- A. CHIAVE USATA NELL'HTML MA ASSENTE DAL DIZIONARIO ---")
    print(f"{'lang':<6}{'usate':>8}{'mancanti':>10}   esempi")
    for lang in LANGS:
        need = used_by_lang.get(lang, set())
        dic = dicts.get(lang, {})
        missing = sorted(k for k in need if k not in dic)
        ex = ", ".join(missing[:3])
        print(f"{lang:<6}{len(need):>8}{len(missing):>10}   {ex}")
        report.setdefault(lang, {})["missing_keys"] = missing

    # ── B. chiavi orfane ─────────────────────────────────────────────────────
    print("\n--- B. CHIAVI NEL DIZIONARIO MAI USATE IN NESSUN HTML ---")
    known_runtime = set(FOOTER_KEYS)
    for lang in ("it", "en"):
        orphans = sorted(k for k in dicts[lang]
                         if k not in all_used and k not in known_runtime)
        print(f"  {lang}.json: {len(orphans)} orfane su {len(dicts[lang])} "
              f"({100*len(orphans)//max(1,len(dicts[lang]))}%)  es. {orphans[:3]}")
        report.setdefault(lang, {})["orphan_keys"] = orphans

    # ── C. valori vuoti ──────────────────────────────────────────────────────
    print("\n--- C. VALORI VUOTI (il testo sparisce o resta in IT) ---")
    for lang in LANGS:
        empties = sorted(k for k, v in dicts[lang].items() if isinstance(v, str) and not v.strip())
        used_empties = [k for k in empties if k in all_used or k in known_runtime]
        print(f"  {lang:<4} vuote={len(empties):<5} di cui USATE in pagina={len(used_empties):<5} "
              f"es. {used_empties[:2]}")
        report.setdefault(lang, {})["empty_values"] = empties
        report[lang]["empty_used"] = used_empties

    # ── D. non tradotte (identiche all'italiano) ────────────────────────────
    print("\n--- D. VALORI IDENTICI ALL'ITALIANO (non tradotti) ---")
    print(f"{'lang':<6}{'confrontate':>13}{'identiche':>11}{'%':>6}   esempi")
    for lang in LANGS:
        if lang == "it":
            continue
        dic = dicts[lang]
        common = [k for k in it if k in dic and isinstance(it[k], str) and it[k].strip()]
        same = [k for k in common if dic[k] == it[k] and k not in same_ok]
        # solo quelle davvero renderizzate
        same_used = [k for k in same if k in all_used or k in known_runtime]
        pct = 100 * len(same) // max(1, len(common))
        print(f"{lang:<6}{len(common):>13}{len(same):>11}{pct:>5}%   {same_used[:2]}")
        report.setdefault(lang, {})["untranslated"] = same
        report[lang]["untranslated_used"] = same_used

    # ── F. chiavi footer ────────────────────────────────────────────────────
    print("\n--- F. CHIAVI DEL FOOTER RUNTIME (26) — presenza per lingua ---")
    for lang in LANGS:
        dic = dicts[lang]
        miss = [k for k in FOOTER_KEYS if k not in dic]
        empty = [k for k in FOOTER_KEYS if k in dic and not str(dic[k]).strip()]
        same = [k for k in FOOTER_KEYS
                if k in dic and lang != "it" and k in it and dic[k] == it[k]]
        print(f"  {lang:<4} mancanti={len(miss):<3} vuote={len(empty):<3} "
              f"uguali_a_IT={len(same):<3} {('MANCANTI: ' + ','.join(miss[:4])) if miss else ''}")

    (OUT / "i18n.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    print(f"\nDettaglio completo -> {OUT / 'i18n.json'}")


if __name__ == "__main__":
    main()
