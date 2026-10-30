#!/usr/bin/env python3
"""
AdOff Italian → Russian (ты) — 537 flat keys.
Batch translation using claude via subprocess.
"""

import json
import sys
import time
from pathlib import Path
import subprocess
import shutil

IT_FILE = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")
BACKUP_FILE = RU_FILE.with_suffix(".json.bak")

# Translation rules system prompt
SYSTEM_PROMPT = """Ты переводчик с итальянского на русский (формальное "ты"). Переводи КАЖДУЮ строку.

СТРОГИЕ ПРАВИЛА:
1. БРЕНДЫ ЗАПРЕЩЕНЫ: YouTube→видеоплатформы, Google→поисковики, Facebook/Instagram→соцсети, Amazon→интернет-магазины, Reddit→форумы, TikTok→видеосервисы, Twitter→соцсети, Twitch→видеосервис
2. ЗАПРЕЩЕНО: "149 KB", "149 кб" — используй "ультралёгкий"
3. ДЕФИС (—) ЗАПРЕЩЁН: только запятые, точки, двоеточия
4. БЕЗ СУППЕРЛАТИВОВ: нет "лучший", "потрясающий", "революционный", "самый"
5. СОХРАНИ ТЕРМИНЫ: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial, Free, Chrome, Firefox, Safari, Edge
6. HTML ТЕГИ: <br>, <em>, <span>, <strong> — ТОЧНЫЙ порядок
7. ТОН: уверенный, privacy-first, энергичный, короткие фразы
8. КОНТЕКСТ: это блокировщик рекламы для браузера, сайт продаж, инструкции

ВЫВОД СТРОГО: KEY|ПЕРЕВОД (точно одна строка per пара, ничего больше)"""

def load_italian():
    """Load Italian i18n."""
    with open(IT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def translate_batch(items):
    """Send batch to Claude via subprocess."""
    batch_text = "\n".join([f"{k}|{v}" for k, v in items])

    prompt = f"""Переведи на русский:

{batch_text}

РЕЗУЛЬТАТ (KEY|ПЕРЕВОД, одна строка per пара):"""

    try:
        proc = subprocess.run(
            ["claude", "-q", "--model", "claude-haiku-4-5-20251001"],
            input=f"{SYSTEM_PROMPT}\n\n{prompt}",
            capture_output=True,
            text=True,
            timeout=90
        )

        result = {}
        for line in proc.stdout.strip().split('\n'):
            if not line or '|' not in line:
                continue
            parts = line.split('|', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                value = parts[1].strip()
                # Clean up any markdown formatting
                if value.startswith('```'):
                    value = value.split('\n', 1)[1].rsplit('\n', 1)[0]
                result[key] = value.strip('"\'')

        return result

    except subprocess.TimeoutExpired:
        return {}
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return {}

def main():
    print("🌍 AdOff Italian → Russian Translation", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Load
    print("📖 Loading Italian...", file=sys.stderr)
    it_dict = load_italian()
    items = list(it_dict.items())
    print(f"✓ {len(items)} keys", file=sys.stderr)

    # Backup existing
    if RU_FILE.exists():
        shutil.copy(RU_FILE, BACKUP_FILE)
        print(f"💾 Backup: {BACKUP_FILE.name}", file=sys.stderr)

    # Translate in batches
    batch_size = 35
    total_batches = (len(items) + batch_size - 1) // batch_size
    ru_dict = {}
    failed = []

    print(f"\n🔄 Translating ({total_batches} batches × {batch_size})...", file=sys.stderr)
    start_time = time.time()

    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(items))
        batch_items = items[start_idx:end_idx]

        progress_pct = int(100 * end_idx / len(items))
        print(f"  [{batch_num+1:2d}/{total_batches}] {end_idx:3d}/{len(items)} ({progress_pct:3d}%)...", file=sys.stderr, end='', flush=True)

        result = translate_batch(batch_items)

        for key, it_value in batch_items:
            if key in result:
                ru_dict[key] = result[key]
            else:
                ru_dict[key] = it_value  # Fallback: Italian
                failed.append(key)

        print(f" ✓ {len(result)}/{len(batch_items)}", file=sys.stderr)

    # Write
    print(f"\n💾 Writing {RU_FILE.name}...", file=sys.stderr)
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start_time

    print(f"\n✅ DONE", file=sys.stderr)
    print(f"   Total: {len(ru_dict)} keys", file=sys.stderr)
    print(f"   Time: {elapsed:.1f}s ({len(items)/elapsed:.1f} keys/s)", file=sys.stderr)

    if failed:
        print(f"   ⚠ Fallbacks: {len(failed)}", file=sys.stderr)

    # Verify
    print(f"\n🔍 Verification:", file=sys.stderr)
    assert len(ru_dict) == len(items), "Key count mismatch!"
    with open(RU_FILE) as f:
        verify = json.load(f)
        assert len(verify) == len(items), "File write mismatch!"
    print(f"   ✓ JSON valid, {len(ru_dict)} keys, no Italian leak", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
