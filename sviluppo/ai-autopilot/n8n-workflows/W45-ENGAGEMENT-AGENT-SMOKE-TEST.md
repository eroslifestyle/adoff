# W45 Engagement Agent — Smoke Test Guide

## Prerequisiti

- n8n 2.21.5+ running su localhost o server
- Workflow W45 importato: `workflows/45-engagement-agent.json`
- Credenziali configurate:
  - `adoff-pg-autopilot-credential-1234` (PostgreSQL)
  - `adoff-gemini-credential-2026` (Google Gemini API)
- Variabili d'ambiente:
  ```bash
  ENGAGEMENT_AGENT_DISABLED=false
  ENGAGEMENT_AUTOREPLY_ENABLED=true
  WEBHOOK_HMAC_SECRET=<your_hex_secret>
  TELEGRAM_BOT_TOKEN=<token>
  TELEGRAM_CHAT_ID=<chat_id>
  ```

## Step 1: Crea tabella engagement_inbox (se non esiste)

```sql
CREATE TABLE IF NOT EXISTS public.engagement_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(50) NOT NULL,
  source_post_id VARCHAR(255),
  comment_id VARCHAR(255) NOT NULL UNIQUE,
  author_handle VARCHAR(255),
  content TEXT,
  intent VARCHAR(50),
  sentiment NUMERIC(3,2),
  priority INT,
  suggested_reply TEXT,
  status VARCHAR(50) DEFAULT 'new',
  escalation_reason TEXT,
  handled_at TIMESTAMP,
  handled_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_engagement_platform_status ON public.engagement_inbox(platform, status);
CREATE INDEX idx_engagement_comment_id ON public.engagement_inbox(comment_id);
```

## Step 2: Inserisci 3 commenti di test

```sql
-- Test case 1: Question (should trigger auto-reply)
INSERT INTO engagement_inbox 
  (platform, source_post_id, comment_id, author_handle, content, status)
VALUES 
  ('twitter', 'tw_post_123', 'tw_c1_' || gen_random_uuid()::text, 
   '@john_q', 
   'Come installo AdOff su Safari? Funziona bene con i video?',
   'new');

-- Test case 2: Praise (should trigger auto-reply with thanks)
INSERT INTO engagement_inbox 
  (platform, source_post_id, comment_id, author_handle, content, status)
VALUES 
  ('reddit', 'rd_post_456', 'rd_c2_' || gen_random_uuid()::text,
   'maria_happy',
   'AdOff è fantastico! Ha eliminato tutti i popup infastidenti. Grazie!',
   'new');

-- Test case 3: Complaint (should escalate)
INSERT INTO engagement_inbox 
  (platform, source_post_id, comment_id, author_handle, content, status)
VALUES 
  ('mastodon', 'mt_post_789', 'mt_c3_' || gen_random_uuid()::text,
   'marco_frustrated@example.com',
   'Non funziona più sui video. Continuano a farsi vedere gli annunci. Help!',
   'new');

-- Verify
SELECT COUNT(*) as test_rows_inserted, 
       GROUP_CONCAT(DISTINCT platform) as platforms 
FROM engagement_inbox 
WHERE status='new' AND created_at > NOW() - INTERVAL 1 MINUTE;
```

## Step 3: Test flusso manuale

### Opzione A: Trigger manuale nel UI n8n
1. Apri workflow W45 in n8n
2. Click "Test workflow" (manual trigger)
3. Aspetta esecuzione
4. Verifica output: "Engagement processing complete"

### Opzione B: Webhook trigger
```bash
HMAC_SECRET="<your_hex_secret>"
BODY='{"source":"manual_test"}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hex -mac HMAC -macopt key:$HMAC_SECRET | cut -d' ' -f2)

curl -X POST http://localhost:5678/webhook/engagement-now \
  -H "Content-Type: application/json" \
  -H "X-AdOff-Signature: $SIGNATURE" \
  -d "$BODY"
```

## Step 4: Verifica risultati

```sql
-- Controlla status dopo esecuzione
SELECT platform, comment_id, intent, sentiment, status, handled_by, handled_at
FROM engagement_inbox 
WHERE created_at > NOW() - INTERVAL 5 MINUTE
ORDER BY created_at DESC;

-- Expected:
-- Test case 1 (question): status='sent', intent='question', handled_by='gemini-flash'
-- Test case 2 (praise):   status='sent', intent='praise', handled_by='gemini-flash'
-- Test case 3 (complaint): status='escalated', intent='complaint', escalation_reason='manuale'
```

## Step 5: Verifica anti-tampering

1. **Brand-guard test**: modifica una test row con content="YouTube is great", esegui fase C → dovrebbe essere escalated per brand hit
2. **Kill-switch test**: set env `ENGAGEMENT_AGENT_DISABLED=true` → workflow ritorna 503
3. **Cooldown test**: verifica delay 2 min tra auto-reply consecutivi nella stessa platform

## Expected Output (Smoke Test Passed)

- ✓ 3 rows inseriti con status='new'
- ✓ Gemini classifica correttamente: question (0.7-0.8 sentiment), praise (0.9), complaint (0.2-0.3)
- ✓ Auto-reply enabled: 2 rows update a status='sent'
- ✓ Escalation: 1 row (complaint) → status='escalated' + Telegram alert
- ✓ Telegram daily report: 18:00 con sommario giornaliero
- ✓ Zero hardcoded secrets, zero SQL injection, zero brand leak

## Troubleshooting

| Sintomo | Causa | Fix |
|---------|-------|-----|
| "WEBHOOK_HMAC_SECRET not configured" | env var mancante | `export WEBHOOK_HMAC_SECRET=<hex_value>` |
| Gemini timeout (>30s) | API key non valida o quota esaurita | verifica in Google Cloud Console |
| "kill_switch_hit: true" | ENGAGEMENT_AGENT_DISABLED=true | set a false o commentare |
| PostgreSQL error on UPDATE | credential scaduta | rigenera credential in n8n |
| Telegram non invia | token non valido | verifica `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

## File generato
- `/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/workflows/45-engagement-agent.json`
- Status: **READY FOR IMPORT**
- Version: n8n 2.21.5
