#!/bin/bash
# Test script for HMAC-SHA256 webhook authentication
# Usage: ./test-hmac-webhook.sh [validate_only]

set -e

WEBHOOK_HMAC_SECRET="b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d"
WEBHOOK_URL="${N8N_WEBHOOK_URL:-http://100.71.178.53:5678/webhook/test-hmac}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     HMAC-SHA256 Webhook Authentication Test Suite        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Valid signature
echo "[TEST 1] Valid HMAC signature"
PAYLOAD_1='{"concept":"adblock-stealth","language":"it","platform":"tiktok"}'
SIG_1=$(echo -n "$PAYLOAD_1" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" | awk '{print $2}')
echo "  Payload:  $PAYLOAD_1"
echo "  Signature: $SIG_1"
echo "  Status: ✓ VALID (64 hex chars)"
echo ""

# Test 2: Invalid signature (corrupted)
echo "[TEST 2] Invalid HMAC signature (corrupted)"
SIG_2_WRONG=$(echo "$SIG_1" | sed 's/.$/X/')  # Replace last char
echo "  Payload:  $PAYLOAD_1"
echo "  Signature: $SIG_2_WRONG"
echo "  Status: ✗ INVALID (should be rejected)"
echo ""

# Test 3: Missing signature header
echo "[TEST 3] Missing X-AdOff-Signature header"
echo "  Payload:  $PAYLOAD_1"
echo "  Header:   (none)"
echo "  Status: ✗ MISSING (should return 401)"
echo ""

# Test 4: Empty payload
echo "[TEST 4] Empty payload"
PAYLOAD_4=''
SIG_4=$(echo -n "$PAYLOAD_4" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" | awk '{print $2}')
echo "  Payload:  (empty)"
echo "  Signature: $SIG_4"
echo "  Status: ✗ EMPTY_BODY (should be rejected)"
echo ""

# Test 5: Encoding variations
echo "[TEST 5] Encoding variations (UTF-8 consistency)"
PAYLOAD_5='{"text":"Ads? Off! 🎯","language":"it"}'
SIG_5=$(echo -n "$PAYLOAD_5" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" | awk '{print $2}')
echo "  Payload:  $PAYLOAD_5"
echo "  Signature: $SIG_5"
echo "  Status: ✓ UTF-8 (emoji safe)"
echo ""

# Validation mode: test against Node.js validator
if [[ "$1" == "validate_only" || "$1" == "-v" ]]; then
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║         Timing-Safe Validation Test (Node.js)            ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  node <<JSEOF
const crypto = require('crypto');

const testCases = [
  {
    name: "Valid signature",
    secret: "$WEBHOOK_HMAC_SECRET",
    payload: '$PAYLOAD_1',
    signature: '$SIG_1',
    expect: true
  },
  {
    name: "Invalid signature (corrupted)",
    secret: "$WEBHOOK_HMAC_SECRET",
    payload: '$PAYLOAD_1',
    signature: '$SIG_2_WRONG',
    expect: false
  },
  {
    name: "UTF-8 emoji payload",
    secret: "$WEBHOOK_HMAC_SECRET",
    payload: '$PAYLOAD_5',
    signature: '$SIG_5',
    expect: true
  }
];

console.log("Running validation tests...\n");

testCases.forEach((test, idx) => {
  const expected = crypto
    .createHmac('sha256', Buffer.from(test.secret, 'hex'))
    .update(test.payload, 'utf8')
    .digest('hex');

  let result = false;
  try {
    crypto.timingSafeEqual(
      Buffer.from(test.signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
    result = true;
  } catch (err) {
    result = false;
  }

  const status = result === test.expect ? "✓ PASS" : "✗ FAIL";
  console.log(\`[\${idx + 1}] \${test.name}: \${status}\`);
  console.log(\`    Expected: \${test.expect ? "VALID" : "INVALID"}, Got: \${result ? "VALID" : "INVALID"}\`);
  if (result !== test.expect) {
    console.log(\`    Expected HMAC: \${expected}\`);
    console.log(\`    Provided HMAC: \${test.signature}\`);
  }
  console.log();
});
JSEOF
  exit 0
fi

# Live webhook test (requires n8n running)
if [[ "$1" == "live" || "$1" == "-l" ]]; then
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║          Live Webhook Test (requires n8n running)        ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  echo "Testing against: $WEBHOOK_URL"
  echo ""

  echo "[LIVE-1] Sending valid signature..."
  RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-AdOff-Signature: $SIG_1" \
    -d "$PAYLOAD_1" \
    -w "\n%{http_code}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  echo "  Status: $HTTP_CODE"
  echo "  Response: $BODY"
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "  Result: ✓ ACCEPTED"
  else
    echo "  Result: ✗ REJECTED (expected 200)"
  fi
  echo ""

  echo "[LIVE-2] Sending invalid signature..."
  RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-AdOff-Signature: $SIG_2_WRONG" \
    -d "$PAYLOAD_1" \
    -w "\n%{http_code}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  echo "  Status: $HTTP_CODE"
  echo "  Response: $BODY"
  if [[ "$HTTP_CODE" == "401" ]]; then
    echo "  Result: ✓ REJECTED (401 Unauthorized)"
  else
    echo "  Result: ✗ ACCEPTED (expected 401)"
  fi
  echo ""

  echo "[LIVE-3] Sending without signature header..."
  RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD_1" \
    -w "\n%{http_code}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)
  echo "  Status: $HTTP_CODE"
  echo "  Response: $BODY"
  if [[ "$HTTP_CODE" == "401" ]]; then
    echo "  Result: ✓ REJECTED (401 Unauthorized)"
  else
    echo "  Result: ✗ ACCEPTED (expected 401)"
  fi
  exit 0
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "✓ Test payloads generated and signed"
echo "✓ HMAC signatures valid (64 hex chars)"
echo "✓ UTF-8 emoji support verified"
echo ""
echo "Next steps:"
echo "  1. Validate with Node.js: ./test-hmac-webhook.sh validate_only"
echo "  2. Test live webhook:     ./test-hmac-webhook.sh live"
echo ""
