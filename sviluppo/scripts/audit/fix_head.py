#!/usr/bin/env python3
"""
Fix head for 89 HTML files in site/:
  1. CSS relative path -> absolute: href="style.css -> href="/style.css
  2. Add lang attribute to <html> where missing
"""

import re
import sys
from pathlib import Path

BASE = Path(__file__).parent.parent.parent.parent / "site"

# ── FIX 1: files that need CSS path fix ──────────────────────────────────────
# (relative style.css appears in subfolder pages)
CSS_FIX_FILES = {
    "ar/guide.html", "ar/privacy.html",
    "blog/honest-ad-blocker-no-acceptable-ads.html",
    "blog/paid-ad-blocker-when-makes-sense.html",
    "de/guide.html", "de/privacy.html",
    "en/best-ad-blocker-2026.html", "en/community.html",
    "en/guide.html", "en/how-it-works.html", "en/install.html",
    "en/press.html", "en/privacy.html", "en/unique-tech.html",
    "es/guide.html", "es/install.html", "es/privacy.html",
    "fr/guide.html", "fr/privacy.html",
    "hi/guide.html", "hi/install.html", "hi/privacy.html",
    "id/guide.html", "id/privacy.html",
    "it/blog/honest-ad-blocker-no-acceptable-ads.html",
    "it/blog/index.html",
    "it/blog/paid-ad-blocker-when-makes-sense.html",
    "it/guide.html", "it/privacy.html",
    "ja/guide.html", "ja/install.html", "ja/privacy.html",
    "ko/guide.html", "ko/privacy.html",
    "pl/guide.html", "pl/install.html", "pl/privacy.html",
    "pt/guide.html", "pt/install.html", "pt/privacy.html",
    "ru/guide.html", "ru/install.html", "ru/privacy.html",
    "tr/guide.html", "tr/install.html", "tr/privacy.html",
    "zh/guide.html", "zh/privacy.html",
}

# Root files with relative style.css — from root level this resolves correctly
# to /style.css, so NO CSS fix needed. Listed here to confirm zero-action.
ROOT_CSS_FALSE_POSITIVES = {
    "affiliati.html", "about.html", "chi-sono.html",
    "pricing.html", "guide.html", "privacy.html",
    "install.html", "index.html",
}

# ── FIX 2: lang map for each file ────────────────────────────────────────────
# Key = relative path from site/, Value = language code
LANG_MAP = {
    # Root files (Italian)
    "account.html": "it",
    "account/index.html": "it",
    "admin-console.html": "it",
    "affiliati.html": "it",
    "chi-sono.html": "it",
    "panel.html": "it",
    "pricing.html": "it",
    "salesletter.html": "it",
    "success.html": "it",
    "uninstall.html": "it",
    # Root / blog (content-detected: IT)
    "blog/index.html": "it",
    "blog/annuncio-lancio-adblock-vpn.html": "it",
    # vs/ (Italian)
    "vs/adblock.html": "it",
    "vs/adguard.html": "it",
    "vs/brave.html": "it",
    "vs/cyberghost.html": "it",
    "vs/expressvpn.html": "it",
    "vs/ghostery.html": "it",
    "vs/nordvpn.html": "it",
    "vs/privacyspy.html": "it",
    "vs/protonvpn.html": "it",
    "vs/ublock-origin.html": "it",
    # it/ subfolder
    "it/accessibility.html": "it",
    "it/adblock-detector.html": "it",
    "it/ad-blocker-brave.html": "it",
    "it/ad-blocker-chrome.html": "it",
    "it/android-ad-blocker.html": "it",
    "it/best-ad-blocker-2026.html": "it",
    "it/block-video-ads.html": "it",
    "it/bypass-anti-adblock.html": "it",
    "it/community.html": "it",
    "it/free-ad-blocker.html": "it",
    "it/guide.html": "it",
    "it/how-it-works.html": "it",
    "it/license-guide.html": "it",
    "it/lightweight-ad-blocker.html": "it",
    "it/manifest-v3-ad-blocker.html": "it",
    "it/press.html": "it",
    "it/privacy.html": "it",
    "it/private-ad-blocker.html": "it",
    "it/ublock-origin-alternative.html": "it",
    "it/undetectable-ad-blocker.html": "it",
    "it/unique-tech.html": "it",
    "it/blog/honest-ad-blocker-no-acceptable-ads.html": "it",
    "it/blog/index.html": "it",
    "it/blog/paid-ad-blocker-when-makes-sense.html": "it",
    # 15-language subfolders
    "ar/guide.html": "ar",
    "ar/privacy.html": "ar",
    "de/guide.html": "de",
    "de/privacy.html": "de",
    "en/best-ad-blocker-2026.html": "en",
    "en/community.html": "en",
    "en/guide.html": "en",
    "en/how-it-works.html": "en",
    "en/install.html": "en",
    "en/press.html": "en",
    "en/privacy.html": "en",
    "en/unique-tech.html": "en",
    "es/guide.html": "es",
    "es/install.html": "es",
    "es/privacy.html": "es",
    "fr/guide.html": "fr",
    "fr/privacy.html": "fr",
    "hi/guide.html": "hi",
    "hi/install.html": "hi",
    "hi/privacy.html": "hi",
    "id/guide.html": "id",
    "id/privacy.html": "id",
    "ja/guide.html": "ja",
    "ja/install.html": "ja",
    "ja/privacy.html": "ja",
    "ko/guide.html": "ko",
    "ko/privacy.html": "ko",
    "pl/guide.html": "pl",
    "pl/install.html": "pl",
    "pl/privacy.html": "pl",
    "pt/guide.html": "pt",
    "pt/install.html": "pt",
    "pt/privacy.html": "pt",
    "ru/guide.html": "ru",
    "ru/install.html": "ru",
    "ru/privacy.html": "ru",
    "tr/guide.html": "tr",
    "tr/install.html": "tr",
    "tr/privacy.html": "tr",
    "zh/guide.html": "zh",
    "zh/privacy.html": "zh",
    # Blog EN (already correct in source, added for completeness)
    "blog/honest-ad-blocker-no-acceptable-ads.html": "en",
    "blog/paid-ad-blocker-when-makes-sense.html": "en",
}

