#!/usr/bin/env python3
"""
BLOCCO 5 — traduzione delle chiavi rimaste in inglese o in italiano.

Il 43% circa di ogni dizionario contiene la stringa INGLESE (copiata dentro come
"fallback" dal commit c6c5bfc) e un altro 35% quella ITALIANA. Sono ~1000 chiavi
per lingua, su pagine pubbliche.

Questo script le traduce a lotti tramite MiniMax (`m3-code`), con guardie perche'
un errore qui danneggerebbe 13 dizionari:
  - traduce SOLO le chiavi non tradotte; quelle gia' a posto non si toccano
  - backup del dizionario prima di ogni scrittura
  - la risposta del modello deve essere JSON valido con ESATTAMENTE le chiavi
    inviate: se manca o avanza una chiave, il lotto viene scartato
  - i segnaposto e i tag HTML dentro le stringhe devono sopravvivere: se cambiano,
    la singola traduzione viene scartata
  - scrittura atomica a fine lotto, cosi' un'interruzione non lascia il file a meta'

Uso:
    python3 translate_batch.py --lang de --limit 200      # prova su 200 chiavi
    python3 translate_batch.py --lang de                  # tutte
    python3 translate_batch.py --all --dry-run            # stima il lavoro
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
I18N = SITE / "i18n"
BACKUP = Path(__file__).parent / "out" / "i18n-backup"

LANGS = ["it", "de", "fr", "es", "pt", "ru", "ar", "zh", "tr", "pl", "hi", "ja", "ko", "id"]
LANG_NAME = {
    "it": "ITALIANO",
    "de": "TEDESCO", "fr": "FRANCESE", "es": "SPAGNOLO", "pt": "PORTOGHESE",
    "ru": "RUSSO", "ar": "ARABO", "zh": "CINESE SEMPLIFICATO", "tr": "TURCO",
    "pl": "POLACCO", "hi": "HINDI", "ja": "GIAPPONESE", "ko": "COREANO",
    "id": "INDONESIANO",
}
SCRIPT_NOTE = {
    "ru": "Scrivi in cirillico.", "ar": "Scrivi in alfabeto arabo.",
    "zh": "Scrivi in caratteri cinesi semplificati.", "hi": "Scrivi in devanagari.",
    "ja": "Scrivi in giapponese (kanji/kana), registro です・ます.",
    "ko": "Scrivi in hangul.",
}

KEY_RE = re.compile(r"""data-i18n(?:-html|-placeholder)?\s*=\s*["']([^"']+)["']""")
# segnaposto che devono sopravvivere alla traduzione
PLACEHOLDER = re.compile(r"\{[^}]*\}|%[sd]|\$\{[^}]*\}")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")
# pagine non pubbliche: le loro chiavi non vale la pena tradurle
INTERNAL = ("admin-console.html", "mgmt-9f4a/", "panel.html", "account.html",
            "account/", "success.html", "uninstall.html")

BATCH = 22


def public_keys():
    keys = set()
    for p in SITE.rglob("*.html"):
        rel = p.relative_to(SITE).as_posix()
        if any(x in rel for x in INTERNAL):
            continue
        keys |= set(KEY_RE.findall(p.read_text(encoding="utf-8", errors="replace")))
    return keys


# marker per riconoscere l'inglese: serve solo per il caso 'it', dove il criterio
# "identico all'inglese" da solo produrrebbe falsi positivi (nomi propri, "Email",
# "AdOff", sigle) che non vanno tradotti.
EN_MARK = re.compile(
    r"\b(the|you|your|and|with|for|that|this|are|is|to|of|from|have|has|will|"
    r"can|not|but|they|we|our|when|where|why|how|all|every|it's|don't)\b", re.I)


def looks_english(s):
    return len(s.strip()) >= 20 and len(EN_MARK.findall(s)) >= 2


def untranslated(lang, pub, it, en):
    d = json.loads((I18N / f"{lang}.json").read_text(encoding="utf-8"))
    out = {}
    for k in sorted(pub):
        v = d.get(k)
        if not isinstance(v, str) or not v.strip():
            continue
        if lang == "it":
            # caso speciale: it.json contiene INGLESE. Criterio prudente — il valore
            # coincide con quello inglese ED e' riconoscibilmente una frase inglese.
            if k in en and v == en[k] and looks_english(v):
                out[k] = en[k]
            continue
        same_en = k in en and v == en[k]
        same_it = k in it and v == it[k]
        if same_en or same_it:
            # la sorgente migliore e' l'inglese quando esiste, altrimenti l'italiano
            src = en.get(k) if (k in en and en[k].strip()) else it.get(k)
            if src and src.strip():
                out[k] = src
    return d, out


def call_model(lang, chunk):
    note = SCRIPT_NOTE.get(lang, "")
    prompt = (
        f"Traduci in {LANG_NAME[lang]} i VALORI di questo oggetto JSON.\n"
        "Regole ferree:\n"
        "- restituisci SOLO l'oggetto JSON tradotto: nessun testo prima o dopo, "
        "nessun markdown fence, nessuna spiegazione\n"
        "- le CHIAVI devono restare identiche, in numero e nome: traduci solo i valori\n"
        "- conserva ESATTAMENTE eventuali tag HTML, entita' (&mdash;, &nbsp;) e "
        "segnaposto ({0}, %s, ${...}) presenti nelle stringhe\n"
        "- 'AdOff' e' un nome proprio: non tradurlo mai\n"
        "- i nomi di prodotti terzi (Chrome, Firefox, uBlock Origin, AdGuard, Stripe) "
        "restano invariati\n"
        "- tono: diretto e asciutto, non pubblicitario; stessa lunghezza dell'originale\n"
        f"{('- ' + note) if note else ''}\n\n"
        + json.dumps(chunk, ensure_ascii=False)
    )
    try:
        r = subprocess.run(["m3-code", "--code", prompt], capture_output=True,
                           text=True, timeout=600)
    except subprocess.TimeoutExpired:
        return None, "timeout"
    raw = r.stdout.strip()
    m = re.findall(r"```(?:json)?\s*\n(.*?)```", raw, re.S)
    if m:
        raw = m[0].strip()
    i, j = raw.find("{"), raw.rfind("}")
    if i < 0 or j < 0:
        return None, "nessun JSON nella risposta"
    try:
        return json.loads(raw[i:j + 1]), None
    except json.JSONDecodeError as e:
        return None, f"JSON non valido: {e}"


def accept(src, got):
    """La traduzione preserva segnaposto e tag, ed e' davvero cambiata?"""
    if not isinstance(got, str) or not got.strip():
        return False
    if sorted(PLACEHOLDER.findall(src)) != sorted(PLACEHOLDER.findall(got)):
        return False
    if sorted(t.lower() for t in TAG.findall(src)) != sorted(t.lower() for t in TAG.findall(got)):
        return False
    return got.strip() != src.strip()


