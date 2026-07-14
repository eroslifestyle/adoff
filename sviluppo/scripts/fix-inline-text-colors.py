#!/usr/bin/env python3
"""
fix-inline-text-colors.py — Rende tema-aware i colori di TESTO hardcoded.

Contesto: il sito è stato redisegnato light+dark (2026-07-14), ma centinaia di
pagine hanno blocchi <style> per-pagina con `color: #xxx` pensati per il vecchio
tema dark (bianco / grigi chiari). Su tema light diventano testo chiaro su sfondo
chiaro → illeggibili (le "descrizioni in tabella" segnalate dall'utente).

Strategia CONTEXT-AWARE per regola CSS: per ogni blocco `selettore { ... }` si
sostituisce `color: <neutro>` con una variabile CSS tema-aware SOLO se la regola
NON ha anche un `background`/`background-color` scuro o accent. Così i bottoni e
i badge (testo bianco su fondo viola/scuro) restano intatti, mentre le
descrizioni su superficie chiara diventano leggibili in entrambi i temi.

Copre sia le regole nei blocchi <style> sia i `color:` negli attributi
`style="..."` inline (che non hanno un proprio background → sempre mappati, a
meno che l'attributo stesso porti un background scuro).

Idempotente: una var non contiene `#`, quindi rieseguire non fa nulla.
"""
import re
import sys
from pathlib import Path

# colore-testo-neutro (lowercase) → variabile CSS tema-aware già in style.css.
#   --text        primario   #1a1a2e light / #e2e2f0 dark
#   --text-muted  secondario #5a5a72 light / #8a8aaa dark   (descrizioni)
#   --text-dim    terziario  #6d6d85 light / #80809a dark
COLOR_MAP = {
    "#fff": "var(--text)", "#ffffff": "var(--text)",
    "#e2e2f0": "var(--text)", "#d8d8ea": "var(--text)",
    "#d4d4e8": "var(--text)", "#cfcfe2": "var(--text)",
    "#c8c8d8": "var(--text)", "#0a0a1a": "var(--text)",
    "#000": "var(--text)", "#000000": "var(--text)", "#333": "var(--text)",
    "#b0b0c8": "var(--text-muted)", "#8888aa": "var(--text-muted)",
    "#8a8aaa": "var(--text-muted)", "#a0a0c0": "var(--text-muted)",
    "#a0a0b8": "var(--text-muted)", "#9090c0": "var(--text-muted)",
    "#c9d1d9": "var(--text-muted)", "#8b949e": "var(--text-muted)",
    "#94a3b8": "var(--text-muted)", "#aaa": "var(--text-muted)",
    "#6f6f8e": "var(--text-dim)", "#6c6c85": "var(--text-dim)",
    "#6a6a8a": "var(--text-dim)", "#6b6b80": "var(--text-dim)",
    "#5a5a7a": "var(--text-dim)", "#4a4a6a": "var(--text-dim)",
    "#3a3a5a": "var(--text-dim)",
}

_HEX = r"#[0-9a-fA-F]{3,6}\b|#[0-9a-fA-F]{3}\b"
_COLOR_RE = re.compile(r"(color\s*:\s*)(#[0-9a-fA-F]{3,6})", re.IGNORECASE)

# Segnali di "fondo scuro/accent nella stessa regola" → NON toccare il color.
_DARK_BG_RE = re.compile(
    r"background(?:-color)?\s*:[^;}]*"
    r"(var\(--primary\)|var\(--accent[^)]*\)|var\(--shield[^)]*\)|"
    r"var\(--deep-space\)|var\(--midnight[^)]*\)|gradient|"
    r"#7c5cfc|#7252f8|#4c3ad4|#b8a9ff|#0a0a1a|#12122a|#1[0-9a-f]{5}|#0[0-9a-f]{5})",
    re.IGNORECASE,
)


def _map_colors_in(text: str) -> tuple[str, int]:
    """Applica COLOR_MAP a tutti i `color:` in text. Ritorna (nuovo, n_sost)."""
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        var = COLOR_MAP.get(m.group(2).lower())
        if var is None:
            return m.group(0)
        count += 1
        return m.group(1) + var

    return _COLOR_RE.sub(repl, text), count


# Un blocco regola CSS: `<selettori> { <corpo> }` (corpo senza `{` `}` annidati).
_RULE_RE = re.compile(r"(\{)([^{}]*)(\})")


def _process_style_blocks(html: str) -> tuple[str, int]:
    """Nei <style>…</style>, mappa color per regola, saltando regole con bg scuro."""
    total = 0

    def per_style(style_match: re.Match) -> str:
        nonlocal total
        block = style_match.group(0)

        def per_rule(rule_match: re.Match) -> str:
            nonlocal total
            body = rule_match.group(2)
            if _DARK_BG_RE.search(body):
                return rule_match.group(0)  # testo su fondo scuro → invariato
            new_body, n = _map_colors_in(body)
            total += n
            return rule_match.group(1) + new_body + rule_match.group(3)

        return _RULE_RE.sub(per_rule, block)

    html = re.sub(r"<style\b[^>]*>.*?</style>", per_style, html,
                  flags=re.IGNORECASE | re.DOTALL)
    return html, total


_INLINE_STYLE_RE = re.compile(r'style\s*=\s*"([^"]*)"', re.IGNORECASE)


def _process_inline_styles(html: str) -> tuple[str, int]:
    """Negli attributi style="…", mappa color salvo bg scuro nello stesso attr."""
    total = 0

    def per_attr(m: re.Match) -> str:
        nonlocal total
        body = m.group(1)
        if _DARK_BG_RE.search(body):
            return m.group(0)
        new_body, n = _map_colors_in(body)
        total += n
        return 'style="' + new_body + '"'

    return _INLINE_STYLE_RE.sub(per_attr, html), total


def process_file(path: Path) -> int:
    html = path.read_text(encoding="utf-8")
    html, n1 = _process_style_blocks(html)
    html, n2 = _process_inline_styles(html)
    total = n1 + n2
    if total:
        path.write_text(html, encoding="utf-8")
    return total


def main() -> None:
    site_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("site")
    if not site_root.is_dir():
        print(f"ERRORE: {site_root} non è una directory", file=sys.stderr)
        sys.exit(1)

    # Pagine dark-only per design (admin) — NON renderle tema-aware.
    DARK_ONLY = {"panel.html", "admin-console.html", "admin.html"}

    files = sorted(site_root.rglob("*.html"))
    changed_files, changed_total = 0, 0
    for f in files:
        if f.name in DARK_ONLY:
            continue
        n = process_file(f)
        if n:
            changed_files += 1
            changed_total += n
            print(f"  {n:5d}  {f.relative_to(site_root)}")

    print(f"\nFatto: {changed_total} color→var tema-aware in {changed_files} file "
          f"(su {len(files)} .html totali).")


if __name__ == "__main__":
    main()
