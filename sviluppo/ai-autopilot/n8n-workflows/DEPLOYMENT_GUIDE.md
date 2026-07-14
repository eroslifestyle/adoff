# W41 Learning Loop Engine — Deployment Guide

**Quick Start**: 10 minutes from zero to live analytics.

---

## Prerequisites Checklist

- [ ] n8n 2.21.5+ running on leobox
- [ ] PostgreSQL database `adoff_autopilot` accessible from n8n
- [ ] Telegram bot token (from BotFather)
- [ ] Admin chat numeric ID (from `@userinfobot`)
- [ ] Git repo with workflow files cloned locally

---

## Step 1: Database Setup (2 minutes)

### 1a. Connect to PostgreSQL

```bash
psql -h postgres.leobox.internal -U postgres -d adoff_autopilot
```

### 1b. Create Tables (if not exist)

```bash
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  -f sql/w41-learning-loop-queries.sql
```

Or manually:

```sql
-- Copy-paste the table creation from docs/W41-LEARNING-LOOP-ENGINE.md
-- Section: "Database Schema & Indexes"
```

### 1c. Verify Tables

```bash
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
```

Expected: 6+ tables created.

---

## Step 2: Create n8n Credentials (2 minutes)

### 2a. PostgreSQL Credential

1. Go to **n8n UI** → **Credentials** → **+ Create New**
2. Select **PostgreSQL**
3. Configure:
   - **Credential Name**: `adoff-pg-autopilot-credential-1234`
   - **Host**: `postgres.leobox.internal`
   - **Port**: `5432`
   - **Database**: `adoff_autopilot`
   - **User**: `adoff_writer`
   - **Password**: `<your_db_password>`
   - **SSL**: `No` (internal network)
4. Click **Test Connection** → should show ✓
5. Click **Save**

### 2b. Set Environment Variables (for Telegram)

In n8n `.env` or Settings:

```bash
TELEGRAM_BOT_TOKEN=<your_bot_token_from_botfather>
TELEGRAM_CHAT_ID_ADMIN=<numeric_chat_id>
```

Verify in n8n UI → **Settings** → **Environment Variables**.

---

## Step 3: Import Workflow (3 minutes)

### 3a. Download/Prepare JSON

```bash
# Already in repo:
ls -la workflows/41-learning-loop-engine.json
```

### 3b. Import into n8n

1. Go to n8n **Workflows** → **Import**
2. Select file: `workflows/41-learning-loop-engine.json`
3. Click **Import**
4. n8n should show: "Workflow imported successfully"

### 3c. Verify Node Credentials

1. Open the workflow
2. Click each **PostgreSQL node** → Check credential dropdown
3. Ensure all PostgreSQL nodes use `adoff-pg-autopilot-credential-1234`
4. Save workflow: **Ctrl+S**

---

## Step 4: Test with Sample Data (2 minutes)

### 4a. Insert Test Metrics

```bash
# Use the test helper or manual SQL:
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot << 'EOF'

-- Clean previous test data
DELETE FROM metrics WHERE created_at > NOW() - INTERVAL '1 hour';
DELETE FROM social_published WHERE created_at > NOW() - INTERVAL '1 hour';
DELETE FROM gemini_copy_drafts WHERE created_at > NOW() - INTERVAL '1 hour';

-- Insert gemini drafts
INSERT INTO gemini_copy_drafts (body, topic_tag, lang)
VALUES
  ('Draft 1 content', 'privacy', 'IT'),
  ('Draft 2 content', 'tracking-blocker', 'EN'),
  ('Draft 3 content', 'encryption', 'DE')
RETURNING id;

-- Copy the IDs and insert social_published:
INSERT INTO social_published (draft_id, caption, hashtags, lang, asset_type, published_at, platform)
VALUES
  ('<draft_id_1>', 'Caption 1', '#privacy,#adblock,#tracking', 'IT', 'video', NOW() - INTERVAL '5 days', 'instagram'),
  ('<draft_id_2>', 'Caption 2', '#privacy,#surveillance', 'EN', 'video', NOW() - INTERVAL '3 days', 'tiktok'),
  ('<draft_id_3>', 'Caption 3', '#encryption,#vpn', 'DE', 'carousel', NOW() - INTERVAL '1 day', 'facebook')
RETURNING id;

-- Copy the IDs and insert metrics:
INSERT INTO metrics (platform, likes, comments, shares, views, engagement_rate, social_published_id, measured_at)
VALUES
  ('instagram', 50, 12, 3, 1000, 6.5, '<social_pub_id_1>', NOW()),
  ('instagram', 75, 15, 5, 1200, 7.1, '<social_pub_id_1>', NOW() - INTERVAL '1 second'),
  ('tiktok', 150, 45, 12, 3000, 5.2, '<social_pub_id_2>', NOW() - INTERVAL '2 seconds'),
  ('facebook', 25, 8, 1, 800, 4.0, '<social_pub_id_3>', NOW() - INTERVAL '3 seconds');

SELECT COUNT(*) FROM metrics;
EOF
```

