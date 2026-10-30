# W25 Intelligent Approval Gate — Implementation Guide

## Cambio Architetturale
W25 evolve da **100% manual approval** → **Intelligent Approval Gate** con Gemini Flash scoring + auto-approve loop.

### Nuovi Componenti
- **Auto-approve loop** (Schedule ogni 10 min)
  - Query 20 draft candidati (status='draft', brand_guard_ok=true, asset_type IN ['caption_social','ad_copy','landing_section','email_drip'])
  - Gemini 2.5 Flash score su 5 dimensioni (brand_alignment, tone, clarity, engagement, risk)
  - Decision tree: auto_approve (score≥threshold) | needs_review (70-89) | reject (<70)
  - DB update con approval_score, auto_approved flag, brand_guard_reason
- **Dispatch logic** (Schedule ogni 30 min — esistente)
  - Ora legge `status='approved'` (sia manual che auto) da gemini_copy_drafts
  - INSERT in posts_queue con source_draft_id linkage
- **Throttle**: 2s tra LLM richieste (rate limiting Gemini)
- **Metric**: Daily auto_approve_rate tracker (alert se <50/giorno)

## Pre-Requisiti
1. **DB Columns**:
   - `gemini_copy_drafts.auto_approved` (BOOLEAN)
   - `gemini_copy_drafts.approval_score` (INT 0-100)
   - `gemini_copy_drafts.brand_guard_reason` (TEXT)
   - `posts_queue.source_draft_id` (BIGINT FK)
   ```bash
   psql adoff_autopilot < sviluppo/ai-autopilot/sql-scripts/migrate-w25-autoapprove.sql
   ```

2. **Env Variables**:
   - `ADOFF_AUTO_APPROVE_THRESHOLD` (default 90)
   - `TELEGRAM_BOT_TOKEN` (existing)
   - `TELEGRAM_CHAT_ID` (existing)
   - `WEBHOOK_HMAC_SECRET` (existing)

3. **Gemini Credential**:
   - Cred name: `adoff-gemini-credential-2026`
   - Tipo: HTTP Header Auth (`Authorization: Bearer <API_KEY>`)
   - API key in `/opt/n8n/.env` come `ADOFF_GEMINI_KEY` (o in secrets)

## Smoke Test

### Step 1: Load test data
```bash
psql adoff_autopilot -f sviluppo/ai-autopilot/sql-scripts/migrate-w25-autoapprove.sql
```

Verifica:
```sql
SELECT id, asset_type, body, status, approval_score, auto_approved
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow = 'w25-test'
ORDER BY id;
-- Atteso: 3 draft, tutti status='draft', approval_score=NULL
```

### Step 2: Import workflow
1. N8N UI → Workflows → Import → `25-approve-publish-drafts.json`
2. Aggiorna credenziali (replace PLACEHOLDER_*):
   - `PLACEHOLDER_PG_CREDENTIAL` → `adoff-pg-autopilot`
   - `PLACEHOLDER_GEMINI_CREDENTIAL` → `adoff-gemini-credential-2026`
3. Enable workflow (toggle Active)

### Step 3: Execute auto-approve loop manualmente
1. N8N UI → Open workflow
2. Select node `Schedule every 10 min (auto-approve loop)` → Execute Node
3. Atteso:
   - **Draft 1** (perfetto): `auto_approved=true, status='approved', approval_score=85-95, reason='Alta qualità, tono energico'`
   - **Draft 2** (borderline): `status='needs_review', approval_score=70-80, reason='Chiarezza mediocre'` + Telegram alert ⚠️
   - **Draft 3** (brand leak): `status='rejected', approval_score=40-50, reason='Brand YouTube citato, leak "149 KB"'`

### Step 4: Verifica DB post-execution
```sql
SELECT id, status, approval_score, auto_approved, brand_guard_reason
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow = 'w25-test'
ORDER BY id;
```

### Step 5: Verifica posts_queue dispatch (Schedule 30 min)
1. Esegui node `Schedule every 30 min` manualmente
2. Atteso: INSERT in posts_queue con source_draft_id=1 (il draft auto-approved)
3. Check:
```sql
SELECT id, source_draft_id, asset_type, body, workflow FROM adoff_autopilot.posts_queue
WHERE source_draft_id IS NOT NULL ORDER BY id DESC LIMIT 1;
```

## Behavior Specification

### Auto-Approve Decision Tree
```
score ≥ threshold (default 90) AND recommendation='auto_approve'
  → status='approved', auto_approved=true, approved_by='gemini-flash-auto'
  → Incluso in prossimo dispatch verso posts_queue

70 ≤ score < threshold OR recommendation='needs_human'
  → status='needs_review', approval_score=score
  → Telegram alert: ⚠️ Draft needs human review
  → Attesa approvazione manuale via webhook

score < 70 OR recommendation='reject'
  → status='rejected', approval_score=score, brand_guard_reason=reasoning
  → No Telegram (considerato fallimento LLM, archiviato)

Escalation errors (parse Gemini, timeout)
  → status='needs_review', escalate_reason='gemini_response_parse_failed'
  → Telegram alert: 🚨 Draft escalation
```

### Rate Limiting
- Max **20 draft per loop** (10 min trigger)
- **2 sec throttle** tra LLM richieste
- **Max 100 auto-approve/giorno** (hard cap, can be lowered)
- Metric alert se auto_approve_rate < 50/giorno

### Manual Override
Webhook `/draft-approve` (HMAC-authed) ancora funzionante:
```bash
curl -X POST http://localhost:5678/webhook/draft-approve \
  -H "X-AdOff-Signature: <hmac>" \
  -H "Content-Type: application/json" \
  -d '{"draft_id": 123, "action": "approve"}'
```
Bypassa LLM, aggiorna DB direttamente.

## Monitoring

### Logs
- N8N UI → Executions → Select `Schedule every 10 min (auto-approve loop)` run
- Visualizza ogni step: DB fetch, LLM call, decision, DB update, Telegram alert

### Metrics
Daily auto_approve_rate:
```sql
SELECT
  DATE(approved_at) as day,
  COUNT(*) FILTER (WHERE auto_approved=true) as auto_approved_count,
  COUNT(*) FILTER (WHERE auto_approved=false) as manual_approved_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE auto_approved=true) / NULLIF(COUNT(*), 0),
    1
  ) as auto_approve_pct
FROM adoff_autopilot.gemini_copy_drafts
WHERE status='approved' AND approved_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(approved_at)
ORDER BY day DESC;
```

## Rollback Plan
Se LLM scoring si dimostra instabile:
1. Disabilita loop: `Disable node "Schedule every 10 min (auto-approve loop)"` in N8N UI
2. Revert a workflow v1.0 (100% manual): commit git precedente
3. Draft rimasti in 'needs_review' vanno approvati manualmente via webhook

## Future Enhancements
- Feedback loop: track manual approvals vs LLM per re-calibration threshold
- A/B test threshold (90 vs 85) per ottimizzare recall
- Fine-tune Gemini system prompt per AdOff-specific scoring
- Integra con posts_queue scheduler per best-time-to-post per platform/lang
