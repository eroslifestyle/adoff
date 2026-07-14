# Idempotency Pattern — Webhook Gemini AdOff

## Overview

Previene esecuzioni duplicate quando un client (es. extension, app mobile, scraper bot) invia la stessa richiesta 2 volte entro una finestra temporale.

Usa Redis con chiave `idem:${workflow_id}:${key}` e SET NX (only if not exists) con TTL configurabile (default 300s).

## Client Usage

### 1. Invia richiesta con Idempotency-Key

```bash
curl -X POST http://n8n.local/webhook/idempotency-check \
  -H "Content-Type: application/json" \
  -d '{
    "key": "gemini-copywriter-20260520-12345",
    "workflow_id": "w20-gemini-copywriter-caption",
    "ttl_seconds": 300
  }'
```

**Header alternativo (se il client usa standard HTTP Idempotency-Key):**

```bash
curl -X POST http://n8n.local/webhook/idempotency-check \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: gemini-copywriter-20260520-12345" \
  -d '{
    "workflow_id": "w20-gemini-copywriter-caption",
    "ttl_seconds": 300
  }'
```

### 2. Resposta

**Prima volta (nuova richiesta):**
```json
{
  "is_duplicate": false,
  "key": "gemini-copywriter-20260520-12345",
  "workflow_id": "w20-gemini-copywriter-caption",
  "message": "request accepted"
}
```

**Seconda volta (entro TTL, stessa key):**
```json
{
  "is_duplicate": true,
  "key": "gemini-copywriter-20260520-12345",
  "workflow_id": "w20-gemini-copywriter-caption",
  "message": "duplicate request, skipping"
}
```

## Workflow Integration

### Pattern 1: Sub-workflow Call

Nel workflow principale (es. w20-gemini-copywriter-caption), aggiungi **Execute Workflow** node:

```json
{
  "name": "Check Idempotency",
  "type": "n8n-nodes-base.executeWorkflow",
  "parameters": {
    "workflowId": "w27-idempotency-check",
    "mode": "each",
    "options": {
      "executionData": "inputData"
    }
  }
}
```

Poi aggiungi **IF** per decidere:

```json
{
  "name": "Is Duplicate?",
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "boolean": [
        {
          "value1": "={{ $json.is_duplicate === true }}",
          "value2": true
        }
      ]
    }
  }
}
```

Se true → early return (log + 200 OK).
Se false → continua con processing Gemini.

### Pattern 2: Direct Redis Node (Advanced)

Se preferisci evitare sub-workflow call, usa Redis node direttamente:

```json
{
  "name": "Redis SET NX",
  "type": "n8n-nodes-base.redis",
  "parameters": {
    "resource": "generic",
    "operation": "executeCommand",
    "command": "SET",
    "key": "={{ `idem:${$json.workflow_id}:${$json.key}` }}",
    "ttl": "={{ $json.ttl_seconds || 300 }}",
    "mode": "NX"
  },
  "credentials": {
    "redis": "adoff-redis-credential-001"
  }
}
```

Output:
- Redis ritorna `1` (o `true`) → richiesta nuova, procedi
- Redis ritorna `0` (o `false`) → duplicata, return early

## Key Generation Strategies

### Strategy 1: UUIDs

Client genera UUID v4 per ogni **sessione utente**:
```python
import uuid
idempotency_key = str(uuid.uuid4())  # "a1b2c3d4-..."
```

Mantieni UUID per retry della STESSA operazione entro TTL.

### Strategy 2: Content-Hash

Hash del payload per detecting duplicati basati su contenuto:
```python
import hashlib
payload = json.dumps({...}, sort_keys=True)
idempotency_key = hashlib.sha256(payload.encode()).hexdigest()[:16]
```

### Strategy 3: Timestamp + Seq

Per client che non supportano UUID:
```
idempotency_key = f"{int(time.time())}_{random.randint(0, 9999)}"
# "1716216000_4723"
```

## Redis Setup (Already Done)

Credenziale importata: `adoff-redis-credential-001`

**Verifica connessione:**
```bash
docker exec n8n-redis redis-cli -a "20tIaYvSHWlGa1cCAQe3HffX9o88d9a" ping
# Output: PONG
```

## Monitoring & Cleanup

### View active idempotency keys

```bash
docker exec n8n-redis redis-cli -a "20tIaYvSHWlGa1cCAQe3HffX9o88d9a" KEYS "idem:*"
```

### Manual cleanup (if needed)

```bash
docker exec n8n-redis redis-cli -a "20tIaYvSHWlGa1cCAQe3HffX9o88d9a" DEL "idem:w20-gemini-copywriter-caption:some-key"
```

## TTL Tuning

Default: 300 seconds (5 minuti).

**Adjust per workflow:**
- **Fast operations** (< 30s): TTL = 60s
- **Medium** (30s - 5min): TTL = 300s (default)
- **Slow** (> 5min): TTL = 600s - 900s

Comunicare al client via **API docs**:
> Per operazioni Gemini lunghe (strategist, research), consigliamo TTL di almeno 5 minuti per evitare false positivi.

## Testing

### Smoke Test (Local)

```bash
#!/bin/bash
KEY="test-idem-$(date +%s)"
WID="w27-idempotency-check"

# Request 1 (new)
curl -X POST http://localhost:5678/webhook/idempotency-check \
  -H "Content-Type: application/json" \
  -d "{ \"key\": \"$KEY\", \"workflow_id\": \"$WID\", \"ttl_seconds\": 60 }" \
  | jq '.is_duplicate'
# Expected: false

# Request 2 (same key, should be duplicate)
curl -X POST http://localhost:5678/webhook/idempotency-check \
  -H "Content-Type: application/json" \
  -d "{ \"key\": \"$KEY\", \"workflow_id\": \"$WID\", \"ttl_seconds\": 60 }" \
  | jq '.is_duplicate'
# Expected: true

# Request 3 (different key, should be new)
KEY2="test-idem-$(date +%s)-2"
curl -X POST http://localhost:5678/webhook/idempotency-check \
  -H "Content-Type: application/json" \
  -d "{ \"key\": \"$KEY2\", \"workflow_id\": \"$WID\", \"ttl_seconds\": 60 }" \
  | jq '.is_duplicate'
# Expected: false
```

---

**Versione:** 1.0.0  
**Creato:** 2026-05-20  
**Workflow:** w27-idempotency-check  
**Redis Credential:** adoff-redis-credential-001
