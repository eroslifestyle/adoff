# W00 Master Orchestrator — N8N Import Checklist

## Pre-Import Prerequisites

- [ ] N8N instance running (2.21.5+)
- [ ] Postgres addon/connection enabled
- [ ] All 7 sub-workflows exist: W28, W27, W22, W20, W25, W29, W30
- [ ] Telegram bot token configured (for W30 alerts)
- [ ] Gemini API key available (for W22/W20 calls)
- [ ] Credentials `adoff-pg-autopilot-credential-1234` set up in N8N

## Import Steps

### 1. Copy Workflow JSON to N8N
```bash
# Option A: Copy paste via UI
# Login → Workflows → Import → Select 00-master-orchestrator.json

# Option B: CLI (if available)
n8n import:workflow --input workflows/00-master-orchestrator.json
```

### 2. Verify Sub-Workflow IDs
After import, open workflow editor. For each ExecuteWorkflow node, confirm:
- [ ] n00-003-hmac-validate → references `w29-hmac-auth-validator`
- [ ] n00-007-load-config → references `w28-config-loader`
- [ ] n00-008-idempotency-check → references `w27-idempotency-check`
- [ ] n00-013-gen-strategy → references `w22-gemini-strategist`
- [ ] n00-016-gen-copy-multiline → references `w20-gemini-copy-caption`
- [ ] n00-018-queue-approval → references `w25-approve-publish-drafts`
- [ ] n00-020-telegram-report → references `w30-telegram-error-notifier`

### 3. Configure Postgres Credentials
In N8N:
- [ ] Connections → Add new Postgres credential
- [ ] Name: `adoff-pg-autopilot-credential-1234`
- [ ] Host: `[your-pg-host]`
- [ ] Port: `5432`
- [ ] Database: `adoff_autopilot`
- [ ] User: `[your-pg-user]`
- [ ] Password: `[your-pg-password]`
- [ ] Test connection

### 4. Set Environment Variables
In N8N .env file or instance settings:
```bash
W28_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W27_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W22_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W20_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W25_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W29_WORKFLOW_ID=<literal-workflow-id-or-env-var>
W30_WORKFLOW_ID=<literal-workflow-id-or-env-var>

# Optional: enable DRY_RUN for testing (no DB writes)
ORCHESTRATOR_DRY_RUN=false
```

### 5. Verify Database Tables Exist
```sql
-- Run these queries in Postgres to confirm tables exist:
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='workflow_kill_switch');
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='marketing_config');
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='content_seeds');
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='gemini_copy_drafts');
```

### 6. Activate Workflow
- [ ] In N8N UI: Workflows → 00 - Master Orchestrator → Toggle "Active"
- [ ] Confirm workflow appears in "Active Workflows" list
- [ ] Check cron schedule is set: `0 5 * * *` (05:00 UTC daily)

## Smoke Test (Pre-Production)

### Test 1: Kill-switch Check
```bash
# Should exit immediately:
curl -X POST http://localhost:5678/webhook/orchestrator-run-now \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HMAC-SIGNATURE>" \
  -d '{ "test": "kill_switch_check" }'

# Expected: check_kill_switch node returns disabled=false
```

### Test 2: DRY_RUN Mode
```bash
# Set env var: ORCHESTRATOR_DRY_RUN=true
# Then trigger:
curl -X POST http://localhost:5678/webhook/orchestrator-run-now \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HMAC-SIGNATURE>" \
  -d '{ "dry_run": true }'

# Expected output:
{
  "ok": true,
  "workflow_id": "w00-master-orchestrator",
  "execution_status": "completed",
  "topic_count": 3,
  "lang_count": 5,
  "drafts_generated": 0,
  "dry_run_plan": { ... }
}

# Verify: No entries inserted into gemini_copy_drafts table
```

### Test 3: Idempotency
```bash
# Trigger twice in same day:
curl -X POST http://localhost:5678/webhook/orchestrator-run-now
# Then immediately:
curl -X POST http://localhost:5678/webhook/orchestrator-run-now

# Expected: Second run skipped (already_executed=true)
# Check execution history: second run shorter duration
```

### Test 4: Manual Schedule Test
```bash
# In N8N UI: Workflows → 00 - Orchestrator → "Execute workflow"
# Watch execution in real-time
# Expected: All 24 nodes execute without error
```

## Production Readiness Checklist

- [ ] All 7 sub-workflows callable (ExecuteWorkflow nodes have valid IDs)
- [ ] Postgres credentials validated (test connection passed)
- [ ] Database tables exist (content_seeds, gemini_copy_drafts, etc.)
- [ ] Telegram bot token works (test W30 alert)
- [ ] Gemini API keys active (test W22/W20 LLM calls)
- [ ] DRY_RUN smoke tests passed (zero errors)
- [ ] Idempotency confirmed (max 1 run/day)
- [ ] Kill-switch protection works (can halt if needed)
- [ ] HMAC auth validated (webhook signature checking)
- [ ] Cron schedule 05:00 UTC set + timezone Europe/Rome

## Monitoring & Operations

### Daily Checks
- [ ] Check Telegram #alerts channel for daily orchestrator summary
- [ ] Monitor `gemini_copy_drafts` table for draft inserts
- [ ] Verify `content_seeds.used_count` incremented
- [ ] Check execution time & Gemini API cost in billing

### Troubleshooting

**Issue**: Workflow not firing at 05:00 UTC
- **Fix**: Check N8N system time vs UTC offset. Verify cron `0 5 * * *` in schedule node.

**Issue**: Sub-workflow calls failing (red X in execution)
- **Fix**: Verify sub-workflow IDs match exactly. Check ExecuteWorkflow node parameters.

**Issue**: Postgres connection error
- **Fix**: Test credentials separately. Confirm database/user/password. Check firewall.

**Issue**: Gemini API timeout
- **Fix**: Check API quota + key validity. Increase timeout in W22/W20 (handled by those workflows).

**Issue**: HMAC auth failing on webhook
- **Fix**: Verify W29 signature validation. Check HMAC secret in W00 webhook node.

**Issue**: DRY_RUN not preventing DB writes
- **Fix**: Confirm env var `ORCHESTRATOR_DRY_RUN=true` set. Check node #22 conditional logic.

## Rollback

If production issues occur:
1. Set `workflow_kill_switch.disabled = true` (instant halt)
2. Disable workflow schedule (UI toggle)
3. Review execution history in N8N
4. Fix sub-workflow or db issue
5. Re-enable workflow + set kill_switch disabled=false

## References

- Workflow file: `workflows/00-master-orchestrator.json` (516 lines)
- Executive summary: `docs/W00-EXECUTIVE-SUMMARY.md`
- Smoke test report: `docs/W00-SMOKE-TEST-REPORT.md` (this file)
- Sub-workflows: W28, W27, W22, W20, W25, W29, W30
- Database: adoff_autopilot (Postgres)

---

**Status**: ✅ Ready for import (2026-05-21)
**Support**: Check n8n execution history for detailed logs
