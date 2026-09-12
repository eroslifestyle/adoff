#!/usr/bin/env python3
"""One-shot: inietta author Person 'Eros' (E-E-A-T) negli schema JSON-LD dei
template prose delle 4 comparison/tool pages. Idempotente. SSOT = template;
applicare poi con prose_i18n.py apply <slug>.

- vs/{ublock-origin,adblock-plus,adguard}: author dentro l'Article (prima di publisher).
- adblock-detector: author dentro la WebApplication (prima di offers).
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROSE = ROOT / "sviluppo" / "seo-tools" / ".state" / "prose"

AUTHOR = (
    '    "author": {\n'
    '      "@type": "Person",\n'
    '      "name": "Eros",\n'
    '      "url": "https://adoff.app/about"\n'
    '    },\n'
)

VS_ANCHOR = (
    '    "publisher": {\n'
    '      "@type": "Organization",\n'
    '      "name": "AdOff",\n'
    '      "url": "https://adoff.app"\n'
    '    },\n'
)

DET_ANCHOR = '    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },\n'

TARGETS = {
    "vs/ublock-origin": (VS_ANCHOR, AUTHOR + VS_ANCHOR),
    "vs/adblock-plus": (VS_ANCHOR, AUTHOR + VS_ANCHOR),
    "vs/adguard": (VS_ANCHOR, AUTHOR + VS_ANCHOR),
    "adblock-detector": (DET_ANCHOR, AUTHOR + DET_ANCHOR),
}


def main():
    for slug, (anchor, repl) in TARGETS.items():
        tmpls = sorted((PROSE / slug).glob("_template*.html"))
        for t in tmpls:
            txt = t.read_text(encoding="utf-8")
            if '"name": "Eros"' in txt:
                print(f"  SKIP (gia' presente) {slug}/{t.name}")
                continue
            if anchor not in txt:
                print(f"  ⚠️  ANCHOR MANCANTE {slug}/{t.name} — NON modificato")
                continue
            t.write_text(txt.replace(anchor, repl, 1), encoding="utf-8")
            print(f"  OK  {slug}/{t.name}")


if __name__ == "__main__":
    main()
