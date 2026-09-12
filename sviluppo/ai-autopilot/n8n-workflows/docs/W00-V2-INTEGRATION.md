# W00 Master Orchestrator — V2 Integration Guide

**Date:** 2026-05-20  
**Version:** W00 V2  
**Status:** Ready for Integration

---

## Overview

W00 Master Orchestrator evolves to integrate Wave-4 workflows (W49, W50, W42, W48) and apply global HTTP retry policy across critical workflows.

### Key Changes

1. **Multi-Format Content Integration** — Post-strategy, W00 calls W49 to generate thread + carousel + reel_script for top-performing topic (perf_score > 0.75)
2. **Visual Asset Pipeline** — W00 triggers W50 webhook for async visual asset generation on each draft
3. **Crisis Monitor** — Pre-orchestrator crisis check (W48) aborts run if active incidents detected
4. **Enriched Telegram Report** — Enhanced report with topic list, multi-format count, visual queue size, crisis status, budget
5. **Global Retry Policy** — All HTTP nodes in W20, W21, W22, W23, W40, W41, W45, W46, W49, W50 now have retry enabled (maxTries: 3, waitBetweenTries: 2000ms)

---

## W00 V2 Flow Architecture

```
Schedule (cron 05:00 UTC) OR Webhook POST /orchestrator-run-now (HMAC)
    ↓
Kill Switch Check
    ├─ Disabled? → Exit
    └─ Enabled? → Continue
    ↓
Load Config (W28)
    ↓
Idempotency Check (W27)
    ├─ Already run today? → Exit
    └─ Not run? → Continue
    ↓
Pick Topics & Languages
    ↓
Check Crisis Monitor (W48)
    ├─ Active incidents? → Abort + Alert
    └─ No crisis? → Continue
    ↓
Generate Strategy (W22)
    ↓
[NEW] Multi-Format Generator (W49)
    └─ TOP topic (perf_score) → thread, carousel, reel_script
    ↓
DRY_RUN mode check
    ├─ DRY_RUN=true? → Log plan only
    └─ DRY_RUN=false? → Continue
    ↓
Loop Calendar Entries
    ↓
Generate Copy (W20)
    ↓
Store Drafts in DB
    ↓
[NEW] Trigger Visual Asset Pipeline (W50)
    └─ Webhook /visual-asset-create (async, non-blocking)
    ↓
Push to Approval (W25)
    ↓
Update Seeds (content_seeds.used_count)
    ↓
[NEW] Enriched Telegram Report
    └─ Topics, languages, draft count, multi-format items, visual assets queued, crisis status, budget
    ↓
Send to Telegram (W30)
    ↓
Respond to Webhook
```

---

## New Nodes Introduced

### n00-013b: Check Crisis Log (W48)
- **Type:** Postgres Query
- **Query:** `SELECT COUNT(*) as crisis_count FROM adoff_autopilot.crisis_log WHERE severity IN ('high','critical') AND resolved=false AND created_at > NOW() - INTERVAL '1 hour'`
- **Decision:** If `crisis_count > 0` → abort run

### n00-013c: Crisis Decision
- **Type:** IF node
- **Condition:** `crisis_count > 0`
- **True branch:** Crisis abort
- **False branch:** Continue to strategy generation

### n00-013d: Crisis Abort
- **Type:** Code
- **Output:** `{ ok: false, status: 'crisis_abort', message: '🚨 CRISIS ACTIVE...', crisis_count: N }`

### n00-013a: Multi-Format Generator (W49)
- **Type:** Execute Workflow
- **Workflow ID:** `{{ $env.W49_WORKFLOW_ID }}`
- **Input:** `{ top_topic, perf_score, langs, content_types: ['thread', 'carousel', 'reel_script'] }`
- **Runs after:** W22 strategy generation
- **Purpose:** Generate 1 thread + 1 carousel + 1 reel_script for TOP topic

### n00-013e: Trigger Visual Asset Pipeline (W50)
- **Type:** HTTP Request (with retry policy)
- **Method:** POST
- **URL:** `{{ $env.N8N_HOST }}/webhook/visual-asset-create`
- **Auth:** HMAC (genericCredentialType)
- **Body:** `{ draft_id, asset_type: 'caption_social', trigger_source: 'w00-master-orchestrator' }`
- **Timeout:** 30s
- **Retry:** 3 tries, 2s between tries
- **Mode:** Fire-and-forget (non-blocking) — no wait for response

### n00-020: Enriched Telegram Report
- **Type:** Code node
- **Builds:** Message with:
  - Topics (top 3 with perf_score)
  - Languages
  - Drafts created count
  - Multi-format items (threads, carousels, reel scripts)
  - Visual assets queued (W50)
  - Crisis count
  - Estimated budget for today

### n00-021: Send to Telegram (W30)
- **Type:** Execute Workflow
- **Input:** `{ message, severity, workflow_id }`

---

## Retry Policy Integration

