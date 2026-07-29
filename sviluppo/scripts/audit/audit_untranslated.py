#!/usr/bin/env python3
"""
FASE 2b — separa i due bug opposti nascosti dietro "valore identico all'italiano":

  (1) it.json contiene INGLESE          -> l'utente italiano legge inglese
  (2) xx.json contiene ITALIANO         -> l'utente straniero legge italiano

Il rilevatore e' euristico (stopword marker IT vs EN) e volutamente conservativo:
classifica solo stringhe >= 25 caratteri con almeno 2 marker di scarto, il resto
finisce in "incerto". I numeri vanno letti come ordine di grandezza verificato
per campione, non come misura esatta.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
I18N = SITE / "i18n"
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

LANGS = ["en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "pl", "hi", "ja", "ko", "id"]

IT_MARK = re.compile(
    r"\b(il|lo|la|le|gli|dei|delle|della|del|nel|nella|che|per|con|una|un'|"
    r"sono|puoi|tuo|tua|tuoi|questo|questa|anche|piu|piu'|senza|come|"
    r"quando|perche|solo|tutti|tutte|ogni|dove|viene|essere|fare)\b",
    re.I)
EN_MARK = re.compile(
    r"\b(the|you|your|and|with|for|that|this|are|is|to|of|from|have|has|"
    r"will|can|not|but|they|it's|we|our|when|where|why|how|all|every)\b",
    re.I)
IT_ACCENT = re.compile(r"[àèéìòùÀÈÉÌÒÙ]")

MIN_LEN = 25
MIN_GAP = 2


def guess(s: str):
    if not isinstance(s, str) or len(s.strip()) < MIN_LEN:
        return "incerto"
    it = len(IT_MARK.findall(s)) + len(IT_ACCENT.findall(s))
    en = len(EN_MARK.findall(s))
    if it - en >= MIN_GAP:
        return "it"
    if en - it >= MIN_GAP:
        return "en"
    return "incerto"


def collect_used():
    used = set()
    for p in SITE.rglob("*.html"):
        if p.relative_to(SITE).parts[0] == "graphify-out":
            continue
        used |= set(re.findall(
            r"""data-i18n(?:-html|-placeholder)?\s*=\s*["']([^"']+)["']""",
            p.read_text(encoding="utf-8", errors="replace")))
    return used


def main():
    it = json.loads((I18N / "it.json").read_text(encoding="utf-8"))
    same_ok = set(json.loads((I18N / "_same_ok.json").read_text()))
    used = collect_used()

    print("=" * 92)
    print("FASE 2b — natura reale delle stringhe 'non tradotte'")
    print("=" * 92)
    print(f"{'lang':<6}{'ident.a IT':>12}{'di cui usate':>14}{'e'' ITALIANO':>14}{'e'' INGLESE':>13}{'incerto':>9}")
    print("-" * 92)

    detail = {}
    tot_it_in_foreign = 0
    for lang in LANGS:
        d = json.loads((I18N / f"{lang}.json").read_text(encoding="utf-8"))
        same = [k for k in it
                if k in d and isinstance(it[k], str) and it[k].strip()
                and d[k] == it[k] and k not in same_ok]
        same_used = [k for k in same if k in used]
        g = {"it": [], "en": [], "incerto": []}
        for k in same_used:
            g[guess(it[k])].append(k)
        tot_it_in_foreign += len(g["it"])
        print(f"{lang:<6}{len(same):>12}{len(same_used):>14}{len(g['it']):>14}{len(g['en']):>13}{len(g['incerto']):>9}")
        detail[lang] = {kk: vv for kk, vv in g.items()}

    print("-" * 92)
    print("Colonna «e' ITALIANO» = stringhe italiane servite a utenti stranieri (bug tipo 2).")
    print("Colonna «e' INGLESE»  = it.json contiene inglese: l'utente italiano legge inglese (bug tipo 1).")

    # bug tipo 1: quantifica su it.json direttamente
    en_in_it = [k for k in it
                if k in used and isinstance(it[k], str) and guess(it[k]) == "en"]
    print(f"\nBUG TIPO 1 — chiavi USATE il cui valore in it.json e' inglese: {len(en_in_it)}")
    for k in en_in_it[:8]:
        print(f"   {k}\n      -> {it[k][:96]}")

    print(f"\nBUG TIPO 2 — esempi di italiano servito in lingua straniera:")
    for lang in ("de", "ja", "ar"):
        ex = detail[lang]["it"][:3]
        for k in ex:
            print(f"   [{lang}] {k}\n      -> {it[k][:96]}")

    (OUT / "untranslated.json").write_text(json.dumps(
        {"detail": detail, "en_in_it": en_in_it}, indent=1, ensure_ascii=False))
    print(f"\nDettaglio -> {OUT / 'untranslated.json'}")


if __name__ == "__main__":
    main()
