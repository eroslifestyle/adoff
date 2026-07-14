#!/usr/bin/env python3
"""
FIX 4: Script versioning e defer attributes.
- affiliate-tracking.js → /affiliate-tracking.js?v=260613a + defer
- adoff-i18n.js → add defer (safe everywhere)
- adoff-nav.js → add defer + bump ?v= to 260613a (if exists)
- adoff-footer.js → add defer + bump ?v= to 260613a (if exists)
- adoff-chat.js → add defer (if exists)
"""

import re
from pathlib import Path

SITE_ROOT = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
LANGS = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

def fix_affiliate_tracking(content):
    """affiliate-tracking.js → /affiliate-tracking.js?v=260613a defer"""
    patterns = [
        # root: affiliate-tracking.js (no slash)
        (r'<script\s+src="affiliate-tracking\.js">\s*</script>',
         '<script src="/affiliate-tracking.js?v=260613a" defer></script>'),
        # with slash already
        (r'<script\s+src="/affiliate-tracking\.js">\s*</script>',
         '<script src="/affiliate-tracking.js?v=260613a" defer></script>'),
        # with existing v= param
        (r'<script\s+src="/affiliate-tracking\.js\?v=[^"]+"\s*>\s*</script>',
         '<script src="/affiliate-tracking.js?v=260613a" defer></script>'),
    ]
    changed = False
    for old, new in patterns:
        if re.search(old, content):
            content = re.sub(old, new, content)
            changed = True
    return content, changed

def add_defer_if_missing(content, script_name):
    """Add defer to script if it exists and doesn't have it"""
    # Pattern: <script src="...{script_name}..." > without defer
    pattern = rf'(<script\s+src="[^"]*{re.escape(script_name)}[^"]*")(\s*>)'

    if not re.search(pattern, content):
        return content, False

    # Only add defer if not already there
    def replacer(m):
        src_part = m.group(1)
        close_part = m.group(2)
        if 'defer' in src_part or 'defer' in close_part:
            return m.group(0)  # Already has defer
        return src_part + ' defer' + close_part

    new_content = re.sub(pattern, replacer, content)
    return new_content, new_content != content

def bump_script_version(content, script_name, new_version='260613a'):
    """Bump ?v= parameter to new version"""
    # Pattern: src="...{script_name}.js?v=OLDVER"
    pattern = rf'(src="[^"]*{re.escape(script_name)}\.js)(\?v=[^"]*)?'

    if not re.search(pattern, content):
        return content, False

    def replacer(m):
        src_base = m.group(1)
        return f'{src_base}?v={new_version}'

    new_content = re.sub(pattern, replacer, content)
    return new_content, new_content != content

def process_file(filepath):
    """Apply all script tag fixes"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    original = content
    changes = 0

    # FIX 4a: affiliate-tracking.js
    content, changed = fix_affiliate_tracking(content)
    if changed:
        changes += 1
        print(f"  ✓ affiliate-tracking.js fixed")

    # FIX 4b: adoff-i18n.js (add defer)
    content, changed = add_defer_if_missing(content, 'adoff-i18n')
    if changed:
        changes += 1
        print(f"  ✓ adoff-i18n.js defer added")

    # FIX 4c: adoff-nav.js (add defer + bump version)
    content, changed_defer = add_defer_if_missing(content, 'adoff-nav')
    content, changed_version = bump_script_version(content, 'adoff-nav', '260613a')
    if changed_defer or changed_version:
        changes += 1
        print(f"  ✓ adoff-nav.js fixed (defer={changed_defer}, version={changed_version})")

    # FIX 4d: adoff-footer.js (add defer + bump version)
    content, changed_defer = add_defer_if_missing(content, 'adoff-footer')
    content, changed_version = bump_script_version(content, 'adoff-footer', '260613a')
    if changed_defer or changed_version:
        changes += 1
        print(f"  ✓ adoff-footer.js fixed (defer={changed_defer}, version={changed_version})")

    # FIX 4e: adoff-chat.js (add defer only)
    content, changed = add_defer_if_missing(content, 'adoff-chat')
    if changed:
        changes += 1
        print(f"  ✓ adoff-chat.js defer added")

    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  → saved")
        except Exception as e:
            print(f"  ERROR writing {filepath}: {e}")
            return 0

    return changes

def main():
    total_files = 0
    total_changes = 0

    # Process root HTML files
    print(f"\n[ROOT]")
    for html_file in sorted(SITE_ROOT.glob("*.html")):
        changes = process_file(html_file)
        if changes > 0:
            total_changes += changes
            total_files += 1

    # Process language folders
    for lang in LANGS:
        lang_path = SITE_ROOT / lang
        if lang_path.is_dir():
            print(f"\n[{lang.upper()}]")
            for html_file in sorted(lang_path.glob("*.html")):
                changes = process_file(html_file)
                if changes > 0:
                    total_changes += changes
                    total_files += 1

    print(f"\n{'='*60}")
    print(f"SUMMARY: {total_files} files modified, {total_changes} fixes applied")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
