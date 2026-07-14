#!/usr/bin/env python3
"""
AdOff Italian → Russian (ты) translation — 537 keys.
Uses claude-haiku batch inference via OpenAI-compatible endpoint.
"""

import json
import sys
import os
import time
from pathlib import Path
from typing import Dict, List, Tuple
import subprocess

IT_FILE = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")
BACKUP_FILE = RU_FILE.with_suffix(".json.bak")

def load_italian() -> Dict:
    """Load Italian dictionary."""
    with open(IT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def flatten_dict(d: Dict, prefix: str = "") -> Tuple[Dict[str, str], Dict[str, Tuple[str, str]]]:
    """Flatten nested dict. Returns (flat_items, paths_map)."""
    flat = {}
    paths = {}

    def walk(obj, p=""):
        for k, v in obj.items():
            path = f"{p}.{k}" if p else k
            if isinstance(v, dict):
                walk(v, path)
            elif isinstance(v, str):
                flat[path] = v
                paths[path] = (p, k)

    walk(d)
    return flat, paths

def unflatten_dict(flat: Dict[str, str]) -> Dict:
    """Rebuild nested dict from flat."""
    result = {}
    for path, value in flat.items():
        parts = path.split('.')
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def translate_with_claude(items: List[Tuple[str, str]], batch_num: int) -> Dict[str, str]:
    """Send batch to claude via local bridge."""
    batch_text = "\n".join([f"{k}⟶{v}" for k, v in items])

    # System prompt with strict rules
    system = """Ты переводчик. Переведи КАЖДУЮ строку с итальянского на русский. Обращение "ты" прямое.

ПРАВИЛА ПЕРЕВОДА:
1. Брендов в переводе НЕ ПИШИ: YouTube→"видеоплатформы", Google→"поисковики", Facebook→"соцсети", Amazon→"интернет-магазины", Reddit→"форумы", TikTok→"видеосервисы", Twitter→"соцсети"
2. ЗАПРЕЩЕНО писать: "149 KB", "149 кб" (пиши "ультралёгкий")
3. Дефис — НЕЛЬЗЯ (—): только запятые, точки, двоеточия
4. БЕЗ супперлативов: нет "лучший", "революционный", "потрясающий"
5. СОХРАНИ: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial, Free
6. HTML теги <br>, <em>, <span>, <strong> — в точном порядке
7. Тон: уверенный, privacy-first, короткие фразы
8. ТОЛЬКО перевод — никаких объяснений

ФОРМАТ ВЫВОДА СТРОГО: КЛЮЧ⟶ПЕРЕВОД (одна строка per пара)"""

    user_prompt = f"""Переведи все строки. Ключ|Итальянский → Ключ|Русский

{batch_text}

РЕЗУЛЬТАТ (формат KEY⟶ПЕРЕВОД, построчно, ТОЛЬКО переводы):"""

    # Call local LLM via subprocess (claude command)
    try:
        result = subprocess.run(
            ["claude", "-q"],
            input=f"{system}\n\n{user_prompt}",
            capture_output=True,
            text=True,
            timeout=60
        )

        translations = {}
        for line in result.stdout.strip().split('\n'):
            if '⟶' not in line:
                continue
            parts = line.split('⟶', 1)
            if len(parts) == 2:
                key, value = parts[0].strip(), parts[1].strip()
                translations[key] = value

        return translations

    except subprocess.TimeoutExpired:
        print(f"❌ Timeout batch {batch_num}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"❌ Error batch {batch_num}: {e}", file=sys.stderr)
        return {}

def main():
    print("📖 AdOff Italian → Russian Translation", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    # Load Italian
    print("Loading Italian dictionary...", file=sys.stderr)
    it_dict = load_italian()
    flat_it, paths = flatten_dict(it_dict)
    print(f"✓ {len(flat_it)} keys loaded", file=sys.stderr)

    # Backup existing Russian
    if RU_FILE.exists():
        import shutil
        shutil.copy(RU_FILE, BACKUP_FILE)
        print(f"✓ Backup: {BACKUP_FILE}", file=sys.stderr)

    # Batch translate
    batch_size = 40
    translated = {}
    failed = []
    skipped = 0

    print(f"\n🔄 Translating in batches of {batch_size}...", file=sys.stderr)
    start_time = time.time()

    items_list = list(flat_it.items())
    total_batches = (len(items_list) + batch_size - 1) // batch_size

    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(items_list))
        batch_items = items_list[start_idx:end_idx]

        progress = f"[{batch_num + 1}/{total_batches}] ({end_idx}/{len(items_list)} keys)"
        print(f"  {progress}...", file=sys.stderr, end='', flush=True)

        result = translate_with_claude(batch_items, batch_num + 1)

        # Merge results
        for key, it_value in batch_items:
            if key in result:
                translated[key] = result[key]
            else:
                translated[key] = it_value  # Fallback: keep Italian
                failed.append(key)
                skipped += 1

        print(f" ✓ ({len(result)}/{len(batch_items)})", file=sys.stderr)

    # Rebuild nested dict
    print(f"\n💾 Building output dictionary...", file=sys.stderr)
    ru_dict = unflatten_dict(translated)

    # Write Russian file
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = time.time() - start_time

    print(f"\n✅ Complete: {RU_FILE}", file=sys.stderr)
    print(f"   {len(translated)} keys translated", file=sys.stderr)
    print(f"   {skipped} fallbacks (kept Italian)", file=sys.stderr)
    print(f"   Time: {elapsed:.1f}s", file=sys.stderr)

    if failed:
        print(f"\n⚠ Failed ({len(failed)} keys):", file=sys.stderr)
        for key in failed[:5]:
            print(f"   - {key}", file=sys.stderr)
        if len(failed) > 5:
            print(f"   ... +{len(failed) - 5} more", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
