#!/usr/bin/env python3
"""Monitor dell'assistente AI del sito: verifica che /chat risponda davvero.

Nasce dal 06/09/2026: la chat era muta dal 22/08 (chiave LiteLLM revocata) e
nessuno se n'e' accorto per due settimane — ogni visitatore che scriveva apriva
un ticket. Qui si controlla il SINTOMO end-to-end, non le singole parti: un'unica
chiamata copre chiave revocata, modello mancante, backend Ollama morto, PC
spento e tunnel giu'.

La richiesta non porta email: il worker esce sul ramo `needEmail` PRIMA di
createTicketFromChat, quindi il monitor non crea ticket ne' notifiche.

Uso:  monitor-chat.py [--verbose]
Exit: 0 = sano (o skip), 1 = degradato, 2 = errore del monitor stesso.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CHAT_URL = "https://api.adoff.app/chat"
PROBE_MESSAGE = "How do I install the extension?"
REQUEST_TIMEOUT_S = 45
MIN_REPLY_CHARS = 20

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = PROJECT_ROOT / "sviluppo" / "logs" / "chat-monitor-state.json"
LOG_PATH = PROJECT_ROOT / "sviluppo" / "logs" / "chat-monitor.log"

# Namespace del vault TPM da cui leggere le credenziali Telegram. Il chat id NON
# deve essere quello del canale pubblico @adoffapp: un alert tecnico contiene
# dettagli d'infrastruttura e non va davanti agli utenti.
SECRET_NAMESPACE = "adoff-stores"
ALERT_CHAT_ID_VAR = "ALERT_CHAT_ID"
BOT_TOKEN_VAR = "TELEGRAM_BOT_TOKEN"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def probe_chat() -> tuple[str, str]:
    """Interroga la chat. Ritorna (stato, dettaglio) con stato in ok|down|skip."""
    payload = json.dumps({"message": PROBE_MESSAGE, "lang": "en"}).encode()
    request = urllib.request.Request(
        CHAT_URL,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "adoff-chat-monitor/1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
            body = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            return "skip", "rate-limited dal worker, nessun giudizio"
        return "down", f"HTTP {exc.code}"
    except Exception as exc:  # rete, DNS, timeout, JSON malformato
        return "down", f"{type(exc).__name__}: {exc}"

    if body.get("rateLimited"):
        return "skip", "rate-limited dal worker, nessun giudizio"
    if body.get("capped"):
        return "skip", "sessione capped, nessun giudizio"

    # Il sintomo esatto del guasto del 22/08: invece di rispondere, la chat
    # dirotta su un umano perche' l'LLM non e' raggiungibile.
    if body.get("escalate") or body.get("needEmail"):
        return "down", "escalation forzata: LLM non raggiungibile"

    reply = (body.get("reply") or "").strip()
    if len(reply) < MIN_REPLY_CHARS:
        return "down", f"risposta troppo corta ({len(reply)} caratteri)"
    return "ok", f"risposta di {len(reply)} caratteri"


def read_secret(namespace: str, name: str) -> str:
    """Legge una credenziale dal vault TPM. Stringa vuota se assente."""
    try:
        done = subprocess.run(
            ["secret", "get", f"{namespace}.{name}"],
            capture_output=True, text=True, timeout=20,
        )
        return done.stdout.strip() if done.returncode == 0 else ""
    except Exception:
        return ""


def send_telegram(text: str) -> bool:
    chat_id = read_secret(SECRET_NAMESPACE, ALERT_CHAT_ID_VAR)
    token = read_secret(SECRET_NAMESPACE, BOT_TOKEN_VAR)
    if not chat_id or not token:
        return False
    payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload, headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode()).get("ok", False)
    except Exception:
        return False


def notify(text: str) -> None:
    """Telegram se configurato; altrimenti notifica desktop. Sempre su log."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"{utc_now_iso()} {text}\n")
    if send_telegram(text):
        return
    try:
        subprocess.run(["notify-send", "-u", "critical", "AdOff", text], timeout=10)
    except Exception:
        pass


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    status, detail = probe_chat()
    if args.verbose:
        print(f"{utc_now_iso()} {status}: {detail}")

    if status == "skip":
        return 0

    state = load_state()
    previous = state.get("status")
    state.update({"status": status, "detail": detail, "checkedAt": utc_now_iso()})

    # Si notifica solo al CAMBIO di stato: un guasto lungo non deve generare un
    # messaggio ogni mezz'ora, ma il ritorno alla normalita' va comunicato.
    if status != previous:
        if status == "down":
            notify(f"🔴 <b>AdOff</b> — l'assistente AI non risponde\n{detail}\n"
                   f"Ogni visitatore che scrive in chat apre un ticket.")
        elif previous == "down":
            notify(f"🟢 <b>AdOff</b> — assistente AI di nuovo operativo\n{detail}")
        state["changedAt"] = utc_now_iso()

    save_state(state)
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
