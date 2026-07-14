# AdOff n8n Workflows — Complete Automation Hub

**Version**: 1.0  
**n8n**: 2.21.5+  
**Status**: Production Ready (W00 + W40 + W41 live)  
**Architecture**: Hub-and-spoke orchestrator pattern  

---

## Overview

This directory contains the complete n8n workflow automation suite for AdOff AI Autopilot:

- **W00**: Master Orchestrator — Daily decision engine, seeds content cycle
- **W40**: Agent K (Social Listening) — Collects metrics from social platforms
- **W41**: Learning Loop Engine — Analytics hub, generates insights & updates config

**Data Flow**:
```
W00 (Morning)              W40 (24/7 Collection)         W41 (Daily 04:00 UTC)
├─ Reads marketing_config  ├─ Listens social metrics     ├─ Aggregates 14-day metrics
├─ Selects daily topics    ├─ Inserts metrics table      ├─ Computes topic/hashtag/time scores
├─ Triggers W10/W20/W30    └─ Updates social_published   ├─ Updates marketing_config (6 keys)
└─ Publishes schedule                                    ├─ Inserts performance_insights
                                                          └─ Reports to Telegram
```

---

## Directory Structure

```
n8n-workflows/
├── workflows/              # Exportable JSON workflows
│   ├── 00-master-orchestrator.json
│   ├── 40-agent-k-social-listening.json
│   └── 41-learning-loop-engine.json
├── sql/                    # Database schema + queries
│   ├── w41-learning-loop-queries.sql
│   └── schema-adoff-autopilot.sql (if exists)
├── tests/                  # Test suites
│   ├── w41-smoke-tests.js
│   └── w00-orchestrator-tests.js (if exists)
├── docs/                   # Technical specifications
│   ├── W00-MASTER-ORCHESTRATOR.md
│   ├── W40-AGENT-K.md
│   └── W41-LEARNING-LOOP-ENGINE.md
├── config/                 # Configuration templates
│   ├── marketing-config-seed.json
│   └── telegram-config.json
├── README.md              # This file
├── DEPLOYMENT_GUIDE.md    # Step-by-step deployment
└── .env.example           # Environment variables template
```

---

## Workflows at a Glance

### W00 — Master Orchestrator

**Purpose**: Daily decision hub that orchestrates content cycle.

| Aspect | Detail |
|--------|--------|
| **Trigger** | Cron: 06:00 UTC daily |
| **Inputs** | marketing_config (topic_scores, lang_performance, best_post_times) |
| **Process** | 1) Load config 2) Rank topics 3) Select 5 daily topics 4) Assign to languages 5) Trigger W10/W20/W30 |
| **Outputs** | daily_schedule (JSON) → Telegram report |
| **Status** | ✓ Production (see docs/W00-MASTER-ORCHESTRATOR.md) |

### W40 — Agent K (Social Listening)

**Purpose**: Real-time metric collection from deployed social posts.

| Aspect | Detail |
|--------|--------|
| **Trigger** | Cron: Every 4 hours (adaptive polling) |
| **Inputs** | social_published (list of published posts) |
| **Process** | 1) Fetch metrics from Meta API + TikTok API 2) Compute engagement 3) Store in metrics table |
| **Outputs** | metrics table (rows: likes, comments, shares, views, engagement_rate) |
| **Status** | ✓ Production (integrates W29 webhook, W35 bridge) |

### W41 — Learning Loop Engine ⭐ (THIS WORKFLOW)

**Purpose**: Daily analytics engine that transforms raw metrics into strategic insights.

| Aspect | Detail |
|--------|--------|
| **Trigger** | Cron: 04:00 UTC daily + Webhook `/learning-run` (manual) |
| **Inputs** | metrics table (14-day window) |
| **Process** | 1) Validate 2) Aggregate by topic/hashtag/time/format/language 3) Rank 4) Store insights 5) Report |
| **Outputs** | marketing_config (6 keys updated) + performance_insights (batch insert) |
| **Status** | ✓ Production Ready (NEW) |

---

## Quick Start

### First-Time Setup (10 minutes)

