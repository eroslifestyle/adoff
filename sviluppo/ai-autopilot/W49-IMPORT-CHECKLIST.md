# W49 Import Checklist

**Workflow:** W49 Multi-Format Content Factory  
**File:** `workflows/49-multi-format-content.json`  
**Status:** Ready for import  
**Estimated setup time:** 15 minutes

---

## Pre-Import Checks

- [ ] n8n instance running on `http://localhost:5678` (or your instance)
- [ ] Database `adoff_autopilot` accessible from n8n
- [ ] Gemini API credential available (`adoff-gemini-credential-2026`)
- [ ] Postgres credential available (`adoff-pg-autopilot-credential-1234`)
- [ ] `WEBHOOK_HMAC_SECRET` env var set on n8n server
- [ ] `content_seeds` table exists with `perf_score` column
- [ ] `gemini_copy_drafts` table exists

---

## Step 1: Database Migration

Run migration to add new asset_type values:

```bash
psql -U postgres -d adoff_autopilot -f \
  desenvolvp/ai-autopilot/database/migrations/w49-multi-format-asset-types.sql
```

**Expected output:**
```
BEGIN
SELECT 1
ALTER TABLE
CREATE INDEX
COMMIT
```

Verify constraint:
```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'gemini_copy_drafts' AND constraint_name = 'check_asset_type';
```

---

## Step 2: Import Workflow in n8n

1. Open n8n UI: http://localhost:5678/workflows
2. Click **+ Create New**
3. Select **Import from file**
4. Choose `workflows/49-multi-format-content.json`
5. Click **Import**
6. n8n auto-creates all 23 nodes and connections

---

## Step 3: Verify Credentials

After import, check credential references:

1. Go to Workflow → node **"Gemini 2.5 Flash (multi-format)"**
2. Verify credential: `adoff-gemini-credential-2026`
3. Go to node **"Fetch top-performing seeds (schedule)"**
4. Verify credential: `adoff-pg-autopilot-credential-1234`
5. Go to node **"Postgres INSERT gemini_copy_drafts"**
6. Verify credential: `adoff-pg-autopilot-credential-1234`

If credentials are missing:
- Create them in n8n: **Settings → Credentials**
- Add connection strings, API keys
- Re-assign in workflow nodes

---

## Step 4: Set Environment Variables

On n8n server (`.env` or startup script):

```bash
WEBHOOK_HMAC_SECRET=<your-hex-encoded-secret>
DEV_MODE=false  # Set to "true" for testing (skips HMAC validation)
```

To generate a random hex secret:
```bash
openssl rand -hex 32
```

Example:
```bash
WEBHOOK_HMAC_SECRET=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
```

---

## Step 5: Activate Workflow

1. Open W49 in n8n
2. Toggle **Active** switch to ON (top right)
3. Both triggers activate:
   - Webhook `/multi-format-create` (immediate requests)
   - Schedule (every 6 hours)

---

## Step 6: Smoke Test

### Test 6.1: Webhook with valid HMAC

```bash
#!/bin/bash
set -e

SECRET_HEX="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"  # Use actual secret
CONCEPT="navigazione online senza interruzioni di pubblicità"
BODY=$(cat <<EOF
{
  "concept": "$CONCEPT",
  "formats": ["thread"],
  "langs": ["it"],
  "platforms": ["twitter"]
}
EOF
)

# Calculate HMAC-SHA256
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$SECRET_HEX" -hex | cut -d' ' -f2)

# POST to webhook
curl -X POST "http://localhost:5678/webhook/multi-format-create" \
  -H "Content-Type: application/json" \
  -H "X-AdOff-Signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected response:**
```json
{
  "ok": true,
  "asset_type": "thread",
  "lang": "it",
  "platform": "twitter",
  "rows_inserted": 1
}
```

### Test 6.2: Invalid HMAC (should fail)

```bash
curl -X POST "http://localhost:5678/webhook/multi-format-create" \
  -H "Content-Type: application/json" \
  -H "X-AdOff-Signature: invalidsignature" \
  -d '{"concept": "test", "formats": ["thread"], "langs": ["it"]}'
