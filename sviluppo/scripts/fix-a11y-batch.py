#!/usr/bin/env python3
"""
Batch fix A11Y+styling issues across site/ (root + 15 language folders).
Fixes:
  1. Gradient text (background-clip) → solid color
  2. Side-stripe border-left → border all-sides
  3. Rule count ~130 → 138
"""

import os
import re
from pathlib import Path

SITE_ROOT = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
LANGS = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

def fix_gradient_text(content):
    """FIX 1: Remove gradient text effect, replace with solid color."""
    # Pattern: background:linear-gradient(...);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text
    pattern = r'background:linear-gradient\(135deg,var\(--white\)\s+40%,var\(--purple-soft\)\);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text'
    if re.search(pattern, content):
        content = re.sub(pattern, 'color:var(--white)', content)
        return content, True
    return content, False

def fix_side_stripe(content):
    """FIX 2: Replace border-left:4px solid #7c5cfc with border:1px solid rgba(124,92,252,0.25)"""
    patterns = [
        (r'border-left:\s*4px\s+solid\s+#7c5cfc', 'border:1px solid rgba(124,92,252,0.25)'),
        (r'border-left:\s*4px\s+solid\s+#7c5cfc', 'border:1px solid rgba(124,92,252,0.25)'),  # redundant but safe
    ]
    changed = False
    for old, new in patterns:
        if re.search(old, content, re.IGNORECASE):
            content = re.sub(old, new, content, flags=re.IGNORECASE)
            changed = True
    return content, changed

def fix_rule_count(content, filename):
    """FIX 3: Replace ~130 rules with 138 (only in lightweight-ad-blocker.html)"""
    if 'lightweight-ad-blocker' not in filename:
        return content, False

    patterns = [
        (r'~130\s+targeted\s+rules', '138 targeted rules'),
        (r'~130\s+regole', '138 regole'),
        (r'~130', '138'),
    ]
    changed = False
    for old, new in patterns:
        if re.search(old, content):
            content = re.sub(old, new, content, flags=re.IGNORECASE)
            changed = True
    return content, changed

def process_file(filepath):
    """Apply all fixes to a single HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    original = content
    changes = 0

    # FIX 1: Gradient text
    content, changed = fix_gradient_text(content)
    if changed:
        changes += 1
        print(f"  ✓ FIX 1 (gradient) applied")

    # FIX 2: Side-stripe
    content, changed = fix_side_stripe(content)
    if changed:
        changes += 1
        print(f"  ✓ FIX 2 (border-left) applied")

    # FIX 3: Rule count
    content, changed = fix_rule_count(content, filepath.name)
    if changed:
        changes += 1
        print(f"  ✓ FIX 3 (rule count) applied")

    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  → saved {filepath.name}")
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
