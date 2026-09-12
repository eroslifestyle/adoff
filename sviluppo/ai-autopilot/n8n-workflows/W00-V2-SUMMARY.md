# W00 V2 — Quick Reference

## Files Modified/Created

| File | Type | Change |
|------|------|--------|
| `workflows/00-master-orchestrator.json` | JSON | W00 evolved: +7 new nodes (W49 call, W50 trigger, crisis check, enriched report) |
| `scripts/apply-retry-policy.py` | Python | Batch retry policy applier (3 retries, 2s wait) |
| `workflows/49-multi-format-content.json` | JSON | Stub: thread/carousel/reel generator |
| `workflows/50-visual-asset-pipeline.json` | JSON | Stub: visual asset webhook trigger |
| `workflows/48-crisis-manager.json` | JSON | Stub: crisis monitor |
| `workflows/42-oauth-token-manager.json` | JSON | Updated: retry policy added |
| `docs/W00-V2-INTEGRATION.md` | MD | Full integration guide + testing checklist |

## Commands

### Apply Retry Policy (Dry-Run)
```bash
cd /path/to/n8n-workflows
python scripts/apply-retry-policy.py --dry-run
```

### Apply Retry Policy (Real)
```bash
python scripts/apply-retry-policy.py
```

### Test W00 V2 in DRY_RUN
```bash
export ORCHESTRATOR_DRY_RUN=true
curl -X POST http://n8n-host/webhook/orchestrator-run-now -H "Content-Type: application/json" -d '{}'
```

## Key Changes Summary

1. **W49 Integration** — Post-strategy, generates 1 thread + 1 carousel + 1 reel_script for top topic
2. **W50 Async Trigger** — Non-blocking webhook POST for visual asset generation
3. **Crisis Monitor** — Pre-orchestrator check, aborts if high/critical incidents in last 1h
4. **Enriched Report** — Telegram message now includes: topics, langs, draft count, multi-format items, visual assets queued, crisis status, budget
5. **Global Retry** — 20 HTTP nodes across 9 workflows now have: maxTries=3, waitBetweenTries=2000ms

## Nodes Summary

- **Total nodes in W00:** 30
- **New nodes:** 7 (13a, 13b, 13c, 13d, 13e, 20, 21)
- **Sub-workflows called:** 8 (W28, W27, W22, W49, W20, W25, W30, W48)
- **HTTP nodes with retry:** 20 across 9 workflows

## Integration Steps

1. Backup current W00 in n8n
2. Import `workflows/00-master-orchestrator.json` (v2)
3. Import stubs: W49, W50, W48, W42
4. Run `apply-retry-policy.py` (no --dry-run)
5. Re-import modified workflows (W20, W21, W22, W23, W40, W41, W45, W49, W50)
6. Test DRY_RUN mode
7. Monitor first production run
8. Validate crisis check, W49 calls, W50 webhooks in logs

## Rollback

Restore from `.bak.20260520-pre-retry` backups:
```bash
for f in workflows/*.bak.20260520-pre-retry; do
  cp "$f" "${f%.bak.20260520-pre-retry}"
done
```

---
**Date:** 2026-05-20 | **Status:** Ready for Import | **Tested:** DRY_RUN ✓
