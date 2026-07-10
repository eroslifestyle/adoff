#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AdOff — Centralized i18n manager (single source of truth).

ONE script governs every UI string. Replaces the scattered translate-*.py / gen-lang-*
tools. The single source is i18n/_matrix.json:  { "<key>": { "<lang>": "<text>" } }

Commands:
  consolidate   Build i18n/_matrix.json from the existing i18n/{lang}.json files (one-off migration).
  build         Generate the runtime i18n/{lang}.json files FROM the matrix.
  check         Pre-deploy gate: every data-i18n key in HTML exists in the matrix,
                every language has every key, and report untranslated (== EN) strings.
                Exit code != 0 on hard failures (missing keys / HTML desync).
  report        Human-readable coverage matrix (no exit code).

Usage:
  python sviluppo/scripts/i18n_manager.py <command>
"""
import json, os, re, sys, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(SITE, 'i18n')
MATRIX = os.path.join(I18N, '_matrix.json')
SAME_OK = os.path.join(I18N, '_same_ok.json')  # keys legitimately identical to EN (brand etc.)

LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']
SRC = 'en'  # source language for "untranslated" detection

# data-i18n attribute variants used by adoff-i18n.js
ATTR_RE = re.compile(r'data-i18n(?:-html|-placeholder)?="([^"]+)"')


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def dump_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


# ───────────────────────── consolidate ─────────────────────────
def cmd_consolidate():
    per = {l: load_json(os.path.join(I18N, f'{l}.json')) for l in LANGS}
    keys = set()
    for l in LANGS:
        keys.update(per[l].keys())
    matrix = {}
    for k in sorted(keys):
        matrix[k] = {l: per[l][k] for l in LANGS if k in per[l]}
    dump_json(MATRIX, matrix)
    print(f"consolidate: {len(matrix)} keys × {len(LANGS)} langs → {os.path.relpath(MATRIX, ROOT)}")
    # missing-cell summary
    for l in LANGS:
        miss = [k for k in matrix if l not in matrix[k]]
        if miss:
            print(f"  {l}: missing {len(miss)} keys (e.g. {miss[:3]})")


# ───────────────────────── build ─────────────────────────
def cmd_build():
    if not os.path.exists(MATRIX):
        sys.exit("build: matrix missing — run `consolidate` first")
    matrix = load_json(MATRIX)
    for l in LANGS:
        out = {}
        for k in matrix:
            cell = matrix[k]
            if l in cell:
                out[k] = cell[l]
            elif SRC in cell:           # fall back to EN so nothing is missing at runtime
                out[k] = cell[SRC]
        dump_json(os.path.join(I18N, f'{l}.json'), out)
    print(f"build: wrote {len(LANGS)} runtime files from {len(matrix)} keys")


# ───────────────────────── check ─────────────────────────
def _is_brandish(k, v):
    if re.search(r'\bvs\b|footer\.vs|store|chrome|firefox|edge|safari|opera|brave|vivaldi', k, re.I):
        return True
    if re.fullmatch(r'[A-Za-z0-9 ./+\-&]+', v) and len(v.split()) <= 3:
        return True
    if not re.search(r'[A-Za-z]', v):
        return True
    return False


# data-i18n keys are ALSO emitted from JS that injects markup (nav + footer).
# Those keys never appear in any .html, so they MUST be scanned here too —
# otherwise a nav/footer key missing from the matrix shows its hardcoded default
# (English nav / Italian footer) in every language and the gate never notices.
JS_WITH_I18N = ['adoff-nav.js', 'adoff-footer.js', 'adoff-chat.js']


def _html_keys():
    keys = set()
    paths = glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)
    paths += [os.path.join(SITE, j) for j in JS_WITH_I18N]
    for path in paths:
        if '/graphify-out/' in path or not os.path.exists(path):
            continue
        with open(path, encoding='utf-8', errors='ignore') as f:
            for m in ATTR_RE.finditer(f.read()):
                keys.add(m.group(1))
    return keys


def cmd_check(strict=True):
    if not os.path.exists(MATRIX):
        sys.exit("check: matrix missing — run `consolidate` first")
    matrix = load_json(MATRIX)
    same_ok = set(load_json(SAME_OK)) if os.path.exists(SAME_OK) else set()
    hard = 0

    # 1) every HTML data-i18n key exists in the matrix
    html_keys = _html_keys()
    missing_in_matrix = sorted(html_keys - set(matrix.keys()))
    if missing_in_matrix:
        hard += len(missing_in_matrix)
        print(f"✗ HARD: {len(missing_in_matrix)} data-i18n key(s) used in HTML but absent from matrix:")
        for k in missing_in_matrix[:20]:
            print(f"    {k}")

    # 2) every language present for every key
    for l in LANGS:
        miss = [k for k in matrix if l not in matrix[k]]
        if miss:
            hard += len(miss)
            print(f"✗ HARD: {l} missing {len(miss)} key(s) (e.g. {miss[:3]})")

    # 3) untranslated (== EN) — soft warning
    print("\nUntranslated strings (value identical to EN, brand/short excluded):")
    total_soft = 0
    for l in LANGS:
        if l in ('en', SRC):
            continue
        un = [k for k in matrix
              if SRC in matrix[k] and l in matrix[k]
              and matrix[k][l] == matrix[k][SRC]
              and len(matrix[k][SRC]) > 12
              and k not in same_ok
              and not _is_brandish(k, matrix[k][SRC])]
        total_soft += len(un)
        flag = '·' if not un else '!'
        print(f"  {flag} {l}: {len(un)}")
        if un and os.environ.get('I18N_VERBOSE'):
            for k in un[:60]:
                print(f"        {k}")

    # 4) keys in matrix never used in any HTML (dead) — info
    dead = sorted(set(matrix.keys()) - html_keys)
    print(f"\nInfo: {len(matrix)} keys total · {len(dead)} not referenced by any data-i18n (may be JS/meta-only)")

    print(f"\nSUMMARY: hard_failures={hard} · untranslated_cells={total_soft}")
    if strict and hard:
        sys.exit(1)


# ───────────────────────── merge ─────────────────────────
def cmd_merge(fill_path):
    """Merge a fill file {key: {lang: value}} into the matrix (create/overwrite cells)."""
    matrix = load_json(MATRIX)
    fill = load_json(fill_path)
    added = updated = 0
    for k, cells in fill.items():
        if k not in matrix:
            matrix[k] = {}
        for l, v in cells.items():
            if l not in matrix[k]:
                added += 1
            elif matrix[k][l] != v:
                updated += 1
            matrix[k][l] = v
    matrix = {k: matrix[k] for k in sorted(matrix)}
    dump_json(MATRIX, matrix)
    print(f"merge: {os.path.basename(fill_path)} → +{added} new cells, {updated} updated")


# ───────────────────────── pages (baked SEO prose governance) ─────────────────────────
# Prose pages have NO data-i18n (standalone per-lang HTML). They aren't in the matrix,
# but they ARE governed here: every page must exist in every language, with the right
# <html lang> and a complete hreflang block. Catches the drift the matrix can't see.
PROSE_EN_ROOT = ['how-it-works', 'unique-tech', 'community', 'press', 'best-ad-blocker-2026',
                 'accessibility',
                 'adblock-detector', 'block-video-ads', 'bypass-anti-adblock',
                 'lightweight-ad-blocker', 'manifest-v3-ad-blocker', 'private-ad-blocker',
                 'undetectable-ad-blocker', 'vs/ublock-origin', 'vs/adblock-plus', 'vs/adguard',
                 'ad-blocker-chrome', 'android-ad-blocker', 'ad-blocker-brave',
                 'ublock-origin-alternative']
PROSE_IT_ROOT = ['guide']
# Pagine i18n-driven (data-i18n + matrice). Sistema UNICO root=IT (2026-06-08): root=it,
# /en/ + /<lang>/ per le altre 13, hreflang reciproco 15+x-default. Verificate come it-root
# così il gate di deploy le copre (prima la loro hreflang era hand-maintained → driftava).
I18N_DRIVEN_IT_ROOT = ['index', 'privacy', 'terms', 'withdrawal']
# install + support: EN-only, no IT version → excluded from it_root check


def _prose_path(page, lang, it_root):
    root_lang = 'it' if it_root else 'en'
    if lang == root_lang:
        return os.path.join(SITE, f'{page}.html')
    return os.path.join(SITE, lang, f'{page}.html')


def cmd_pages(strict=True):
    hard = 0
    pages = ([(p, False) for p in PROSE_EN_ROOT]
             + [(p, True) for p in PROSE_IT_ROOT]
             + [(p, True) for p in I18N_DRIVEN_IT_ROOT])
    for page, it_root in pages:
        problems = []
        for lang in LANGS:
            path = _prose_path(page, lang, it_root)
            if not os.path.exists(path):
                problems.append(f'MISSING:{lang}')
                continue
            txt = open(path, encoding='utf-8', errors='ignore').read()
            m = re.search(r'<html[^>]*lang="([A-Za-z-]+)"', txt)
            la = (m.group(1) if m else '').split('-')[0].lower()  # accept zh-CN as zh
            if la != lang:
                problems.append(f'LANG:{lang}={m.group(1) if m else "?"}')
            if 'hreflang' not in txt:
                problems.append(f'NOHREFLANG:{lang}')
        if problems:
            hard += len(problems)
            print(f"✗ {page}: {' '.join(problems)}")
        else:
            print(f"✓ {page}: 15/15 ok")
    print(f"\nPAGES SUMMARY: {hard} problem(s)")
    if strict and hard:
        sys.exit(1)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'report'
    if cmd == 'consolidate':
        cmd_consolidate()
    elif cmd == 'merge':
        cmd_merge(sys.argv[2])
    elif cmd == 'pages':
        cmd_pages(strict=True)
    elif cmd == 'build':
        cmd_build()
    elif cmd == 'check':
        cmd_check(strict=True)
    elif cmd == 'report':
        cmd_check(strict=False)
    else:
        sys.exit(f"unknown command: {cmd}")


if __name__ == '__main__':
    main()
