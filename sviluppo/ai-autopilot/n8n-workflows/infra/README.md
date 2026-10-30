# AdOff Autopilot Database Infrastructure

PostgreSQL 16 database schema supporting the autonomous social media manager pipeline.

## Quick Start

### Database Access
```bash
# Via Docker container
docker exec n8n-postgres psql -U n8n -d n8n

# Via local psql (if port exposed)
psql -h localhost -U n8n -d n8n
```

### Schema
- **Database:** `n8n` (created by n8n container init)
- **Schema:** `adoff_autopilot` (custom, isolated from n8n metadata)
- **Owner:** `n8n` user

### Files

| File | Purpose |
|---|---|
| `db-schema.sql` | Initial schema: accounts, posts_queue, mentions, outreach, leads, etc. |
| `migrations/001-add-published-at.sql` | Add `published_at` to `gemini_copy_drafts` |
| `migrations/002-autonomy-evolution.sql` | Core autonomy tables: metrics analytics, performance insights, A/B tests, engagement inbox |
| `migrations/MIGRATIONS.md` | Detailed documentation of each migration |

## Tables Overview

### Content Generation Pipeline
- **gemini_copy_drafts** — LLM-generated copy variants (captions, emails, ads)
- **content_seeds** — Seed topics for generation (enriched with perf_score, topic_tag)
- **ab_tests** — Caption A/B test variants with engagement tracking

### Distribution & Publishing
- **channels** — Social media platforms (Instagram, Facebook, TikTok, LinkedIn, etc.)
  - Enriched with: api_endpoint, oauth_token_ref, rate_limit, posting_window
  - 12 platforms seeded (IT/EN variants)
- **social_published** — Published posts (audit trail)
- **posts_queue** — Posts scheduled or executed
  - Enriched with: approval_score, approval_reasoning, auto_approved

### Analytics & Learning
- **metrics** — Post-level engagement data (likes, comments, shares, views, etc.)
  - Linked to social_published via social_published_id
  - Includes raw_payload (complete API response)
- **performance_insights** — Discovered patterns from W41 learning loop
  - insight_type: topic_score, hashtag_perf, best_time, format_rank, persona_score
  - valid_until: expiry date for refreshing

### Engagement Management
- **engagement_inbox** — Incoming comments, mentions, DMs
  - intent: question, praise, complaint, spam, other
  - sentiment: -1.0 to 1.0 (NLP)
  - suggested_reply: LLM-drafted response
  - status: new → drafted → sent/escalated/ignored

### Community Seeding (Legacy)
- **accounts** — Social media accounts for outreach (Reddit, Twitter, Mastodon, etc.)
- **mentions** — Discovered mentions of AdOff/competitors
- **outreach** — Cold email drip campaigns
- **leads** — Captured from popups/lead magnets

### Configuration
- **marketing_config** — Key-value store (seeded with autonomy parameters)
  - topic_scores, best_post_times, auto_approve_threshold
  - engagement_reply rules, learning loop params

### Monitoring
- **workflow_errors** — n8n workflow error logs
- **workflow_kill_switch** — Circuit breaker state
- **budget_alerts** — Spending alerts

## Workflow Integration

### W40: Metrics Collection
1. Polls social platform APIs (Instagram Graph, Facebook, TikTok, Twitter, LinkedIn)
2. Inserts rows into `metrics` table (social_published_id, platform_post_id, engagement data)
3. Stores raw_payload for debugging + future feature extraction

### W41: Learning Loop
1. Queries `metrics` table (lookback = 14 days from `marketing_config`)
2. Analyzes: topic performance, hashtag effectiveness, best posting times, format rankings, persona engagement
3. Inserts/updates rows in `performance_insights` (with valid_until expiry)
4. Updates `marketing_config.topic_scores`, `best_post_times`, etc.
5. Computes `ab_tests.win_score` for each variant (engagement normalized by frequency)

### W42: Content Generation & Approval
1. Queries `content_seeds` (filtered by `topic_tag`, ordered by `perf_score`)
2. Uses `marketing_config.best_post_times` + `channels.posting_window` for scheduling
3. Generates copy via Gemini LLM → inserts `gemini_copy_drafts`
4. Self-rates copy → `approval_score` in `posts_queue`
5. Auto-approves if score ≥ `marketing_config.auto_approve_threshold` (90)
6. Queues for posting or flags for human review

### W43: Engagement Management
1. Polls social APIs for new comments/mentions
2. Inserts `engagement_inbox` with intent + sentiment (NLP)
3. LLM drafts replies → `suggested_reply`
4. Auto-sends if: sentiment > 0.6 AND intent NOT IN escalate_intents
5. Escalates complaints/legal questions to human
6. Updates `status` (new → sent/escalated/ignored)

## Performance Considerations

### Indices
All critical query paths are indexed:
- **A/B tests:** `(draft_id, status)` for variant queries
- **Metrics:** `(social_published_id, measured_at DESC)` for post analytics
- **Engagement:** `(status, priority DESC, created_at DESC)` for inbox queue
- **Insights:** `(insight_type, valid_until DESC)` for expiry filtering

