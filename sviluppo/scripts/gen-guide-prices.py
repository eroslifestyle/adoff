#!/usr/bin/env python3
"""
gen-guide-prices.py — Rigenera i prezzi delle guide multilingua dal SSOT.

Single source of truth: site/data/constants.json (chiave "pricing").
Aggiorna SOLO i valori numerici nelle 3 righe a pagamento della tabella prezzi
di ogni site/**/guide.html (Mensile / Annuale / Lifetime), preservando simbolo
valuta, suffissi ("/mese", "/month", "/Monat"...) e tutta la prosa per-lingua.

Idempotente: se i numeri coincidono gia' col SSOT, non scrive nulla.

Uso:
    python sviluppo/scripts/gen-guide-prices.py            # applica (annuale = Founder)
    python sviluppo/scripts/gen-guide-prices.py --dry-run  # mostra cosa cambierebbe
    python sviluppo/scripts/gen-guide-prices.py --annual standard   # usa il prezzo annuale standard

Dopo l'esecuzione: deploy sito + purge cache (le guide sono servite via 308 .html->URL pulito).
"""
import argparse
import glob
import io
import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
SITE_DIR = os.path.join(PROJECT_ROOT, "site")
CONSTANTS = os.path.join(SITE_DIR, "data", "constants.json")

# Ordine fisso delle righe a pagamento nella tabella prezzi delle guide.
PAID_ROW_ORDER = ["monthly", "annual", "lifetime"]

PRICE_TABLE_RE = re.compile(r'<table class="guide-table">.*?</table>', re.S)
TD_RE = re.compile(r"(<td>)([^<]*?)(</td>)")
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")
# Valuta = euro in tutte le sue forme usate nelle guide: "EUR", simbolo, arabo, cinese.
CURRENCY_RE = re.compile(r"EUR|€|يورو|欧元")
# Per dedurre il separatore decimale dai prezzi gia' presenti.
DECIMAL_PROBE_RE = re.compile(r"\d+([.,])\d{2}")


def lang_of(path):
    """site/guide.html -> 'BASE'; site/en/guide.html -> 'en'."""
    rel = os.path.relpath(path, SITE_DIR)
    parts = rel.split(os.sep)
    return parts[0] if len(parts) == 2 else "BASE"


def detect_decimal_sep(table_html):
    """Deduce il separatore decimale (',' o '.') dai prezzi gia' presenti."""
    probe = DECIMAL_PROBE_RE.search(table_html)
    return probe.group(1) if probe else ","


def format_price(value, decimal_sep, decimals):
    text = "{:.{d}f}".format(float(value), d=decimals)
    if decimal_sep == ",":
        text = text.replace(".", ",")
    return text


def decimals_for(key, value):
    # Lifetime intero; mensile/annuale 2 decimali (salvo importo intero).
    if key == "lifetime" or float(value).is_integer():
        return 0
    return 2


def rewrite_table(table_html, prices, decimal_sep):
    state = {"i": 0, "changed": 0}

    def repl(match):
        inner = match.group(2)
        if not CURRENCY_RE.search(inner) or not NUMBER_RE.search(inner):
            return match.group(0)  # non e' una cella prezzo (Free / Trial / Include)
        if state["i"] >= len(PAID_ROW_ORDER):
            return match.group(0)
        key = PAID_ROW_ORDER[state["i"]]
        state["i"] += 1
        value = prices[key]
        new_num = format_price(value, decimal_sep, decimals_for(key, value))
        new_inner = NUMBER_RE.sub(new_num, inner, count=1)
        if new_inner != inner:
            state["changed"] += 1
        return match.group(1) + new_inner + match.group(3)

    new_table = TD_RE.sub(repl, table_html)
    return new_table, state["i"], state["changed"]


def process_file(path, prices, write):
    source = io.open(path, encoding="utf-8").read()
    # Una guida ha piu' <table class="guide-table">: scegli quella prezzi
    # (la prima che contiene un indicatore di valuta).
    table = None
    for m in PRICE_TABLE_RE.finditer(source):
        if CURRENCY_RE.search(m.group(0)):
            table = m.group(0)
            break
    if table is None:
        return ("skip", 0)
    decimal_sep = detect_decimal_sep(table)
    new_table, matched, changed = rewrite_table(table, prices, decimal_sep)
    if matched != len(PAID_ROW_ORDER):
        return ("warn:%d-cells" % matched, changed)
    if changed == 0:
        return ("ok", 0)
    if write:
        io.open(path, "w", encoding="utf-8").write(source.replace(table, new_table, 1))
    return ("updated", changed)


def main():
    parser = argparse.ArgumentParser(description="Rigenera prezzi guide da constants.json")
    parser.add_argument("--annual", choices=["founder", "standard"], default="founder",
                        help="quale prezzo annuale usare (default: founder)")
    parser.add_argument("--dry-run", action="store_true", help="non scrivere, mostra solo")
    args = parser.parse_args()

    constants = json.load(io.open(CONSTANTS, encoding="utf-8"))
    p = constants["pricing"]
    prices = {
        "monthly": p["monthly"],
        "annual": p["annual_founder"] if args.annual == "founder" else p["annual_standard"],
        "lifetime": p["founder_lifetime"],
    }
    print("SSOT prezzi: mensile=%s  annuale(%s)=%s  lifetime=%s  [%s]" % (
        prices["monthly"], args.annual, prices["annual"], prices["lifetime"], p["currency"]))

    files = sorted(set(
        glob.glob(os.path.join(SITE_DIR, "guide.html")) +
        glob.glob(os.path.join(SITE_DIR, "*", "guide.html"))
    ))
    updated = 0
    for path in files:
        status, changed = process_file(path, prices, write=not args.dry_run)
        if status not in ("ok",):
            label = lang_of(path) or "BASE"
            print("  %-6s %s (%d valori)" % (label, status, changed))
        if status == "updated":
            updated += 1
    action = "cambierebbero" if args.dry_run else "aggiornati"
    print("Totale file %s: %d / %d" % (action, updated, len(files)))
    if not args.dry_run and updated:
        print("\nProssimo passo: deploy sito + purge cache.")


if __name__ == "__main__":
    main()
