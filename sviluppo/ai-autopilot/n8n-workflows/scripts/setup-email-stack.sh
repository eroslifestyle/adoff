#!/bin/bash
# AdOff Email Stack Setup — Zero-budget
# Cloudflare Email Routing + Resend + n8n credential
#
# Uso:
#   export CF_API_TOKEN="..."
#   export RESEND_API_KEY="..."
#   ./setup-email-stack.sh
#
# Idempotente: safe da rilanciare.

set -euo pipefail

: "${CF_API_TOKEN:?CF_API_TOKEN richiesto}"
: "${RESEND_API_KEY:?RESEND_API_KEY richiesto}"

DOMAIN="adoff.app"
DESTINATION="adoffsecurity@proton.me"
ALIASES=("press" "support" "partners" "dev" "hello")
N8N_ENCRYPTION_KEY="471c71315d63ab02bfe4a545d98b7438066f689033f76deaa2e68d6b5267ac67"

cf_api() {
    local method="$1"; local path="$2"; local data="${3:-}"
    local cmd=(curl -sS -X "$method" "https://api.cloudflare.com/client/v4$path"
        -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")
    [ -n "$data" ] && cmd+=(-d "$data")
    "${cmd[@]}"
}

resend_api() {
    local method="$1"; local path="$2"; local data="${3:-}"
    local cmd=(curl -sS -X "$method" "https://api.resend.com$path"
        -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json")
    [ -n "$data" ] && cmd+=(-d "$data")
    "${cmd[@]}"
}

echo "=== 1. Recupero Zone ID adoff.app ==="
ZONE_ID=$(cf_api GET "/zones?name=$DOMAIN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'][0]['id'] if d['result'] else '')")
[ -z "$ZONE_ID" ] && { echo "ERRORE: zone $DOMAIN non trovata nell'account CF del token"; exit 1; }
echo "Zone ID: $ZONE_ID"

echo
echo "=== 2. Recupero Account ID ==="
ACCOUNT_ID=$(cf_api GET "/zones/$ZONE_ID" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result']['account']['id'])")
echo "Account ID: $ACCOUNT_ID"

echo
echo "=== 3. Enable Email Routing su zone ==="
cf_api POST "/zones/$ZONE_ID/email/routing/enable" "{}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('enabled:', d.get('success', False), '-', d.get('result', {}).get('enabled', 'n/a'))"

echo
echo "=== 4. Add destination address $DESTINATION ==="
DEST_RESPONSE=$(cf_api POST "/accounts/$ACCOUNT_ID/email/routing/addresses" "{\"email\":\"$DESTINATION\"}")
DEST_ID=$(echo "$DEST_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print((d.get('result') or {}).get('tag') or (d.get('errors') and 'EXISTS' or ''))")
if [ "$DEST_ID" = "EXISTS" ]; then
    DEST_ID=$(cf_api GET "/accounts/$ACCOUNT_ID/email/routing/addresses" | python3 -c "import json,sys,os; d=json.load(sys.stdin); print(next((a['tag'] for a in d['result'] if a['email']==os.environ['DESTINATION']), ''))" DESTINATION="$DESTINATION")
fi
echo "Destination ID: $DEST_ID"
echo "⚠️  Vai sulla webmail Proton ora — CF ha inviato email di verifica a $DESTINATION. Click sul link per attivare."

echo
echo "=== 5. Crea routing rules per ogni alias ==="
for ALIAS in "${ALIASES[@]}"; do
    RULE_JSON=$(cat <<EOF
{
  "name": "Forward $ALIAS to $DESTINATION",
  "enabled": true,
  "matchers": [{"type": "literal", "field": "to", "value": "$ALIAS@$DOMAIN"}],
  "actions": [{"type": "forward", "value": ["$DESTINATION"]}]
}
EOF
)
    RES=$(cf_api POST "/zones/$ZONE_ID/email/routing/rules" "$RULE_JSON")
    OK=$(echo "$RES" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success', False))")
    echo "  $ALIAS@$DOMAIN → $DESTINATION  [$OK]"
done

echo
echo "=== 6. Catch-all rule (qualsiasi *@$DOMAIN → destination, low priority) ==="
CATCHALL=$(cat <<EOF
{
  "name": "Catch-all forward",
  "enabled": false,
  "matchers": [{"type": "all"}],
  "actions": [{"type": "forward", "value": ["$DESTINATION"]}]
}
EOF
)
cf_api POST "/zones/$ZONE_ID/email/routing/rules/catch_all" "$CATCHALL" >/dev/null
echo "  catch-all created (disabled by default — abilitalo se vuoi ricevere TUTTO)"

echo
echo "=== 7. Add Resend domain (se non esiste) ==="
RESEND_DOMAINS=$(resend_api GET "/domains")
RESEND_DOMAIN_ID=$(echo "$RESEND_DOMAINS" | python3 -c "import json,sys,os; d=json.load(sys.stdin); print(next((x['id'] for x in d.get('data', []) if x['name']==os.environ['DOMAIN']), ''))" DOMAIN="$DOMAIN")
if [ -z "$RESEND_DOMAIN_ID" ]; then
    ADD_RES=$(resend_api POST "/domains" "{\"name\":\"$DOMAIN\",\"region\":\"eu-west-1\"}")
    RESEND_DOMAIN_ID=$(echo "$ADD_RES" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id', ''))")
    echo "  Resend domain created: $RESEND_DOMAIN_ID"
else
    echo "  Resend domain already exists: $RESEND_DOMAIN_ID"
fi

echo
echo "=== 8. Aggiungi record DNS Resend (DKIM + SPF) a Cloudflare ==="
RESEND_DOMAIN_DETAIL=$(resend_api GET "/domains/$RESEND_DOMAIN_ID")
echo "$RESEND_DOMAIN_DETAIL" | python3 <<'PYEOF'
import json, sys, os, subprocess
detail = json.load(sys.stdin)
records = detail.get("records", [])
zone_id = os.environ["ZONE_ID"]
token = os.environ["CF_API_TOKEN"]
domain = os.environ["DOMAIN"]
for r in records:
    rtype = r.get("type", "")
    name = r.get("name", "")
    val = r.get("value", "")
    if not all([rtype, name, val]):
        continue
    # Resend ritorna name relativo, CF vuole FQDN
    if not name.endswith(domain):
        name = f"{name}.{domain}" if name else domain
    body = json.dumps({"type": rtype, "name": name, "content": val, "ttl": 3600, "proxied": False})
    res = subprocess.run([
        "curl", "-sS", "-X", "POST",
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", body
    ], capture_output=True, text=True)
    try:
        out = json.loads(res.stdout)
        ok = out.get("success", False)
        err = (out.get("errors") or [{}])[0].get("message", "")
        status = "OK" if ok else f"ERR ({err})"
    except Exception:
        status = "PARSE_ERR"
    print(f"  {rtype:8s} {name:60s} {status}")
PYEOF

echo
echo "=== 9. Trigger verifica dominio Resend ==="
resend_api POST "/domains/$RESEND_DOMAIN_ID/verify" "" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Resend verify:', d.get('status') or d.get('object') or d)"

echo
echo "=== 10. Cifra Resend API key + crea n8n credential ==="
RESEND_CRED_JSON="{\"name\":\"Authorization\",\"value\":\"Bearer $RESEND_API_KEY\"}"
RESEND_CRED_ENC=$(echo -n "$RESEND_CRED_JSON" | openssl enc -aes-256-cbc -md md5 -salt -pass pass:"$N8N_ENCRYPTION_KEY" -base64 -A)
RESEND_CRED_ID="adoff-resend-credential-001"
PROJECT_ID=$(docker exec n8n-postgres psql -U n8n -d n8n -tAc "SELECT id FROM project WHERE type='personal' LIMIT 1;")

docker exec -i n8n-postgres psql -U n8n -d n8n <<SQL
INSERT INTO credentials_entity (id, name, data, type, "isManaged", "isGlobal", "isResolvable", "resolvableAllowFallback")
VALUES ('$RESEND_CRED_ID', 'AdOff Resend Sender', '$RESEND_CRED_ENC', 'httpHeaderAuth', false, false, false, false)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW();

INSERT INTO shared_credentials ("credentialsId", "projectId", role)
VALUES ('$RESEND_CRED_ID', '$PROJECT_ID', 'credential:owner')
ON CONFLICT DO NOTHING;
SQL

echo
echo "=== 11. Patch W07 — punta al credential Resend reale ==="
docker exec n8n-postgres psql -U n8n -d n8n -c "
UPDATE workflow_entity SET nodes = REPLACE(nodes::text, 'PLACEHOLDER_RESEND_CRED', '$RESEND_CRED_ID')::json
WHERE name LIKE '%Press Cold Email%';
UPDATE workflow_history SET nodes = REPLACE(nodes::text, 'PLACEHOLDER_RESEND_CRED', '$RESEND_CRED_ID')::json
WHERE name LIKE '%Press Cold Email%';
"

echo
echo "=== SETUP COMPLETATO ==="
echo "Aliases attivi: ${ALIASES[@]/%/@adoff.app}"
echo "Destination: $DESTINATION (verifica email ricevuta su Proton)"
echo "Resend domain: $DOMAIN (verifica può richiedere 1-15 min)"
echo "n8n credential Resend: $RESEND_CRED_ID"
echo
echo "Test invio (dopo verifica Resend OK):"
echo "  curl -X POST https://api.resend.com/emails \\"
echo "       -H 'Authorization: Bearer $RESEND_API_KEY' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"from\":\"AdOff Press <press@adoff.app>\",\"to\":[\"test@example.com\"],\"subject\":\"Test\",\"text\":\"Hello\"}'"
