"""
AdOff — License Key Generator
Sistema proprietario di generazione chiavi.

Formato chiave: ADOFF-XXXX-XXXX-XXXX
Dove XXXX sono blocchi hex che contengono:
  - Piano (pro/lifetime)
  - Scadenza
  - Device limit
  - HMAC signature

Uso:
  python keygen.py --plan pro --months 1 --email user@example.com
  python keygen.py --plan lifetime --email user@example.com
  python keygen.py --plan pro --months 12 --email user@example.com --batch 10
"""

import hashlib
import hmac
import json
import time
import base64
import argparse
import os
import sys

# =============================================
# CONFIGURAZIONE
# =============================================

# SECRET KEY per la firma HMAC — obbligatoria, nessun default
# Settare con: export ADOFF_SECRET=<tuo_secret>
# Generare con: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = os.environ.get("ADOFF_SECRET", "")

# Prefisso chiave
PREFIX = "ADOFF"

# =============================================
# GENERAZIONE
# =============================================

def generate_license(plan, months=0, email="", device_limit=3):
    """
    Genera una license key firmata HMAC-SHA256.

    Args:
        plan: "pro" | "lifetime"
        months: durata in mesi (0 = lifetime)
        email: email dell'acquirente
        device_limit: max dispositivi (default 3)

    Returns:
        dict con key, payload e metadata
    """
    now = int(time.time())

    if plan == "lifetime":
        expires = 0  # 0 = mai
        months = 0
    else:
        expires = now + (months * 30 * 24 * 3600)

    # Payload della licenza
    payload = {
        "e": email,           # email
        "p": plan,            # piano
        "x": expires,         # scadenza unix timestamp (0=lifetime)
        "d": device_limit,    # max dispositivi
        "c": now,             # created at
        "v": 1,               # versione formato
    }

    # Serializza e firma
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")

    # HMAC-SHA256
    signature = hmac.new(
        SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()[:32]  # Primi 32 hex chars (128 bit, allineato con worker.js)

    # Combina payload + signature in formato leggibile
    raw = payload_b64 + signature

    # Converti in blocchi ADOFF-XXXX-XXXX-XXXX
    # Usiamo HMAC del raw per creare blocchi leggibili (allineato con worker.js)
    key_hash = hmac.new(SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest().upper()

    key = f"{PREFIX}-{key_hash[:4]}-{key_hash[4:8]}-{key_hash[8:12]}"

    return {
        "key": key,
        "raw": raw,           # payload+sig per validazione
        "payload": payload,
        "signature": signature,
        "plan": plan,
        "email": email,
        "expires": expires,
        "expires_human": time.strftime("%Y-%m-%d", time.gmtime(expires)) if expires > 0 else "LIFETIME",
        "created": time.strftime("%Y-%m-%d %H:%M", time.gmtime(now)),
        "device_limit": device_limit,
    }


def validate_license_offline(raw_key, secret=None):
    """
    Valida una license key offline (solo HMAC, no server).

    Args:
        raw_key: il campo "raw" della licenza (payload_b64 + signature)
        secret: il secret key (default: SECRET_KEY)

    Returns:
        dict { valid: bool, payload: dict|None, error: str|None }
    """
    s = secret or SECRET_KEY

    if len(raw_key) < 20:
        return {"valid": False, "error": "Key too short"}

    # Separa payload e signature
    payload_b64 = raw_key[:-32]
    signature = raw_key[-32:]

    # Verifica firma (32 hex chars = 128 bit, allineato con worker.js)
    expected_sig = hmac.new(
        s.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()[:32]

    if not hmac.compare_digest(signature, expected_sig):
        return {"valid": False, "error": "Invalid signature"}

    # Decodifica payload
    try:
        # Aggiungi padding base64
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(padded).decode()
        payload = json.loads(payload_json)
    except Exception as e:
        return {"valid": False, "error": f"Decode error: {e}"}

    # Controlla scadenza
    if payload.get("x", 0) > 0 and payload["x"] < time.time():
        return {"valid": False, "error": "License expired", "payload": payload}

    return {"valid": True, "payload": payload}


def generate_batch(plan, months, count, email_prefix="user"):
    """Genera un batch di licenze."""
    licenses = []
    for i in range(count):
        email = f"{email_prefix}{i+1}@adoff.app"
        lic = generate_license(plan, months, email)
        licenses.append(lic)
    return licenses


# =============================================
# CLI
# =============================================

def main():
    parser = argparse.ArgumentParser(description="AdOff License Key Generator")
    parser.add_argument("--plan", required=True, choices=["pro", "lifetime"], help="Piano licenza")
    parser.add_argument("--months", type=int, default=1, help="Durata in mesi (ignorato per lifetime)")
    parser.add_argument("--email", default="", help="Email acquirente")
    parser.add_argument("--devices", type=int, default=3, help="Max dispositivi (default 3)")
    parser.add_argument("--batch", type=int, default=1, help="Numero di chiavi da generare")
    parser.add_argument("--output", default=None, help="File output JSON")

    args = parser.parse_args()

    global SECRET_KEY
    if not SECRET_KEY:
        print("[ERRORE] La variabile d'ambiente ADOFF_SECRET non e' configurata.")
        print("   Generane una con: python -c \"import secrets; print(secrets.token_hex(32))\"")
        print("   Poi settala con: export ADOFF_SECRET=<tuo_secret>")
        sys.exit(1)

    if args.batch > 1:
        licenses = generate_batch(args.plan, args.months, args.batch)
    else:
        licenses = [generate_license(args.plan, args.months, args.email, args.devices)]

    # Output
    for i, lic in enumerate(licenses):
        print(f"{'=' * 50}")
        print(f"  License Key:  {lic['key']}")
        print(f"  Raw (per API): {lic['raw'][:40]}...")
        print(f"  Piano:        {lic['plan']}")
        print(f"  Email:        {lic['email'] or '—'}")
        print(f"  Scadenza:     {lic['expires_human']}")
        print(f"  Dispositivi:  max {lic['device_limit']}")
        print(f"  Creata:       {lic['created']}")

        # Verifica
        check = validate_license_offline(lic["raw"])
        print(f"  Verifica:     {'VALIDA' if check['valid'] else 'INVALIDA: ' + check.get('error', '')}")

    print(f"{'=' * 50}")
    print(f"\nGenerate {len(licenses)} licenza/e")

    # Salva su file se richiesto
    if args.output:
        with open(args.output, "w") as f:
            json.dump(licenses, f, indent=2)
        print(f"Salvate in: {args.output}")


if __name__ == "__main__":
    main()