def run_lang(lang, pub, it, en, limit, dry):
    d, todo = untranslated(lang, pub, it, en)
    if limit:
        todo = dict(list(todo.items())[:limit])
    print(f"\n=== {lang} — {len(todo)} chiavi da tradurre ===")
    if dry or not todo:
        return 0, 0

    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(I18N / f"{lang}.json", BACKUP / f"{lang}.json.bak")

    items = list(todo.items())
    done = skipped = 0
    for b in range(0, len(items), BATCH):
        chunk = dict(items[b:b + BATCH])
        got, err = call_model(lang, chunk)
        if err or not isinstance(got, dict):
            print(f"  lotto {b//BATCH+1}: SCARTATO ({err})")
            skipped += len(chunk)
            continue
        if set(got.keys()) != set(chunk.keys()):
            print(f"  lotto {b//BATCH+1}: SCARTATO (chiavi non corrispondenti: "
                  f"{len(got)} contro {len(chunk)})")
            skipped += len(chunk)
            continue
        ok = 0
        for k, src in chunk.items():
            if accept(src, got.get(k, "")):
                d[k] = got[k]
                ok += 1
            else:
                skipped += 1
        done += ok
        # scrittura atomica dopo ogni lotto
        tmp = tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False,
                                          dir=str(I18N), suffix=".tmp")
        json.dump(d, tmp, ensure_ascii=False, indent=1, sort_keys=True)
        tmp.close()
        os.replace(tmp.name, I18N / f"{lang}.json")
        print(f"  lotto {b//BATCH+1}/{(len(items)+BATCH-1)//BATCH}: {ok}/{len(chunk)} accettate "
              f"(totale {done})")
    return done, skipped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    it = json.loads((I18N / "it.json").read_text(encoding="utf-8"))
    en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
    pub = public_keys()
    print(f"chiavi su pagine pubbliche: {len(pub)}")

    targets = LANGS if a.all else ([a.lang] if a.lang else [])
    if not targets:
        ap.error("serve --lang XX oppure --all")

    tot_done = tot_skip = 0
    for lang in targets:
        dn, sk = run_lang(lang, pub, it, en, a.limit, a.dry_run)
        tot_done += dn
        tot_skip += sk

    if not a.dry_run:
        print(f"\n{'='*60}\ntradotte {tot_done} · scartate {tot_skip}")
        print(f"backup in {BACKUP}")


if __name__ == "__main__":
    main()
