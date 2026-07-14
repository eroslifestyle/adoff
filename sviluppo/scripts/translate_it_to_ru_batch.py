#!/usr/bin/env python3
"""
AdOff Italian → Russian batch translation.
Optimized for 537 keys using Claude Opus 4.7 batch API.
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, Any
import requests

# Paths
IT_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")
BACKUP_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json.bak")

# OpenAI-compatible endpoint (local LLM bridge — leobox)
API_ENDPOINT = "http://100.71.178.53:4000/v1/chat/completions"
API_MODEL = "claude-opus-4-7"

PRESERVE_TERMS = {"AdOff", "Stealth Mode", "IMA SDK", "Manifest V3", "Pro", "Trial"}

def extract_html(text: str) -> tuple:
    """Extract HTML tags, return (clean_text, tag_positions)."""
    clean = text
    positions = []
    for match in re.finditer(r'<[^>]+>', text):
        positions.append((match.group(), match.start()))
    return clean, positions

def translate_batch_via_llm(items: Dict[str, str], batch_num: int) -> Dict[str, str]:
    """Send batch to local LLM for translation."""
    items_list = list(items.items())
    batch_text = "\n".join([f"{k}|{v}" for k, v in items_list])

    prompt = f"""Переведи на русский все строки (обращение "ты"). Формат: KEY|ИТАЛЬЯНСКИЙ_ТЕКСТ → KEY|РУССКИЙ_ТЕКСТ

ПРАВИЛА:
1. Брендов НЕ писать: YouTube→видеоплатформы, Google→поисковики, Facebook→соцсети, Amazon→интернет-магазины
2. НИКОГДА не пиши "149 KB" или "149 кб"
3. NO em-dash (—): только запятые/точки/двоеточия
4. Без супперлативов (лучший, революционный)
5. Сохрани: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial
6. Обращение "ты" прямое и естественное
7. Короткие фразы, энергичный тон privacy-first
8. HTML теги <br>, <em>, <strong> сохранять в точном порядке
9. ТОЛЬКО результаты — никаких объяснений

Переводи построчно:

{batch_text}

РЕЗУЛЬТАТ (строго формат KEY|ПЕРЕВОД, по одной строке):"""

    try:
        response = requests.post(
            API_ENDPOINT,
            json={
                "model": API_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 4000,
                "timeout": 60
            },
            timeout=90
        )
        response.raise_for_status()
        result_text = response.json()["choices"][0]["message"]["content"].strip()

        # Parse result
        translations = {}
        for line in result_text.split('\n'):
            line = line.strip()
            if not line or '|' not in line:
                continue
            parts = line.split('|', 1)
            if len(parts) == 2:
                key, value = parts
                translations[key.strip()] = value.strip()

        return translations
    except Exception as e:
        print(f"❌ API error batch {batch_num}: {e}", file=sys.stderr)
        return {}

def main():
    # Load Italian
    print("📖 Загружаю словарь...", file=sys.stderr)
    with open(IT_FILE, 'r', encoding='utf-8') as f:
        it_dict = json.load(f)

    print(f"✓ {len(it_dict)} ключей", file=sys.stderr)

    # Flatten dict (handle nested objects)
    flat_items = {}
    paths = {}

    def flatten(d, prefix=""):
        for k, v in d.items():
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                flatten(v, path)
            elif isinstance(v, str):
                flat_items[path] = v
                paths[path] = (prefix, k)

    flatten(it_dict)
    print(f"✓ Развёрнуто {len(flat_items)} элементов", file=sys.stderr)

    # Batch translate
    batch_size = 50
    translated = {}
    failed = []

    print(f"🔄 Перевожу батчами по {batch_size}...", file=sys.stderr)

    for batch_num in range(0, len(flat_items), batch_size):
        batch_items = dict(list(flat_items.items())[batch_num:batch_num+batch_size])
        batch_idx = batch_num // batch_size + 1
        total_batches = (len(flat_items) + batch_size - 1) // batch_size

        print(f"  Батч {batch_idx}/{total_batches}...", file=sys.stderr, end=' ')

        result = translate_batch_via_llm(batch_items, batch_idx)

        for key in batch_items:
            if key in result:
                translated[key] = result[key]
            else:
                translated[key] = batch_items[key]  # Fallback: keep Italian
                failed.append(key)

        print(f"✓ ({len(result)}/{len(batch_items)})", file=sys.stderr)

    print(f"✓ Переведено {len(translated)} элементов", file=sys.stderr)

    # Rebuild nested dict
    ru_dict = {}

    for path, value in translated.items():
        if '.' in path:
            parts = path.split('.')
            current = ru_dict
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            current[parts[-1]] = value
        else:
            ru_dict[path] = value

    # Backup
    if RU_FILE.exists():
        import shutil
        shutil.copy(RU_FILE, BACKUP_FILE)
        print(f"✓ Бэкап: {BACKUP_FILE}", file=sys.stderr)

    # Write
    print(f"💾 Сохраняю...", file=sys.stderr)
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'), indent=None)

    print(f"✅ Готово: {RU_FILE}", file=sys.stderr)

    if failed:
        print(f"⚠ Не переведены: {len(failed)}", file=sys.stderr)

if __name__ == "__main__":
    main()
