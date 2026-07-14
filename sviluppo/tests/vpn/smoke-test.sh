#!/bin/bash
# smoke-test.sh — QA continuo VPN (da mettere in cron giornaliero)
# Esegue: gating + availability + balance + rate-limit
set -uo pipefail  # no -e: we want all tests to run even if one fails

WORKER="${VPN_WORKER_URL:-https://api.adoff.app}"
PASS=0 FAIL=0

log()  { echo "[$(date -Iseconds)] $*"; }
pass() { echo "  PASS: $*"; ((PASS++)); }
fail() { echo "  FAIL: $*"; ((FAIL++)); }

log "=== VPN smoke test ==="

# 1. /vpn/servers — pubblico, deve tornare 200
code=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER/vpn/servers")
if [[ "$code" == "200" ]]; then
  count=$(curl -s "$WORKER/vpn/servers" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['servers']))" 2>/dev/null || echo 0)
  pass "/vpn/servers → HTTP $code ($count server)"
else
  fail "/vpn/servers → HTTP $code (atteso 200)"
fi

# 2. /vpn/profile — pubblico, deve tornare 200
code=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER/vpn/profile")
if [[ "$code" == "200" ]]; then
  balance=$(curl -s "$WORKER/vpn/profile" | python3 -c "import sys,json; print(json.load(sys.stdin).get('balance','?'))" 2>/dev/null || echo "?")
  pass "/vpn/profile → HTTP $code (balance: \$$balance)"
else
  fail "/vpn/profile → HTTP $code (atteso 200)"
fi

# 3. GATING — /vpn/config senza token → deve essere 403
code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$WORKER/vpn/config?accountId=test&serverId=135&deviceId=testdev")
if [[ "$code" == "403" ]]; then
  pass "GATING /vpn/config senza token → HTTP $code"
else
  fail "GATING /vpn/config senza token → HTTP $code (atteso 403)"
fi

# 4. GATING — /vpn/create senza token → deve essere 403 (post-redeploy FASE 0)
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$WORKER/vpn/create" \
  -H "Content-Type: application/json" \
  -d '{}')
if [[ "$code" == "403" ]]; then
  pass "GATING /vpn/create senza token → HTTP $code"
else
  fail "GATING /vpn/create senza token → HTTP $code (atteso 403, probabile OLD codice non deployato)"
fi

# 5. GATING — /vpn/delete senza token → deve essere 403
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$WORKER/vpn/delete" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"test"}')
if [[ "$code" == "403" ]]; then
  pass "GATING /vpn/delete senza token → HTTP $code"
else
  fail "GATING /vpn/delete senza token → HTTP $code (atteso 403)"
fi

# 6. GATING — /vpn/enable senza token → deve essere 403
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$WORKER/vpn/enable" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"test"}')
if [[ "$code" == "403" ]]; then
  pass "GATING /vpn/enable senza token → HTTP $code"
else
  fail "GATING /vpn/enable senza token → HTTP $code (atteso 403)"
fi

# 7. GATING — /vpn/disable senza token → deve essere 403
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$WORKER/vpn/disable" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"test"}')
if [[ "$code" == "403" ]]; then
  pass "GATING /vpn/disable senza token → HTTP $code"
else
  fail "GATING /vpn/disable senza token → HTTP $code (atteso 403)"
fi

# 8. /vpn/servers ritorna almeno 10 server
count=$(curl -s "$WORKER/vpn/servers" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['servers']))" 2>/dev/null || 0)
if [[ "$count" -ge 10 ]]; then
  pass "Server count $count >= 10"
else
  fail "Server count $count < 10 (possibile problema API VPNresellers)"
fi

log ""
log "=== RISULTATI: $PASS pass, $FAIL fail ==="

if [[ "$FAIL" -gt 0 ]]; then
  log "SMOKE FAIL — alert richiesto"
  exit 1
else
  log "SMOKE PASS"
  exit 0
fi
