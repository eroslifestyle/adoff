# W50 — Visual Asset Pipeline

**Status**: Ready for import  
**Version**: 1.0.0  
**Date**: 2026-05-20  
**Workflow ID**: `ADOFF50VISUALPIPELINE1`

---

## Overview

W50 bridges the gap between **text generation** (W00→W20) and **publication** (W02/W03). After Gemini generates approved captions, W50 automatically creates platform-specific visuals:

- **TikTok**: Video via cyber-purge (W15 HTTP bridge)
- **Instagram**: Image 1080×1350 via W98 image generator
- **Facebook**: Image 1200×630 via W98
- **Twitter**: Image 1200×675 via W98
- **LinkedIn**: Professional image 1200×627 via W98
- **Text-only platforms** (Bluesky, Mastodon, Reddit): Skip visual, mark as `visual_skipped`

---

## Architecture

### Triggers

1. **Webhook `/visual-asset-create`** (POST)
   - **Path**: `POST /webhook/visual-asset-create`
   - **Auth**: HMAC-SHA256 signature validation (X-AdOff-Signature header)
   - **Payload**:
     ```json
     {
       "draft_id": 123,
       "asset_type": "caption_social",
       "platform": "instagram",
       "lang": "it",
       "concept": "c1-story-arc",
       "caption_preview": "..."
     }
     ```
   - **Response**: `{ ok: true, media_id: ..., status: "generated" }`

2. **Schedule Trigger** (every 10 minutes)
   - Polls `gemini_copy_drafts` for `status='approved'` AND `asset_type='caption_social'`
   - Excludes drafts already in `media_queue`
   - Processes up to 10 drafts per cycle

### Processing Flow

```
┌─ Webhook or Schedule ─────────┐
│                               │
├─ Validate HMAC (webhook only) │
├─ Fetch approved drafts        │
├─ Normalize input              │
├─ Route by platform ──────┬────┴─────────┬──────────┬──────────┬─────────┐
│                          │              │          │          │         │
├─ TikTok Video           ├─ Instagram    ├─ Facebook├─ Twitter ├─LinkedIn
│  cyber-purge            │  (1080×1350)  │ (1200×630)(1200×675)│(1200×627)
│  (W15 bridge)           │  (W98)        │ (W98)    │ (W98)    │ (W98)
│                          │              │          │          │
├─ Parse responses         │              │          │          │
├─ Merge context           │              │          │          │
├─ INSERT media_queue ─────┴──────────────┴──────────┴──────────┴─────────┘
├─ UPDATE posts_queue
└─ Respond webhook (200)
```

### Database Schema

**Table**: `adoff_autopilot.media_queue`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | BIGSERIAL | PK | Auto-increment |
| `draft_id` | BIGINT | FK(gemini_copy_drafts) | Reference to source draft |
| `platform` | TEXT | CHECK IN (...) | tiktok, instagram, facebook, twitter, linkedin, bluesky, mastodon, reddit |
| `media_type` | TEXT | CHECK IN (...) | image, video, carousel |
| `media_path` | TEXT | NULL | Local path: `/tmp/media/adoff-ig-xxx.jpg` |
| `media_public_url` | TEXT | NULL | Public URL (S3, CDN, etc.) |
| `job_id` | UUID | NULL | Reference to `image_queue.job_id` (async polling) |
| `prompt_used` | TEXT | NULL | FLUX/image generator prompt |
| `dimensions` | TEXT | NULL | e.g., "1080x1350" |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | pending, generating, generated, failed |
| `error` | TEXT | NULL | Error message if failed |
| `retry_count` | INT | DEFAULT 0 | Number of retry attempts |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| `completed_at` | TIMESTAMPTZ | NULL | When generation finished |
| **Unique** | | UNIQUE(draft_id, platform) | One media asset per draft per platform |

**Indexes**:
- `idx_media_queue_draft_id` — lookup by source draft
- `idx_media_queue_platform_status` — efficient querying by platform + status
- `idx_media_queue_status` — monitor pending/generating/failed
- `idx_media_queue_job_id` — track async image generation jobs

---

## Integration Points

### Upstream: `gemini_copy_drafts`

W50 queries:
```sql
SELECT id, body, platform, lang, concept, asset_type 
FROM adoff_autopilot.gemini_copy_drafts 
WHERE status='approved' AND asset_type='caption_social' 
AND NOT EXISTS (SELECT 1 FROM adoff_autopilot.media_queue m WHERE m.draft_id=...)
LIMIT 10;
```

**Condition**: Fetches only approved drafts **without** a corresponding media_queue entry.

### Downstream: `posts_queue`

W50 updates after media generation:
```sql
UPDATE adoff_autopilot.posts_queue 
SET media_path=$1, updated_at=NOW() 
WHERE source_draft_id=$2 AND media_path IS NULL;
```

This allows W02/W03 (Social Crosspost Hub / Posts Dispatcher) to include the visual asset when publishing.

### External: FLUX & Image Generators

| Platform | Service | Endpoint | Notes |
|----------|---------|----------|-------|
| TikTok | cyber-purge (W15) | `http://host.docker.internal:8792/build/cyber-purge` | HTTP POST, timeout 1500s, returns `{ ok, output: { video: '...' } }` |
| Instagram | W98 image-gen | `http://localhost:5678/webhook/image-gen` | Enqueue job, returns `job_id` (async polling via W98 status endpoint) |
| Facebook | W98 image-gen | Same as above | Same async pattern |
| Twitter | W98 image-gen | Same as above | Same async pattern |
| LinkedIn | W98 image-gen | Same as above | Same async pattern |

