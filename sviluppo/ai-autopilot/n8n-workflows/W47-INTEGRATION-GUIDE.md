# W47 Content Seed Refresher — Integration Guide

## Overview

W47 is a new n8n workflow that **automatically injects fresh content seeds into AdOff's strategy**, addressing the Gemini API audit caveat: *"requires periodic injection of new strategic concepts from human"*.

The workflow runs **daily at 03:30 UTC** (before W41 learning loop at 04:00, before W00 orchestrator at 05:00) and:
1. Diagnoses tired seeds (used >5x or low performance)
2. Discovers fresh ideas from news, competitors, trending topics
3. Generates new seeds via Gemini Pro
4. Filters violations (brand names, size leaks), deduplicates
5. Inserts into DB with neutral performance score (tuned by W41)
6. Reports to Telegram ops channel

## Files Included

| File | Purpose |
|------|---------|
| `workflows/47-content-seed-refresher.json` | Complete n8n workflow (21 nodes, 22 connections) |
| `../docs/W47-CONTENT-SEED-REFRESHER.md` | Full technical documentation |
| `../scripts/setup-w47-db.sql` | SQL setup for required tables + indexes |
| `../scripts/w47-smoke-test.py` | Python helper: verify DB + test data + health check |

## Quick Start (5 minutes)

### 1. Verify Database Setup
```bash
# Option A: Run Python helper (auto-detects DB from env)
cd /home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/ai-autopilot/scripts
python3 w47-smoke-test.py --full

# Option B: Manual SQL (if you prefer)
psql -h localhost -U n8n adoff_autopilot < setup-w47-db.sql
```

Expected output:
```
✓ Tables created/updated
✓ Test data inserted
✓ content_seeds: 1+ rows
✓ news_events: 1+ rows
✓ competitor_activity: 1+ rows
✓ All checks passed. W47 ready for workflow import.
```

### 2. Set Environment Variables in n8n

In **n8n UI → Settings → Environment Variables**, add:

```
GEMINI_API_KEY=gsk_xxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=5123456789:ABCDEFGHIJKLMNOPabcdefg_hijklmn
TELEGRAM_CHAT_ID=-123456789
```

Where:
- `GEMINI_API_KEY` — from Google Cloud (get at console.cloud.google.com, APIs & Services → Credentials)
- `TELEGRAM_BOT_TOKEN` — from your Telegram bot (@BotFather)
- `TELEGRAM_CHAT_ID` — Telegram group ID where you want reports (negative = private group)

### 3. Import Workflow into n8n

1. **n8n UI → Workflows → Import**
2. **Upload JSON** → select `47-content-seed-refresher.json`
3. **Check credential placeholders**: find `PLACEHOLDER_PG_CREDENTIAL` nodes and **select your Postgres credential**
   - All 8 DB nodes use `{{ "postgres": { "id": "PLACEHOLDER_PG_CREDENTIAL", ... } }}`
   - Replace with your actual n8n Postgres credential
4. **Activate workflow** (toggle in top-right)
5. **Schedule verification**: confirm cron is set to `30 3 * * *` (03:30 UTC daily)

### 4. Manual Test Trigger

```bash
# Trigger workflow manually via Webhook
curl -X POST http://n8n-host:5679/webhook/seed-refresh-now \
  -H "Authorization: Bearer <YOUR_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected Telegram message:
```
Seed Refresher 2026-05-20:
1 seed attivo, 0 disattivati, 0 nuovi generati (no sources).
Top new: 'none'
```

(0 new seeds expected on first run if news_events, competitor_activity are empty. This is OK.)

## Architecture Overview

### Daily Execution Order (n8n workflows)

```
03:30 UTC  W47 Content Seed Refresher  ← NEW
           ├─ Phase A: diagnose tired seeds
           ├─ Phase B: discover sources (news, competitors, trending)
           ├─ Phase C: generate via Gemini Pro
           ├─ Phase D: filter violations, insert fresh seeds
           ├─ Phase E: mark sources used
           └─ Phase F: Telegram report

04:00 UTC  W41 Learning Loop  (existing)
           └─ Tune perf_score of seeds based on content engagement

05:00 UTC  W00 Master Orchestrator  (existing)
           └─ Distribute seeds to content factory (W03+)
```

**Result**: Each day, W47 adds 8-15 fresh seeds; W41 tunes performance; W00 feeds campaigns. Cycle repeats.

### Data Flow

```
news_events (from W06 newsjacking watcher)
competitor_activity (from W05 competitor watch)
marketing_config (manual: hashtags)
              ↓
         [W47 Discover]
              ↓
         [Gemini Pro]
              ↓
content_seeds (perf_score=0.5, active=true)
         ↓
[W41 Learning Loop] → tunes perf_score
         ↓
[W00 Orchestrator] → selects top seeds
         ↓
[W03+ Content Factory] → generates content
         ↓