RTL_LANGS = {"ar"}

SKIP_NOUNicode = {
    "site/adoff-nav.js", "site/adoff-footer.js", "site/adoff-i18n.js",
}

def fix_file(rel_path: str) -> tuple[int, int]:
    """
    Returns (css_fixes, lang_fixes) applied to this file.
    Idempotent: skips if already correct.
    """
    css_fixes = 0
    lang_fixes = 0

    # Skip JS files
    for skip in SKIP_NOUNicode:
        if str(rel_path).endswith(skip):
            return 0, 0

    fpath = BASE / rel_path
    if not fpath.exists():
        print(f"  [SKIP] {rel_path}: file not found")
        return 0, 0

    text = fpath.read_text(encoding="utf-8")
    original = text

    # ── FIX 1: CSS relative path ───────────────────────────────────────────
    if rel_path in CSS_FIX_FILES:
        # Only replace if still using relative path
        if 'href="style.css' in text and 'href="/style.css' not in text:
            text = text.replace('href="style.css', 'href="/style.css')
            css_fixes += 1

    # ── FIX 2: lang attribute ─────────────────────────────────────────────
    lang_code = LANG_MAP.get(rel_path)
    if lang_code:
        html_tag_match = re.search(r'<html([^>]*)>', text, re.IGNORECASE)
        if html_tag_match:
            attrs = html_tag_match.group(1)
            if 'lang=' not in attrs:
                new_attrs = attrs
                if lang_code in RTL_LANGS and 'dir=' not in attrs:
                    new_attrs = f' dir="rtl"{attrs}'
                new_tag = f'<html lang="{lang_code}"{new_attrs}>'
                text = text[:html_tag_match.start()] + new_tag + text[html_tag_match.end():]
                lang_fixes += 1

    if text != original:
        fpath.write_text(text, encoding="utf-8")

    return css_fixes, lang_fixes


def main():
    fix_head_list = BASE.parent / "sviluppo/scripts/audit/out/fix_head.txt"
    paths = [p.strip() for p in fix_head_list.read_text(encoding="utf-8").splitlines() if p.strip()]

    total_css = 0
    total_lang = 0
    skipped = []

    for rel in paths:
        css, lang = fix_file(rel)
        if css == 0 and lang == 0:
            # Might be already correct or not in our maps
            pass
        total_css += css
        total_lang += lang

    print(f"\n=== RESULTS ===")
    print(f"CSS fixes (relative → absolute): {total_css}")
    print(f"Lang attribute fixes:            {total_lang}")
    print(f"Total files in fix_head.txt:     {len(paths)}")


if __name__ == "__main__":
    main()
