#!/usr/bin/env python3
"""Garantisce che la chiave LiteLLM usata dalla chat del sito sia valida.

Il 22/08/2026 una rotazione ha invalidato la chiave del worker e la chat e'
rimasta muta 15 giorni: chi ruotava non sapeva chi consumava. Il watchdog
esistente (litellm-pi-key-reset) rigenera solo la chiave del client PI.

Qui si chiude il cerchio per AdOff: verifica, e se la chiave non funziona piu'
la rigenera con gli stessi limiti e la ripropaga a vault e worker. Idempotente:
se e' valida non tocca niente.

Uso:  ensure-llm-key.py [--verbose]
Exit: 0 chiave valida (gia' o dopo riparazione) e worker con LLM sano,
       1 riparazione fallita o worker ancora degradato dopo i retry.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request

LITELLM_BASE = "http://127.0.0.1:4000"
MASTER_KEY_ENV = "~/.claude/secrets/local-llm.env"
MASTER_KEY_VAR = "LITELLM_API_KEY"

SECRET_REF = "adoff-stores.LLM_API_KEY"
WORKER_DIR = "/mnt/nvme2/projects/Progetti/ChromePlugin/sviluppo/license-system"
WORKER_SECRET = "LLM_API_KEY"

# Verifica finale end-to-end: quella che conta e' la chiave che ha il WORKER,
# non quella del vault locale — se divergono (es. secret cambiato a mano) la
# chat in produzione e' rotta anche se il vault e' "valido".
ADMIN_TOKEN_REF = "adoff-stores.ADMIN_TOKEN"
WORKER_HEALTH_URL = "https://api.adoff.app/admin/health"
HEALTH_RETRIES = 3
HEALTH_RETRY_DELAY_S = 10  # secondi tra i tentativi: la propagazione del secret worker impiega qualche secondo

# Deve restare identico a quanto documentato: la chat non ha bisogno di altro, e
# una chiave larga su un worker pubblico e' una superficie inutile.
KEY_ALIAS = "adoff-support-chat-v2"
KEY_SPEC = {
    # fast-backup e' la riserva del fallback di LiteLLM: la chiave deve essere
    # autorizzata su ENTRAMBI, altrimenti al primo guasto del primario il
    # fallback viene respinto (403) e la chat torna muta.
    "models": ["fast-max", "fast-backup"],
    "key_alias": KEY_ALIAS,
    "max_budget": 5,
    "budget_duration": "30d",
    "rpm_limit": 30,
    "tpm_limit": 60000,
    "metadata": {"owner": "adoff-license-api", "purpose": "site support chatbot"},
}


def run(cmd: list[str], stdin: str | None = None, timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, input=stdin, capture_output=True, text=True, timeout=timeout)


def master_key() -> str:
    done = run(["bash", "-lc", f"set -a; . {MASTER_KEY_ENV}; set +a; echo ${MASTER_KEY_VAR}"])
    return done.stdout.strip()


def vault_key() -> str:
    done = run(["secret", "get", SECRET_REF])
    return done.stdout.strip() if done.returncode == 0 else ""


def key_works(key: str, model: str = KEY_SPEC["models"][0]) -> bool:
    """Una chiamata reale: /v1/models direbbe ok anche per una chiave senza modelli."""
    if not key:
        return False
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 8,
    }).encode()
    request = urllib.request.Request(
        f"{LITELLM_BASE}/v1/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.status == 200
    except Exception:
        return False


def key_conforme(key: str) -> bool:
    """Conforme solo se autorizzata su TUTTI i modelli di KEY_SPEC: un primario
    ok con la riserva respinta (403) lascerebbe il fallback rotto."""
    return all(key_works(key, model) for model in KEY_SPEC["models"])


def regenerate(master: str) -> str:
    # Via la vecchia omonima, altrimenti restano chiavi orfane valide a vita.
    try:
        urllib.request.urlopen(urllib.request.Request(
            f"{LITELLM_BASE}/key/delete",
            data=json.dumps({"key_aliases": [KEY_ALIAS]}).encode(),
            headers={"Authorization": f"Bearer {master}", "Content-Type": "application/json"},
            method="POST",
        ), timeout=30)
    except Exception:
        pass  # non esisteva: e' il caso normale dopo una ricreazione del DB

    request = urllib.request.Request(
        f"{LITELLM_BASE}/key/generate", data=json.dumps(KEY_SPEC).encode(),
        headers={"Authorization": f"Bearer {master}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode()).get("key", "")


def propagate(key: str, verbose: bool) -> bool:
    saved = run(["secret", "set", SECRET_REF], stdin=key)
    if saved.returncode != 0:
        print(f"ERRORE: salvataggio nel vault fallito: {saved.stderr.strip()[:200]}")
        return False
    pushed = run(["npx", "wrangler", "secret", "put", WORKER_SECRET],
                 stdin=key, timeout=300)
    if pushed.returncode != 0:
        print(f"ERRORE: push sul worker fallito: {pushed.stderr.strip()[:200]}")
        return False
    if verbose:
        print("  chiave propagata a vault e worker")
    return True


def worker_llm_degraded() -> list[str] | None:
    """Interroga /admin/health: ritorna la lista 'degraded', None se irraggiungibile."""
    token = run(["secret", "get", ADMIN_TOKEN_REF]).stdout.strip()
    if not token:
        print("ERRORE: ADMIN_TOKEN non leggibile dal vault")
        return None
    request = urllib.request.Request(WORKER_HEALTH_URL, headers={
        "X-Admin-Token": token,
        # OBBLIGATORIO: senza User-Agent il WAF Cloudflare risponde 403 "error code: 1010"
        "User-Agent": "adoff-ensure-llm-key/1.0",
    })
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode())
    except Exception as exc:
        print(f"verifica worker: health irraggiungibile: {exc}")
        return None
    return list(data.get("degraded", []))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    master = master_key()
    if not master:
        print("ERRORE: master key LiteLLM non leggibile")
        return 1

    if key_conforme(vault_key()):
        if args.verbose:
            print("chiave valida, nessuna azione")
    else:
        print("chiave non valida o assente: rigenero e ripropago")
        import os
        os.chdir(WORKER_DIR)
        new_key = regenerate(master)
        if not new_key:
            print("ERRORE: rigenerazione fallita")
            return 1
        if not propagate(new_key, args.verbose):
            return 1
        if not key_conforme(new_key):
            print("ERRORE: la chiave nuova non e' conforme (primario o fallback)")
            return 1
        print("chiave rigenerata e propagata")

    # Verifica end-to-end finale: il worker e' l'unico che sa se la chat funziona.
    for attempt in range(1, HEALTH_RETRIES + 1):
        if attempt > 1:
            time.sleep(HEALTH_RETRY_DELAY_S)  # il secret worker si propaga in pochi secondi
        degraded = worker_llm_degraded()
        if degraded is None:
            print(f"verifica worker {attempt}/{HEALTH_RETRIES}: health non raggiungibile")
            continue
        if "llm" not in degraded:
            if args.verbose:
                print("verifica end-to-end: il worker vede l'LLM sano")
            return 0
        print(f"verifica worker {attempt}/{HEALTH_RETRIES}: l'llm risulta ancora degradato")
    print("ERRORE: il worker riporta ancora l'llm degradato dopo i retry")
    return 1


if __name__ == "__main__":
    sys.exit(main())
