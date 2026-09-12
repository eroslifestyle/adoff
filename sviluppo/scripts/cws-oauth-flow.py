#!/usr/bin/env python3
"""
AdOff — CWS OAuth Refresh Token Generator (no OAuth Playground needed)

Runs the OAuth 2.0 authorization-code flow directly:
  1. Starts a local HTTP server on http://localhost:8765 to catch the redirect
  2. Opens browser to Google's authorization URL
  3. Captures the authorization code from the redirect
  4. Exchanges it for access + refresh tokens
  5. Prints the refresh token

This bypasses OAuth Playground completely. Works even if Chrome Web Store API
is freshly enabled and the scope isn't yet recognized in the Playground UI.

Usage:
  python cws-oauth-flow.py <CLIENT_ID> <CLIENT_SECRET>

The Client ID must be of type "Desktop app" or "Web application" with
http://localhost:8765 in its Authorized redirect URIs.
"""
import http.server
import socketserver
import sys
import urllib.parse
import urllib.request
import webbrowser
import json
import threading
import time

PORT = 8765
SCOPE = "https://www.googleapis.com/auth/chromewebstore"
REDIRECT_URI = f"http://localhost:{PORT}"

if len(sys.argv) != 3:
    print("Usage: cws-oauth-flow.py <CLIENT_ID> <CLIENT_SECRET>")
    sys.exit(1)

CLIENT_ID = sys.argv[1].strip()
CLIENT_SECRET = sys.argv[2].strip()

auth_code = {"value": None}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            auth_code["value"] = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                "<html><body style='font-family:sans-serif;text-align:center;padding:50px'>"
                "<h2 style='color:green'>OK - torna al terminale</h2>"
                "<p>Codice ricevuto. Puoi chiudere questa finestra.</p>"
                "</body></html>".encode("utf-8")
            )
        elif "error" in params:
            err = params["error"][0]
            desc = params.get("error_description", [""])[0]
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Error: {err} — {desc}".encode())
            print(f"\n[ERROR] {err}: {desc}\n", file=sys.stderr)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return  # silence


def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.timeout = 1
        print(f"[1/3] Local listener on http://localhost:{PORT}")
        while auth_code["value"] is None:
            httpd.handle_request()


# Step 1: start local server in background
server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(0.5)

# Step 2: open browser
auth_url = (
    "https://accounts.google.com/o/oauth2/v2/auth?"
    + urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    })
)
print(f"[2/3] Opening browser for authorization...")
print(f"      If it doesn't open, paste this URL manually:\n      {auth_url}\n")
webbrowser.open(auth_url)

# Step 3: wait for code
print("[*] Waiting for callback...")
timeout = 300
start = time.time()
while auth_code["value"] is None:
    if time.time() - start > timeout:
        print("[ERROR] Timeout — no code received in 5 minutes.")
        sys.exit(1)
    time.sleep(0.5)

print(f"[+] Authorization code received (length={len(auth_code['value'])}).")

# Step 4: exchange for tokens
print("[3/3] Exchanging code for refresh token...")
token_data = urllib.parse.urlencode({
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": auth_code["value"],
    "redirect_uri": REDIRECT_URI,
    "grant_type": "authorization_code",
}).encode()

try:
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=token_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        tokens = json.loads(resp.read().decode())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"\n[ERROR] HTTP {e.code} — {body}")
    sys.exit(1)

if "refresh_token" not in tokens:
    print("\n[ERROR] No refresh_token in response. Full response:")
    print(json.dumps(tokens, indent=2))
    print("\nIf 'access_token' was returned but 'refresh_token' missing, the user")
    print("had already authorized this client before. Revoke at:")
    print("https://myaccount.google.com/permissions and re-run this script.")
    sys.exit(1)

print("\n=== SUCCESS ===")
print(f"\nRefresh Token:\n{tokens['refresh_token']}\n")
print(f"Access Token (expires in {tokens.get('expires_in', '?')}s):")
print(f"{tokens['access_token'][:40]}...\n")
print("Save the refresh token and use it in cws-recover-token.sh")
