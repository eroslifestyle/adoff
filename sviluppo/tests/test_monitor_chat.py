#!/usr/bin/env python3
"""Self-check di monitor-chat.py: il giudizio sulla risposta della chat.

Il punto delicato non e' la rete, e' la CLASSIFICAZIONE: nel guasto del 22/08 il
worker rispondeva 200 con un JSON perfettamente valido — solo, invece della
risposta, c'era `escalate: true`. Un monitor che guarda solo lo status HTTP
avrebbe detto "tutto ok" per due settimane.

Uso: python3 sviluppo/tests/test_monitor_chat.py
"""

import json
import sys
import urllib.error
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import importlib

monitor = importlib.import_module("monitor-chat")


@contextmanager
def fake_response(payload=None, http_error=None):
    """Sostituisce urlopen per non toccare la rete."""
    original = monitor.urllib.request.urlopen

    class FakeHandle:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return json.dumps(payload).encode()

    def stub(request, timeout=None):
        if http_error is not None:
            raise urllib.error.HTTPError("u", http_error, "err", {}, BytesIO(b""))
        return FakeHandle()

    monitor.urllib.request.urlopen = stub
    try:
        yield
    finally:
        monitor.urllib.request.urlopen = original


def check(label, expected, payload=None, http_error=None):
    with fake_response(payload, http_error):
        status, detail = monitor.probe_chat()
    assert status == expected, f"{label}: atteso {expected}, ottenuto {status} ({detail})"
    print(f"  ok  {label} → {status}")


healthy_reply = "AdOff is a browser extension. Install it from the Chrome Web Store."

# Il guasto reale: HTTP 200, JSON valido, ma nessuna risposta all'utente.
check("escalation forzata (il bug del 22/08)", "down",
      {"ok": True, "escalate": True, "needEmail": True, "reply": "I need your email."})
check("chat sana", "ok", {"ok": True, "reply": healthy_reply})
check("risposta vuota", "down", {"ok": True, "reply": ""})
check("risposta troppo corta", "down", {"ok": True, "reply": "ok"})
check("worker in errore", "down", http_error=500)
# Il rate limit e' una difesa che funziona, non un guasto: non deve allertare.
check("rate limit HTTP", "skip", http_error=429)
check("rate limit nel body", "skip", {"ok": True, "rateLimited": True, "reply": "slow down"})
check("sessione capped", "skip", {"ok": True, "capped": True, "reply": "too many messages"})

print("test_monitor_chat: 8/8 OK")
