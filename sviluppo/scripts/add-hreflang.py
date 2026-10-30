#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add hreflang links to 58 HTML files in lang folders.
Processes: best-ad-blocker-2026.html, community.html, how-it-works.html, press.html, terms.html
"""

import os
import re
import sys
from pathlib import Path

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")

# List of languages for the target pages
LANGS = ["ar", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "zh"]

# Pages that exist in lang folders (14 langs × 4 pages = 56 files)
PAGES = ["best-ad-blocker-2026", "community", "how-it-works", "press"]

# hreflang template (default: English root pages)
HREFLANG_TEMPLATE = """  <!-- hreflang -->
  <link rel="alternate" hreflang="x-default" href="https://adoff.app/{page}.html" />
  <link rel="alternate" hreflang="en" href="https://adoff.app/{page}.html" />
  <link rel="alternate" hreflang="it" href="https://adoff.app/it/{page}.html" />
  <link rel="alternate" hreflang="de" href="https://adoff.app/de/{page}.html" />
  <link rel="alternate" hreflang="fr" href="https://adoff.app/fr/{page}.html" />
  <link rel="alternate" hreflang="es" href="https://adoff.app/es/{page}.html" />
  <link rel="alternate" hreflang="pt" href="https://adoff.app/pt/{page}.html" />
  <link rel="alternate" hreflang="ru" href="https://adoff.app/ru/{page}.html" />
  <link rel="alternate" hreflang="ar" href="https://adoff.app/ar/{page}.html" />
  <link rel="alternate" hreflang="zh" href="https://adoff.app/zh/{page}.html" />
  <link rel="alternate" hreflang="hi" href="https://adoff.app/hi/{page}.html" />
  <link rel="alternate" hreflang="ja" href="https://adoff.app/ja/{page}.html" />
  <link rel="alternate" hreflang="ko" href="https://adoff.app/ko/{page}.html" />
  <link rel="alternate" hreflang="tr" href="https://adoff.app/tr/{page}.html" />
  <link rel="alternate" hreflang="id" href="https://adoff.app/id/{page}.html" />
  <link rel="alternate" hreflang="pl" href="https://adoff.app/pl/{page}.html" />"""

# hreflang template for Italian terms.html (IT root page)
HREFLANG_TERMS = """  <!-- hreflang -->
  <link rel="alternate" hreflang="x-default" href="https://adoff.app/terms.html" />
  <link rel="alternate" hreflang="it" href="https://adoff.app/terms.html" />
  <link rel="alternate" hreflang="en" href="https://adoff.app/en/terms.html" />
  <link rel="alternate" hreflang="de" href="https://adoff.app/de/terms.html" />
  <link rel="alternate" hreflang="fr" href="https://adoff.app/fr/terms.html" />
  <link rel="alternate" hreflang="es" href="https://adoff.app/es/terms.html" />
  <link rel="alternate" hreflang="pt" href="https://adoff.app/pt/terms.html" />
  <link rel="alternate" hreflang="ru" href="https://adoff.app/ru/terms.html" />
  <link rel="alternate" hreflang="ar" href="https://adoff.app/ar/terms.html" />
  <link rel="alternate" hreflang="zh" href="https://adoff.app/zh/terms.html" />
  <link rel="alternate" hreflang="hi" href="https://adoff.app/hi/terms.html" />
  <link rel="alternate" hreflang="ja" href="https://adoff.app/ja/terms.html" />
  <link rel="alternate" hreflang="ko" href="https://adoff.app/ko/terms.html" />
  <link rel="alternate" hreflang="tr" href="https://adoff.app/tr/terms.html" />
  <link rel="alternate" hreflang="id" href="https://adoff.app/id/terms.html" />
  <link rel="alternate" hreflang="pl" href="https://adoff.app/pl/terms.html" />"""

def process_file(filepath, page_name):
    """Add hreflang block to a single file if it doesn't have it."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if hreflang already exists
    if 'hreflang' in content:
        return False  # Already has hreflang

    # Find canonical line
    canonical_pattern = r'(\s*<link rel="canonical"[^>]*>\s*\n)'
    match = re.search(canonical_pattern, content)

    if not match:
        print(f"WARNING: No canonical found in {filepath}")
        return False

    # Choose hreflang template based on page
    if page_name == "terms":
        hreflang = HREFLANG_TERMS
    else:
        hreflang = HREFLANG_TEMPLATE.format(page=page_name)

    # Insert hreflang after canonical
    insert_pos = match.end()
    new_content = content[:insert_pos] + hreflang + "\n" + content[insert_pos:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True

def main():
    count = 0

    # Process lang-folder pages (best-ad-blocker-2026, community, how-it-works, press)
    for lang in LANGS:
        for page in PAGES:
            filepath = ROOT / lang / f"{page}.html"
            if filepath.exists():
                if process_file(filepath, page):
                    print(f"✓ {lang}/{page}.html")
                    count += 1
                else:
                    print(f"- {lang}/{page}.html (already has hreflang or canonical missing)")
            else:
                print(f"✗ {lang}/{page}.html (file not found)")

    # Process terms.html (de and fr only)
    for lang in ["de", "fr"]:
        filepath = ROOT / lang / "terms.html"
        if filepath.exists():
            if process_file(filepath, "terms"):
                print(f"✓ {lang}/terms.html")
                count += 1
            else:
                print(f"- {lang}/terms.html (already has hreflang or canonical missing)")
        else:
            print(f"✗ {lang}/terms.html (file not found)")

    print(f"\n✓ Total files updated: {count}")

if __name__ == "__main__":
    main()
