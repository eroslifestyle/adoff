#!/bin/bash
# Smoke test for W28 Config Loader
# Usage: bash tests/test-config-loader.sh

N8N_URL="${N8N_URL:-http://localhost:5678}"
WEBHOOK_ID="adoff-marketing-config-webhook"

echo "=== AdOff W28 Config Loader Smoke Test ==="
echo

# Test 1: Get all config
echo "Test 1: GET all config"
RESPONSE=$(curl -s "${N8N_URL}/webhook/${WEBHOOK_ID}?key=all")
echo "$RESPONSE" | jq .

# Parse and verify
BRAND_COUNT=$(echo "$RESPONSE" | jq '.data.brand_blacklist | length')
FORBID_COUNT=$(echo "$RESPONSE" | jq '.data.forbidden_phrases | length')
LANG_IT=$(echo "$RESPONSE" | jq -r '.data.lang_names.it')

echo "Checks:"
echo "  - brand_blacklist.length = $BRAND_COUNT (expect 17)"
echo "  - forbidden_phrases.length = $FORBID_COUNT (expect 5)"
echo "  - lang_names.it = $LANG_IT (expect 'italiano')"
echo

# Test 2: Get specific keys
echo "Test 2: GET specific keys (brand_blacklist + lang_names)"
RESPONSE2=$(curl -s "${N8N_URL}/webhook/${WEBHOOK_ID}?key=brand_blacklist&key=lang_names")
echo "$RESPONSE2" | jq '.data | keys'

HAS_BRAND=$(echo "$RESPONSE2" | jq 'has("data.brand_blacklist")')
HAS_LANG=$(echo "$RESPONSE2" | jq 'has("data.lang_names")')
HAS_PLATFORM=$(echo "$RESPONSE2" | jq 'has("data.platform_caps")')

echo "Has brand_blacklist: $HAS_BRAND (expect true)"
echo "Has lang_names: $HAS_LANG (expect true)"
echo "Has platform_caps: $HAS_PLATFORM (expect false)"
echo

# Test 3: Check forbidden phrases
echo "Test 3: Forbidden phrases validation"
FORBIDDEN=$(echo "$RESPONSE" | jq -r '.data.forbidden_phrases[]')
echo "Forbidden phrases:"
echo "$FORBIDDEN" | sed 's/^/  - /'
echo

echo "=== Smoke Test Complete ==="
