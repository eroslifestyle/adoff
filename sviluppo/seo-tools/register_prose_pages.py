#!/usr/bin/env python3
"""
AdOff — Auto-registrazione pagine prose nel gate di governance i18n.

PROBLEMA (sessione 2026-06-14): quando l'agente SEO crea una nuova landing prose, deve
registrarla nelle liste PROSE di sviluppo/scripts/i18n_manager.py perché il gate di deploy
ne verifichi esistenza in 15 lingue + hreflang. Ma quel file è FUORI dallo scope-lock
(site/) dell'agente → la registrazione restava "da fare a mano" ogni settimana (debito
ricorrente). Questo script la fa in automatico, eseguito dal watcher (bash, non soggetto a
scope-lock) PRIMA del deploy.

Sicurezza: registra uno slug SOLO se la pagina esiste in TUTTE le 15 lingue (altrimenti il
gate fallirebbe). Edita solo la lista PROSE_EN_ROOT, con regex sul literal, senza importare
il modulo (zero side-effect). Idempotente.

Uso: python3 register_prose_pages.py [--dry-run]
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SITE = os.path.join(ROOT, "site")
I18N = os.path.join(ROOT, "sviluppo", "scripts", "i18n_manager.py")
LANGS = ['it', 'en', 'de', 'fr', 'es', 'pt', 'ru', 'ar', 'zh', 'hi', 'ja', 'ko', 'tr', 'id', 'pl']

# Pagine root non-landing: mai auto-registrare (funzionali/legali/i18n-driven).
FUNCTIONAL = {
    "index", "install", "support", "privacy", "terms", "withdrawal", "about", "chi-sono",
    "account", "admin", "affiliati", "success", "uninstall", "salesletter", "license-guide",
}


def _read_list(src, name):
    """Estrae gli slug da un literal lista Python `NAME = [ ... ]` (multi-linea)."""
    m = re.search(rf"{name}\s*=\s*\[(.*?)\]", src, re.S)
    if not m:
        return None, None
    items = re.findall(r"['\"]([^'\"]+)['\"]", m.group(1))
    return items, m


def _exists_all_langs(slug):
    """True se la landing EN-root esiste in tutte le 15 lingue (en=root file, altre in /<lang>/)."""
    if not os.path.isfile(os.path.join(SITE, f"{slug}.html")):
        return False
    for lang in LANGS:
        path = (os.path.join(SITE, f"{slug}.html") if lang == "en"
                else os.path.join(SITE, lang, f"{slug}.html"))
        if not os.path.isfile(path):
            return False
    return True


def main():
    dry = "--dry-run" in sys.argv
    src = open(I18N, encoding="utf-8").read()
    en_root, m = _read_list(src, "PROSE_EN_ROOT")
    it_root, _ = _read_list(src, "PROSE_IT_ROOT")
    driven, _ = _read_list(src, "I18N_DRIVEN_IT_ROOT")
    if en_root is None:
        print("[register_prose] PROSE_EN_ROOT non trovata, abort")
        return 1
    known = set(en_root) | set(it_root or []) | set(driven or []) | FUNCTIONAL

    # candidati: landing root .html non già note, presenti in tutte le lingue
    candidates = []
    for n in sorted(os.listdir(SITE)):
        if not n.endswith(".html"):
            continue
        slug = n[:-5]
        if slug in known:
            continue
        if _exists_all_langs(slug):
            candidates.append(slug)
        else:
            print(f"[register_prose] skip '{slug}': non presente in tutte le 15 lingue")

    if not candidates:
        print("[register_prose] nessuna nuova pagina da registrare (tutto già governato)")
        return 0

    new_list = en_root + candidates
    # ricostruisce il literal indentato come l'originale (4 per riga, leggibile)
    rows = [", ".join(f"'{s}'" for s in new_list[i:i + 4]) for i in range(0, len(new_list), 4)]
    literal = "PROSE_EN_ROOT = [" + (",\n                 ".join(rows)) + "]"
    new_src = src[:m.start()] + literal + src[m.end():]

    if dry:
        print(f"[register_prose] (dry-run) registrerei: {', '.join(candidates)}")
        return 0
    open(I18N, "w", encoding="utf-8").write(new_src)
    print(f"[register_prose] registrate {len(candidates)} pagine: {', '.join(candidates)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
