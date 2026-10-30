#!/usr/bin/env python3
"""
AdOff — Ottimizza la LUNGHEZZA di <title> (≤60) e <meta description> (≤155) su tutte le pagine
indicizzabili, in OGNI lingua, senza perdere keyword/brand. Motore: Claude Haiku (`claude -p`).
Accorcia solo ciò che eccede; lascia intatto il resto. Aggiorna anche og/twitter title+desc se
combaciano col valore vecchio. Idempotente.

Run:  python3 sviluppo/seo-tools/seo_meta_optimize.py [--dry]
"""
import glob
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "site")
SITE = os.path.abspath(SITE)
CLAUDE = "/home/mrxxx/.local/bin/claude"
TITLE_MAX, DESC_MAX = 60, 155
NAME = {'it': 'Italian', 'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish',
        'pt': 'Portuguese', 'ru': 'Russian', 'ar': 'Arabic', 'zh': 'Chinese', 'hi': 'Hindi',
        'ja': 'Japanese', 'ko': 'Korean', 'tr': 'Turkish', 'id': 'Indonesian', 'pl': 'Polish'}
# skip: pagine non indicizzabili + le 3 i18n-driven rigenerate da rebuild-lang-pages.mjs
# (index/install/support: la loro meta viene dalla MATRICE, va accorciata lì non nell'HTML).
SKIP = re.compile(r'(^|/)(account|admin|success|uninstall|index|install|support)\.html$|mgmt-')


def lang_of(path, html):
    m = re.search(r'<html lang="([a-z-]+)"', html)
    return (m.group(1).split('-')[0] if m else 'en')


def shorten_batch(items):
    """items = [(text, limit, lang)]. Ritorna lista accorciata stessa lunghezza."""
    lines = [f'{i}. [{lang}, max {lim} chars] {txt}' for i, (txt, lim, lang) in enumerate(items)]
    prompt = (
        "You are an SEO copy editor for the AdOff ad-blocker website. Shorten each of the following "
        "page meta strings to fit its character limit, WITHOUT losing the main keyword or the brand "
        "name (AdOff). Keep it in the SAME language as marked. Natural, compelling, no truncation "
        "with '...'. Each must be <= its 'max' characters.\n"
        "Return ONLY a JSON array of the shortened strings in the same order, same length.\n"
        + "\n".join(lines)
    )
    try:
        p = subprocess.run([CLAUDE, "-p", "--model", "claude-haiku-4-5", "--output-format", "json"],
                           input=prompt, capture_output=True, text=True, timeout=240)
        txt = json.loads(p.stdout)["result"]
        txt = re.sub(r'^```(?:json)?\s*|\s*```$', '', txt.strip())
        arr = json.loads(re.search(r'\[.*\]', txt, re.S).group(0))
        if len(arr) == len(items):
            return [str(x).strip() for x in arr]
    except Exception:
        pass
    return [t for t, _, _ in items]  # fallback: invariato


def collect():
    jobs = []  # (file, kind, oldval, lang)
    files = (glob.glob(os.path.join(SITE, "*.html"))
             + glob.glob(os.path.join(SITE, "*", "*.html"))
             + glob.glob(os.path.join(SITE, "*", "*", "*.html")))
    for f in files:
        rel = os.path.relpath(f, SITE)
        if SKIP.search(rel):
            continue
        html = open(f, encoding="utf-8").read()
        if 'name="robots"' in html and re.search(r'name="robots"[^>]*noindex', html):
            continue
        lang = lang_of(f, html)
        mt = re.search(r'<title[^>]*>(.*?)</title>', html, re.S)
        if mt:
            tt = re.sub(r'\s+', ' ', mt.group(1)).strip()
            if len(tt) > TITLE_MAX:
                jobs.append((f, 'title', tt, lang))
        md = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
        if md and len(md.group(1)) > DESC_MAX:
            jobs.append((f, 'desc', md.group(1), lang))
    return jobs


def apply_fix(f, kind, old, new):
    html = open(f, encoding="utf-8").read()
    eo, en = re.escape(old), new.replace('\\', r'\\')
    if kind == 'title':
        html = re.sub(r'<title[^>]*>.*?</title>', f'<title>{new}</title>', html, count=1, flags=re.S)
        # og/twitter title se uguali al vecchio
        for prop in ['property="og:title"', 'name="twitter:title"']:
            html = re.sub(rf'(<meta\s+{prop}\s+content=")' + eo + r'(")', rf'\g<1>{en}\g<2>', html)
    else:
        html = re.sub(r'(<meta\s+name="description"\s+content=")' + eo + r'(")', rf'\g<1>{en}\g<2>', html)
        for prop in ['property="og:description"', 'name="twitter:description"']:
            html = re.sub(rf'(<meta\s+{prop}\s+content=")' + eo + r'(")', rf'\g<1>{en}\g<2>', html)
    open(f, "w", encoding="utf-8").write(html)


def main():
    dry = "--dry" in sys.argv
    jobs = collect()
    print(f"[seo-meta] da ottimizzare: {sum(1 for j in jobs if j[1]=='title')} title>{TITLE_MAX}, "
          f"{sum(1 for j in jobs if j[1]=='desc')} desc>{DESC_MAX}  ({len(jobs)} totali)")
    if dry or not jobs:
        return
    B = 25
    batches = [jobs[i:i + B] for i in range(0, len(jobs), B)]

    def run(batch):
        items = [(old, TITLE_MAX if kind == 'title' else DESC_MAX, lang) for (_, kind, old, lang) in batch]
        return batch, shorten_batch(items)
    fixed = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for batch, news in ex.map(run, batches):
            for (f, kind, old, lang), new in zip(batch, news):
                lim = TITLE_MAX if kind == 'title' else DESC_MAX
                if new and new != old and len(new) <= lim + 10:  # tolleranza
                    apply_fix(f, kind, old, new)
                    fixed += 1
    print(f"[seo-meta] applicati {fixed}/{len(jobs)} accorciamenti")


if __name__ == "__main__":
    main()