```bash
# 1. Clone repo
git clone <repo> adoff-autopilot
cd adoff-autopilot/sviluppo/ai-autopilot/n8n-workflows

# 2. Setup database
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  -f sql/w41-learning-loop-queries.sql

# 3. Create n8n credentials (see DEPLOYMENT_GUIDE.md step 2)

# 4. Import W41 workflow (DEPLOYMENT_GUIDE.md step 3)

# 5. Insert test data
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  < sql/test-data-w41.sql

# 6. Run smoke tests
npm install pg axios dotenv
node tests/w41-smoke-tests.js
```

### Daily Operations

- **W00** runs at **06:00 UTC** → Topics selected for the day
- **W40** runs **every 4 hours** → Metrics collected from social
- **W41** runs at **04:00 UTC** → Insights computed, config updated

### Manual Triggers

```bash
# Trigger W41 manually (e.g., to test new data)
curl -X POST http://n8n.leobox:5678/webhook/learning-run \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(hmac_sha256 <body> <webhook_secret>)" \
  -d '{}'

# Check execution
# → n8n UI: Workflows → W41 → Executions
# → Telegram: Admin gets report
# → DB: marketing_config updated
```

---

## Configuration & Secrets

### Environment Variables

Copy `.env.example` and fill in:

```bash
cp .env.example .env

# Required for W41:
ADOFF_PG_HOST=postgres.leobox.internal
ADOFF_PG_PORT=5432
ADOFF_PG_DATABASE=adoff_autopilot
ADOFF_PG_USER=adoff_writer
ADOFF_PG_PASSWORD=<from 1password>

# Required for Telegram reports:
TELEGRAM_BOT_TOKEN=<from BotFather>
TELEGRAM_CHAT_ID_ADMIN=<numeric ID from @userinfobot>
```

### n8n Credentials Reference

| Name | Type | Location | Notes |
|------|------|----------|-------|
| `adoff-pg-autopilot-credential-1234` | PostgreSQL | n8n UI → Credentials | Used by all W41 nodes |
| `stripe-production` | Stripe | n8n UI → Credentials | For W50 payment processing (future) |
| `telegram-admin-bot` | HTTP (implicit) | Env vars + hardcoded token | Used by Telegram send nodes |

---

## Database Schema

### Core Tables

- **metrics**: Raw data from W40 (platform, likes, comments, shares, views, engagement_rate)
- **social_published**: Post metadata (caption, hashtags, lang, published_at, platform)
- **gemini_copy_drafts**: Copy templates from W10 (body, topic_tag, lang)
- **performance_insights**: Historical analytics from W41 (valid 24h, then deleted)
- **marketing_config**: Live configuration (topic_scores, best_post_times, lang_performance, etc.)
- **content_seeds**: Seed pool for next content cycle (topic_tag, perf_score)

### Indexes

Required for <500ms query performance:
- `idx_metrics_measured_at_desc` — Load metrics efficiently
- `idx_metrics_social_published_id` — Join metrics to posts
- `idx_content_seeds_topic_tag` — Update seeds by topic

See `sql/w41-learning-loop-queries.sql` for DDL.

---

## Testing & Validation

### Unit Tests

```bash
node tests/w41-smoke-tests.js
# Tests database connectivity, table existence, aggregation correctness, etc.
# Expected: 14 tests pass, ~30 seconds
```

### Integration Tests

```bash
# Insert test data
psql -d adoff_autopilot -f sql/test-data-w41.sql

# Trigger W41 via webhook
curl -X POST http://localhost:5678/webhook/learning-run -d '{}'

# Verify outputs
psql -d adoff_autopilot -c "SELECT COUNT(*) FROM performance_insights WHERE created_at > NOW() - INTERVAL '5 minutes'"

# Expected: >0 rows
```

### Load Testing

```bash
# Generate 100k metrics across 7 days
# Run W41 and measure execution time (target: <8 seconds)
# Use PostgreSQL EXPLAIN ANALYZE on slow queries
```

---

## Monitoring & Alerts

### Daily Checklist

- [ ] W00 report received at 06:00 UTC (Telegram)
- [ ] W40 collecting metrics (check metrics table count increasing)
- [ ] W41 report received at 04:15 UTC (Telegram) with insights
- [ ] n8n execution page shows 0 errors

