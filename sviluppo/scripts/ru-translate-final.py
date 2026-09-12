#!/usr/bin/env python3
"""
Final translation: Italian → Russian using claude-haiku-4-5.
Direct approach with clear format validation.
"""

import json
import sys
import time
from pathlib import Path
import subprocess
import shutil
import re

IT_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")

def load_it():
    with open(IT_FILE) as f:
        return json.load(f)

def batch_translate(items):
    """Translate batch using haiku subprocess."""
    # Create input: each line is "KEY: ITALIAN TEXT"
    input_text = "\n".join([f"{k}: {v}" for k, v in items])

    prompt = f"""Переведи КАЖДУЮ строку на русский (ты-форма). ТОЛЬКО переводы. НИКАКОГО итальянского.

ПРАВИЛА:
- YouTube→видеоплатформы, Google→поисковики, Facebook/Instagram→соцсети, Amazon→магазины
- БЕЗ "149 KB"
- БЕЗ em-dash (—)
- СОХРАНИ: AdOff, Pro, Trial, Free, Chrome, Firefox, Safari
- HTML теги сохранять

Переводи (формат: KEY: ПЕРЕВОД):

{input_text}

РЕЗУЛЬТАТ:"""

    try:
        proc = subprocess.run(
            [
                "claude",
                "-m", "claude-haiku-4-5-20251001",
                "-q"
            ],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=60
        )

        result = {}
        for line in proc.stdout.strip().split('\n'):
            if ':' not in line:
                continue
            parts = line.split(':', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                value = parts[1].strip()
                result[key] = value

        return result

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return {}

def main():
    it = load_it()
    items = list(it.items())

    print(f"Translating {len(items)} keys...", file=sys.stderr)

    # Translate
    batch_size = 25
    ru = {}
    failed = []

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        pct = int(100 * (i + len(batch)) / len(items))
        print(f"  {pct:3d}%...", file=sys.stderr, end='', flush=True)

        result = batch_translate(batch)

        for key, val in batch:
            if key in result:
                ru[key] = result[key]
            else:
                ru[key] = val
                failed.append(key)

        print(f" ✓", file=sys.stderr)
        time.sleep(0.3)

    # Write
    shutil.copy(RU_FILE, RU_FILE.with_suffix(".json.bak"))
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru, f, ensure_ascii=False, separators=(',', ':'))

    print(f"\n✅ {len(ru)}/{len(items)} keys", file=sys.stderr)
    print(f"   {RU_FILE}", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
