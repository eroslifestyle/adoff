import argparse
import mimetypes
import os
import sys
import urllib.parse
import posixpath
import socketserver
from http.server import BaseHTTPRequestHandler

# Tipi MIME che includono charset=utf-8
MIME_CON_CHARSET = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'xml': 'application/xml; charset=utf-8',
    'txt': 'text/plain; charset=utf-8',
}

class _Handler(BaseHTTPRequestHandler):
    """Gestore delle richieste HTTP che replica le regole di Cloudflare Pages."""

    def __init__(self, request, client_address, server):
        # Passa gli attributi del server al gestore
        self.root_abs = server.root_abs
        self.notfound_mode = server.notfound_mode
        super().__init__(request, client_address, server)

    def do_GET(self):
        self._handle(send_body=True)

    def do_HEAD(self):
        self._handle(send_body=False)

    def _handle(self, send_body):
        # Estrae il percorso, ignora la query string
        path = urllib.parse.urlparse(self.path).path
        path = urllib.parse.unquote(path)
        # Normalizza il percorso (risolve .. e .). ATTENZIONE: normpath elimina
        # lo slash finale, ma qui distingue due casi diversi (/vs vs /vs/), quindi
        # va preservato — altrimenti /vs/ ricade sulla regola di /vs e produce un
        # redirect verso se stesso.
        had_trailing_slash = path.endswith('/') and path != '/'
        path = posixpath.normpath(path)
        if not path.startswith('/'):
            path = '/' + path
        if had_trailing_slash and not path.endswith('/'):
            path += '/'

        # Risoluzione della richiesta
        status, reason, content_type, file_path, redirect = self.resolve(path)

        # Log su stderr: METODO path -> status (target)
        log = f"{self.command} {path} -> {status}"
        if redirect:
            log += f" ({redirect})"
        sys.stderr.write(log + "\n")

        # Invia la risposta HTTP
        self.send_response(status, reason)
        if redirect:
            self.send_header("Location", redirect)
        if content_type:
            self.send_header("Content-Type", content_type)
        if file_path:
            # Invia la lunghezza del contenuto per ogni file servito
            self.send_header("Content-Length", str(os.path.getsize(file_path)))
        self.end_headers()

        # Corpo della risposta solo per GET
        if send_body and file_path:
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())

    def resolve(self, path):
        """Applica le regole di routing di Cloudflare Pages."""
        # Regola 1: /x.html -> 308 /x
        if path.endswith('.html') and not path.endswith('/index.html'):
            redirect = path[:-5]
            if redirect == '':
                redirect = '/'
            return (308, None, None, None, redirect)

        # Regola 2: /x/index.html -> 308 /x/
        if path.endswith('/index.html'):
            redirect = path[:-len('/index.html')] + '/'
            if redirect == '':
                redirect = '/'
            return (308, None, None, None, redirect)

        # Percorsi con slash finale
        if path.endswith('/'):
            # Regola 5: /x/ -> 200 (index.html)
            index_rel = os.path.join(path.lstrip('/'), 'index.html')
            index_file = self.file_exists(index_rel)
            if index_file:
                ct = self._mime_type('index.html')
                return (200, None, ct, index_file, None)

            # Regola 6: /x/ -> 308 /x (se esiste x.html)
            parent = path.rstrip('/')
            html_rel = parent.lstrip('/') + '.html'
            html_file = self.file_exists(html_rel)
            if html_file:
                redirect = parent
                return (308, None, None, None, redirect)

            # Non trovato
            return self.notfound_response(path)

        # Percorsi senza slash finale
        # Regola 3: /x -> 200 (x.html)
        html_rel = path.lstrip('/') + '.html'
        html_file = self.file_exists(html_rel)
        if html_file:
            # NB: il MIME va dedotto dal file RISOLTO, non dal path richiesto.
            # Passando 'html' (senza punto) si otteneva application/octet-stream
            # e il browser scaricava la pagina invece di navigarci.
            ct = self._mime_type(html_rel)
            return (200, None, ct, html_file, None)

        # Regola 4: /x -> 308 /x/ (se esiste directory con index.html)
        index_rel = os.path.join(path.lstrip('/'), 'index.html')
        index_file = self.file_exists(index_rel)
        if index_file:
            redirect = path + '/'
            return (308, None, None, None, redirect)

        # Regola asset: qualsiasi file esistente con estensione nota
        file_rel = path.lstrip('/')
        file_path = self.file_exists(file_rel)
        if file_path:
            ct = self._mime_type(file_rel)
            return (200, None, ct, file_path, None)

        # Non trovato
        return self.notfound_response(path)

    def file_exists(self, rel_path):
        """Restituisce il percorso assoluto del file se esiste ed è dentro root, altrimenti None."""
        # Costruisce il percorso assoluto
        local = os.path.normpath(os.path.join(self.root_abs, rel_path))
        # Verifica che il percorso sia sotto la directory root
        if not (local.startswith(self.root_abs + os.sep) or local == self.root_abs):
            return None
        if os.path.isfile(local):
            return local
        return None

    def notfound_response(self, path):
        """Gestisce le richieste non risolvibili in base alla modalità configurata."""
        if self.notfound_mode == '404':
            err_file = self.file_exists('404.html')
            if err_file:
                ct = self._mime_type('404.html')
                return (404, None, ct, err_file, None)
            else:
                return (404, "Not Found", None, None, None)
        else:  # spa
            idx_file = self.file_exists('index.html')
            if idx_file:
                ct = self._mime_type('index.html')
                return (200, None, ct, idx_file, None)
            else:
                return (404, "Not Found", None, None, None)

    def _mime_type(self, filename):
        """Restituisce il MIME type con charset se appropriato."""
        ext = os.path.splitext(filename)[1].lstrip('.')
        if ext in MIME_CON_CHARSET:
            return MIME_CON_CHARSET[ext]
        # Usa mimetypes per le altre estensioni
        return mimetypes.types_map.get('.' + ext, 'application/octet-stream')


class HTTPServer(socketserver.TCPServer):
    """Server HTTP con attributi per la configurazione."""
    allow_reuse_address = True

    def __init__(self, host, port, root, notfound_mode):
        self.root_abs = os.path.abspath(root)
        self.notfound_mode = notfound_mode
        super().__init__((host, port), _Handler)


def main():
    parser = argparse.ArgumentParser(
        description='Server HTTP locale che replica le regole di risoluzione URL di Cloudflare Pages.'
    )
    parser.add_argument(
        '--root',
        default='site',
        help='Directory radice del sito (default: site)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8899,
        help='Porta di ascolto (default: 8899)'
    )
    parser.add_argument(
        '--notfound',
        choices=['404', 'spa'],
        default='404',
        help="Modalità per le risorse non trovate: '404' restituisce 404.html, "
             "'spa' restituisce index.html con status 200 (default: 404)"
    )
    args = parser.parse_args()

    root_dir = args.root
    port = args.port
    notfound = args.notfound

    # Verifica che la directory root esista
    if not os.path.isdir(root_dir):
        sys.stderr.write(f"Errore: la directory root '{root_dir}' non esiste.\n")
        sys.exit(1)

    server = HTTPServer('', port, root_dir, notfound)
    sys.stderr.write(
        f"Server in ascolto su http://localhost:{port}/ "
        f"(root: {os.path.abspath(root_dir)})\n"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("Arresto del server in corso...\n")
        server.shutdown()


if __name__ == '__main__':
    main()
