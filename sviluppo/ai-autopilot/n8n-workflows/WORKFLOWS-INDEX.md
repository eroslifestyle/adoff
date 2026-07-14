# N8N Workflows Index (AdOff Autopilot)

| ID | Name | Status | Triggers | Purpose |
|----|----|--------|----------|---------|
| **W00** | Master Orchestrator | Active | Manual, Schedule | Entry point: routes content generation across all pipelines |
| **W01** | Multi-Language Translator | Active | Webhook | Translates captions to 6 languages (IT, EN, DE, FR, ES, PT) |
| **W02** | Social Crosspost Hub | Active | Webhook | Publishes approved content to Meta/TikTok/Twitter/LinkedIn |
| **W03** | Posts Dispatcher (v2) | Active | Schedule | Queues approved posts for publication, integrates media assets |
| **W04** | Mention Sentinel | Active | Schedule | Monitors brand mentions across social platforms, auto-responds |
| **W05** | Competitor Watch | Active | Schedule | Tracks competitor activity for newsjacking opportunities |
| **W06** | Newsjacking Watcher | Active | Schedule | Identifies trending topics in content domain |
| **W07** | Press Cold Email Drip | Active | Schedule | Automated cold email campaign to press contacts |
| **W08** | Reddit Forum Hunter | Active | Schedule | Finds relevant Reddit discussions for engagement |
| **W09** | Quora Answer Scheduler | Active | Schedule | Auto-answers Quora questions with brand voice |
| **W10** | Warming Bot | Active | Schedule | Engagement on complementary brands' content |
| **W11** | Multilang Channel Publisher | Active | Schedule | Publishes to multi-language LinkedIn/Medium channels |
| **W12** | YouTube Factory | Active | Schedule | Generates YouTube video descriptions and hashtags |
| **W13** | YouTube Publisher | Active | Schedule | Publishes videos to YouTube channel |
| **W14** | Social Enqueue | Active | Webhook | Queues manual posts from web form |
| **W15** | Cyber-Purge Producer | Active | Manual/API | Builds video assets via cyber-purge composition engine |
| **W20** | Gemini Smart Copy | Active | Schedule | Generates captions, hooks, CTAs via Gemini API |
| **W25** | Intelligent Approval | Active | Schedule | Auto-approves/rejects drafts with brand guard AI |
| **W29** | HMAC Auth Validator | Active | Webhook Trigger | Sub-workflow: validates webhook signatures |
| **W30** | Telegram Error Notifier | Active | Error Triggers | Sends error notifications to Telegram |
| **W50** | **Visual Asset Pipeline** | **Active** | **Webhook + Schedule** | **Auto-generates images/videos for approved drafts** |
| **W98** | Image Generator | Active | Webhook | Queues image generation jobs (FLUX via HF space) |

---

## W50 — Visual Asset Pipeline (NEW)

**Status**: Ready for import  
**Delivery Date**: 2026-05-20

### What it does
- Monitors `gemini_copy_drafts` for approved captions
- Triggers image/video generation based on platform
- **TikTok**: video via cyber-purge (W15 HTTP bridge)
- **Instagram**: 1080×1350 image via W98
- **Facebook**: 1200×630 image via W98
- **Twitter**: 1200×675 image via W98
- **LinkedIn**: 1200×627 professional image via W98
- **Text-only**: Skip visual, mark as processed
- Updates `posts_queue` with media paths for W02/W03 to publish

### Triggers
1. **Webhook `/visual-asset-create`** (POST, HMAC auth)
   - Manual trigger: `POST /webhook/visual-asset-create` with HMAC signature
   - Response: `{ ok: true, media_id, status }`
   
2. **Schedule** (every 10 minutes)
   - Auto-fetch approved drafts without media_queue entries
   - Process up to 10 per cycle

### Integration
- **Upstream**: `gemini_copy_drafts` (approved captions)
- **Downstream**: `posts_queue` (adds media_path)
- **External**: cyber-purge bridge, W98 image-gen

### Database
- **New table**: `adoff_autopilot.media_queue` (migration 003)
- **Columns**: draft_id, platform, media_type, media_path, job_id, status, retry_count, error, created_at
- **Indexes**: draft_id, platform+status, status, job_id

### Files
- **Workflow**: `workflows/50-visual-asset-pipeline.json` (23 nodes, 20 connections)
- **Migration**: `infra/migrations/003-media-queue-table.sql`
- **Docs**: `docs/W50-VISUAL-ASSET-PIPELINE.md`
- **Tests**: `tests/test-w50-smoke.py` (6 tests, all passing)

### Deployment
```bash
# 1. Run migration
psql -U adoff_user -d adoff_db -f infra/migrations/003-media-queue-table.sql

# 2. Import in n8n UI
# Workflows → Import → Select 50-visual-asset-pipeline.json

# 3. Verify
curl -X POST http://localhost:5678/webhook/visual-asset-create \
  -H "Content-Type: application/json" \
  -H "X-AdOff-Signature: <hmac-hex>" \
  -d '{"draft_id":1,"platform":"instagram","lang":"it","concept":"test"}'
```

---

## Workflow Execution Flow (High-Level)

```
┌─ W00 Master Orchestrator ──────────────────────┐
│ (Entry: Manual or Schedule)                    │
├─ Route by content type ┬──────────────────┬────┴─────┬──────┐
│                        │                  │           │      │
├─ W20 Gemini Smart Copy (captions)         │           │      │
│  ├─ W01 Translator (6 langs)              │           │      │
│  ├─ W25 Intelligent Approval (brand)      │           │      │
│  └─ W50 Visual Asset Pipeline (NEW)       │           │      │
│      ├─ Schedule pickup: approved → media │           │      │
│      ├─ Route by platform                 │           │      │
│      │  ├─ TikTok → W15 cyber-purge       │           │      │
│      │  ├─ Instagram → W98 image-gen      │           │      │
│      │  ├─ Facebook → W98 image-gen       │           │      │
│      │  └─ Twitter → W98 image-gen        │           │      │
│      └─ DB: gemini_copy_drafts → media_q │           │      │
│                                            │           │      │
│  (All approved + media) ▼                  │           │      │
├─ W02 Social Crosspost (publish)           │           │      │
├─ W03 Posts Dispatcher (queue)              │           │      │
│                                            │           │      │
├─ W04-W10 Growth ops (mentions, engage)    │           │      │
└────────────────────────────────────────────┘           │      │
                                             Manual ─────┴──────┤
                                             Triggers:          │
                                             W12,W13 YouTube   │
                                             W14 Social Enqueue│
```

---

## Concurrency & Performance

- **W50 schedule**: Every 10 minutes, max 10 drafts per cycle
- **TikTok video**: ~300-600s, max 3 concurrent (CPU/RAM)
- **Image generation**: ~60-300s per image, max 5 concurrent (async queued)
- **Total E2E**: Text→approved: ~1-2 min, Media ready: +5-10 min for TikTok, +1-5 min for images

---

## Monitoring & Alerting

- Monitor `media_queue.status='failed'` for generation failures
- Check `retry_count` for problematic concepts/languages
- Alert on `error LIKE '%timeout%'` for infrastructure issues
- Telegram notifications via W30 on critical errors

---

## Future Enhancements

1. **Concurrency worker pool**: Dedicate N8N subworkflow for parallel generation
2. **CDN upload**: Upload media to S3/Cloudflare after generation
3. **A/B testing**: Generate 2 variants per draft, track performance
4. **Carousel support**: Instagram carousel (5 images per draft)
5. **Brand watermark**: Optional AdOff logo on generated images
