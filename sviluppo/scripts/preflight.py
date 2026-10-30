#!/usr/bin/env python3
"""Controlli di coerenza da eseguire PRIMA di un deploy.

Ogni controllo qui nasce da un guasto realmente avvenuto, non da un'ipotesi:

- `LLM_MODEL` valeva `fast-max`, che nel proxy non esisteva: se il 401 non
  avesse mascherato tutto, la chat sarebbe morta lo stesso con un 400.
- le due copie della console admin erano gia' divergenti, e un fix applicato a
  una sola sarebbe passato inosservato.
- i tre manifest devono avere la stessa versione (regola di progetto), ma
  nulla lo verificava.
- un numero di regole stantio nei testi e' il tipo di incongruenza che si nota
  solo dopo la pubblicazione.

Uso:  preflight.py [--strict]
Exit: 0 tutto ok (o solo avvisi), 1 almeno un errore bloccante.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFESTS = [
    ROOT / "app" / "manifest.json",
    ROOT / "app-firefox" / "manifest.json",
    ROOT / "app-safari" / "manifest.json",
]
CONSOLE_COPIES = [
    ROOT / "site" / "admin-console.html",
]
RULES_FILE = ROOT / "app" / "rules" / "adblock-rules.json"
LITELLM_MODELS_URL = "http://127.0.0.1:4000/v1/models"
LITELLM_CHAT_URL = "http://127.0.0.1:4000/v1/chat/completions"
# Catena fallback del worker: deve restare allineata alla catena `fallbacks`
# in /etc/litellm/config.yaml e ai `models` ammessi dalla virtual key.
LLM_CHAIN = ["fast-max", "fast-backup"]
WORKER_CHAT_MAX_TOKENS = 650  # CHAT_MAX_TOKENS in worker.js — il budget reale
LLM_TIMEOUT_S = 120  # una completion reale puo' metterci una decina di secondi

errors: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)
    print(f"  ERRORE  {msg}")


def warn(msg: str) -> None:
    warnings.append(msg)
    print(f"  avviso  {msg}")


def ok(msg: str) -> None:
    print(f"  ok      {msg}")


def check_manifest_versions() -> None:
    versions = {}
    for path in MANIFESTS:
        if not path.exists():
            warn(f"manifest assente: {path.relative_to(ROOT)}")
            continue
        versions[path.relative_to(ROOT)] = json.loads(path.read_text())["version"]
    distinct = set(versions.values())
    if len(distinct) > 1:
        fail(f"versioni divergenti fra i manifest: { {str(k): v for k, v in versions.items()} }")
    elif distinct:
        ok(f"versione allineata su {len(versions)} manifest: {distinct.pop()}")


# Le due console divergono per costruzione (quella in license-system ha in piu'
# la sezione ops-stats), quindi confrontarle riga per riga produrrebbe solo falsi
# allarmi — e un controllo che urla a vuoto viene ignorato in due giorni. Si
# verifica invece che i fix CONDIVISI siano finiti in entrambe: e' quello che
# sfugge davvero quando si applica una patch a una copia sola.
CONSOLE_SHARED_MARKERS = [
    ("_pageLoadedAt", "TTL del router pagine (senza, la console mostra dati congelati)"),
    ("PAGE_TTL_MS", "costante del TTL"),
    ("async function loadTickets", "caricamento ticket"),
]


def check_console_copies() -> None:
    present = [p for p in CONSOLE_COPIES if p.exists()]
    if not present:
        warn("console admin non presente, salto il controllo marker")
        return
    for marker, why in CONSOLE_SHARED_MARKERS:
        # Confini di parola, non sottostringa: con `in` un identificatore rinominato
        # in `_pageLoadedAtXX` conteneva ancora `_pageLoadedAt` e il controllo
        # passava a vuoto. Trovato dalla controprova, non dalla lettura.
        pattern = re.compile(rf"(?<![\w$]){re.escape(marker)}(?![\w$])")
        missing = [str(p.relative_to(ROOT)) for p in present
                   if not pattern.search(p.read_text(encoding="utf-8"))]
        if missing:
            fail(f"'{marker}' manca in {missing} — {why}")
        else:
            ok(f"'{marker}' presente nella console admin")


def check_llm_model() -> None:
    """La catena COMPLETA del worker deve funzionare: esistenza, autorizzazione
    della virtual key e contenuto non vuoto col budget reale.

    Due guasti reali che solo la catena intera coglie: il modello di riserva non
    era nei `models` della virtual key (il fallback sarebbe stato respinto con
    403) e la riserva era un modello "thinking" che col budget di CHAT_MAX_TOKENS
    bruciava tutto nel reasoning restituendo contenuto vuoto — un 200 che per il
    worker e' un guasto.
    """
    try:
        token = subprocess.run(
            ["bash", "-lc", "set -a; . ~/.claude/secrets/local-llm.env; set +a; echo $LITELLM_API_KEY"],
            capture_output=True, text=True, timeout=20,
        ).stdout.strip()
        request = urllib.request.Request(
            LITELLM_MODELS_URL, headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            ids = [m["id"] for m in json.loads(response.read().decode())["data"]]
    except Exception as exc:
        warn(f"proxy LLM non interrogabile ({type(exc).__name__}): controllo saltato")
        return

    for model in LLM_CHAIN:
        if model in ids:
            ok(f"il modello '{model}' esiste nel proxy ({len(ids)} modelli)")
        else:
            fail(f"il modello '{model}' NON esiste nel proxy — la chat o il suo fallback risponderanno 400. Disponibili: {ids}")

    # Autorizzazione della virtual key del worker + contenuto non vuoto col
    # budget reale: servono chiamate vere, /v1/models non basta.
    worker_key = subprocess.run(
        ["secret", "get", "adoff-stores.LLM_API_KEY"],
        capture_output=True, text=True, timeout=20,
    ).stdout.strip()
    if not worker_key:
        fail("virtual key del worker (secret adoff-stores.LLM_API_KEY) vuota o non leggibile")
        return

    for model in LLM_CHAIN:
        body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 8,
        }).encode()
        request = urllib.request.Request(
            LITELLM_CHAT_URL, data=body,
            headers={"Authorization": f"Bearer {worker_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=LLM_TIMEOUT_S) as response:
                json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                fail(f"la virtual key del worker NON e' autorizzata su '{model}' "
                     f"(HTTP {exc.code}) — il fallback su questo modello morirebbe. "
                     f"Aggiungi '{model}' ai `models` della virtual key.")
            else:
                warn(f"chiamata di test su '{model}' fallita con HTTP {exc.code}: non bloccante")
            continue
        except Exception as exc:
            warn(f"chiamata di test su '{model}' non arrivata ({type(exc).__name__}): non bloccante")
            continue
        ok(f"la virtual key del worker e' autorizzata su '{model}'")

        # Stesso modello, budget reale del worker: un 200 con contenuto vuoto e'
        # un guasto (tipico dei modelli thinking che consumano il budget nel
        # reasoning e non lasciano nulla per la risposta).
        body = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": WORKER_CHAT_MAX_TOKENS,
        }).encode()
        request = urllib.request.Request(
            LITELLM_CHAT_URL, data=body,
            headers={"Authorization": f"Bearer {worker_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=LLM_TIMEOUT_S) as response:
                content = (json.loads(response.read().decode())
                           .get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        except Exception as exc:
            warn(f"test contenuto su '{model}' non completato ({type(exc).__name__}): non bloccante")
            continue
        if content:
            ok(f"'{model}' restituisce contenuto non vuoto con max_tokens={WORKER_CHAT_MAX_TOKENS}")
        else:
            fail(f"'{model}' risponde 200 ma con contenuto VUOTO a max_tokens={WORKER_CHAT_MAX_TOKENS} — "
                 f"il worker la interpreta come guasto. Se e' un modello thinking, brucia il budget "
                 f"nel reasoning: serve un modello non-thinking o un budget maggiore.")


def check_rules_count() -> None:
    if not RULES_FILE.exists():
        warn("adblock-rules.json non trovato, salto il conteggio")
        return
    rules = json.loads(RULES_FILE.read_text())
    count = len(rules)
    claimed = set()
    for path in CONSOLE_COPIES[:1] + [ROOT / "site" / "index.html"]:
        if not path.exists():
            continue
        for match in re.finditer(r"(\d{3})\+?\s*(?:regole|rules)", path.read_text(encoding="utf-8"), re.I):
            claimed.add(int(match.group(1)))
    stale = [c for c in claimed if c > count]
    if stale:
        fail(f"i testi promettono {stale} regole ma il file ne ha {count}")
    else:
        ok(f"conteggio regole coerente ({count} regole)")


def check_secrets_not_committed() -> None:
    """Una chiave in chiaro nell'albero di lavoro non deve mai arrivare al deploy."""
    patterns = [r"sk-[A-Za-z0-9]{20,}", r"AKIA[0-9A-Z]{16}"]
    targets = [ROOT / "site", ROOT / "app" / "src", ROOT / "app-firefox" / "src", ROOT / "app-safari" / "src"]
    found = []
    for base in targets:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in {".js", ".html", ".json", ".css"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for pattern in patterns:
                if re.search(pattern, text):
                    found.append(str(path.relative_to(ROOT)))
                    break
    if found:
        fail(f"possibili credenziali nei file deployabili: {found}")
    else:
        ok("nessuna credenziale nei file deployabili")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="tratta gli avvisi come errori")
    args = parser.parse_args()

    print("Preflight AdOff — controlli di coerenza pre-deploy\n")
    for check in (check_manifest_versions, check_console_copies, check_llm_model,
                  check_rules_count, check_secrets_not_committed):
        check()

    print(f"\n{len(errors)} errori, {len(warnings)} avvisi")
    if errors:
        print("Deploy sconsigliato: risolvi gli errori sopra.")
        return 1
    if args.strict and warnings:
        print("Modalita' strict: gli avvisi bloccano.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
