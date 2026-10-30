#!/usr/bin/env python3
"""
AdOff — Fix dei link interni ROTTI in site/ (trovati da validate_site.py --seo).

Risoluzione intelligente dell'intento (NON un blanket-rewrite):
  pagina = {lang}/foo.html ; href rotto con basename B →
    1. se esiste {lang}/B  → rewrite a "/{lang}/B"  (pagina localizzata; fixa i path duplicati ar/→ar/ar/)
    2. elif esiste B a root → rewrite a "/B"        (pagine root-only: install/chi-sono/zip/legali)
    3. else → lascia e segnala (link davvero morto)
I link già funzionanti non si toccano. Path assoluti per robustezza da ogni sottocartella.

Uso: python3 fix_links.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
DRY = "--dry-run" in sys.argv
LANGS = {"it", "en", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "id", "pl", "hi", "ja", "ko"}


def existing_paths():
    s = set()
    for dp, _, names in os.walk(SITE):
        for n in names:
            s.add(os.path.relpath(os.path.join(dp, n), SITE).replace("\\", "/"))
    return s


def resolve(href, cur_rel):
    h = href.split("#")[0].split("?")[0].strip()
    if not h or h.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "data:", "//")):
        return None
    if h.startswith("/"):
        p = h[1:]
    else:
        p = os.path.normpath(os.path.join(os.path.dirname(cur_rel), h)).replace("\\", "/")
    if p == "" or p.endswith("/"):
        return (p + "index.html").lstrip("/")
    if "." in os.path.basename(p):
        return p
    return p + ".html"


def corrected(href, cur_rel, existing):
    """Ritorna il nuovo href assoluto, o None se non correggibile."""
    base = os.path.basename(href.split("#")[0].split("?")[0])
    if not base:
        return None
    seg = cur_rel.split("/")[0]
    lang = seg if seg in LANGS else None
    suffix = ""
    raw = href.split("#")
    frag = "#" + raw[1] if len(raw) > 1 else ""
    if lang and f"{lang}/{base}" in existing:
        return f"/{lang}/{base}{frag}"
    if base in existing:
        return f"/{base}{frag}"
    return None


def main():
    existing = existing_paths()
    href_re = re.compile(r'(href=["\'])([^"\']+)(["\'])')
    total_files, total_links, dead = 0, 0, []
    for dp, _, names in os.walk(SITE):
        for n in names:
            if not n.endswith(".html"):
                continue
            path = os.path.join(dp, n)
            rel = os.path.relpath(path, SITE).replace("\\", "/")
            text = open(path, encoding="utf-8").read()
            changed = 0

            def repl(m):
                nonlocal changed, dead
                pre, href, post = m.group(1), m.group(2), m.group(3)
                tgt = resolve(href, rel)
                if tgt is None or tgt in existing:
                    return m.group(0)            # esterno o già valido
                new = corrected(href, rel, existing)
                if new and new != href:
                    changed += 1
                    return pre + new + post
                dead.append(f"{rel} → {href}")
                return m.group(0)

            new_text = href_re.sub(repl, text)
            if changed:
                total_files += 1
                total_links += changed
                print(f"  {rel}: {changed} link")
                if not DRY:
                    open(path, "w", encoding="utf-8").write(new_text)
    print(f"\n{'[DRY] ' if DRY else ''}{total_links} link corretti in {total_files} file")
    if dead:
        print(f"\n⚠️  {len(dead)} link non correggibili (target inesistente ovunque):")
        for d in dead[:20]:
            print(f"    {d}")


if __name__ == "__main__":
    main()
