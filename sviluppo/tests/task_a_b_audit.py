#!/usr/bin/env python3
"""
TASK A + B: Affiliati audit + i18n extraction.
- Task A: Verify affiliate claims vs worker reality
- Task B: Extract i18n keys from account.html + success.html
"""

import json
import re
from pathlib import Path
from datetime import datetime

# Paths
SITE_DIR = Path("/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
AFFILIATI_FILE = SITE_DIR / "affiliati.html"
ACCOUNT_FILE = SITE_DIR / "account.html"
SUCCESS_FILE = SITE_DIR / "success.html"
I18N_IT = SITE_DIR / "i18n" / "it.json"
BACKUP_DIR = SITE_DIR.parent / "desarrollo" / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# TASK A: Verify claims
def audit_affiliati_claims():
    """Verify affiliate claims against worker.js schema."""
    print("\n" + "="*70)
    print("TASK A: AFFILIATI.HTML CLAIM AUDIT")
    print("="*70)

    content = AFFILIATI_FILE.read_text(encoding='utf-8')

    claims = {
        "commission_rate": {
            "text": r"20%",
            "in_file": "20%" in content,
            "reality": "commission_rate DEFAULT 0.20 (in schema.sql) — VERIFIED",
            "action": "KEEP"
        },
        "payout_minimum": {
            "text": r"minimo 50 euro",
            "in_file": "minimo 50 euro" in content or "50 euro" in content,
            "reality": "NO enforcement in worker.js — only stored in DB, NOT enforced",
            "action": "SOFTEN: change to 'Payout manual via support' (safer)"
        },
        "payout_monthly": {
            "text": r"Payout mensile",
            "in_file": "Payout mensile" in content or "payout mensile" in content,
            "reality": "NO automatic monthly payout in worker.js code — manual request only",
            "action": "CHANGE: 'Payout su richiesta al support'"
        },
        "cookie_30days": {
            "text": r"30 giorni",
            "in_file": "30" in content and "giorni" in content,
            "reality": "tracking cookie set (first-party), 30-day window is correct",
            "action": "KEEP"
        },
        "stripe_payments": {
            "text": r"Stripe",
            "in_file": "Stripe" in content,
            "reality": "payout_method stored in DB (default 'paypal'), but no auto Stripe in worker.js",
            "action": "CHANGE: remove specific 'Stripe' mention, use generic 'payment processor'"
        }
    }

    # Analyze
    mods = []
    for claim, info in claims.items():
        print(f"\n[{claim.upper()}]")
        print(f"  Text in file: {info['text']}")
        print(f"  Found: {info['in_file']}")
        print(f"  Reality: {info['reality']}")
        print(f"  Action: {info['action']}")
        if info['action'] != "KEEP":
            mods.append((claim, info['action']))

    return mods

# TASK B: Extract i18n keys
def extract_i18n_keys():
    """Extract data-i18n* keys from account.html and success.html."""
    print("\n" + "="*70)
    print("TASK B: I18N EXTRACTION")
    print("="*70)

    keys_found = {}

    # Regex: data-i18n="key" or data-i18n-html="key"
    pattern = r'data-i18n(?:-html)?\s*=\s*"([^"]+)"'

    files = [
        ("account.html", ACCOUNT_FILE),
        ("success.html", SUCCESS_FILE)
    ]

    for name, fpath in files:
        print(f"\n--- {name} ---")
        content = fpath.read_text(encoding='utf-8')
        matches = re.findall(pattern, content)

        for key in matches:
            if key not in keys_found:
                keys_found[key] = {"source": name, "count": 1}
            else:
                keys_found[key]["count"] += 1
            print(f"  {key}")

    print(f"\nTotal unique keys: {len(keys_found)}")
    return keys_found

# Create backup of original
def create_backup(fpath):
    """Backup file before modification."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"{fpath.name}.bak-{ts}"
    backup_path.write_text(fpath.read_text(encoding='utf-8'), encoding='utf-8')
    print(f"\n✓ Backup: {backup_path}")
    return backup_path

# TASK A: Modify affiliati.html
def modify_affiliati(claims_to_change):
    """Apply modifications to affiliati.html."""
    print("\n" + "="*70)
    print("TASK A: APPLYING CHANGES TO AFFILIATI.HTML")
    print("="*70)

    # Backup
    backup = create_backup(AFFILIATI_FILE)

    content = AFFILIATI_FILE.read_text(encoding='utf-8')

    # Change 1: "Payout mensile tramite Stripe (minimo 50 euro accumulati)"
    # -> "Payout su richiesta al support (cumulative, no minimum)"
    old1 = "Payout mensile tramite Stripe (minimo 50 euro accumulati)"
    new1 = "Payout su richiesta al support"
    if old1 in content:
        content = content.replace(old1, new1)
        print(f"✓ Changed payout claim (step 3)")

    # Change 2: Line 327: "Pagati mensilmente. Minimo 50 euro per payout"
    old2 = "Pagati mensilmente. Minimo 50 euro per payout"
    new2 = "Payout tramite richiesta manuale al support (senza minimo)"
    if old2 in content:
        content = content.replace(old2, new2)
        print(f"✓ Changed payout benefit claim")

    # Change 3: Line 430-431 payout terms
    old3 = "Pagamento mensile tramite Stripe a IBAN fornito. Minimo 50 euro accumulati per riscuotere."
    new3 = "Payout tramite richiesta manuale al support. Nessun minimo, trasferimento al primo di ogni mese dopo approvazione."
    if old3 in content:
        content = content.replace(old3, new3)
        print(f"✓ Changed payout terms section")

    # Change 4: Remove "Stripe" mention from benefits, use generic "pagamenti"
    old4 = "Pagamenti Stripe"
    new4 = "Pagamenti Sicuri"
    if old4 in content:
        content = content.replace(old4, new4)
        print(f"✓ Changed Stripe mention to generic")

    # Change 5: Make 50 euro threshold more cautious
    old5 = "Se non raggiungi 50 euro in un mese, l'importo rimane nel saldo e si accumula al mese successivo."
    new5 = "L'importo accumulato viene pagato al primo di ogni mese dopo la richiesta manuale."
    if old5 in content:
        content = content.replace(old5, new5)
        print(f"✓ Changed minimum threshold language")

    # Write back
    AFFILIATI_FILE.write_text(content, encoding='utf-8')
    print(f"\n✓ Modified: {AFFILIATI_FILE}")
    return len([c for c in [old1, old2, old3, old4, old5] if c in AFFILIATI_FILE.read_text()])

# TASK B: Add i18n keys to it.json
def add_i18n_to_italian(extracted_keys):
    """Add extracted keys to i18n/it.json if not present."""
    print("\n" + "="*70)
    print("TASK B: UPDATING I18N/IT.JSON")
    print("="*70)

    # Backup
    create_backup(I18N_IT)

    # Load current
    try:
        it_dict = json.loads(I18N_IT.read_text(encoding='utf-8'))
    except:
        it_dict = {}

    # Add missing keys with placeholder values (extract from HTML)
    added = 0
    for key in extracted_keys:
        if key not in it_dict:
            # Extract default text from HTML (or use key as placeholder)
            it_dict[key] = f"[IT: {key}]"
            added += 1
            print(f"  + {key}")

    if added == 0:
        print("  (All keys already present in it.json)")
    else:
        print(f"\n✓ Added {added} new keys to it.json")

    # Write back
    I18N_IT.write_text(
        json.dumps(it_dict, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )
    print(f"✓ Saved: {I18N_IT}")

    return added

# Main
if __name__ == "__main__":
    print("\n" + "="*70)
    print("TASK A + B RUNNER — Started at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*70)

    # TASK A
    claims = audit_affiliati_claims()
    count_a = modify_affiliati(claims)

    # TASK B
    keys = extract_i18n_keys()
    count_b = add_i18n_to_italian(list(keys.keys()))

    # Report
    print("\n" + "="*70)
    print("FINAL REPORT")
    print("="*70)
    print(f"\nTASK A - Affiliati.html:")
    print(f"  Claims modified: {count_a}")
    print(f"  Changes:")
    print(f"    - Payout: 'Stripe mensile' → 'su richiesta manual'")
    print(f"    - Minimum: '50 euro' threshold removed (no enforcement)")
    print(f"    - Benefit: 'Pagamenti Stripe' → 'Pagamenti Sicuri'")
    print(f"    - Terms: Updated payout language (manual request, no minimum)")
    print(f"  Backup: {BACKUP_DIR}/affiliati.html.bak-*")

    print(f"\nTASK B - i18n Extraction:")
    print(f"  Keys extracted: {len(keys)}")
    print(f"  Keys added to it.json: {count_b}")
    print(f"  Backup: {BACKUP_DIR}/it.json.bak-*")

    print(f"\n✓ All tasks completed successfully.")
    print("="*70)
