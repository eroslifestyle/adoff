# Workflow W25 — Approve & Publish Gemini Drafts

**ID**: `w25-approve-publish`  
**Version**: 2.21.5  
**Status**: Active (manual trigger: webhooks + scheduled)

## Panoramica

Workflow di approval gate per draft generati da W20/21/22/23 (Gemini copywriter + strategist). Fornisce 3 webhook API + 1 schedule trigger (ogni 30 min) per:

1. **Approva/Rigetta singoli draft** → UPDATE status='approved'|'rejected'
2. **List draft con filtri** → SELECT con paginazione
3. **Bulk approve** → UPDATE multipli draft
4. **Schedule** → Distribuisci approved drafts a posts_queue (caption_social) o Telegram notify (email, ad copy, landing, plan, seo)

## Tabella: adoff_autopilot.gemini_copy_drafts

Schema aggiornato (migration 001-add-published-at.sql):

```sql
id BIGSERIAL PK
workflow TEXT              -- es. 'W20', 'W21', etc.
asset_type TEXT            -- 'caption_social' | 'email_drip' | 'ad_copy' | 'landing_section' | 'marketing_plan' | 'seo_brief'
platform TEXT              -- 'instagram' | 'facebook' | 'tiktok' | NULL (non-social)
lang TEXT                  -- 'it', 'en', 'de', etc.
concept TEXT               -- topic/brief
body JSONB                 -- { text: "...", metadata: {...} }
status TEXT DEFAULT 'draft'-- 'draft' | 'approved' | 'rejected' | 'published'
brand_guard_ok BOOLEAN     -- compliance check (Gemini)
video_master_id TEXT       -- ref video master (se caption_social)
model TEXT                 -- 'gemini-2.0-pro' | altro
tokens_in INT              -- token spesi input
tokens_out INT             -- token spesi output
created_at TIMESTAMPTZ     -- quando generato
approved_at TIMESTAMPTZ    -- quando approvato
approved_by TEXT           -- chi ha approvato
published_at TIMESTAMPTZ   -- NEW: quando pushato a sistema esterno
```

## Endpoints (Webhooks)

### 1. POST /draft-approve
Approva o rigetta un singolo draft.

**Body**:
```json
{
  "draft_id": 123,
  "approver": "mario@adoff.app",
  "action": "approve"
}
```

**Response**:
```json
{
  "ok": true,
  "draft_id": 123,
  "status": "approved",
  "message": "Draft approved successfully"
}
```

**Status**: 200 OK | 400 Bad Request (missing draft_id)

---

### 2. GET /draft-list
Fetch draft con filtri + paginazione (default 20 items, status='draft').

**Query Params**:
```
?workflow=W20&asset_type=caption_social&lang=it&status=draft&limit=20&offset=0
```
- `workflow`: filtro workflow (es. 'W20', 'W21') — optional
- `asset_type`: filtro tipo asset — optional
- `lang`: filtro lingua — optional
- `status`: filtro status (default 'draft') — optional
- `limit`: risultati per pagina (default 20, max 100)
- `offset`: offset paginazione (default 0)

**Response**:
```json
{
  "ok": true,
  "items": [
    {
      "id": 123,
      "workflow": "W20",
      "asset_type": "caption_social",
      "platform": "instagram",
      "lang": "it",
      "status": "draft",
      "body": {...},
      "created_at": "2026-05-20T10:30:00Z"
    }
  ],
  "total": 145,
  "filters": {
    "workflow": "W20",
    "asset_type": "caption_social",
    "lang": "it",
    "status": "draft",
    "limit": 20,
    "offset": 0
  }
}
```

---

### 3. POST /draft-bulk-approve
Approva più draft in un'unica richiesta.

**Body**:
```json
{
  "draft_ids": [123, 124, 125],
  "approver": "mario@adoff.app"
}
```

**Response**:
```json
{
  "ok": true,
  "count": 3,
  "message": "3 draft(s) approved successfully"
}
```

**Status**: 200 OK | 400 Bad Request (empty draft_ids)

