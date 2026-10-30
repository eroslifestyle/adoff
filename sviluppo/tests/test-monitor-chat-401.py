#!/usr/bin/env python3
"""Self-check Fix 2 di monitor-chat.py: 401/403 = allarme, rete giu' = skip.

Simula le risposte con monkeypatch: nessuna chiamata reale, nessuna notifica
Telegram (si testa solo probe_health, che non notifica — notify vive in main).
Uso: python3 test-monitor-chat-401.py   (exit 0 = ok)
"""
import importlib.util
import io
import sys
import urllib.error
from pathlib import Path

_script = Path(__file__).resolve().parents[1] / "scripts" / "monitor-chat.py"
_spec = importlib.util.spec_from_file_location("monitor_chat", _script)
monitor_chat = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(monitor_chat)


def run(exc: Exception):
    """probe_health con token finto e urlopen che solleva `exc`."""
    monitor_chat.read_secret = lambda ns, name: "fake-token"
    def fake_urlopen(request, timeout):
        raise exc
    monitor_chat.urllib.request.urlopen = fake_urlopen
    return monitor_chat.probe_health()


def main() -> int:
    status401, detail401 = run(urllib.error.HTTPError(
        monitor_chat.HEALTH_URL, 401, "Unauthorized", {}, io.BytesIO(b"")))
    assert status401 == "down", f"401 deve essere allarme, non skip: {status401!r}"
    assert "401" in detail401 and "FERMO" in detail401, detail401

    status403, _ = run(urllib.error.HTTPError(
        monitor_chat.HEALTH_URL, 403, "Forbidden", {}, io.BytesIO(b"")))
    assert status403 == "down", f"403 deve essere allarme, non skip: {status403!r}"

    status_net, _ = run(urllib.error.URLError("connessione rifiutata"))
    assert status_net == "skip", f"URLError deve restare skip: {status_net!r}"

    status_to, _ = run(TimeoutError("tempo scaduto"))
    assert status_to == "skip", f"timeout deve restare skip: {status_to!r}"

    print("PASS: 401/403 -> down (allarme), URLError/timeout -> skip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