### Query Optimization
- **Partial indices:** engagement_inbox.status IN ('new', 'drafted') for unhandled queue
- **Foreign keys with CASCADE:** ab_tests, engagement_inbox (no orphans)
- **Constraints:** ab_tests.variant IN ('A','B','C'), engagement_inbox.intent constraints

### Typical Query Patterns
```sql
-- W40: Insert metrics for a post
INSERT INTO metrics (social_published_id, platform, engagement_rate, likes, comments, raw_payload)
VALUES (123, 'instagram', 0.0456, 120, 15, '{"..."}');

-- W41: Get recent performance data
SELECT platform, SUM(likes) as total_likes, AVG(engagement_rate) as avg_rate
FROM metrics
WHERE measured_at > NOW() - INTERVAL '14 days'
GROUP BY platform;

-- W42: Get high-perf seeds
SELECT seed, perf_score FROM content_seeds
WHERE active AND perf_score > 0.7
ORDER BY perf_score DESC
LIMIT 5;

-- W43: Get unhandled comments with high priority
SELECT id, author_handle, content, suggested_reply
FROM engagement_inbox
WHERE status IN ('new', 'drafted')
ORDER BY priority DESC, created_at ASC
LIMIT 10;
```

## Data Retention & Cleanup

### Recommended Policies
- **metrics:** 90 days rolling window (older data archived or deleted)
- **engagement_inbox:** 30 days after handling (if escalated, keep longer)
- **performance_insights:** valid_until controls expiry (refresh stale insights)
- **posts_queue:** Keep history (audit trail, no auto-delete)

### Example Cleanup
```sql
-- Archive old metrics
DELETE FROM metrics WHERE measured_at < NOW() - INTERVAL '90 days';

-- Archive old engagement
DELETE FROM engagement_inbox 
WHERE status IN ('sent', 'ignored') 
AND handled_at < NOW() - INTERVAL '30 days';

-- Refresh stale insights
UPDATE performance_insights 
SET valid_until = NOW() - INTERVAL '1 second'
WHERE valid_until < NOW() AND computed_at < NOW() - INTERVAL '7 days';
```

## Development & Testing

### Create Test Data
```sql
-- Test post
INSERT INTO social_published (post_id, platform, account_ref, platform_post_id, published_url, caption, published_at)
VALUES (1, 'instagram', 'adoff@instagram', 'ig_123', 'https://instagram.com/p/abc123', 'Test caption', NOW());

-- Test metrics
INSERT INTO metrics (social_published_id, platform, likes, comments, engagement_rate, measured_at)
VALUES (1, 'instagram', 45, 8, 0.0456, NOW());

-- Test engagement
INSERT INTO engagement_inbox (platform, source_post_id, comment_id, author_handle, content, intent, sentiment)
VALUES ('instagram', 'ig_123', 'cmt_456', 'user123', 'Love this!', 'praise', 0.9);
```

### Verify Migrations
```sql
-- List all tables in schema
\dt adoff_autopilot.*

-- Check specific table
\d adoff_autopilot.metrics

-- List indices
SELECT indexname FROM pg_indexes WHERE schemaname = 'adoff_autopilot';
```

## Troubleshooting

### Connection Issues
```bash
# Check n8n postgres container is running
docker ps | grep n8n-postgres

# Check port (usually 5432)
docker port n8n-postgres | grep 5432

# Test connection from host
psql -h localhost -U n8n -d n8n -c "SELECT 1;"
```

### Schema Verification
```sql
-- Verify schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'adoff_autopilot';

-- Verify owner
SELECT owner FROM pg_shdescription WHERE objoid = 'adoff_autopilot'::regnamespace;

-- Count tables
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'adoff_autopilot';
```

### Data Issues
```sql
-- Find orphaned ab_tests (draft_id not in gemini_copy_drafts)
SELECT * FROM ab_tests WHERE draft_id NOT IN (SELECT id FROM gemini_copy_drafts);

-- Find duplicate platform comments
SELECT platform, comment_id, COUNT(*) FROM engagement_inbox GROUP BY platform, comment_id HAVING COUNT(*) > 1;

-- Find posts without metrics
SELECT id FROM social_published WHERE id NOT IN (SELECT DISTINCT social_published_id FROM metrics WHERE social_published_id IS NOT NULL);
```

## Backup & Recovery

### Backup
```bash
# Full schema dump
docker exec n8n-postgres pg_dump -U n8n -d n8n -n adoff_autopilot > adoff_schema_backup.sql

# Restore
docker exec -i n8n-postgres psql -U n8n -d n8n < adoff_schema_backup.sql
```

### Point-in-Time Recovery (PITR)
Requires WAL archiving enabled. Contact DevOps for n8n-postgres WAL configuration.

## Security

### User Permissions
The `n8n` user is owner of schema `adoff_autopilot`:
```sql
-- Verify
SELECT grantor, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'adoff_autopilot' AND grantee = 'n8n';
```

### Secrets
OAuth tokens are stored in `channels.oauth_token_ref` (references n8n credential IDs, not raw tokens).
Raw tokens are encrypted and managed by n8n.

## Version History

| Migration | Date | Changes |
|---|---|---|
| 001 | 2026-05-20 | Add published_at to gemini_copy_drafts |
| 002 | 2026-05-20 | Autonomy evolution: metrics, insights, A/B tests, engagement inbox |
