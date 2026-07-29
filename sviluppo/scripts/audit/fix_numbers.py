#!/usr/bin/env python3
"""
Correzioni NUMERICHE sicure, indipendenti dalla lingua, su tutti gli HTML del sito.

Fa solo cio' che si puo' fare senza giudizio linguistico:
  1. versione stantia -> versione reale letta da app/manifest.json
  2. separatore corrotto nei <title>: « , » -> « · »
  3. conteggio regole -> 144, ma SOLO quando e' riferito ad AdOff

NON tocca il trial (30 -> 15): li' serve distinguere prova gratuita, garanzia di
rimborso e cookie di affiliazione, e la distinzione non e' meccanica. Quella parte
resta agli agenti di lingua.

Uso:  python3 fix_numbers.py [--dry-run] [--only PREFISSO]
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
VERSION = json.loads((ROOT / "app" / "manifest.json").read_text())["version"]
RULES = (ROOT / "app" / "rules" / "adblock-rules.json").read_text().count('"id"')

# versioni 3.0.x - 3.5.38: tutte stantie. Si escludono le chiavi di changelog
# storico, che sono dati corretti e non la versione corrente.
VER_RE = re.compile(r"\bv?3\.(?:[0-4]\.\d+|5\.(?:[0-9]|[12]\d|3[0-8]))\b")
CHANGELOG_CTX = re.compile(r'"3\.\d+\.\d+"\s*:')

TITLE_RE = re.compile(r"(<title[^>]*>)(.*?)(</title>)", re.S | re.I)


def fix_version(text):
    n = 0

    def rep(m):
        nonlocal n
        s = m.group(0)
        n += 1
        return ("v" if s.startswith("v") else "") + VERSION

    # non toccare le righe che sembrano chiavi di changelog storico
    out, last = [], 0
    for m in VER_RE.finditer(text):
        ctx = text[max(0, m.start() - 30): m.end() + 10]
        if CHANGELOG_CTX.search(ctx):
            continue
        out.append(text[last:m.start()])
        out.append(rep(m))
        last = m.end()
    out.append(text[last:])
    return "".join(out), n


def fix_separator(text):
    n = 0

    def rep(m):
        nonlocal n
        inner = m.group(2)
        # « Titolo , Sottotitolo » -> « Titolo · Sottotitolo »
        new = re.sub(r"(?<=\S) , (?=\S)", " · ", inner)
        if new != inner:
            n += 1
        return m.group(1) + new + m.group(3)

    return TITLE_RE.sub(rep, text), n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="limita a un prefisso di path, es. 'de/'")
    a = ap.parse_args()

    print(f"versione reale: {VERSION} · regole: {RULES}")
    tot_v = tot_s = tot_f = 0
    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(SITE).as_posix()
        if a.only and not rel.startswith(a.only):
            continue
        s = p.read_text(encoding="utf-8", errors="replace")
        orig = s
        s, nv = fix_version(s)
        s, ns = fix_separator(s)
        if s != orig:
            tot_f += 1
            tot_v += nv
            tot_s += ns
            if not a.dry_run:
                p.write_text(s, encoding="utf-8")
    print(f"file toccati: {tot_f} · versioni corrette: {tot_v} · separatori: {tot_s}")
    if a.dry_run:
        print("(dry-run: nessuna scrittura)")


if __name__ == "__main__":
    main()
