#!/usr/bin/env python3
"""
Refresh estetico per pagine HTML multilingua (EN, DE, FR, ES, PT).
Applica: em-dash removal, brand name cleanup, "120+"->"130+", "149 KB" removal.
Crea backup e genera report statistiche.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# Target languages e relative directory
LANG_DIRS = {
    'en': 'en',
    'de': 'de',
    'fr': 'fr',
    'es': 'es',
    'pt': 'pt',
}

SITE_ROOT = Path('/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site')
BACKUP_SUFFIX = '.bak-subdir-refresh'

# Mapping en->pagina_tipo per validazione
PAGE_TYPES = {
    'guide.html': 'guide',
    'privacy.html': 'legal',
    'terms.html': 'legal',
    'withdrawal.html': 'legal',
    'best-ad-blocker-2026.html': 'blog',
    'community.html': 'community',
    'how-it-works.html': 'blog',
    'press.html': 'press',
    'unique-tech.html': 'blog',
}

class HTMLRefresher:
    def __init__(self):
        self.stats = {}
        self.errors = []

    def apply_refresh(self, html_content: str, page_type: str) -> Tuple[str, Dict]:
        """Applica tutte le regole di refresh estetico al contenuto HTML."""
        changes = {
            'em_dash_removed': 0,
            'brand_cleaned': 0,
            'rules_updated': 0,
            '149kb_removed': 0,
            'chars_changed': 0,
        }
        original_content = html_content

        # 1. Rimuovi em-dash visibili (— → ,)
        # Evita di toccare em-dash nei titoli/metadata se non necessario
        # Ma rimuovi quelli nei paragrafi di contenuto
        def remove_visible_emdash(match):
            before = match.group(1)
            after = match.group(2)
            # Se è in un paragrafo di testo o description, sostituisci con virgola+spazio
            return f"{before}, {after}"

        # Match em-dash in testo visibile (dentro <p>, <h*>, <title>, <meta description>)
        html_content = re.sub(
            r'(<(?:p|h[1-6]|title|meta[^>]*name="description"[^>]*)>.*?)—(.*?</(?:p|h[1-6]|title|meta)>)',
            lambda m: m.group(1) + ', ' + m.group(2),
            html_content,
            flags=re.DOTALL | re.IGNORECASE
        )

        # Em-dash semplici nel testo
        em_dash_count = html_content.count('—')
        if em_dash_count > 0:
            html_content = html_content.replace('—', ', ', em_dash_count)
            changes['em_dash_removed'] = em_dash_count

        # 2. Rimuovi "149 KB" e varianti
        patterns_149kb = [
            r'149\s*KB',
            r'149KB',
            r'~150\s*KB',
            r'150\s*KB',
        ]
        for pattern in patterns_149kb:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            if matches:
                html_content = re.sub(pattern, '', html_content, flags=re.IGNORECASE)
                changes['149kb_removed'] += len(matches)

        # 3. Sostituisci brand names con equivalenti generici
        brand_replacements = [
            (r'\bGoogle\s+Chrome\b', 'Chrome'),
            (r'\bChrome\s+extension\b', 'Browser extension'),
            (r'\bYouTube\b', 'Video platforms'),
            (r'\byoutube\b', 'video platforms'),
            (r'\bYouTube\b', 'Video streaming'),
            (r'\bFacebook\b', 'Social media'),
            (r'\bfacebook\b', 'social media'),
            (r'\bInstagram\b', 'Social networks'),
            (r'\binstagram\b', 'social networks'),
            (r'\bGoogle\b(?!\s+Cloud)', 'Search engines'),
            (r'\bAmazon\b', 'E-commerce platforms'),
            (r'\bTwitch\b', 'Streaming platforms'),
            (r'\bReddit\b', 'Discussion forums'),
            (r'\bTwitter\b', 'Microblogging'),
            (r'\bLinkedIn\b', 'Professional networks'),
            (r'\bTikTok\b', 'Short-form video'),
        ]

        for pattern, replacement in brand_replacements:
            matches = re.findall(pattern, html_content)
            if matches:
                html_content = re.sub(pattern, replacement, html_content)
                changes['brand_cleaned'] += len(matches)

        # 4. Sostituisci "120+" con "130+"
        rules_match = re.findall(r'120\+', html_content)
        if rules_match:
            html_content = html_content.replace('120+', '130+')
            changes['rules_updated'] = len(rules_match)

        # 5. Count character changes
        changes['chars_changed'] = len(original_content) - len(html_content)

        return html_content, changes

    def process_file(self, file_path: Path, lang: str) -> bool:
        """Processa un singolo file HTML."""
        try:
            # Leggi file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Crea backup
            backup_path = Path(str(file_path) + BACKUP_SUFFIX)
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Determina tipo pagina
            page_type = PAGE_TYPES.get(file_path.name, 'unknown')

            # Applica refresh
            new_content, changes = self.apply_refresh(content, page_type)

            # Salva file modificato
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

            return True, changes

        except Exception as e:
            self.errors.append(f"{file_path}: {str(e)}")
            return False, {}

    def process_language(self, lang: str) -> Dict:
        """Processa tutte le pagine di una lingua."""
        lang_dir = SITE_ROOT / LANG_DIRS[lang]

        if not lang_dir.exists():
            self.errors.append(f"Language dir not found: {lang_dir}")
            return None

        lang_stats = {
            'language': lang,
            'pages_processed': 0,
            'pages_failed': 0,
            'total_em_dash': 0,
            'total_brand_cleaned': 0,
            'total_rules_updated': 0,
            'total_149kb': 0,
            'files': [],
        }

        # Trova tutti i file HTML
        html_files = list(lang_dir.glob('*.html'))

        for html_file in html_files:
            success, changes = self.process_file(html_file, lang)

            if success:
                lang_stats['pages_processed'] += 1
                lang_stats['total_em_dash'] += changes.get('em_dash_removed', 0)
                lang_stats['total_brand_cleaned'] += changes.get('brand_cleaned', 0)
                lang_stats['total_rules_updated'] += changes.get('rules_updated', 0)
                lang_stats['total_149kb'] += changes.get('149kb_removed', 0)

                lang_stats['files'].append({
                    'name': html_file.name,
                    'em_dash': changes.get('em_dash_removed', 0),
                    'brand_cleaned': changes.get('brand_cleaned', 0),
                    'rules_updated': changes.get('rules_updated', 0),
                    '149kb': changes.get('149kb_removed', 0),
                })
            else:
                lang_stats['pages_failed'] += 1

        return lang_stats

    def run(self):
        """Esegui refresh per tutte le lingue."""
        print("[*] Starting HTML aesthetic refresh...\n")

        all_stats = []

        for lang in LANG_DIRS.keys():
            print(f"[*] Processing {lang.upper()}...")
            stats = self.process_language(lang)
            if stats:
                all_stats.append(stats)
                print(f"    ✓ Processed {stats['pages_processed']} pages")
                if stats['pages_failed'] > 0:
                    print(f"    ✗ Failed {stats['pages_failed']} pages")

        print("\n" + "="*70)
        print("REFRESH ESTETICO — STATISTICHE")
        print("="*70)

        # Tabella riepilogativa
        print(f"\n{'Lingua':<8} {'Pagine':<8} {'Em-Dash':<10} {'Brand':<8} {'120+→130+':<12} {'149KB':<8}")
        print("-" * 70)

        total_em_dash = 0
        total_brand = 0
        total_rules = 0
        total_149kb = 0
        total_pages = 0

        for stats in all_stats:
            lang = stats['language'].upper()
            pages = stats['pages_processed']
            em_dash = stats['total_em_dash']
            brand = stats['total_brand_cleaned']
            rules = stats['total_rules_updated']
            kb149 = stats['total_149kb']

            print(f"{lang:<8} {pages:<8} {em_dash:<10} {brand:<8} {rules:<12} {kb149:<8}")

            total_em_dash += em_dash
            total_brand += brand
            total_rules += rules
            total_149kb += kb149
            total_pages += pages

        print("-" * 70)
        print(f"{'TOTAL':<8} {total_pages:<8} {total_em_dash:<10} {total_brand:<8} {total_rules:<12} {total_149kb:<8}\n")

        # Dettagli per file
        print("\nDettagli per file:\n")
        for stats in all_stats:
            print(f"\n{stats['language'].upper()}:")
            for file_info in stats['files']:
                changes_str = []
                if file_info['em_dash'] > 0:
                    changes_str.append(f"em-dash: {file_info['em_dash']}")
                if file_info['brand_cleaned'] > 0:
                    changes_str.append(f"brand: {file_info['brand_cleaned']}")
                if file_info['rules_updated'] > 0:
                    changes_str.append(f"rules: {file_info['rules_updated']}")
                if file_info['149kb'] > 0:
                    changes_str.append(f"149KB: {file_info['149kb']}")

                changes_display = ', '.join(changes_str) if changes_str else 'no changes'
                print(f"  {file_info['name']:<35} ({changes_display})")

        # Backup info
        print("\n" + "="*70)
        print("BACKUP CREATI")
        print("="*70)
        print(f"\nBackup suffix: '{BACKUP_SUFFIX}'")
        print(f"Tutti i file modificati hanno un backup corrispondente.")
        print(f"Recupero: cp <file>{BACKUP_SUFFIX} <file>\n")

        # Errori
        if self.errors:
            print("\n" + "="*70)
            print("ERRORI")
            print("="*70)
            for error in self.errors:
                print(f"  ✗ {error}")
        else:
            print("✓ Nessun errore. Refresh completato con successo.")

        # Salva report JSON
        report_path = SITE_ROOT.parent / f'sviluppo/refresh-report-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_pages': total_pages,
                'total_em_dash_removed': total_em_dash,
                'total_brand_cleaned': total_brand,
                'total_rules_updated': total_rules,
                'total_149kb_removed': total_149kb,
                'languages': all_stats,
                'errors': self.errors,
            }, f, indent=2, ensure_ascii=False)

        print(f"\n[✓] Report salvato: {report_path}")

if __name__ == '__main__':
    refresher = HTMLRefresher()
    refresher.run()
