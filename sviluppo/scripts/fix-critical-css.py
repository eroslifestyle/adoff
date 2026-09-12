#!/usr/bin/env python3
"""fix-critical-css.py — rende TEMA-AWARE il critical-CSS inline delle pagine content.

Problema: ~19-30 pagine content hanno un blocco <style id="adoff-critical"> con un
`:root{...}` inline che fissa i token semantici sui valori DARK (--bg:var(--deep-space),
--text:#e2e2f0, ...). Questo :root inline VINCE sul tema light di style.css, rendendo
i testi illeggibili in light mode.

Fix DETERMINISTICO per sostituzione stringa-esatta (idempotente):
  1. Nel :root inline, sostituisce i valori semantici dark con i valori LIGHT
     (identici a quelli di style.css :root).
  2. Inietta un blocco `:root[data-theme="dark"]{...}` subito dopo il :root inline,
     che ripristina i valori dark quando data-theme=dark.
  3. Rimappa i color:#fff / #ffffff / #e2e2f0 hardcoded nei <style> custom -> var(--text).

Idempotente: se una pagina contiene gia il marker light, viene skippata.

Default: --dry-run. --apply per scrivere.
"""
import argparse
import difflib
import glob
import os
import sys

MARKER = "/*theme-aware-v3*/"

# Coppie (dark inline esatto -> light). Rispecchiano la formattazione del critical CSS.
ROOT_LIGHT = [
    ("--bg:           var(--deep-space);", "--bg:           #f7f7fb;" + MARKER),
    ("--surface:      var(--midnight-blue);", "--surface:      #ffffff;"),
    ("--surface-2:    #1a1a36;", "--surface-2:    #eef0f7;"),
    ("--surface-warm: #15152e;", "--surface-warm: #f2f0fb;"),
    ("--text:         #e2e2f0;", "--text:         #1a1a2e;"),
    ("--text-dim:     #80809a;", "--text-dim:     #6d6d85;"),
    ("--accent-light: var(--shield-purple-light);", "--accent-light: var(--shield-purple-dark);"),
    ("--border:        rgba(124, 92, 252, 0.18);", "--border:        rgba(124, 92, 252, 0.16);"),
    ("--border-subtle: rgba(255, 255, 255, 0.06);", "--border-subtle: rgba(20, 20, 45, 0.08);"),
]

# Blocco dark override da iniettare dopo la chiusura del :root inline.
DARK_OVERRIDE = (
    ":root[data-theme=\"dark\"]{"
    "--bg:var(--deep-space);--surface:var(--midnight-blue);--surface-2:#1a1a36;"
    "--surface-warm:#15152e;--text:#e2e2f0;--text-dim:#80809a;"
    "--accent-light:var(--shield-purple-light);--border:rgba(124,92,252,0.18);"
    "--border-subtle:rgba(255,255,255,0.06)}"
)

# Colori chiari hardcoded nei <style> custom -> token (leggibili in entrambi i temi).
HARDCODED_TEXT = [
    ("color: #fff;", "color: var(--text);"),
    ("color:#fff;", "color: var(--text);"),
    ("color: #ffffff;", "color: var(--text);"),
    ("color:#ffffff;", "color: var(--text);"),
    ("color: #e2e2f0;", "color: var(--text);"),
    ("color:#e2e2f0;", "color: var(--text);"),
    # Grigi-chiari da dark usati come body-text (illeggibili su fondo light) -> token muted
    ("color: #b0b0c8;", "color: var(--text-muted);"),
    ("color:#b0b0c8;", "color: var(--text-muted);"),
    ("color: #b8b8d0;", "color: var(--text-muted);"),
    ("color: #c0c0d8;", "color: var(--text-muted);"),
    ("color: #a0a0c0;", "color: var(--text-muted);"),
]

# Fix indipendente dal MARKER: --text-muted nel :root inline resta dark -> ribalta a light
# con override dark. Applicato una volta (guardia con MUTED_MARKER).
MUTED_MARKER = "/*muted-aware-v3*/"


