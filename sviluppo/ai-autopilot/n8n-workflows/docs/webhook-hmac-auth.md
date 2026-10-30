# Webhook HMAC-SHA256 Authentication Guide

## Overview

All outward-facing webhooks (W20, W21, W22, W23, W15) must validate HMAC-SHA256 signatures to prevent unauthorized requests once webhooks exit Tailscale protection.

**Secret location**: `/opt/n8n/.env` → `WEBHOOK_HMAC_SECRET` (32 bytes hex)  
**Validator sub-workflow**: `workflows/29-hmac-auth-validator.json` (ID: w29-hmac-auth-validator)

---

## Implementation Pattern

### 1. Add Webhook Node (Existing)

Your workflow's Webhook node accepts POST requests:
```
POST /webhook/my-webhook-name
Headers: X-AdOff-Signature: <hex-sha256-hmac>
Body: JSON payload
```

### 2. Add Execute Sub-Workflow Node

Insert an "Execute Sub-Workflow" node **immediately after** the Webhook node:

**Config:**
- **Sub-Workflow**: "HMAC Auth Validator" (ID: w29-hmac-auth-validator)
- **Input Mapping**: Pass webhook data as-is
- **On Error**: Set to **Continue on Error** (optional, for logging)

**Connections:**
```
Webhook Input → Execute Sub-Workflow (29-hmac-auth-validator)
                     ↓
                  Returns: { ok: true/false, payload, reason }
                     ↓
                IF node (check .ok)
                /              \
              true            false → STOP (return 401)
              ↓
        Continue processing
```

### 3. Add IF Node (Conditional Branch)

After the sub-workflow execution:

**Condition:**
```
$node["Execute Sub-Workflow"].json.ok === true
```

**True branch**: Continue to your processing nodes  
**False branch**: Return error response (handled by validator's 401 response)

### 4. Access Validated Payload

In subsequent nodes, reference the validated payload:
```
={{ $node["Execute Sub-Workflow"].json.payload }}
```

---

## Client Example: Generate and Send Signature

### Bash Script

```bash
#!/bin/bash
set -e

# Configuration
WEBHOOK_URL="https://n8n.adoff.app/webhook/gemini-copywriter-caption"
WEBHOOK_HMAC_SECRET="b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d"

# Payload
PAYLOAD='{"concept":"test","language":"it","platform":"tiktok"}'

# Generate HMAC-SHA256
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" | awk '{print $2}')

echo "[DEBUG] Payload: $PAYLOAD"
echo "[DEBUG] Signature: $SIG"

# Send request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AdOff-Signature: $SIG" \
  -d "$PAYLOAD" \
  -v
```

### Python Example

```python
import hmac
import hashlib
import requests
import json

WEBHOOK_URL = "https://n8n.adoff.app/webhook/gemini-copywriter-caption"
WEBHOOK_HMAC_SECRET = "b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d"

payload = {"concept": "test", "language": "it", "platform": "tiktok"}
payload_str = json.dumps(payload, separators=(',', ':'))

# Generate signature
signature = hmac.new(
    bytes.fromhex(WEBHOOK_HMAC_SECRET),
    payload_str.encode('utf-8'),
    hashlib.sha256
).hexdigest()

print(f"Payload: {payload_str}")
print(f"Signature: {signature}")

# Send request
response = requests.post(
    WEBHOOK_URL,
    json=payload,
    headers={"X-AdOff-Signature": signature}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

### JavaScript/Node.js Example

```javascript
import crypto from 'crypto';
import fetch from 'node-fetch';

const WEBHOOK_URL = "https://n8n.adoff.app/webhook/gemini-copywriter-caption";
const WEBHOOK_HMAC_SECRET = "b8db5d4fc8618b36a14a75f38ba4df2f4d48100f70e20067b6ed79c9428e329d";

const payload = { concept: "test", language: "it", platform: "tiktok" };
const payloadStr = JSON.stringify(payload);

// Generate signature
const signature = crypto
  .createHmac('sha256', Buffer.from(WEBHOOK_HMAC_SECRET, 'hex'))
  .update(payloadStr, 'utf-8')
  .digest('hex');

console.log(`Payload: ${payloadStr}`);
console.log(`Signature: ${signature}`);

// Send request
const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AdOff-Signature': signature
  },
  body: payloadStr
});

const data = await response.json();
console.log(`Status: ${response.status}`);
console.log(`Response: ${JSON.stringify(data)}`);
```

---

## Integration Checklist

For each workflow (W15, W20, W21, W22, W23):

- [ ] Webhook node receives requests (unchanged)
- [ ] Add "Execute Sub-Workflow" node → select "HMAC Auth Validator"
- [ ] Add IF node to check `$node["..."].json.ok === true`
- [ ] Route success branch to processing nodes
- [ ] Route failure branch to error handler (or let validator's 401 response handle it)
- [ ] Test with bash script above (replace URL/payload as needed)
- [ ] Verify Telegram logs on failed auth attempts

---

## Validator Node Details

**Input**: Standard n8n webhook context with:
- `json.$headers['x-adoff-signature']` — signature from request header
- `json.$body` — raw request body (string)

**Output on success**:
```json
{
  "ok": true,
  "payload": { "...": "..." },
  "timestamp": "2026-05-20T15:30:45.123Z"
}
```

**Output on failure**:
```json
{
  "ok": false,
  "reason": "invalid_signature | missing_signature_header | empty_body",
  "timestamp": "2026-05-20T15:30:45.123Z"
}
```

**Security**:
- Uses `crypto.timingSafeEqual()` to prevent timing attacks
- Rejects if signature header missing
- Rejects if body empty
- Logs all failures to Telegram

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `missing_signature_header` | Ensure client sends `X-AdOff-Signature` header |
| `invalid_signature` | Verify payload encoding (UTF-8, no whitespace variations). Check secret matches. |
| `empty_body` | Ensure request body is not empty |
| `WEBHOOK_HMAC_SECRET not configured` | Add env var to `/opt/n8n/.env` and restart n8n |

---

## Secret Rotation

To rotate the HMAC secret:

1. Generate new secret: `openssl rand -hex 32`
2. Update `/opt/n8n/.env`: `WEBHOOK_HMAC_SECRET=<new-secret>`
3. Restart n8n: `docker-compose -f stack/docker-compose.yml restart n8n`
4. Update all clients with new secret
5. Old secret stops working immediately (no grace period)

---

## Version History

- **2026-05-20**: Initial implementation with timing-safe validation and Telegram logging.
