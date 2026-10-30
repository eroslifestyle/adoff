#!/usr/bin/env python3
"""
AdOff: Italian → Russian translation (537 keys).
Uses claude --print with correct flags.
"""

import json
import subprocess
import sys
import time
from pathlib import Path
import shutil

IT_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/it.json")
RU_FILE = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/i18n/ru.json")

def load_italian():
    with open(IT_FILE) as f:
        return json.load(f)

def translate_batch(items):
    """Translate batch using claude --print."""
    # Format: KEY→ITALIAN on each line
    lines = [f"{k}→{v}" for k, v in items]
    input_text = "\n".join(lines)

    prompt = f"""Translate EVERY line from Italian to Russian. Use "ты" (you) form.

STRICT RULES:
1. NO BRAND NAMES: YouTube→видеоплатформы, Google→поисковики, Facebook/Instagram→соцсети, Amazon→интернет-магазины, Reddit→форумы, TikTok→видеосервисы, Twitter→соцсети
2. NEVER write "149 KB" or "149 кб"
3. NO em-dashes (—) — use commas, periods, colons only
4. NO superlatives: "лучший", "потрясающий", "революционный" are FORBIDDEN
5. KEEP these: AdOff, Stealth Mode, IMA SDK, Manifest V3, Pro, Trial, Free, Chrome, Firefox, Safari, Edge, Opera
6. KEEP HTML tags exactly: <br>, <em>, <span>, <strong>
7. Tone: confident, direct, privacy-first, short sentences
8. This is an ad blocker extension website with pricing and instructions

Translate (format strictly: KEY→RUSSIAN TRANSLATION):

{input_text}

OUTPUT ONLY - format KEY→RUSSIAN, one line per pair, NO explanations:"""

    try:
        proc = subprocess.run(
            ["claude", "--print", "--model", "claude-haiku-4-5-20251001"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120
        )

        result = {}
        for line in proc.stdout.strip().split('\n'):
            if not line or '→' not in line:
                continue
            parts = line.split('→', 1)
            if len(parts) == 2:
                key, value = parts[0].strip(), parts[1].strip()
                result[key] = value

        return result

    except subprocess.TimeoutExpired:
        return {}
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return {}

def main():
    print("🌍 AdOff Italian → Russian Translation", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Load
    it_dict = load_italian()
    items = list(it_dict.items())

    print(f"📖 {len(items)} keys to translate\n", file=sys.stderr)

    # Backup
    if RU_FILE.exists():
        shutil.copy(RU_FILE, RU_FILE.with_suffix(".json.bak"))
        print(f"💾 Backup: {RU_FILE.with_suffix('.json.bak').name}\n", file=sys.stderr)

    # Translate in batches
    batch_size = 40
    total_batches = (len(items) + batch_size - 1) // batch_size
    ru_dict = {}
    failed = []

    print(f"🔄 Translating ({total_batches} batches)...\n", file=sys.stderr)
    start_time = time.time()

    for batch_num in range(total_batches):
        start = batch_num * batch_size
        end = min(start + batch_size, len(items))
        batch = items[start:end]

        pct = int(100 * end / len(items))
        print(f"  Batch {batch_num+1:2d}/{total_batches} ({pct:3d}%) — keys {start+1:3d}–{end:3d}...", file=sys.stderr, end='', flush=True)

        result = translate_batch(batch)

        for key, it_value in batch:
            if key in result:
                ru_dict[key] = result[key]
            else:
                ru_dict[key] = it_value
                failed.append(key)

        success = len([k for k, v in batch if k in result])
        print(f" ✓ {success}/{len(batch)}", file=sys.stderr)

        time.sleep(0.3)  # Rate limiting

    elapsed = time.time() - start_time

    # Write
    print(f"\n💾 Writing {RU_FILE.name}...", file=sys.stderr)
    with open(RU_FILE, 'w', encoding='utf-8') as f:
        json.dump(ru_dict, f, ensure_ascii=False, separators=(',', ':'))

    # Report
    print(f"\n✅ COMPLETE", file=sys.stderr)
    print(f"   Total: {len(ru_dict)}/{len(items)} keys", file=sys.stderr)
    print(f"   Failed: {len(failed)}", file=sys.stderr)
    print(f"   Time: {elapsed:.1f}s ({len(items)/elapsed:.0f} keys/sec)", file=sys.stderr)
    print(f"   File: {RU_FILE}", file=sys.stderr)

    if failed:
        print(f"\n⚠ Failed to translate ({len(failed)} keys):", file=sys.stderr)
        for key in failed[:10]:
            print(f"   {key}", file=sys.stderr)

    return 0

if __name__ == "__main__":
    sys.exit(main())