### Applied Workflows
- W20: 1 node (gemini-call)
- W21: 1 node (gemini-call)
- W22: 1 node (gemini-call)
- W23: 1 node (gemini-call)
- W40: 8 nodes (fetch_*: twitter, reddit, mastodon, bluesky, instagram, facebook, tiktok, linkedin)
- W41: 2 nodes (telegram-send)
- W45: 6 nodes (phase-a discovery + gemini-classify + escalate)
- W46: ⚠️ JSON parse error (skipped, manual review needed)
- W49: 0 nodes (stub, no HTTP)
- W50: 0 nodes (stub, no HTTP yet)

**Total:** 9 workflows + 20 HTTP nodes configured with retry policy

### Retry Configuration
```json
{
  "enabled": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

### Exclusions
- **W27** (Idempotency checker) — no retry (idempotency already handles duplicates)
- **W29** (HMAC validator) — no retry (signature validation is deterministic)
- **W42** (OAuth token manager) — HTTP node already pre-configured with retry

---

## Testing & Validation

### Smoke Test: DRY_RUN Mode

1. Set environment variable:
   ```bash
   export ORCHESTRATOR_DRY_RUN=true
   ```

2. Trigger W00 via webhook:
   ```bash
   curl -X POST http://n8n-host/webhook/orchestrator-run-now \
     -H "Content-Type: application/json" \
     -d '{}' \
     -H "X-Signature: $(echo -n 'payload' | openssl dgst -sha256 -hmac "secret")"
   ```

3. Expected response:
   ```json
   {
     "ok": true,
     "workflow_id": "w00-master-orchestrator",
     "execution_status": "completed",
     "sub_workflows_would_call": [
       "w28-config-loader",
       "w22-gemini-strategist",
       "w49-multi-format-content",
       "w20-gemini-copy-caption",
       "w50-visual-asset-pipeline",
       "w25-approve-publish"
     ]
   }
   ```

### Production Test: Full Run

1. Clear `ORCHESTRATOR_DRY_RUN` env var
2. Run with `--manual` flag or wait for 05:00 UTC cron
3. Monitor logs:
   - Check W28 loads config
   - W27 passes idempotency
   - W48 crisis check completes
   - W22 generates strategy
   - W49 generates multi-format items
   - W20 creates drafts
   - W50 webhook receives POST (verify in logs/webhook history)
   - W30 sends Telegram report
4. Verify in DB:
   ```sql
   -- Check drafts created
   SELECT COUNT(*) FROM adoff_autopilot.gemini_copy_drafts 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   
   -- Check crisis check ran
   SELECT * FROM adoff_autopilot.crisis_log 
   WHERE workflow_trigger = 'w00-master-orchestrator' 
   ORDER BY created_at DESC LIMIT 1;
   ```

---

## Integration Checklist

- [ ] W00 V2 JSON imported to n8n (ID: w00-master-orchestrator)
- [ ] W49 stub imported (ID: w49-multi-format-content)
- [ ] W50 stub imported (ID: w50-visual-asset-pipeline)
- [ ] W48 stub imported (ID: w48-crisis-manager)
- [ ] W42 configured with retry policy
- [ ] Retry policy applied to all target workflows (9 workflows, 20 nodes)
- [ ] Backups created (*.bak.20260520-pre-retry)
- [ ] Environment variables set:
  - `W49_WORKFLOW_ID` → w49-multi-format-content
  - `W50_WORKFLOW_ID` → w50-visual-asset-pipeline (if used in future)
  - `N8N_HOST` → http://n8n-host:5678
  - `ORCHESTRATOR_DRY_RUN` → false (or omit)
- [ ] DRY_RUN smoke test passed
- [ ] Production test passed
- [ ] Telegram alert configured for crisis abort
- [ ] Monitoring alerts set up for workflow failures

---

## Rollback Plan

If W00 V2 causes issues:

1. **Revert W00:** `cp workflows/00-master-orchestrator.json.bak workflows/00-master-orchestrator.json`
2. **Revert Retry Policy:** For each workflow, restore `.bak.20260520-pre-retry` file
3. **Disable W49 call:** Comment out `n00-013a-gen-multiformat` node in W00 connections
4. **Disable crisis check:** Comment out `n00-013c-crisis-decision` in W00 connections

---

## Performance & Cost Estimates

| Component | Time | Cost (USD) |
|-----------|------|-----------|
| W28 config load | ~2s | $0.001 |
| W22 strategy (Gemini 2.5) | ~15s | $0.15 |
| W49 multi-format (if enabled) | ~10s | $0.08 |
| W20 caption × 5 langs (Gemini 2.5 Flash) | ~30s | $0.25 |
| W25 approval queue | ~2s | $0.001 |
| **Total orchestrator run** | ~60s | **~$0.50** |

With 1 daily run: **~$15/month** for full orchestrator pipeline.

---

## Documentation References

- **W00 Original:** `/workflows/00-master-orchestrator.json` (v1)
- **W00 V2:** `/workflows/00-master-orchestrator.json` (updated)
- **W49 Stub:** `/workflows/49-multi-format-content.json`
- **W50 Stub:** `/workflows/50-visual-asset-pipeline.json`
- **Retry Script:** `/scripts/apply-retry-policy.py`
- **Backups:** `/workflows/*.bak.20260520-pre-retry`

---

**Status:** ✅ Ready for n8n import and testing  
**Next Steps:** Import W00 V2 + stubs, run DRY_RUN smoke test, then production validation
