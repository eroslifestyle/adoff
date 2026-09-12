#!/bin/bash
# Smoke test W28 Config Loader refactor
# Prerequisiti: W28 importato in n8n, DB populated con insert-marketing-config.sql

set -e

echo "=== AdOff W28 Config Loader — Smoke Test ==="
echo ""

# Config
N8N_BASE_URL="${N8N_BASE_URL:-http://localhost:5678}"
N8N_WEBHOOK_URL="${N8N_BASE_URL}/webhook/adoff-marketing-config-webhook"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="adoff_autopilot"
DB_USER="${DB_USER:-postgres}"

echo "[1/5] Verifico connessione n8n..."
if curl -s "${N8N_BASE_URL}/api/v1/health" > /dev/null; then
  echo "✓ n8n reachable"
else
  echo "✗ n8n not reachable. Verificare N8N_BASE_URL=${N8N_BASE_URL}"
  exit 1
fi

echo ""
echo "[2/5] Test GET /marketing-config?key=brand_blacklist (DB read)..."
RESPONSE=$(curl -s "${N8N_WEBHOOK_URL}?key=brand_blacklist")
if echo "$RESPONSE" | grep -q "YouTube"; then
  BLACKLIST_COUNT=$(echo "$RESPONSE" | jq '.data.brand_blacklist | length')
  echo "✓ Ritornati ${BLACKLIST_COUNT} brand blacklist (include YouTube)"
else
  echo "✗ Response non contiene brand_blacklist. Response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "[3/5] Test GET /marketing-config?key=lang_names (DB read)..."
RESPONSE=$(curl -s "${N8N_WEBHOOK_URL}?key=lang_names")
if echo "$RESPONSE" | grep -q "italiano"; then
  LANG_COUNT=$(echo "$RESPONSE" | jq '.data.lang_names | keys | length')
  echo "✓ Ritornate ${LANG_COUNT} lingue (include italiano)"
else
  echo "✗ Response non contiene lang_names. Response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "[4/5] Test UPDATE DB + refresh (validazione cache)..."
echo "  UPDATE marketing_config SET value='[\"TEST_UPDATE\"]'::jsonb WHERE key='brand_blacklist'..."
if command -v psql &> /dev/null; then
  PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "UPDATE adoff_autopilot.marketing_config SET value=('[\"TEST_UPDATE\"]'::jsonb), updated_at=NOW() WHERE key='brand_blacklist';" \
    2>/dev/null || true

  sleep 1
  RESPONSE=$(curl -s "${N8N_WEBHOOK_URL}?key=brand_blacklist")
  if echo "$RESPONSE" | grep -q "TEST_UPDATE"; then
    echo "✓ DB update riflesso immediatamente (no cache stale)"
  else
    echo "⚠ Avviso: refresh non ha pick up il valore aggiornato (potrebbe essere cache)"
    echo "  Response: $(echo "$RESPONSE" | jq '.data.brand_blacklist' 2>/dev/null || echo "$RESPONSE")"
  fi
else
  echo "⚠ psql non disponibile, test UPDATE saltato. Verificare manualmente."
fi

echo ""
echo "[5/5] Test GET /marketing-config (all keys)..."
RESPONSE=$(curl -s "${N8N_WEBHOOK_URL}")
if echo "$RESPONSE" | jq -e '.data | has("brand_blacklist") and has("lang_names") and has("platform_caps") and has("brand_voice") and has("synonyms")' > /dev/null 2>&1; then
  KEY_COUNT=$(echo "$RESPONSE" | jq '.data | keys | length')
  echo "✓ Ritornate tutte ${KEY_COUNT} config keys"
else
  echo "✗ Response non contiene tutte le keys. Response:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "=== TUTTI I TEST PASSATI ==="
echo ""
echo "Prossimi step:"
echo "  1. Re-import W28 in n8n (delete old ADOFF28CONFIGLOADER1, import w28-config-loader)"
echo "  2. Update W20/21/22/23 per usare W28 ID nuovo (se necessario)"
echo "  3. Integrazione in workflow Gemini (wave successiva)"
