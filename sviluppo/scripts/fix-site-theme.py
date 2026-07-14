#!/usr/bin/env python3
"""fix-site-theme.py — allinea le pagine del sito AdOff al redesign v3 (2026-07-14).

Tre categorie di fix DETERMINISTICI e SICURI su site/*.html e site/vs/*.html:

  1. Trial 30 -> 15 giorni (SOLO trial/prova Pro; i rimborsi restano 30gg).
  2. Prezzo Founder 19,99 -> 29,99 (solo in contesto prezzo/anno/Founder).
  3. Anti-FOUC: inserisce lo snippet tema nell'<head> se assente.

Default: --dry-run (mostra diff, non scrive). --apply per scrivere in-place.

Le sostituzioni trial usano una LISTA ESPLICITA di stringhe (non una regex
generica su "30 giorni"), cosi i contesti di rimborso/notice non vengono
toccati per costruzione.
"""
import argparse
import difflib
import glob
import os
import re
import sys

# -- 1. Trial 30 -> 15: coppie (esatto -> sostituto). NIENTE rimborsi qui. --
TRIAL_REPLACEMENTS = [
    ("30 giorni di trial Pro", "15 giorni di trial Pro"),
    ("Trial 30gg Pro incluso", "Trial 15gg Pro incluso"),
    ("Trial 30gg Pro", "Trial 15gg Pro"),
    ("30-day full Pro trial", "15-day full Pro trial"),
    ("30-day Pro trial included", "15-day Pro trial included"),
    ("30-day Pro trial with Ste", "15-day Pro trial with Ste"),
    ("30-day Pro trial for", "15-day Pro trial for"),
    ("30-day Pro trial", "15-day Pro trial"),
    ("30-day free trial and", "15-day free trial and"),
    ("30-day free trial", "15-day free trial"),
    ("Prova gratis 30 giorni", "Prova gratis 15 giorni"),
    ("prova gratuita di 30 giorni", "prova gratuita di 15 giorni"),
    ("Prova gratuita di 30 giorni", "Prova gratuita di 15 giorni"),
    ("va gratuita di 30 giorni", "va gratuita di 15 giorni"),
    ("30 giorni con tutte le funzionalita", "15 giorni con tutte le funzionalita"),
    ("Dopo 30 giorni decidi", "Dopo 15 giorni decidi"),
    ("features free for 30 days", "features free for 15 days"),
    ("tures free for 30 days", "tures free for 15 days"),
    ("30 days completely free", "15 days completely free"),
    ("30 days free.", "15 days free."),
    ("30 days free</strong>", "15 days free</strong>"),
    # Trial contestuali (seconda passata)
    ("Prova AdOff gratuitamente per 30 giorni", "Prova AdOff gratuitamente per 15 giorni"),
    ("gratuitamente per 30 giorni", "gratuitamente per 15 giorni"),
    ("Try AdOff Pro free for 30 days", "Try AdOff Pro free for 15 days"),
    ("free for 30 days", "free for 15 days"),
    ("these free for 30 days", "these free for 15 days"),
    ("30 days through", "15 days through"),
    ("Prova Pro 30 giorni gratis", "Prova Pro 15 giorni gratis"),
    ("Trial 30 giorni gratis", "Trial 15 giorni gratis"),
    ("30 giorni gratis", "15 giorni gratis"),
    ("di tracciamento per 30 giorni", "di tracciamento per 15 giorni"),
    ("protezione gratuitamente per 30 giorni", "protezione gratuitamente per 15 giorni"),
    ("gratuita per 30 giorni", "gratuita per 15 giorni"),
    # Terza passata — residui specifici
    ("trial Pro da 30 giorni", "trial Pro da 15 giorni"),
    ("scade dopo 30 giorni", "scade dopo 15 giorni"),
    ("prova Pro completa di 30 giorni", "prova Pro completa di 15 giorni"),
    ("trial Pro 30 giorni incluso", "trial Pro 15 giorni incluso"),
    ("included free in the 30-day trial", "included free in the 15-day trial"),
    ("<strong>30-day free</strong>", "<strong>15-day free</strong>"),
]

ANTIFOUC = (
    '<script>\n'
    '  (function(){try{var t=localStorage.getItem("adoff_theme");'
    'if(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)t="dark";'
    'if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();\n'
    '</script>\n'
)

PRICE_CONTEXT = re.compile(r'(Founder|founder|/anno|anno|year|annual)')


def fix_trial(text):
    count = 0
    for src, dst in TRIAL_REPLACEMENTS:
        if src in text:
            count += text.count(src)
            text = text.replace(src, dst)
    return text, count


def fix_price(text):
    count = 0
    out = []
    for line in text.split("\n"):
        if ("19,99" in line or "19.99" in line) and PRICE_CONTEXT.search(line):
            new = line.replace("19,99", "29,99").replace("19.99", "29.99")
            if new != line:
                count += line.count("19,99") + line.count("19.99")
                line = new
        out.append(line)
    return "\n".join(out), count


def fix_antifouc(text):
    if "adoff_theme" in text:
        return text, 0
    m = re.search(r"<head>\s*\n", text)
    if not m:
        return text, 0
    idx = m.end()
    indented = "".join(("  " + l) if l.strip() else l for l in ANTIFOUC.splitlines(True))
    return text[:idx] + indented + text[idx:], 1


def process(path, apply):
    try:
        with open(path, encoding="utf-8") as f:
            original = f.read()
    except Exception as e:
        print(f"  ERR read {path}: {e}", file=sys.stderr)
        return (0, 0, 0)

    text = original
    text, t_trial = fix_trial(text)
    text, t_price = fix_price(text)
    text, t_fouc = fix_antifouc(text)

    if text == original:
        return (0, 0, 0)

    diff = difflib.unified_diff(
        original.splitlines(True), text.splitlines(True),
        fromfile=path, tofile=path + " (fixed)", n=1)
    changed = [d for d in diff if d.startswith(("+", "-")) and not d.startswith(("+++", "---"))]
    print(f"\n-- {path}  [trial:{t_trial} price:{t_price} fouc:{t_fouc}]")
    for d in changed[:40]:
        print("   " + d.rstrip("\n"))
    if len(changed) > 40:
        print(f"   ... (+{len(changed)-40} altre righe)")

    if apply:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
    return (t_trial, t_price, t_fouc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="site")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    apply = args.apply and not args.dry_run

    files = sorted(glob.glob(os.path.join(args.root, "*.html")) +
                   glob.glob(os.path.join(args.root, "vs", "*.html")))
    tot = [0, 0, 0]
    touched = 0
    for p in files:
        r = process(p, apply)
        if any(r):
            touched += 1
        for i in range(3):
            tot[i] += r[i]

    mode = "APPLIED" if apply else "DRY-RUN (nessuna scrittura)"
    print(f"\n===== {mode} =====")
    print(f"file toccati: {touched}/{len(files)}")
    print(f"trial 30->15: {tot[0]}   prezzo 19,99->29,99: {tot[1]}   anti-FOUC inseriti: {tot[2]}")


if __name__ == "__main__":
    main()
