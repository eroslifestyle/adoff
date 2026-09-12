# N8N Workflow Index — AdOff Autopilot

**Generated**: 2026-05-21  
**n8n Version**: 2.21.5  
**Total Workflows**: 50 (00-Master, 01-99, W48 NEW)

---

## W48 — Crisis Manager (NUOVO — 2026-05-21)

**Status**: STABLE | **Criticality**: CRITICAL | **Schedule**: Every 5 min + Every 60 min (recovery)

Automated crisis detection & management hub:
- **Phase A**: Aggregate signals (errors 15min, budget 1h, engagement 30min, publish anomaly 1h, brand violations 1h)
- **Phase B**: Classify severity via simple logic (low/medium/high/critical)
- **Phase C**: Execute playbook (low/medium) = disable workflows w00, w15, w22, w25
- **Phase D**: Escalate (high/critical) = Telegram alert + webhook ACK/ROLLBACK handlers
- **Phase E**: Auto-recovery (60 min) = if signals normal 30min → mark resolved + re-enable workflows

**Key Tables**:
- `adoff_autopilot.crisis_log` — NEW (created by W48)
- `adoff_autopilot.workflow_kill_switch` — Manages workflow disable/enable

**Webhooks**:
- `POST /webhook/crisis/ack` — Acknowledge crisis (human response)
- `POST /webhook/crisis/rollback` — Rollback automated actions

**Integration Points**:
- W26 (Budget Monitor) → writes `budget_alerts` table
- W30 (Error Notifier) → writes `workflow_errors` table
- W45 (Engagement Agent) → writes `engagement_inbox` with escalated status
- W15 (Cyber-Purge Producer) → can be disabled by W48

---

## Core Workflows (00-15)

| ID | Name | Schedule | Input | Output | Status |
|----|----|----------|-------|--------|--------|
| W00 | Master Orchestrator | Manual | orchestration request | delegates to L2s | STABLE |
| W01 | Multi-Language Translator | On-demand | text + target langs | translated texts | STABLE |
| W02 | Social Crosspost Hub | On-demand | content + platforms | posted URLs | STABLE |
| W03 | Posts Dispatcher (v2) | On-demand | batch posts | queue status | STABLE |
| W04 | Mention Sentinel | Every 15 min | n/a | notifications | STABLE |
| W05 | Competitor Watch | Daily | competitor URLs | analysis | STABLE |
| W06 | Newsjacking Watcher | Every hour | topics | trending angles | STABLE |
| W07 | Press Cold Email Drip | Daily | recipient list | sent count | STABLE |
| W08 | Reddit Forum Hunter | Every 2 hours | forums | thread summary | STABLE |
| W09 | Quora Answer Scheduler | Every 4 hours | question list | posted answers | STABLE |
| W10 | Warming Bot | Every hour | account list | engagement metrics | STABLE |
| W11 | Multilang Channel Pub | On-demand | content + langs | publish status | STABLE |
| W12 | YouTube Factory | Daily | script + metadata | video file | STABLE |
| W13 | YouTube Publisher | On-demand | video file | published URL | STABLE |
| W14 | Social Enqueue | On-demand | content batch | queue | STABLE |
| W15 | Cyber-Purge Producer | Every 4 hours | n/a | Remotion comp | **CAN_BE_DISABLED_BY_W48** |

---

## Content Generation (20-30)

| ID | Name | Trigger | Model | Output | Status |
|----|----|---------|-------|--------|--------|
| W20 | Gemini Copywriter Caption | On-demand | Gemini 2.5 Flash | captions | STABLE |
| W21 | Gemini Email/Ad/Landing | On-demand | Gemini 2.5 Flash | copy | STABLE |
| W22 | Gemini Strategist Calendar | Every 6 hours | Gemini 2.5 Pro | content calendar | **CAN_BE_DISABLED_BY_W48** |
| W23 | Gemini SEO Research | On-demand | Gemini 2.5 Flash | SEO keywords | STABLE |
| W25 | Approve & Publish Drafts | Manual | n/a | publish workflow | **CAN_BE_DISABLED_BY_W48** |
| W26 | Budget Cap Monitor | Every 60 min | n/a | budget alerts | ← **FEEDS W48** |
| W27 | Idempotency Check | On-demand | n/a | dedup status | STABLE |
| W28 | Config Loader | On-demand | n/a | config JSON | STABLE |
| W29 | HMAC Auth Validator | On-demand | n/a | auth status | STABLE |
| W30 | Telegram Error Notifier | On-demand + Webhook | n/a | Telegram alerts | ← **FEEDS W48** |

---

## Analytics & Engagement (40-50)

| ID | Name | Schedule | Input | Output | Status |
|----|----|----------|-------|--------|--------|
| W40 | Analytics Collector | Every 30 min | API endpoints | metrics | STABLE |
| W41 | Learning Loop Engine | Daily | performance data | insights | STABLE |
| W45 | Engagement Agent | Every 5 min | social feeds | escalated items | ← **FEEDS W48** |
| W48 | **Crisis Manager** (NEW) | Every 5 min + 60 min | signal aggregates | crisis_log | **STABLE** |
| W96 | Media Agent | On-demand | media brief | media specs | STABLE |
| W98 | Image Generator | On-demand | prompt + model | image file | STABLE |
| W99 | Copy Agent | On-demand | brief | copy variants | STABLE |

---

## Workflow Dependencies

```
W26 (Budget Monitor) ──┐
W30 (Error Notifier) ──┤
W45 (Engagement Agent) ├──→ W48 (Crisis Manager)
W98 (Image Generator) ──┤   ├─→ w00, w15, w22, w25 (disable on crisis)
social_published table ─┘   └─→ telegram.org (escalation)
```

---

## W48 Playbook Matrix

| Trigger Signal | Count | Window | Severity | Action |
|---|---|---|---|---|
| Errors | > 20 | 15 min | medium | Disable w00, w15, w22, w25 |
| Errors | > 50 | 15 min | critical | Disable ALL + Telegram |
| Budget | critical | 1 hour | high | Disable w00, w15, w22, w25 |
| Engagement escalations | > 5 | 30 min | medium | Pause autoreply |
| Brand violations | > 5 | 1 hour | critical | Set auto_approve=99 + Telegram |
| Publish rate | 3x+ avg | 1 hour | high | Pause channels + Telegram |

**Recovery** (auto @ 60 min):
- If all signals < threshold 30 min consecutive → mark crisis resolved + re-enable workflows

**Human Override**:
- `/crisis-ack-{CRS_ID}` → acknowledge (monitor mode)
- `/crisis-rollback-{CRS_ID}` → rollback (re-enable workflows now)
- Timeout: 60 min no response → GLOBAL KILL_SWITCH (all workflows except W48 disabled)

---

## File Locations

| File | Location |
|------|----------|
| W48 Workflow | `workflows/48-crisis-manager.json` |
| W48 Documentation | `docs/W48-CRISIS-MANAGER.md` |
| Workflow Index | `WORKFLOW-INDEX.md` (this file) |
| Credentials | `credentials/adoff-*.json` (n8n managed) |
| Rules & Data | PostgreSQL `adoff_autopilot` schema |

---

**Last Updated**: 2026-05-21  
**Status**: Complete & tested
