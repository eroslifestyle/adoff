#!/usr/bin/env python3
"""
Aggiunge data-i18n a pagine HTML statiche (batch 1: 10 pagine).
Blocca: tag inline dentro block gia' processato, script, svg, noscript.
"""
import re, json
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

SITE = Path(__file__).parent.parent.parent / "site"

BATCH1 = [
    "about", "accessibility", "adblock-detector",
    "best-ad-blocker-2026", "block-video-ads",
    "bypass-anti-adblock", "free-ad-blocker",
    "lightweight-ad-blocker", "manifest-v3-ad-blocker",
    "undetectable-ad-blocker",
]

BATCH2 = [
    "account", "ad-blocker-brave", "ad-blocker-chrome",
    "admin-console", "affiliati", "android",
    "android-ad-blocker", "android-dns", "chi-sono",
    "community", "guide", "how-it-works",
    "license-guide", "panel", "press",
    "private-ad-blocker", "salesletter", "success",
    "ublock-origin-alternative", "unique-tech", "vpn-policy",
]

# Solo block-level tag che processiamo (inline dentro block non processati separatamente)
BLOCK_TAGS = {'h1','h2','h3','h4','h5','h6','p','li','td','th',
              'div','section','article','aside','header','footer',
              'figcaption','blockquote','pre','legend'}

# Tag che contengono figli strutturali e non processiamo direttamente
STRUCTURAL_TAGS = BLOCK_TAGS | {'ul','ol','table','thead','tbody','tr','form','nav'}

def slugify(text):
    s = text.lower().strip()[:50]
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[-\s]+', '_', s)
    return s.strip('_')[:35]

def is_meaningful(t):
    if not t or len(t.strip()) < 2: return False
    t = t.strip()
    if re.match(r'^[\d\.\-\+\%\,\:\/\@\+\#\★\⚡🔒✓✗→←©®™°…]+$', t): return False
    if re.match(r'^[\d\.\-\+\%\,]+$', t): return False
    if re.match(r'^[A-Z]{2,6}$', t): return False
    if t.startswith('http') or '://' in t: return False
    return True

def get_section(element, page_name):
    for parent in element.parents:
        if parent and parent.name in ('section','article','aside','header','footer'):
            if parent.get('id'): return slugify(parent['id'])
            cls = parent.get('class',[])
            if cls: return slugify(cls[0])
    if element.get('id'): return slugify(element['id'])
    cls = element.get('class',[])
    if cls: return slugify(cls[0])
    return page_name

def process_page(page_name, dry_run=False):
    html_file = SITE / f"{page_name}.html"
    if not html_file.exists(): return []
    soup = BeautifulSoup(html_file.read_text(encoding='utf-8'), 'lxml')

    new_keys = []
    counter = {}
    for tag in soup.find_all(BLOCK_TAGS):
        if tag.get('data-i18n'): continue
        # Solo testo diretto (no figli), almeno 2 char
        direct = ''.join(s.string or '' for s in tag.children
                         if isinstance(s, NavigableString)).strip()
        if not is_meaningful(direct): continue
        section = get_section(tag, page_name)
        base = slugify(direct[:35])
        if not base: continue
        ck = f"{section}.{base}"
        if ck in counter: counter[ck] += 1; suf = f"_{counter[ck]}"
        else: counter[ck] = 0; suf = ""
        key = f"{section}.{base}{suf}"
        if not dry_run: tag['data-i18n'] = key
        new_keys.append((key, direct[:200]))

    if not dry_run and new_keys:
        result = str(soup)
        result = re.sub(r'\n{3,}', '\n\n', result)
        html_file.write_text(result, encoding='utf-8')
        print(f"  {page_name}.html: {len(new_keys)} attrs added")
    return new_keys

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--batch', type=int, choices=[1,2])
    args = p.parse_args()

    pages = BATCH1 if args.batch == 1 else (BATCH2 if args.batch == 2 else BATCH1)
    print(f"{'[DRY RUN] ' if args.dry_run else ''}Batch {args.batch or 'all'}: {len(pages)} pages")
    all_keys = {}
    for page in pages:
        for k,v in process_page(page, dry_run=args.dry_run):
            all_keys[k] = v
    print(f"Total: {len(all_keys)} keys")
    if all_keys and not args.dry_run:
        en = json.loads((SITE/"i18n"/"en.json").read_text())
        it = json.loads((SITE/"i18n"/"it.json").read_text())
        men = {k:v for k,v in all_keys.items() if k not in en}
        mit = {k:v for k,v in all_keys.items() if k not in it}
        print(f"Missing en: {len(men)}, it: {len(mit)}")
        if men:
            print("\nSample en keys:")
            for k,v in sorted(men.items())[:15]: print(f'  "{k}": "{v}",')
        en.update(men); it.update(mit)
        en = dict(sorted(en.items())); it = dict(sorted(it.items()))
        (SITE/"i18n"/"en.json").write_text(json.dumps(en,indent=2,ensure_ascii=False)+"\n",encoding='utf-8')
        (SITE/"i18n"/"it.json").write_text(json.dumps(it,indent=2,ensure_ascii=False)+"\n",encoding='utf-8')
        print(f"Updated en.json ({len(en)}), it.json ({len(it)})")

if __name__ == "__main__": main()
