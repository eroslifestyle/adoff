# W00 Master Orchestrator — Complete Documentation Index

## Quick Links

| Document | Purpose |
|---|---|
| **W00-EXECUTIVE-SUMMARY.md** | High-level overview, features, architecture, next steps |
| **W00-IMPORT-CHECKLIST.md** | Step-by-step import guide, smoke tests, troubleshooting |
| **W00-SMOKE-TEST-REPORT.md** | Detailed test plan, execution flow, metrics |
| **00-master-orchestrator.json** | Workflow file (n8n 2.21.5 format, ready to import) |

## What is W00?

**W00 Master Strategy Orchestrator** is the "daily regista" that automatically orchestrates the complete AdOff content generation pipeline:

```
Config → Topic Selection → Strategy → Copy Generation → Approval → Reporting
```

Runs **every day @ 05:00 UTC** OR on-demand via **webhook POST /orchestrator-run-now**.

## Key Facts

- **24 nodes**, 7 sub-workflow calls
- **~110–130 sec** execution time
- **~$0.80/run** cost (Gemini API)
- **3 topics + 5 languages** per day
- **100+ captions** generated daily
- **Kill-switch protection** + idempotency guard
- **DRY_RUN mode** for testing (zero side-effects)

## Architecture

```
W00 Orchestrator
  ├── W28: Config Loader (brand rules, language perf)
  ├── W27: Idempotency Check (max 1 run/day)
  ├── W29: HMAC Auth (webhook security)
  ├── W22: Gemini Strategy (30-day plan)
  ├── W20: Gemini Copy Writer (captions, hashtags)
  ├── W25: Approval Gate (draft queue)
  └── W30: Telegram Reporter (daily alerts)
```

## Flows

### Happy Path (Production)
1. Schedule fires @ 05:00 UTC OR webhook received + HMAC validated
2. Kill-switch check (skip if disabled)
3. Load config + check idempotency
4. Pick topics (70% top performers + 30% fresh)
5. Pick languages (top 5 + IT + EN)
6. Generate 30-day strategy (Gemini)
7. Loop calendar entries for today
8. Generate captions per lang/platform (Gemini)
9. Store drafts + queue for approval
10. Update topic metrics + send Telegram report

### Dry-Run Mode (Testing)
Same flow but:
- Zero DB writes
- Zero sub-workflow calls
- Returns plan-only JSON
- No cost incurred

### Error Handling
- Non-blocking sub-workflow failures
- Logged to Telegram + DB
- Continues to next step
- Doesn't halt pipeline

## Getting Started

### 1. Read Overview
Start with **W00-EXECUTIVE-SUMMARY.md** (5 min read)

### 2. Import Workflow
Follow **W00-IMPORT-CHECKLIST.md** step-by-step:
- Copy JSON to n8n instance
- Verify sub-workflow IDs
- Configure credentials
- Set environment variables

### 3. Run Smoke Tests
Use the 4 test scenarios in import checklist:
- Kill-switch check
- DRY_RUN mode (zero side-effects)
- Idempotency (max 1 run/day)
- Manual execution

### 4. Go Live
Enable schedule + activate workflow

## Environment Variables

```bash
W28_WORKFLOW_ID=<workflow-id>
W27_WORKFLOW_ID=<workflow-id>
W22_WORKFLOW_ID=<workflow-id>
W20_WORKFLOW_ID=<workflow-id>
W25_WORKFLOW_ID=<workflow-id>
W29_WORKFLOW_ID=<workflow-id>
W30_WORKFLOW_ID=<workflow-id>

ORCHESTRATOR_DRY_RUN=false  # Set to 'true' for testing
```

## Database Tables Used

| Table | Operation | Purpose |
|---|---|---|
| `workflow_kill_switch` | SELECT | Check if W00 should run |
| `marketing_config` | SELECT | Load brand/language rules |
| `content_seeds` | UPDATE | Track topic usage |
| `gemini_copy_drafts` | INSERT | Store generated captions |

## Monitoring

### Healthy Run Indicators
- ✅ Telegram message arrives daily @ 05:05 UTC
- ✅ `gemini_copy_drafts` table populated (15 captions/day)
- ✅ `content_seeds.used_count` incremented
- ✅ Execution time 110–130 sec
- ✅ All 24 nodes complete without error

### Troubleshooting Guide
See **W00-IMPORT-CHECKLIST.md** "Troubleshooting" section

## Features Checklist

- [x] Daily schedule (cron 05:00 UTC)
- [x] Manual webhook trigger (HMAC auth)
- [x] Kill-switch protection
- [x] Idempotency guard (max 1 run/day)
- [x] Topic selection (70% top + 30% fresh)
- [x] Language optimization (top 5 + always IT/EN)
- [x] Strategy generation (Gemini 30-day plan)
- [x] Multi-language copy (Instagram/Facebook/TikTok)
- [x] Draft storage + approval queue
- [x] Metrics tracking (topic usage)
- [x] DRY_RUN mode (testing)
- [x] Error handling (non-blocking)
- [x] Telegram reporting (daily alerts)

## Files

```
workflows/
  └── 00-master-orchestrator.json    (516 lines, n8n 2.21.5 format)

docs/
  ├── W00-README.md                  (this file)
  ├── W00-EXECUTIVE-SUMMARY.md       (overview + features)
  ├── W00-IMPORT-CHECKLIST.md        (import guide + tests)
  └── W00-SMOKE-TEST-REPORT.md       (detailed test plan)
```

## Support

- **Import issues**: Check W00-IMPORT-CHECKLIST.md troubleshooting
- **Execution logs**: View in n8n UI → Executions tab
- **Sub-workflow errors**: Check individual W28, W27, W22, W20, W25, W29, W30 logs
- **Database issues**: Verify Postgres connection + table structure
- **Gemini API issues**: Check API quota + key validity

## Next Steps

1. **Read**: W00-EXECUTIVE-SUMMARY.md
2. **Import**: W00-IMPORT-CHECKLIST.md (step 1-6)
3. **Test**: W00-IMPORT-CHECKLIST.md (smoke tests)
4. **Monitor**: Check Telegram alerts + database

---

**Created**: 2026-05-21  
**Status**: ✅ Ready for production  
**Version**: n8n 2.21.5  
**Support**: Check execution history in n8n UI for logs
