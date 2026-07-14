#!/usr/bin/env python3
"""
AdOff Italian → Russian (ты) translation.
Uses local LLM bridge for high-quality contextual translation.
"""

import json
import sys
from pathlib import Path
import requests
import time

# File paths
IT_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")
BACKUP_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json.bak")

# Local LLM endpoint (mcp-servers/local-llm bridge)
LLM_ENDPOINT = "http://100.71.178.53:4000/v1/chat/completions"

# Brand rules
BRAND_RULES = {
    "YouTube": "видеоплатформы",
    "Google": "поисковики",
    "Facebook": "соцсети",
    "Instagram": "соцсети",
    "Amazon": "интернет-магазины",
    "Reddit": "форумы",
    "TikTok": "видеосервисы",
    "Twitter": "соцсети",
}

PRESERVE_TERMS = {"AdOff", "Stealth Mode", "IMA SDK", "Manifest V3", "Pro", "Trial"}

def sanitize_html(text: str) -> tuple:
    """Extract HTML tags, return (clean_text, tags)."""
    import re
    tags = re.findall(r'<[^>]+>', text)
    clean = re.sub(r'<[^>]+>', '{{TAG}}', text)
    return clean, tags

def restore_html(text: str, tags: list) -> str:
    """Restore HTML tags."""
    result = text
    for tag in tags:
        result = result.replace('{{TAG}}', tag, 1)
    return result

def translate_chunk(it_text: str, context: str) -> str:
    """Translate via local LLM."""
    clean_text, tags = sanitize_html(it_text)

    prompt = f"""Перевод с итальянского на русский (обращение "ты").

КОНТЕКСТ: {context}

ПРАВИЛА:
1. Брендов НЕ писать: YouTube→видеоплатформы, Google→поисковики, Facebook→соцсети, Amazon→интернет-магазины, Reddit→форумы, TikTok→видеосервисы, Twitter→соцсети
2. НИКОГДА не писать "149 KB" или "149 кб"
3. NO em-dash (—): только запятые/точки/двоеточия
4. Без супперлативов (лучший, революционный, потрясающий)
5. Сохрани: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial
6. Обращение "ты" прямое (ты пользователь)
7. Короткие фразы, энергичный тон
8. Если есть {{TAG}}, верни текст с {{TAG}} на тех же местах

Итальянский:
"{clean_text}"

ТОЛЬКО перевод (без объяснений, без подстановок — точно как в оригинале):"""

    try:
        response = requests.post(
            LLM_ENDPOINT,
            json={
                "model": "claude-opus-4-7",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 300,
            },
            timeout=30
        )
        response.raise_for_status()
        ru_text = response.json()["choices"][0]["message"]["content"].strip()

        # Remove markdown backticks if present
        if ru_text.startswith('```'):
            ru_text = ru_text.split('\n', 1)[1].rsplit('\n', 1)[0]
        ru_text = ru_text.strip('"\'')

        return restore_html(ru_text, tags)
    except Exception as e:
        print(f"⚠ LLM error: {e}", file=sys.stderr)
        return None

def main():
    # Load Italian file
    print("📖 Загружаю итальянский словарь...", file=sys.stderr)
    with open(IT_FILE, 'r', encoding='utf-8') as f:
        it_dict = json.load(f)

    print(f"✓ Загружено {len(it_dict)} ключей", file=sys.stderr)

    # Create Russian dict
    ru_dict = {}
    total = len(it_dict)
    failed = []

    print(f"🔄 Перевожу на русский...", file=sys.stderr)
    start_time = time.time()

    for idx, (key, it_value) in enumerate(it_dict.items(), 1):
        if isinstance(it_value, dict):
            # Nested object (like contacts, pages)
            ru_dict[key] = {}
            for sub_key, sub_value in it_value.items():
                if isinstance(sub_value, str):
                    context = f"Ключ: {key}.{sub_key}"
                    ru_text = translate_chunk(sub_value, context)
                    if ru_text:
                        ru_dict[key][sub_key] = ru_text
                    else:
                        ru_dict[key][sub_key] = it_value.get(sub_key, "")
                        failed.append(f"{key}.{sub_key}")
                else:
                    ru_dict[key][sub_key] = sub_value
        elif isinstance(it_value, str):
            context = f"Ключ: {key}"
            ru_text = translate_chunk(it_value, context)
            if ru_text:
                ru_dict[key] = ru_text
            else:
                ru_dict[key] = it_value
                failed.append(key)
        else:
            ru_dict[key] = it_value

        # Progress
        if idx % 50 == 0:
            elapsed = time.time() - start_time
            rate = idx / elapsed
            remaining = (total - idx) / rate if rate > 0 else 0
            print(f"  {idx}/{total} ({100*idx//total}%) — осталось ~{remaining:.0f}s", file=sys.stderr)

    # Backup existing
    if RU_FILE.exists():
        import shutil
        shutil.copy(RU_FILE, BACKUP_FILE)
        print(f"✓ Бэкап: {BACKUP_FILE}", file=sys.stderr)

    # Write Russian file
    print(f"💾 Сохраняю русский словарь...", file=sys.stderr)
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'))

    print(f"✅ Готово: {RU_FILE}", file=sys.stderr)
    print(f"  {len(ru_dict)} ключей переведены", file=sys.stderr)

    if failed:
        print(f"⚠ {len(failed)} ошибок перевода:", file=sys.stderr)
        for key in failed[:10]:
            print(f"    - {key}", file=sys.stderr)
        if len(failed) > 10:
            print(f"    ... и ещё {len(failed) - 10}", file=sys.stderr)

    elapsed = time.time() - start_time
    print(f"⏱ Время: {elapsed:.1f}s", file=sys.stderr)

if __name__ == "__main__":
    main()
