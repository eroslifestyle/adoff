# Webhook HMAC Authentication — Quick Start

## Files Created

| File | Purpose |
|------|---------|
| `/opt/n8n/.env` | Updated with `WEBHOOK_HMAC_SECRET` (32 bytes hex) |
| `workflows/29-hmac-auth-validator.json` | Sub-workflow validator (import into n8n) |
| `docs/webhook-hmac-auth.md` | Full integration guide |
| `test-hmac-webhook.sh` | Test suite (bash) |

## Secret

```
WEBHOOK_HMAC_SECRET=b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d
```

**Length**: 32 bytes (64 hex characters)  
**Algorithm**: HMAC-SHA256  
**Location**: `/opt/n8n/.env` (already set)

## Import Sub-Workflow

1. Open n8n UI: `http://100.71.178.53:5678`
2. Workflows → Import from file
3. Select `workflows/29-hmac-auth-validator.json`
4. Confirm (creates workflow with ID: w29-hmac-auth-validator)

## Add to Your Webhook

For workflows W15, W20, W21, W22, W23:

```
Webhook Input → Execute Sub-Workflow (29-hmac-auth-validator)
                  ↓
                IF ($node["..."].json.ok === true)
                /                              \
              TRUE                           FALSE
              ↓                                ↓
        [Your processing]        [Return 401 Unauthorized]
```

## Test It

```bash
cd sviluppo/ai-autopilot/n8n-workflows

# Validation test (no n8n needed)
./test-hmac-webhook.sh validate_only

# Live test (requires n8n running)
export N8N_WEBHOOK_URL="http://100.71.178.53:5678/webhook/my-test"
./test-hmac-webhook.sh live
```

## Client Example

```bash
PAYLOAD='{"concept":"test"}'
SECRET="b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d"
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://n8n.adoff.app/webhook/your-webhook \
  -H "X-AdOff-Signature: $SIG" \
  -d "$PAYLOAD"
```

## Failures Logged to Telegram

All auth failures are logged via `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (must be set in n8n env).

---

**Status**: ✓ Implementation complete. Timing-safe validation verified. Ready for integration.