### Alerts to Set Up

```bash
# n8n: Execution failed
# → Send Telegram: "W41 execution failed, check logs"

# Database: Query >500ms on metrics table
# → Check indexes: REINDEX INDEX idx_metrics_measured_at_desc

# Telegram: Message send failed
# → Verify TELEGRAM_BOT_TOKEN valid (test via /getMe)
```

### Key Metrics to Track

| Metric | Target | Alert If |
|--------|--------|----------|
| Metrics collected (daily) | >100 | <50 (data pipeline issue) |
| W41 execution time | 2-3s | >10s (index degradation) |
| Config keys updated | 6 | <6 (aggregation failure) |
| Insights generated | >20 | 0 (cold-start expected day 1) |

---

## Troubleshooting

### "No metrics found"

**Cause**: Day 1 of W40 — platform APIs haven't populated data yet.

**Solution**: Wait 24 hours. W41 detects this with `status == 'cold_start'` and:
- Inserts default config values
- Sends warning Telegram
- Returns gracefully (no error)

### "PostgreSQL connection refused"

**Cause**: Credential misconfigured or DB not accessible from n8n.

**Solution**:
```bash
# Test from n8n container
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot -c "SELECT 1"

# If fails, check:
# 1. Is DB running? (psql from host)
# 2. Is firewall open? (netstat -tuln | grep 5432)
# 3. Does user exist? (SELECT * FROM pg_user WHERE usename = 'adoff_writer')
```

### "Telegram message not sent"

**Cause**: Token invalid, chat ID incorrect, or API rate limited.

**Solution**:
```bash
# Test token
curl -s https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe | jq

# Test send to self
curl -X POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage \
  -d "chat_id=${TELEGRAM_CHAT_ID_ADMIN}" \
  -d "text=Test"
```

### "Hashtag aggregation empty"

**Cause**: Hashtags stored in unexpected format (not comma-separated).

**Solution**: Check actual data:
```sql
SELECT DISTINCT hashtags FROM social_published LIMIT 5;
```

Update `compute_hashtag_perf` node to match format (split on `,`, `;`, or `|`).

---

## Contributing

### Workflow Updates

1. **Make changes** in n8n UI
2. **Export** as JSON: Workflows → W41 → Export
3. **Save** to `workflows/41-learning-loop-engine.json`
4. **Document** changes in `docs/W41-LEARNING-LOOP-ENGINE.md`
5. **Test** with `node tests/w41-smoke-tests.js`

### Database Changes

1. **Create migration** in `sql/` (e.g., `001_add_column.sql`)
2. **Test locally**: `psql -d adoff_autopilot -f sql/001_add_column.sql`
3. **Update schema** in docs
4. **Commit & deploy**

---

## References

| Doc | Purpose |
|-----|---------|
| `DEPLOYMENT_GUIDE.md` | Step-by-step deployment (10 min) |
| `docs/W41-LEARNING-LOOP-ENGINE.md` | Complete technical spec, 100+ rules |
| `sql/w41-learning-loop-queries.sql` | SQL queries + indexes, well-commented |
| `tests/w41-smoke-tests.js` | 14 test cases (unit + integration) |

---

## Roadmap

- [x] W00 — Master Orchestrator
- [x] W40 — Agent K (Social Listening)
- [x] W41 — Learning Loop Engine ← **DEPLOYED 2026-05-20**
- [ ] W10 — Content Generator (pending W41 insights)
- [ ] W20 — Format Optimizer (pending W41 format rankings)
- [ ] W30 — Posting Scheduler (pending W41 best times)
- [ ] W50 — Payment Processing (Stripe integration)

---

## Support & Contact

**Issues?**
- Check `DEPLOYMENT_GUIDE.md` → Troubleshooting
- Review n8n logs: `docker logs n8n 2>&1 | grep -i error`
- Test database: `psql -d adoff_autopilot -c "SELECT pg_database.datname FROM pg_database"`

**Documentation**: Full technical spec in `docs/W41-LEARNING-LOOP-ENGINE.md`

---

**Last Updated**: 2026-05-20  
**Maintained by**: AdOff AI Autopilot Team  
**Status**: ✓ Production Ready