def fix_root(text):
    if MARKER in text:
        return text, 0  # gia processato
    if "--bg:           var(--deep-space);" not in text:
        return text, 0  # non ha il critical CSS atteso
    n = 0
    for src, dst in ROOT_LIGHT:
        if src in text:
            text = text.replace(src, dst, 1)
            n += 1
    # inietta il dark override dopo la PRIMA chiusura di :root inline.
    # Il :root inline termina con "--transition:     var(--t)}" nel critical css.
    anchor = "--transition:     var(--t)}"
    if anchor in text:
        text = text.replace(anchor, anchor + DARK_OVERRIDE, 1)
        n += 1
    return text, n


# Se una riga contiene uno di questi, il #fff e' testo-su-accento: NON sostituire.
ON_ACCENT_GUARDS = ("btn--primary", "background: var(--primary)", "background:var(--primary)",
                    "background: var(--accent)", "background:var(--accent)", "--accent-btn",
                    ".cta-box", "background: var(--accent-btn)",
                    "background: #7c5cfc", "background:#7c5cfc", "background: var(--accent,",
                    "rank-badge", "layer-badge", "rgba(255,255,255", "rgba(255, 255, 255",
                    "closeBtn.style")


def fix_muted(text):
    """Ribalta --text-muted (e --text-dim se dark) nel :root inline a valori light."""
    if MUTED_MARKER in text:
        return text, 0
    src = "--text-muted:   var(--steel-gray);"
    if src not in text:
        return text, 0
    # light: muted leggibile su fondo chiaro; dark override lo riporta a steel-gray
    text = text.replace(src, "--text-muted:   #5a5a72;" + MUTED_MARKER, 1)
    # aggiungi il muted al dark override gia iniettato (se presente)
    if ":root[data-theme=\"dark\"]{" in text and "--text-muted:var(--steel-gray)" not in text:
        text = text.replace(
            ":root[data-theme=\"dark\"]{",
            ":root[data-theme=\"dark\"]{--text-muted:var(--steel-gray);", 1)
    return text, 1


def fix_hardcoded(text):
    n = 0
    out = []
    for line in text.split("\n"):
        if any(g in line for g in ON_ACCENT_GUARDS):
            out.append(line)  # testo su fondo accento: lascia il bianco
            continue
        for src, dst in HARDCODED_TEXT:
            if src in line:
                n += line.count(src)
                line = line.replace(src, dst)
        out.append(line)
    return "\n".join(out), n


def process(path, apply):
    try:
        with open(path, encoding="utf-8") as f:
            original = f.read()
    except Exception as e:
        print(f"  ERR {path}: {e}", file=sys.stderr)
        return (0, 0)

    text = original
    text, n_root = fix_root(text)
    text, n_muted = fix_muted(text)
    text, n_hard = fix_hardcoded(text)
    n_root += n_muted

    if text == original:
        return (0, 0)

    diff = difflib.unified_diff(
        original.splitlines(True), text.splitlines(True),
        fromfile=path, tofile=path + " (fixed)", n=0)
    changed = [d for d in diff if d.startswith(("+", "-")) and not d.startswith(("+++", "---"))]
    print(f"\n-- {path}  [root:{n_root} hardcoded:{n_hard}]")
    for d in changed[:12]:
        print("   " + d.rstrip("\n")[:160])
    if len(changed) > 12:
        print(f"   ... (+{len(changed)-12} righe)")

    if apply:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
    return (n_root, n_hard)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="site")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    apply = args.apply and not args.dry_run

    files = sorted(glob.glob(os.path.join(args.root, "*.html")) +
                   glob.glob(os.path.join(args.root, "vs", "*.html")))
    tot = [0, 0]
    touched = 0
    for p in files:
        r = process(p, apply)
        if any(r):
            touched += 1
        tot[0] += r[0]
        tot[1] += r[1]

    print(f"\n===== {'APPLIED' if apply else 'DRY-RUN'} =====")
    print(f"file toccati: {touched}/{len(files)}  root-fix:{tot[0]} hardcoded-fix:{tot[1]}")


if __name__ == "__main__":
    main()
