#!/usr/bin/env python3
"""Riparazione deterministica delle lunghezze nei contenuti del cluster streaming.

Scorre streaming-cluster/content/*.json (escluse le sorgenti .en.json e .it.json)
e corregge SENZA LLM:
- answer oltre il limite lingua → rimuove frasi dalla fine; se la prima frase
  da sola sfora, taglia all'ultimo confine di parola e chiude con "…".
- description oltre il massimo → stessa logica; se scendendo sotto il minimo,
  tiene la precedente solo se sfora di <10 char, altrimenti taglio a parola + "…".
- title oltre il massimo → taglio a confine di parola preservando " | AdOff"
  (o "｜AdOff" fullwidth).

Concurrency-safe: se un file non è JSON valido (worker ancora in scrittura),
viene saltato e segnalato. Nessun lock.

Uso: python3 repair_cluster_lengths.py [--dry-run] [--verbose] [--selfcheck]
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "sviluppo/seo-tools/streaming-cluster/content"

CJK_LANGS = {"ja", "ko", "zh"}
ANSWER_MAX_CJK = 260
ANSWER_MAX = 400   # en, it (mai toccate qui: sorgenti escluse)
ANSWER_MAX_WIDE = 500
TITLE_MAX, TITLE_MAX_CJK = 70, 40
DESC_MIN, DESC_MAX = 100, 165
DESC_MIN_CJK, DESC_MAX_CJK = 50, 100
ELLIPSIS = "…"
SENTENCE_END = set(".!?。！？،؟।")
CLAUSE_END = set(",;:—–，、；：؛·")
ADOFF_SUFFIXES = (" | AdOff", "｜AdOff")


def limits_for(lang):
    if lang in CJK_LANGS:
        return TITLE_MAX_CJK, DESC_MIN_CJK, DESC_MAX_CJK
    return TITLE_MAX, DESC_MIN, DESC_MAX


def answer_max(lang):
    if lang in CJK_LANGS:
        return ANSWER_MAX_CJK
    return ANSWER_MAX if lang in ("en", "it") else ANSWER_MAX_WIDE


def _word_cut(text, limit):
    """Taglia all'ultimo confine di parola sotto limit e appende …."""
    if len(text) <= limit:
        return text
    cut = text[:limit - 1].rstrip()
    # ultimo spazio (confine parola); per CJK i "confini" sono i caratteri stessi
    sp = cut.rfind(" ")
    if sp > 0:
        cut = cut[:sp].rstrip()
    return cut + ELLIPSIS


def _clause_cut(text, limit, min_len):
    """Taglia all'ultimo confine di clausola (,;:—) sotto limit, senza "…".

    Ritorna None se non c'è confine utile o il risultato scende sotto min_len."""
    if len(text) <= limit:
        return text
    last = -1
    depth = 0
    for i, ch in enumerate(text[:limit]):
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth -= 1
        elif depth == 0 and ch in CLAUSE_END:
            last = i
    if last < 0:
        return None
    cut = text[:last].rstrip().rstrip("".join(CLAUSE_END)).rstrip()
    if not cut or len(cut) < min_len:
        return None
    return cut


def _sentence_trim(text, limit):
    """Rimuove frasi dalla fine finché len <= limit. Ritorna None se anche la
    prima frase da sola sfora."""
    while len(text) > limit:
        # trova l'ultimo terminatore di frase (fuori da HTML tag)
        last = -1
        depth = 0
        for i, ch in enumerate(text):
            if ch == "<":
                depth += 1
            elif ch == ">":
                depth -= 1
            elif depth == 0 and ch in SENTENCE_END:
                last = i
        if last < 0:
            return None
        if last == len(text.rstrip()) - 1:
            # il terminatore è l'ultimo char: passa al precedente, altrimenti non accorcia
            prev = -1
            depth = 0
            for i, ch in enumerate(text[:last]):
                if ch == "<":
                    depth += 1
                elif ch == ">":
                    depth -= 1
                elif depth == 0 and ch in SENTENCE_END:
                    prev = i
            if prev < 0:
                return None
            last = prev
        text = text[:last + 1].rstrip()
    return text


def repair_answer(text, limit):
    if len(text) <= limit:
        return text
    trimmed = _sentence_trim(text, limit)
    if trimmed is not None:
        return trimmed
    clause = _clause_cut(text, limit, int(limit * 0.6))
    if clause is not None:
        return clause
    return _word_cut(text, limit)


def repair_description(text, lang):
    _, d_min, d_max = limits_for(lang)
    if len(text) <= d_max:
        return text
    trimmed = _sentence_trim(text, d_max)
    if trimmed is not None and len(trimmed) >= d_min:
        return trimmed
    # la versione attuale sfora il max: tenerla solo se sfora il min di <10
    # (cioè: se il taglio con frasi scenderebbe sotto il minimo per poco)
    if trimmed is not None and d_min - len(trimmed) < 10:
        return trimmed
    clause = _clause_cut(text, d_max, d_min)
    if clause is not None:
        return clause
    return _word_cut(text, d_max)


