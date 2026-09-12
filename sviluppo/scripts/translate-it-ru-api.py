#!/usr/bin/env python3
"""
AdOff Italian → Russian — 537 keys via OpenAI-compatible API.
Uses local LLM bridge on leobox (http://100.71.178.53:4000/v1).
"""

import json
import sys
import time
from pathlib import Path
import requests
import shutil

IT_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")
BACKUP_FILE = RU_FILE.with_suffix(".json.bak")

API_URL = "http://100.71.178.53:4000/v1/chat/completions"
API_MODEL = "claude-opus-4-7"
API_TIMEOUT = 120

SYSTEM_PROMPT = """Ты переводчик. Переводи с итальянского на русский (формальное "ты").

ПРАВИЛА:
1. Брендов НЕ пиши: YouTube→видеоплатформы, Google→поисковики, Facebook/Instagram→соцсети, Amazon→интернет-магазины, Reddit→форумы, TikTok→видеосервисы, Twitter→соцсети
2. НИКОГДА: "149 KB", "149 кб" → "ультралёгкий"
3. БЕЗ em-dash (—): только запятые, точки, двоеточия
4. БЕЗ супперлативов: "лучший", "потрясающий" ЗАПРЕЩЕНЫ
5. СОХРАНИ: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial, Free
6. HTML ТЕГИ в точном порядке: <br>, <em>, <span>, <strong>
7. ТЕСТ на качество: перевод читается как русский, не как калька

ВЫВОД: KEY|ПЕРЕВОД (одна строка per пара, больше ничего)"""

def load_italian():
    """Load Italian dict."""
    with open(IT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def translate_batch(items, batch_num):
    """Send batch to Opus 4.7 via OpenAI-compatible API."""
    batch_text = "\n".join([f"{k}|{v}" for k, v in items])

    prompt = f"""Переведи все строки:

{batch_text}

РЕЗУЛЬТАТ (KEY|ПЕРЕВОД, одна строка per пара, БОЛЬШЕ НИЧЕГО):"""

    try:
        response = requests.post(
            API_URL,
            json={
                "model": API_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 3000,
                "top_p": 0.95
            },
            timeout=API_TIMEOUT
        )
        response.raise_for_status()

        result_text = response.json()["choices"][0]["message"]["content"]

        result = {}
        for line in result_text.strip().split('\n'):
            line = line.strip()
            if not line or '|' not in line:
                continue
            parts = line.split('|', 1)
            if len(parts) == 2:
                key, value = parts[0].strip(), parts[1].strip()
                result[key] = value

        return result

    except requests.exceptions.Timeout:
        print(f"  ❌ Timeout batch {batch_num}", file=sys.stderr)
        return {}
    except requests.exceptions.ConnectionError:
        print(f"  ❌ Connection error batch {batch_num}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"  ❌ API error batch {batch_num}: {e}", file=sys.stderr)
        return {}

def main():
    print("🌍 AdOff Italian → Russian (Opus 4.7)", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Load Italian
    print("📖 Loading Italian...", file=sys.stderr)
    it_dict = load_italian()
    items = list(it_dict.items())
    print(f"✓ {len(items)} keys loaded\n", file=sys.stderr)

    # Backup
    if RU_FILE.exists():
        shutil.copy(RU_FILE, BACKUP_FILE)
        print(f"💾 Backup: {BACKUP_FILE.name}\n", file=sys.stderr)

    # Translate batches
    batch_size = 40
    total_batches = (len(items) + batch_size - 1) // batch_size
    ru_dict = {}
    failed = []

    print(f"🔄 Translating ({total_batches} batches × {batch_size})...\n", file=sys.stderr)
    start_time = time.time()

    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(items))
        batch_items = items[start_idx:end_idx]

        pct = int(100 * end_idx / len(items))
        print(f"  Batch {batch_num+1:2d}/{total_batches} ({pct:3d}%) — keys {start_idx+1:3d}–{end_idx:3d}...", file=sys.stderr, end='', flush=True)

        result = translate_batch(batch_items, batch_num + 1)

        success_count = 0
        for key, it_value in batch_items:
            if key in result:
                ru_dict[key] = result[key]
                success_count += 1
            else:
                ru_dict[key] = it_value  # Fallback
                failed.append(key)

        print(f" ✓ {success_count}/{len(batch_items)}", file=sys.stderr)
        time.sleep(0.5)  # Rate limiting

    elapsed = time.time() - start_time

    # Write file
    print(f"\n💾 Writing {RU_FILE.name}...", file=sys.stderr)
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'))

    # Report
    print(f"\n✅ COMPLETE", file=sys.stderr)
    print(f"   Keys translated: {len(ru_dict)}/{len(items)}", file=sys.stderr)
    print(f"   Fallbacks: {len(failed)}", file=sys.stderr)
    print(f"   Time: {elapsed:.1f}s ({len(items)/elapsed:.0f} keys/s)", file=sys.stderr)
    print(f"   File: {RU_FILE}", file=sys.stderr)

    if failed and len(failed) <= 10:
        print(f"\n⚠ Failed keys:", file=sys.stderr)
        for k in failed:
            print(f"   - {k}", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
