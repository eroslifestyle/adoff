#!/usr/bin/env python3
"""Post-process build: inline critical CSS + async /style.css + preload font.

Idempotente E re-eseguibile (undo+apply, così aggiornare critical.css ri-applica).
- inietta <link rel=preload as=font> per InterVariable (font above-the-fold) →
  evita il reflow da font-swap ora che il paint è anticipato dal critical CSS;
- inietta <style id=adoff-critical> (chrome above-the-fold, penthouse, URL assoluti);
- converte <link rel=stylesheet href=/style.css> in async (preload→onload) + <noscript>.
Preserva href esatto (versione + &lang) e posizione del link (cascata invariata).
"""
import re, glob, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
CRIT = (pathlib.Path(__file__).resolve().parent / ".state" / "critical.css").read_text(encoding="utf-8").strip()
FONT = ('<link rel="preload" id="adoff-font" href="/assets/fonts/InterVariable.woff2" '
        'as="font" type="font/woff2" crossorigin />')
CRIT_BLOCK = '<style id="adoff-critical">' + CRIT + '</style>'
STYLE_LINK_RE = re.compile(r'<link rel="stylesheet" href="(/style\.css[^"]*)"\s*/?>')

def undo(html):
    html = re.sub(r'<link[^>]*id="adoff-font"[^>]*>', '', html)
    html = re.sub(r'<style id="adoff-critical">.*?</style>', '', html, flags=re.S)
    # async link + noscript → ripristina <link rel=stylesheet>
    html = re.sub(
        r'<link rel="preload" href="(/style\.css[^"]*)" as="style"[^>]*>'
        r'\s*<noscript><link rel="stylesheet" href="/style\.css[^"]*"\s*/?></noscript>',
        r'<link rel="stylesheet" href="\1" />', html)
    return html

def transform(html):
    html = undo(html)
    m = STYLE_LINK_RE.search(html)
    if not m:
        return html, False
    href = m.group(1)
    asyncl = (f'<link rel="preload" href="{href}" as="style" '
              f'onload="this.onload=null;this.rel=\'stylesheet\'" />'
              f'<noscript><link rel="stylesheet" href="{href}" /></noscript>')
    out = html[:m.start()] + FONT + CRIT_BLOCK + asyncl + html[m.end():]
    return out, True

def main():
    n = 0
    for f in glob.glob(str(SITE / "**" / "*.html"), recursive=True):
        p = pathlib.Path(f); h = p.read_text(encoding="utf-8")
        out, ok = transform(h)
        if ok and out != h:
            p.write_text(out, encoding="utf-8"); n += 1
    print(f"[inline-critical] {n} pagine (critical {len(CRIT)}B + font preload)")

if __name__ == "__main__":
    main()