social_posts → [W02 Crosspost Hub] → TikTok, IG, FB, etc.
```

## Safeguards

W47 implements **hard constraints** to ensure brand compliance and fraud protection:

| Guard | Implementation |
|-------|---|
| **No brand names** | Regex match + regex.test() on seed output. Brand names: YouTube, Google, Facebook, Instagram, TikTok, Amazon, Twitch, Reddit, Twitter/X |
| **No size leaks** | Regex match '149 KB', '138 KB', '150 KB' variants. Audit requirement. |
| **Dedup** | Semantic similarity (simple: lowercase + stopword removal + normalize). Prevents redundant seeds. |
| **Hard cap** | Max 20 seeds per run. Prevents flood on malicious or buggy Gemini response. |
| **Idempotent** | Tracks `used = true` on news/competitor sources. Won't re-mine same ideas. |
| **Cost limit** | ~$0.16/run (est. $5/month). Monitor Gemini billing. |

## Monitoring & Alerts

### Daily Telegram Report

Each run sends a summary to your ops Telegram channel:
```
Seed Refresher 2026-05-20:
30 seed attivi, 5 disattivati (tired/low-perf), 15 nuovi generati (8 educational, 4 emotional, 3 tactical).
Top new: 'come bloccare popup invasivi nei video gaming'
```

### Execution Logs

Check n8n UI:
```
Workflows → W47 Content Seed Refresher → Executions tab
  → Click latest run
  → Expand "Final summary" node
  → View stats (inserted count, violations, etc.)
```

### Alert Conditions (Recommended Setup)

Set up alerts in n8n or external monitoring:
- Workflow status = FAILED (API error, DB down)
- `phase_d.inserted < 5` (source discovery degraded)
- `phase_d.violations > 3` (prompt safety issue)

## Troubleshooting

| Issue | Debug | Fix |
|-------|-------|-----|
| **Workflow fails on Gemini API call** | Check error in Phase C node | Verify `GEMINI_API_KEY` in Settings → Env Vars |
| **No Telegram message** | Check Phase F logs | Verify `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` are correct |
| **0 seeds inserted (but no violations)** | Check Phase D: `after_dedup` count | Likely 100% dedup hit existing seeds; normal. Check if seed pool is saturated. |
| **Too many violations** | Check Phase D violations array | Gemini may be breaking brand constraints. Review prompt in build-gemini-prompt node. |
| **DB connection fails** | Check postgres credential in nodes | Ensure Postgres credential is selected on all 8 DB nodes (not PLACEHOLDER) |
| **Slow execution (>60s)** | Check Phase B queries | Add indexes: `CREATE INDEX idx_content_seeds_active_perf ON content_seeds(active, perf_score);` |

## Advanced Tuning

### Aggressive Growth vs Maintenance

W47 auto-detects seed shortage and switches modes:

- **aggressive_growth** (if <30 active seeds): target_new_seeds = 15/run
- **maintenance** (if ≥30 active seeds): target_new_seeds = 8/run

To override: edit "Phase A: Diagnose mode" code node:
```javascript
const target_new_seeds = 12; // force 12/run
```

### Adjust Gemini Temperature

Default temperature = 0.7 (balanced creativity). To tune:
1. Open "Phase C: Build Gemini prompt" node
2. Change `temperature: 0.7` to:
   - `0.3` = deterministic (faster, less creative)
   - `0.9` = very creative (slower, more risky)

### Custom Brand Guard

Edit "Phase D: Filter & dedup" code node:
```javascript
const brand_pattern = /youtube|google|facebook|instagram|.../gi;
```

Add/remove brands as needed.

### Hashtag Updates

Instead of manual SQL, update via code:
1. Open "Phase B: Get trending hashtags" node
2. Modify query to fetch from a live source (Twitter API, TikTok API, etc.)

## Cost & Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **Daily runs** | 1 (03:30 UTC) + manual | 365 scheduled + occasional manual |
| **Seeds per run** | 8-15 | Depends on mode (aggressive vs maintenance) |
| **Execution time** | 15-30s | Mostly Gemini API latency |
| **Gemini tokens per run** | ~2000 | ~$0.16 cost per run |
| **Monthly cost** | ~$5 | 1 run/day × 30 days × $0.16 |
| **DB storage** | ~100KB/month | Grows with seed history (no auto-delete) |

## Gotchas & Edge Cases

1. **Empty news/competitor tables** → W47 generates seeds anyway (uses defaults). First run may yield 0 new seeds if sources are cold. This is normal; W05/W06 populate sources over time.

2. **High dedup rate** → If >80% seeds deduplicated, check if seed pool is saturated. Consider longer topic_tag diversity or reset low-perf seeds manually.

3. **Gemini rate limits** → If hitting API quota, check:
   - Google Cloud → APIs → Quotas → Generative AI API
   - Increase quota or switch to `gemini-1.5-flash` (cheaper fallback in code)

4. **Telegram webhook timeout** → If Telegram is slow, increase timeout in "Phase F: Send Telegram report" HTTP node from 15000ms to 30000ms.

## Next Steps

### Week 1: Observe
- Let W47 run daily for 7 days
- Monitor Telegram reports (should see 8-15 seeds/day)
- Check W41 learning: are new seeds being evaluated?
- Verify no violations logged

### Week 2+: Optimize
- If seeds aren't resonating (perf_score stays 0.5), adjust Gemini prompt or angle distribution
- If brand violations appear, update regex in Phase D
- If cost exceeds budget, consider switching to `gemini-1.5-flash` or reducing run frequency

## Support

- **Technical docs**: `docs/W47-CONTENT-SEED-REFRESHER.md`
- **SQL setup**: `scripts/setup-w47-db.sql`
- **Smoke test**: `scripts/w47-smoke-test.py`
- **Workflow file**: `workflows/47-content-seed-refresher.json`

---

**Status**: Ready for production  
**Last Updated**: 2026-05-20  
**Next Review**: 2026-06-20 (monthly health check)