### 4b. Trigger Workflow Manually

**Option A: Via n8n UI**
1. Open workflow **W41 Learning Loop Engine**
2. Click **Test Workflow** (play button)
3. Select **Schedule Daily (04:00 UTC)** as trigger
4. Click **Execute**
5. Watch execution logs

**Option B: Via Webhook**
```bash
curl -X POST http://localhost:5678/webhook/learning-run \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4c. Verify Outputs

```bash
# Check marketing_config updated
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  -c "SELECT key, config_data FROM marketing_config WHERE key IN ('topic_scores', 'last_learning_run_at') LIMIT 2"

# Check performance_insights populated
psql -h postgres.leobox.internal -U adoff_writer -d adoff_autopilot \
  -c "SELECT COUNT(*), metric_type FROM performance_insights WHERE created_at > NOW() - INTERVAL '5 minutes' GROUP BY metric_type"

# Expected output:
#  count | metric_type
# -------+------------------
#      3 | topic_score
#     30 | hashtag_score
```

### 4d. Check Telegram Report

Your admin chat should receive a message like:
```
✅ Learning Loop W41 — 2026-05-21

📊 Analytics Summary

Metrics analyzed: 4

Top Topic: privacy
Top Hashtag: #privacy
Top Language: IT (+6.50% engagement)

...
```

If no message, check:
- Telegram bot token is valid
- Chat ID is numeric (not `@username`)
- n8n environment variables are set

---

## Step 5: Activate Cron Schedule (1 minute)

1. Open workflow **W41 Learning Loop Engine**
2. Click **Schedule Daily (04:00 UTC)** node
3. Ensure trigger is **ACTIVE** (toggle switch)
4. Save: **Ctrl+S**

The workflow will now run automatically every day at 04:00 UTC.

---

## Step 6: Run Smoke Tests (Optional, 2 minutes)

```bash
# Install test dependencies
cd sviluppo/ai-autopilot/n8n-workflows
npm install pg axios dotenv

# Configure .env
cat > .env << 'EOF'
ADOFF_PG_HOST=postgres.leobox.internal
ADOFF_PG_PORT=5432
ADOFF_PG_DATABASE=adoff_autopilot
ADOFF_PG_USER=adoff_writer
ADOFF_PG_PASSWORD=<your_password>
TELEGRAM_BOT_TOKEN=<bot_token>
TELEGRAM_CHAT_ID_ADMIN=<chat_id>
N8N_WEBHOOK_URL=http://localhost:5678/webhook/learning-run
EOF

# Run tests
node tests/w41-smoke-tests.js
```

Expected output:
```
✓ Database connectivity
✓ Required tables exist
✓ Required indexes exist
✓ Load 10 test metrics
✓ Detect cold-start
✓ Topic aggregation correctness
✓ Hashtag extraction & aggregation
✓ Language performance aggregation
✓ Marketing config upsert
✓ Performance insights insert
✓ Webhook connectivity check
✓ Telegram API connectivity check
✓ Query performance
✓ Cold-start execution path

14 passed, 0 failed
```

---

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "No metrics found" (day 1) | Normal! Wait for W40 to populate metrics |
| Telegram message not sent | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID_ADMIN` in n8n env |
| PostgreSQL connection error | Check DB credential in n8n, test with `psql` command |
| Execution timeout (>10s) | Check indexes: `psql -c "SELECT * FROM pg_stat_user_indexes WHERE tablename='metrics'"` |
| Cold-start detection not working | Ensure `check_cold_start` node has correct field name: `validate_metrics.json.status` |

---

## Monitoring After Deployment

### Daily Checklist

- [ ] Check n8n workflow executions page
- [ ] Verify Telegram report received (daily at ~04:15 UTC)
- [ ] Spot-check `marketing_config` contains latest scores
- [ ] Check `performance_insights` growing (>0 rows/day)

### Weekly Checklist

- [ ] Run smoke tests again: `node tests/w41-smoke-tests.js`
- [ ] Review query performance: check PostgreSQL slow-query log
- [ ] Verify indexes not fragmented: `REINDEX INDEX idx_metrics_measured_at_desc`

---

## Next Steps

Once W41 is live:
1. **W00 Master Orchestrator** will read `marketing_config.topic_scores` to select next topics
2. **W10 Content Generator** will use `best_post_times` to schedule posts
3. **W20 Format Optimizer** will prefer `winning_formats`
4. **Loop closes**: Better data → better insights → better content

---

## Support

**Issues?**
- Check n8n execution logs: **Workflows** → **W41** → **Executions**
- Review PostgreSQL logs: `tail -f /var/log/postgresql/postgresql.log`
- Test database: `psql -d adoff_autopilot -f sql/w41-learning-loop-queries.sql --echo-all`

**Documentation**: See `docs/W41-LEARNING-LOOP-ENGINE.md` for complete technical spec.

---

**Status**: Ready to deploy ✓  
**Last Updated**: 2026-05-20
