#!/usr/bin/env python3
"""AdOff — mini static media server (read-only) per media_public_url.

Serve SOLO i .mp4 del bank Remotion a un URL pubblico NON autenticato:
Meta (IG/FB) scarica il video da media_public_url al momento del publish.
Esposto via cloudflared (media.adoff.app) -> 127.0.0.1:8791.

Sicurezza: solo GET/HEAD, solo nomi `[A-Za-z0-9._-]+.mp4`, nessun
directory listing, nessun path traversal (no '/', '..'), Content-Type
video/mp4, range supportato da nessuno (download intero, ok per Meta).

Run:  media_server.py            (BANK default sotto)
      MEDIA_BANK=/path media_server.py
"""
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BANK = Path(os.environ.get(
    "MEDIA_BANK",
    "/home/mrxxx/adoff/sviluppo/marketing/video-engine/output/bank")).resolve()
PORT = int(os.environ.get("MEDIA_PORT", "8791"))
NAME_RE = re.compile(r"^[A-Za-z0-9._-]+\.mp4$")


class Handler(BaseHTTPRequestHandler):
    server_version = "AdOffMedia/1.0"

    def _deny(self, code=404):
        self.send_response(code)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _resolve(self):
        # /<name>.mp4  oppure /healthz
        path = self.path.split("?", 1)[0].lstrip("/")
        if path == "healthz":
            return "healthz"
        if "/" in path or ".." in path or not NAME_RE.match(path):
            return None
        f = (BANK / path).resolve()
        # confine dentro BANK + deve essere file regolare
        if BANK not in f.parents or not f.is_file():
            return None
        return f

    def do_HEAD(self):
        self._serve(head=True)

    def do_GET(self):
        self._serve(head=False)

    def _serve(self, head):
        r = self._resolve()
        if r == "healthz":
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        if r is None:
            return self._deny(404)
        size = r.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        if head:
            return
        with open(r, "rb") as fh:
            while True:
                chunk = fh.read(1024 * 256)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break

    def log_message(self, fmt, *args):  # log conciso su stdout (systemd)
        print("media %s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    print(f"AdOff media server :{PORT} -> {BANK} (solo *.mp4, read-only)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