def repair_title(text, lang):
    t_max = TITLE_MAX_CJK if lang in CJK_LANGS else TITLE_MAX
    if len(text) <= t_max:
        return text
    suffix = ""
    for s in ADOFF_SUFFIXES:
        if text.endswith(s):
            suffix = s
            break
    core = text[: len(text) - len(suffix)] if suffix else text
    budget = t_max - len(suffix)
    if len(core) <= budget:
        return core + suffix
    return _word_cut(core, budget) + suffix


def repair_data(data):
    """Ritorna (dict riparato, lista di (campo, len_old, len_new))."""
    lang = data.get("lang", "")
    changes = []
    for field, repair in (("answer", lambda v: repair_answer(v, answer_max(lang))),
                          ("description", lambda v: repair_description(v, lang)),
                          ("title", lambda v: repair_title(v, lang))):
        val = data.get(field)
        if not isinstance(val, str):
            continue
        new = repair(val)
        if new != val:
            data[field] = new
            changes.append((field, len(val), len(new)))
    return data, changes


def _load_json_safe(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--selfcheck", action="store_true")
    args = ap.parse_args()
    if args.selfcheck:
        _selfcheck()
        return
    files = sorted(CONTENT.glob("*.json"))
    if not files:
        sys.exit(f"ERRORE: nessun file in {CONTENT}")
    examined = fixed = skipped = 0
    for f in files:
        # le sorgenti en/it non si toccano
        m = re.fullmatch(r"([a-z0-9-]+)\.([a-z]{2})", f.stem)
        if not m or m.group(2) in ("en", "it"):
            continue
        data = _load_json_safe(f)
        if data is None or not isinstance(data, dict):
            print(f"SALTATO (JSON incompleto/illeggibile, si riprenderà al prossimo giro): {f.name}")
            skipped += 1
            continue
        examined += 1
        data, changes = repair_data(data)
        if not changes:
            continue
        fixed += 1
        slug, lang = m.group(1), m.group(2)
        for field, lo, ln in changes:
            print(f"{slug}.{lang} {field}: {lo} → {ln} char")
        if args.verbose:
            for field, _, _ in changes:
                print(f"  nuovo {field}: {data[field]!r}")
        if not args.dry_run:
            f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")
    print(f"\n{examined} file esaminati, {fixed} modificati, {skipped} saltati"
          + (" [dry-run]" if args.dry_run else ""))


def _selfcheck():
    # rimozione frasi dalla fine
    assert repair_answer("Uno. Due. Tre.", 9) == "Uno. Due.", repair_answer("Uno. Due. Tre.", 9)
    # terminatori CJK
    assert repair_answer("あ。い。う。", 5) == "あ。い。", repair_answer("あ。い。う。", 5)
    # terminatore arabo
    assert repair_answer("أولا؟ ثانيا؟ ثالثا؟", 10).endswith("؟")
    # prima frase troppo lunga → taglio a parola + …
    r = repair_answer("Parolona " * 30, 20)
    assert r.endswith(ELLIPSIS) and len(r) <= 20, r
    # answer già a posto → invariata
    assert repair_answer("Breve.", 500) == "Breve."
    # description: taglio a frasi rientra nel range
    d = repair_description("Frase uno. " * 20, "de")
    assert len(d) <= 165, len(d)
    # description: solo leggermente sopra il min dopo il taglio → si accetta il taglio
    # title: preservazione suffisso
    assert repair_title("Word " * 30 + " | AdOff", "en").endswith(" | AdOff")
    t = repair_title("Word " * 30 + " | AdOff", "en")
    assert len(t) <= 70, len(t)
    # suffisso fullwidth giapponese
    tj = repair_title("あ" * 50 + "｜AdOff", "ja")
    assert tj.endswith("｜AdOff") and len(tj) <= 40, (tj, len(tj))
    # title ok → invariato
    assert repair_title("Breve | AdOff", "en") == "Breve | AdOff"
    # word-cut senza spazio (CJK) → taglio secco + …
    r = _word_cut("あ" * 50, 10)
    assert len(r) == 10 and r.endswith(ELLIPSIS), r
    # clause-cut: prima frase sfora ma c'è una virgola sotto il limite → chiusura pulita
    d = ("Grosse beschrijving met veel nuttige details, die verder gaat "
         "over dit onderwerp en nog veel meer uitleg bevat hier zo. " * 2)
    d = "Onderwerp: " + d[:200]
    r = repair_description(d, "de")
    assert not r.endswith(ELLIPSIS), r
    assert 100 <= len(r) <= 165, (len(r), r)
    # nessun confine di clausola sotto il limite → None (fallback _word_cut)
    assert _clause_cut("Parolona " * 30, 20, 5) is None
    # non taglia dentro un tag HTML (la virgola sta nell'attributo)
    r = _clause_cut('<a href="x,y">testo</a> e poi una clausola, corta', 45, 5)
    assert r is not None and '<a href="x,y">' in r and 'href="x' in r, r
    print("selfcheck OK")


if __name__ == "__main__":
    main()