---

## Schedule Trigger

**Ogni 30 minuti** (cron: `*/30 * * * *`):

1. **Fetch** da DB: `SELECT * FROM gemini_copy_drafts WHERE status='approved' AND published_at IS NULL`
2. **Group by asset_type**: distribuisci per categoria
3. **Routing**:
   - **caption_social** → POST a W14 (posts_queue) via `http://localhost:5678/webhook/social-enqueue`
   - **email_drip** → Telegram notify: "📧 Email drip — N draft ready"
   - **ad_copy** → Telegram notify: "📢 Ad copy — N draft ready"
   - **landing_section** → Telegram notify: "🏠 Landing section — N draft ready"
   - **marketing_plan** → Telegram notify: "📋 Marketing plan — N draft ready"
   - **seo_brief** → Telegram notify: "🔍 SEO brief — N draft ready"

### Telegram Notify Format

```
🎯 <asset_type>
<count> draft approved

  1. [ID 123] it — W20
  2. [ID 124] en — W21

⚠️ Copia manualmente nel rispettivo sistema.
```

---

## Data Flow

```
W20/21/22/23 (Gemini)
    ↓
INSERT INTO gemini_copy_drafts (status='draft')
    ↓
W25 Webhook: /draft-approve (human approver)
    ↓
UPDATE status='approved'
    ↓
W25 Schedule (30 min)
    ↓
    ├─→ caption_social → W14 (posts_queue webhook)
    └─→ email/ad/landing/plan/seo → Telegram notify
    
Approver vede lista nel dashboard/admin-ui → click approve → webhook → DB update
```

---

## Credenziali Required

- **`adoff-pg-autopilot-credential-1234`**: PostgreSQL autopilot (replace PLACEHOLDER_PG_CREDENTIAL in JSON)
- **`TELEGRAM_BOT_TOKEN`**: bot token Telegram (env var)
- **`TELEGRAM_CHAT_ID`**: channel/user ID Telegram (env var)

---

## Deploy & Testing

### 1. Apply migration
```bash
psql -U autopilot -d adoff_autopilot -f infra/migrations/001-add-published-at.sql
```

### 2. Import workflow in n8n
```bash
# Copy JSON to clipboard or via n8n UI: Import from file
```

### 3. Update credentials
- Set `adoff-pg-autopilot-credential-1234` (or replace placeholder in JSON)
- Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in n8n environment

### 4. Smoke test
```bash
# Create test draft
psql -U autopilot -d adoff_autopilot -c \
  "INSERT INTO gemini_copy_drafts (workflow, asset_type, platform, lang, status, body, tokens_in, tokens_out) \
   VALUES ('W20', 'caption_social', 'instagram', 'it', 'draft', '{\"text\":\"Test caption\"}'::jsonb, 100, 50) \
   RETURNING id;"

# Approve via webhook
curl -X POST http://localhost:5678/webhook/draft-approve \
  -H "Content-Type: application/json" \
  -d '{"draft_id": 1, "approver": "tester@adoff.app", "action": "approve"}'

# Check status
psql -U autopilot -d adoff_autopilot -c \
  "SELECT id, status, approved_at, approved_by FROM gemini_copy_drafts WHERE id=1;"

# List drafts
curl http://localhost:5678/webhook/draft-list?status=draft&limit=5
```

---

## Notes

- **Parametrized SQL**: tutte le query usano `operation:insert/update` con `mappingMode:defineBelow` oppure binding nella query stessa (no string concatenation)
- **No brand/prezzo**: caption_social non include nomi brand espliciti o pricing (regola AdOff CLAUDE.md)
- **Telegram notify**: per asset_type non-social, il copy deve essere copiato manualmente dall'approver nel sistema target
- **Schedule ogni 30 min**: balance tra latency (real-time) e load DB
- **published_at**: colonna NULL fino a quando il draft è pushato a un sistema esterno (W14 per caption, email system per email_drip, etc.)

---

**Last Updated**: 2026-05-20