**cyber-purge parameters**:
```json
{
  "lang": "it|en|de|fr|es|pt",
  "concept": "c1-story-arc|...",
  "force": false,
  "no_logo_variant": true
}
```

---

## Concurrency Control

### Rate Limiting

- **TikTok video rendering**: Max 3 concurrent (CPU/RAM intensive)
- **Image generation**: Max 5 concurrent (per W98 queue size)
- **Total W50 executions**: Schedule every 10 min, webhook throttled by N8N

### Retry Logic

- On FLUX/image-gen failure: Retry up to **3 times** before marking `status='failed'`
- On timeout (>1500s for video, >30s for image): Log error, increment retry_count, re-enqueue in next cycle
- On media_queue INSERT conflict: Use `ON CONFLICT ... DO UPDATE` to idempotently update existing records

---

## Error Handling

### Graceful Degradation

1. **FLUX video generation fails** → Set `status='failed'`, log error, notify Telegram (W30)
2. **Image gen timeout** → Return `job_id` with `status='pending'`, next schedule cycle polls for completion
3. **Webhook HMAC invalid** → Respond 401, log invalid signature, ignore payload
4. **Platform not recognized** → Switch node default case: mark `visual_skipped=true`, don't attempt generation

### Monitoring

- Watch `media_queue.status='failed'` for failed generations
- Monitor `retry_count` to identify problematic concepts/languages
- Alert on `error LIKE '%timeout%'` for infrastructure issues

---

## Deployment Checklist

- [ ] **Migration**: Run `003-media-queue-table.sql` on `adoff_autopilot` database
  ```bash
  psql -U adoff_user -d adoff_db -f migrations/003-media-queue-table.sql
  ```

- [ ] **Verify table exists**:
  ```bash
  psql -c "\d adoff_autopilot.media_queue"
  ```

- [ ] **Import workflow**: In n8n UI, `Workflows → Import → Select 50-visual-asset-pipeline.json`

- [ ] **Configure credentials**:
  - Postgres credential `adoff-pg-autopilot-credential-1234` (must exist, used by W98/W25/etc.)
  - Environment variables:
    - `WEBHOOK_HMAC_SECRET` (hex string, 32 bytes min)
    - `TELEGRAM_BOT_TOKEN` (for error notifications)
    - `N8N_HOST` (default: `http://localhost:5678`)

- [ ] **Smoke test**: Trigger webhook via curl
  ```bash
  curl -X POST http://localhost:5678/webhook/visual-asset-create \
    -H "Content-Type: application/json" \
    -H "X-AdOff-Signature: <hmac-hex>" \
    -d '{"draft_id":1,"platform":"instagram","lang":"it","concept":"test"}'
  ```

- [ ] **Monitor**: Check `media_queue` for rows with `status='generated'`

---

## Performance Benchmarks (Expected)

| Task | Latency | Notes |
|------|---------|-------|
| Schedule fetch + normalize | ~2s | 10 drafts per cycle |
| TikTok video render | ~300-600s | Depends on cyber-purge load |
| Image gen enqueue | ~1-2s | Async, returns job_id immediately |
| Image gen poll (W98) | ~60-300s | Depends on HF space/GPU availability |
| DB INSERT media_queue | ~100ms | Batch or single |
| Webhook latency | ~500ms | HMAC validation + response |

**Total end-to-end time**: TikTok 5-10 min, images 1-5 min (queued async).

---

## Troubleshooting

### Problem: "FLUX timeout"
- **Cause**: cyber-purge bridge too slow or unreachable
- **Fix**: Check `host.docker.internal:8792` is accessible from n8n container, increase timeout or reduce language variants

### Problem: "image-gen enqueue failed"
- **Cause**: W98 webhook unreachable or queue full
- **Fix**: Verify n8n is running, check `/webhook/image-gen` endpoint in W98, reduce concurrent requests

### Problem: "media_queue has 0 rows after schedule trigger"
- **Cause**: No approved drafts OR all approved drafts already have media_queue entries
- **Fix**: Check `gemini_copy_drafts` for `status='approved'`, verify `asset_type='caption_social'`, delete old media_queue rows if testing

### Problem: HMAC validation fails on webhook
- **Cause**: Secret mismatch or invalid signature header
- **Fix**: Verify `WEBHOOK_HMAC_SECRET` env var, recalculate HMAC: `echo -n <body> | openssl dgst -sha256 -mac HMAC -macopt key:$(echo -n <secret> | xxd -p -r)`

---

## Future Enhancements

1. **Concurrency worker pool**: Dedicate N8N subworkflow for parallel media generation (limit TikTok to 3, images to 5)
2. **CDN upload**: After generation, upload media to S3/Cloudflare + set `media_public_url`
3. **A/B testing**: Generate 2 variants per draft, track performance, auto-select winner
4. **Carousel support**: Instagram carousel (5 images from 1 draft, different concepts)
5. **Brand watermark**: Optionally add AdOff logo to generated images (configurable per platform)
