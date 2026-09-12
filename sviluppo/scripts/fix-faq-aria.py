#!/usr/bin/env python3
"""
FIX 5: FAQ ARIA accessibility.
- Aggiungi aria-controls="faq-a-N" a ogni button.faq-question
- Aggiungi id="faq-a-N" al div contenitore della risposta (faq-answer)
"""

import re
from pathlib import Path

SITE_ROOT = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
LANGS = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

def add_faq_aria(content, filename):
    """Add aria-controls and id to FAQ elements"""
    # Find all faq-question buttons and their corresponding answer divs

    # Pattern: <button class="faq-question"...> ... </button> followed by answer div
    # We need to:
    # 1. Add aria-controls="faq-a-N" to each button (if not present)
    # 2. Add id="faq-a-N" to each answer div (if not present)

    # First, find all button indices
    button_pattern = r'<button\s+class="faq-question"'
    buttons = list(re.finditer(button_pattern, content))

    if not buttons:
        return content, False

    changed = False
    counter = 1

    # Process in reverse order so indices stay valid
    for match in reversed(buttons):
        button_start = match.start()
        button_end = match.end()

        # Find the closing </button> tag
        button_close = content.find('</button>', button_end)
        if button_close == -1:
            continue

        button_full = content[button_start:button_close+9]

        # Check if aria-controls already exists
        if 'aria-controls' not in button_full:
            # Add aria-controls
            control_id = f"faq-a-{counter}"
            # Insert aria-controls after class="faq-question"
            new_button = button_full.replace(
                'class="faq-question"',
                f'class="faq-question" aria-controls="{control_id}"'
            )
            content = content[:button_start] + new_button + content[button_close+9:]
            changed = True
        else:
            # Extract existing control_id
            m = re.search(r'aria-controls="([^"]+)"', button_full)
            if m:
                control_id = m.group(1)
            else:
                control_id = f"faq-a-{counter}"

        # Now find the corresponding answer div (usually next element after closing button tag)
        search_start = button_close + 9
        # Look for next <div containing faq-answer
        answer_pattern = r'<div[^>]*class="[^"]*faq-answer[^"]*"[^>]*>'
        answer_match = re.search(answer_pattern, content[search_start:search_start+500])

        if answer_match:
            answer_start = search_start + answer_match.start()
            answer_tag_end = search_start + answer_match.end()
            answer_tag = content[answer_start:answer_tag_end]

            # Check if id already exists
            if 'id=' not in answer_tag:
                new_answer_tag = answer_tag.replace(
                    'class=',
                    f'id="{control_id}" class='
                )
                content = content[:answer_start] + new_answer_tag + content[answer_tag_end:]
                changed = True

        counter += 1

    return content, changed

def process_file(filepath):
    """Apply FAQ ARIA fixes"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return 0

    original = content

    # Only apply to pages with FAQ sections
    if 'faq-question' not in content:
        return 0

    content, changed = add_faq_aria(content, filepath.name)

    if changed and content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✓ FAQ ARIA fixed → saved")
            return 1
        except Exception as e:
            print(f"  ERROR writing {filepath}: {e}")
            return 0

    return 0

def main():
    total_files = 0

    # Process root HTML files
    print(f"\n[ROOT]")
    for html_file in sorted(SITE_ROOT.glob("*.html")):
        if process_file(html_file):
            total_files += 1

    # Process language folders
    for lang in LANGS:
        lang_path = SITE_ROOT / lang
        if lang_path.is_dir():
            print(f"\n[{lang.upper()}]")
            for html_file in sorted(lang_path.glob("*.html")):
                if process_file(html_file):
                    total_files += 1

    print(f"\n{'='*60}")
    print(f"SUMMARY: {total_files} files with FAQ modified")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
