#!/usr/bin/env python3
# Raccolta buchi di traduzione del sito
# Trova chiavi mancanti dalla matrice e lingue assenti per ogni chiave

import json
import os
import re
import sys
import glob
from datetime import datetime, timezone

# Lingue supportate dal sito
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']

# Parola italiane per euristica lingua sorgente
PAROLE_ITALIANE = {'il', 'la', 'le', 'lo', 'di', 'che', 'non', 'per', 'con', 'una', 'sono', 'della', 'delle'}

# Regex per trovare attributi data-i18n
RE_DATA_I18N = re.compile(r'''data-i18n=["']([^"']+)["']''')

# Regex per trovare tag con data-i18n e catturare il contenuto
RE_TAG_I18N = re.compile(r'<(\w+)(?:\s[^>]*)?\s+data-i18n=["\']([^"\']+)["\'](?:\s[^>]*)?>(.*?)</\1>', re.DOTALL | re.IGNORECASE)

# Regex per entità HTML
RE_ENTITIES = re.compile(r'&(?:amp|lt|gt|quot|#39|nbsp);')

# Regex per spazi multipli
RE_SPACES = re.compile(r'\s+')

def resolve_paths():
    """Risolve i percorsi ROOT, SITE e MATRIX."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # ROOT = parent di parent di __file__ (da sviluppo/scripts/ a ROOT)
    root = os.path.dirname(os.path.dirname(script_dir))
    site = os.path.join(root, 'site')
    matrix = os.path.join(site, 'i18n', '_matrix.json')
    return root, site, matrix

def load_matrix(matrix_path):
    """Carica la matrice di traduzione."""
    try:
        with open(matrix_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Errore caricamento matrice: {e}", file=sys.stderr)
        sys.exit(1)

def scan_html_files(site_path):
    """Scansiona tutti i file HTML e restituisce chiavi trovate con posizioni."""
    keys_found = {}  # chiave -> list di (file, testo_estratto)
    
    for html_file in glob.glob(os.path.join(site_path, '**', '*.html'), recursive=True):
        # Salta graphify-out
        if '/graphify-out/' in html_file or '\\graphify-out\\' in html_file:
            continue
        
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except (IOError, UnicodeDecodeError) as e:
            print(f"Skipped {html_file}: {e}", file=sys.stderr)
            continue
        
        # Estrai tutte le chiavi data-i18n
        for match in RE_DATA_I18N.finditer(content):
            key = match.group(1)
            if key not in keys_found:
                keys_found[key] = []
            keys_found[key].append(html_file)
    
    return keys_found

def extract_text_from_html(content, key):
    """Estrae il testo dall'elemento HTML che ha data-i18n per la chiave data."""
    match = RE_TAG_I18N.search(content)
    while match:
        if match.group(2) == key:
            raw_text = match.group(3)
            # Rimuovi tag HTML interni
            cleaned = re.sub(r'<[^>]+>', ' ', raw_text)
            # Sostituisci entità HTML
            cleaned = RE_ENTITIES.sub(lambda m: {
                '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
                '&#39;': "'", '&nbsp;': ' '
            }.get(m.group(0), m.group(0)), cleaned)
            # Comprimi spazi e strip
            cleaned = RE_SPACES.sub(' ', cleaned).strip()
            if cleaned:
                return cleaned
        match = RE_TAG_I18N.search(content, match.end())
    return ''

def find_html_text_for_key(site_path, key):
    """Trova il testo sorgente per una chiave nell'HTML."""
    for html_file in glob.glob(os.path.join(site_path, '**', '*.html'), recursive=True):
        if '/graphify-out/' in html_file or '\\graphify-out\\' in html_file:
            continue
        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except (IOError, UnicodeDecodeError):
            continue
        
        text = extract_text_from_html(content, key)
        if text:
            return text, html_file
    return '', 'matrix'

def detect_source_lang(text):
    """Euristica per detectare se il testo e' italiano o inglese."""
    words = set(text.lower().split())
    for parola in PAROLE_ITALIANE:
        if parola in words:
            return 'it'
    return 'en'

def get_source_info(matrix, key, html_text, html_file):
    """Determina lingua sorgente e testo per una chiave."""
    # Priorita: en > it > html
    if key in matrix:
        if 'en' in matrix[key] and matrix[key]['en']:
            return 'en', matrix[key]['en']
        if 'it' in matrix[key] and matrix[key]['it']:
            return 'it', matrix[key]['it']
    
    if html_text:
        lang = detect_source_lang(html_text)
        return lang, html_text
    
    return 'it', ''

def collect_gaps(matrix, html_keys, site_path):
    """Raccoglie tutti i buchi di traduzione."""
    gaps = {}
    stats = {
        'keys_missing_from_matrix': 0,
        'keys_with_missing_langs': 0,
        'total_missing_cells': 0
    }
    
    # Chiavi presenti nella matrice
    for key, translations in matrix.items():
        missing_langs = [lang for lang in LANGS if lang not in translations or not translations[lang]]
        if missing_langs:
            source_lang, source_text = get_source_info(matrix, key, '', 'matrix')
            gaps[key] = {
                'source_lang': source_lang,
                'source_text': source_text,
                'found_in': 'matrix',
                'missing_langs': missing_langs,
                'new_key': False
            }
            stats['keys_with_missing_langs'] += 1
            stats['total_missing_cells'] += len(missing_langs)
    
    # Chiavi nell'HTML ma non nella matrice
    for key in html_keys:
        if key not in matrix:
            html_text, html_file = find_html_text_for_key(site_path, key)
            source_lang = detect_source_lang(html_text) if html_text else 'en'
            gaps[key] = {
                'source_lang': source_lang,
                'source_text': html_text,
                'found_in': html_file,
                'missing_langs': [lang for lang in LANGS if lang != source_lang],
                'new_key': True
            }
            stats['keys_missing_from_matrix'] += 1
            stats['total_missing_cells'] += len(LANGS) - 1
    
    stats['total_missing_cells'] = sum(len(g['missing_langs']) for g in gaps.values())
    return gaps, stats

def print_summary(gaps, stats):
    """Stampa riepilogo leggibile in italiano."""
    print("\n" + "=" * 60)
    print("RIEPILOGO BUCHI DI TRADUZIONE")
    print("=" * 60)
    print(f"Chiavi nuove (assenti dalla matrice): {stats['keys_missing_from_matrix']}")
    print(f"Chiavi con lingue mancanti: {stats['keys_with_missing_langs']}")
    print(f"Totale celle da riempire: {stats['total_missing_cells']}")
    
    # Ripartizione per lingua
    lang_counts = {}
    for key, gap in gaps.items():
        for lang in gap['missing_langs']:
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
    
    if lang_counts:
        print("\nRipartizione per lingua (mancanze):")
        for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
            print(f"  {lang}: {count}")
    
    print("=" * 60 + "\n")

def main():
    output_path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/i18n-gaps.json'
    
    root, site_path, matrix_path = resolve_paths()
    
    # Carica matrice
    matrix = load_matrix(matrix_path)
    
    # Scansiona HTML
    html_keys = scan_html_files(site_path)
    
    # Raccogli buchi
    gaps, stats = collect_gaps(matrix, html_keys, site_path)
    
    # Prepara output
    output = {
        'generated': datetime.now(timezone.utc).isoformat(),
        'stats': stats,
        'gaps': gaps
    }
    
    # Salva JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    # Stampa riepilogo
    print_summary(gaps, stats)

if __name__ == '__main__':
    main()