```

**Expected response (HTTP 401):**
```json
{
  "ok": false,
  "error": "invalid_signature"
}
```

### Test 6.3: Check database row

```sql
SELECT id, workflow, asset_type, platform, lang, status, created_at
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow = 'w49-multi-format'
ORDER BY created_at DESC LIMIT 1;
```

**Expected output:** 1 row with `asset_type = 'thread'`, `status = 'draft'`

### Test 6.4: Schedule trigger (manual)

1. Open W49 in n8n
2. Click node **"Schedule (every 6h)"**
3. Click **Test node**
4. Expect: 3 payloads generated (round-robin format assignment)
5. Check logs for seed IDs

---

## Step 7: Monitor Logs

Monitor execution logs in n8n:

```bash
# Watch n8n logs in real-time
docker logs -f n8n  # if running in Docker

# Or tail file logs (depends on your setup)
tail -f ~/.n8n/logs/*.log
```

Look for:
- `[w49] multi-format rejected` = brand guard violation
- `WEBHOOK_HMAC_SECRET not configured` = missing env var
- Database insert errors = connection issue

---

## Step 8: Test All 4 Formats

Send separate webhook requests for each format:

### Thread
```json
{"concept": "privacy online", "formats": ["thread"], "langs": ["it"], "platforms": ["twitter"]}
```

### Carousel
```json
{"concept": "privacy online", "formats": ["carousel"], "langs": ["it"], "platforms": ["instagram"]}
```

### Reel Script
```json
{"concept": "privacy online", "formats": ["reel_script"], "langs": ["it"], "platforms": ["tiktok"]}
```

### YouTube Short
```json
{"concept": "privacy online", "formats": ["short_script"], "langs": ["it"], "platforms": ["youtube"]}
```

Check database for 4 rows with different `asset_type` values.

---

## Step 9: Validate Output Schemas

Query database and inspect `body` JSON:

```sql
SELECT asset_type, body
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow = 'w49-multi-format'
ORDER BY created_at DESC
LIMIT 4;
```

For each format, verify schema:

**Thread:**
```json
{"hook_tweet": "...", "body_tweets": [...], "conclusion_tweet": "...", "hashtags": [...]}
```

**Carousel:**
```json
{"cover": {...}, "slides": [...], "final_cta_slide": {...}}
```

**Reel Script:**
```json
{"hook_seconds_0_3": "...", "body_beats": [...], "cta_seconds_last_3": "...", "music_brief": "..."}
```

**YouTube Short:**
```json
{"hook": "...", "narrative_beats": [...], "cta": "...", "title_60char": "...", "description_140char": "...", "tags": [...]}
```

---

## Step 10: Production Deployment

- [ ] Test all 4 formats in staging
- [ ] Verify cost (should be ~$0.025 per full cycle)
- [ ] Monitor schedule trigger (first execution after 6h)
- [ ] Check error logs for brand guard rejections
- [ ] Prepare rollback plan (disable workflow, revert DB migration)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `WEBHOOK_HMAC_SECRET not configured` | Set env var on n8n server, restart n8n |
| `invalid_signature` | Verify secret hex string matches, recalculate HMAC |
| `Table not found` | Run migration: `w49-multi-format-asset-types.sql` |
| `asset_type violates CHECK` | Old constraint exists, run migration |
| Gemini API 403 | Check API key credential, quotas |
| No rows inserted | Check brand guard console logs, might be hitting violation |
| Schedule not running | Check n8n scheduler config, verify workflow is Active |

---

**Estimated time to production:** ~2 hours (with full testing)  
**Support:** Check logs, review docs/W49-MULTI-FORMAT-CONTENT.md
