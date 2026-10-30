#!/usr/bin/env python3
"""
AdOff — Generatore testo via LLM locale (Ollama su leobox/localhost).

Permette all'agente SEO in `claude -p` headless (dove l'MCP local-llm NON è
caricato) di delegare DAVVERO la generazione di copy ai modelli locali gratuiti,
risparmiando token Claude. Claude resta la REGIA: chiama questo helper via Bash.

GUARDRAIL anti-allucinazione (il modello locale tende a inventare numeri/prezzi):
nel system prompt è VIETATO inventare cifre. Prezzi, conteggi, versioni, claim
fattuali NON vanno generati: vanno passati dalla regia (Claude) o lasciati come
placeholder. Verifica sempre l'output prima di applicarlo.

Uso:
  python3 gen_local.py "Scrivi 5 FAQ su un ad blocker invisibile, in tedesco"
  python3 gen_local.py --model brand-max --system "Sei un copywriter SEO" "..."
  echo "prompt lungo" | python3 gen_local.py --stdin --json

Endpoint: Ollama /api/chat (no API key). Default host 127.0.0.1:11434
(override con OLLAMA_HOST). Default model code-max (qwen3-coder abliterated).
"""
import argparse
import json
import os
import sys
import urllib.request

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "127.0.0.1:11434").replace("http://", "").rstrip("/")
DEFAULT_MODEL = os.environ.get("SEO_LOCAL_MODEL", "code-max")

GUARDRAIL = (
    "Sei un copywriter SEO/AEO multilingua per AdOff, un'estensione ad-blocker. "
    "Scrivi testo naturale, conciso, citabile dalle AI, ottimizzato per la query data. "
    "REGOLE FERREE: (1) NON inventare MAI numeri, prezzi, percentuali, date, versioni, "
    "conteggi, statistiche o claim verificabili — se servono, usa esattamente quelli che "
    "ti vengono forniti nel prompt, altrimenti OMETTILI. (2) NON inventare recensioni, "
    "rating o testimonianze. (3) NON nominare marchi di terze parti con loghi; i nomi "
    "piattaforma in forma testuale sono ok. (4) Niente keyword stuffing. "
    "(5) Rispondi SOLO col testo richiesto, senza preamboli."
)


def chat(model, system, prompt, want_json, temperature):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": temperature},
    }
    if want_json:
        body["format"] = "json"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"http://{OLLAMA_HOST}/api/chat", data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.loads(r.read().decode("utf-8", "replace"))
    return (out.get("message") or {}).get("content", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?", default="")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--system", default=GUARDRAIL,
                    help="system prompt (default = guardrail anti-allucinazione)")
    ap.add_argument("--stdin", action="store_true", help="leggi il prompt da stdin")
    ap.add_argument("--json", action="store_true", help="forza output JSON dal modello")
    ap.add_argument("--temperature", type=float, default=0.4)
    args = ap.parse_args()

    prompt = sys.stdin.read() if args.stdin else args.prompt
    if not prompt.strip():
        sys.exit("[gen_local] prompt vuoto")
    # Se l'utente passa un system custom, gli prepone comunque il guardrail-chiave.
    system = args.system if args.system == GUARDRAIL else (args.system + "\n\n" + GUARDRAIL)
    try:
        text = chat(args.model, system, prompt, args.json, args.temperature)
    except Exception as e:
        sys.exit(f"[gen_local ERRORE] {e}")
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
