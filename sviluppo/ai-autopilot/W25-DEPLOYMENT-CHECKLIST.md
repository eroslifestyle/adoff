# W25 Intelligent Approval Gate — Deployment Checklist

## Pre-Deployment (1 ora)

- [ ] Backup production n8n workflow (export current W25 JSON)
- [ ] Backup PostgreSQL: `pg_dump adoff_autopilot | gzip > /tmp/adoff-pre-w25.sql.gz`
- [ ] Review `25-approve-publish-drafts.json` syntax: `jq . < file` (✓ 53 nodes, 0 errors)

## Database Setup (15 min)

- [ ] Run migration SQL: `psql adoff_autopilot < sql-scripts/migrate-w25-autoapprove.sql`
- [ ] Verify columns added:
  ```sql
  \d adoff_autopilot.gemini_copy_drafts
  -- Check: auto_approved, approval_score, brand_guard_reason
  ```
- [ ] Verify posts_queue linkage:
  ```sql
  \d adoff_autopilot.posts_queue
  -- Check: source_draft_id BIGINT
  ```
- [ ] Load test data (3 draft):
  ```sql
  SELECT COUNT(*) FROM adoff_autopilot.gemini_copy_drafts WHERE workflow='w25-test';
  -- Expected: 3
  ```

## N8N Configuration (30 min)

- [ ] N8N UI: Workflows → Import → `25-approve-publish-drafts.json`
- [ ] Update credentials:
  - [ ] Find `PLACEHOLDER_PG_CREDENTIAL` → Select `adoff-pg-autopilot`
  - [ ] Find `PLACEHOLDER_GEMINI_CREDENTIAL` → Select `adoff-gemini-credential-2026`
  - [ ] Verify Gemini API key is loaded from `/opt/n8n/.env`
- [ ] Set environment variables (n8n container or .env file):
  ```bash
  ADOFF_AUTO_APPROVE_THRESHOLD=90
  TELEGRAM_BOT_TOKEN=<existing>
  TELEGRAM_CHAT_ID=<existing>
  WEBHOOK_HMAC_SECRET=<existing>
  ```
- [ ] Enable workflow: toggle Active to ON
- [ ] Verify schedule triggers are set:
  - [ ] `Schedule every 10 min (auto-approve loop)` = enabled
  - [ ] `Schedule every 30 min` = enabled (existing)

## Smoke Test (30 min)

### Manual Execution (Auto-Approve Loop)
1. N8N UI: Open workflow → Node `Schedule every 10 min (auto-approve loop)` → "Execute Node"
2. Monitor execution live:
   - [ ] DB fetch returns 3 test draft
   - [ ] Gemini Flash LLM scoring completes (watch throttle 2sec)
   - [ ] Decision tree routes correctly
   - [ ] DB update succeeds for each draft

### Verify Results
```bash
psql adoff_autopilot << EOF
SELECT id, status, approval_score, auto_approved, brand_guard_reason
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow='w25-test'
ORDER BY id;
EOF
```

Expected:
- **id=1**: status=approved, auto_approved=true, score=85-95
- **id=2**: status=needs_review, auto_approved=false, score=70-80
- **id=3**: status=rejected, auto_approved=false, score=40-60

### Telegram Alert Verification
- [ ] Check Telegram bot channel: should have ⚠️ alert for id=2 (borderline)
- [ ] No alert for id=1 (approved) and id=3 (rejected)

### Dispatch Test
1. N8N UI: Node `Schedule every 30 min` → "Execute Node"
2. Check posts_queue:
```sql
SELECT id, source_draft_id, asset_type, workflow
FROM adoff_autopilot.posts_queue
WHERE source_draft_id IS NOT NULL
ORDER BY id DESC LIMIT 1;
```
Expected: source_draft_id=1 (only auto-approved draft)

## Production Validation (15 min)

- [ ] Delete w25-test data:
  ```sql
  DELETE FROM adoff_autopilot.gemini_copy_drafts WHERE workflow='w25-test';
  ```
- [ ] Monitor auto-approve loop for 1 hour:
  - [ ] Check N8N Executions: all scheduled runs successful
  - [ ] Check Telegram: alerts received (if any needs_review)
  - [ ] Check DB: approval_score populated correctly
- [ ] Verify manual webhook still works:
  ```bash
  HMAC=$(openssl dgst -sha256 -hex -mac HMAC -macopt "key:..." <<< '...')
  curl -X POST http://localhost:5678/webhook/draft-approve \
    -H "X-AdOff-Signature: $HMAC" \
    -H "Content-Type: application/json" \
    -d '{"draft_id": <some-id>, "action": "approve"}'
  ```

## Rollback Plan (In Case of Issues)

- [ ] If LLM scoring is unreliable: Disable `Schedule every 10 min` node
- [ ] Manual approval via webhook only (revert to 100% manual)
- [ ] Restore backup: `psql adoff_autopilot < /tmp/adoff-pre-w25.sql.gz`
- [ ] Roll back n8n workflow: import previous version

## Success Criteria

✅ **Deployment Complete When**:
- All smoke tests pass (3 draft: 1 approved, 1 review, 1 rejected)
- Telegram alerts sent correctly
- posts_queue linkage functional
- Manual webhook override works
- 1 hour of production monitoring without errors

## Metrics to Track (Post-Deployment)

Daily (via SQL queries):
```sql
SELECT
  DATE(approved_at) as day,
  COUNT(*) FILTER (WHERE auto_approved=true) as auto_approved_count,
  COUNT(*) FILTER (WHERE auto_approved=false) as manual_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE auto_approved=true) / NULLIF(COUNT(*), 0), 1) as auto_pct
FROM adoff_autopilot.gemini_copy_drafts
WHERE status='approved' AND approved_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(approved_at)
ORDER BY day DESC;
```

Weekly review:
- [ ] Auto-approve rate trending (target: >70%)
- [ ] Manual override rate (target: <5% of approved)
- [ ] LLM rejection rate (target: <10%)
- [ ] Telegram alert frequency (target: <5 needs_review/day)

## Handoff

- [ ] Document updated: `W25-INTELLIGENT-APPROVAL-README.md`
- [ ] Memory saved: `project_w25_intelligent_approval.md`
- [ ] Deployment checklist filed: this document
- [ ] SQL migration script backed up
- [ ] Workflow JSON version tagged in git

---

**Deployment Date**: 2026-05-20  
**Deployed By**: [your name]  
**Status**: ⏳ Ready for Deployment
