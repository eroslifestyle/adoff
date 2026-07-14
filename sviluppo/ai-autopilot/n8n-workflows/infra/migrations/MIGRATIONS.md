# Database Migrations — AdOff Autopilot

Schema evolution for autonomous social media manager pipeline.

## Migration 001: Add Published Tracking
**File:** `001-add-published-at.sql`
**Date:** 2026-05-20

Adds `published_at` column to `gemini_copy_drafts` to track when content is published to external systems.

## Migration 002: Autonomy Evolution
**File:** `002-autonomy-evolution.sql`
**Date:** 2026-05-20

Core schema upgrade enabling the autonomous social media manager pipeline (W40 → W41 → W42 → W43).

### New Tables

#### `performance_insights`
Output of W41 learning loop. Stores discovered patterns:
- **insight_type:** `topic_score`, `hashtag_perf`, `best_time`, `format_rank`, `persona_score`
- **key:** Topic name ("astrology"), hashtag ("#privacy"), time ("18:00"), format ("reel+caption"), persona handle
- **value:** Score 0.0-100.0 (normalized)
- **payload:** Rich metadata (sample count, confidence, competing insights)
- **valid_until:** Expiry date for refreshing stale insights

Used by: W42 (content generation), W41 (continuous learning)

#### `ab_tests`
Caption variant testing framework:
- **draft_id:** FK to gemini_copy_drafts
- **variant:** A, B, or C
- **body:** JSONB with {caption, hashtags, cta} — allows nuanced testing
- **posted_count:** Times this variant was posted
- **total_engagement:** Sum of likes+comments+shares across all posts
- **win_score:** Normalized engagement (accounts for frequency + duration)
- **status:** active → winner/losing → stopped

Workflow: W42 generates variants → W40 posts → W41 measures engagement + updates win_score → winner variant rolled out.

#### `engagement_inbox`
Incoming comments, mentions, DMs from social platforms:
- **platform:** instagram, facebook, tiktok, twitter, linkedin, mastodon, bluesky, reddit
- **source_post_id:** Post on which comment appeared
- **comment_id:** Unique per platform (UNIQUE constraint)
- **intent:** question, praise, complaint, spam, other
- **sentiment:** -1.0 to 1.0 (NLP-based)
- **priority:** 1-10 (complaints=8, spam=1, questions=6, praise=4)
- **suggested_reply:** LLM-drafted response (human review gate before sending)
- **status:** new → drafted → sent/escalated/ignored

Workflow: W43 monitors engagement → auto-drafts replies (sentiment + intent-based) → human review → safe ones auto-sent (high confidence, non-escalation intent).

### Enhanced Existing Tables

#### `metrics` (analytics evolution)
Tracks post-level performance metrics from platform APIs:
- **social_published_id:** FK to social_published (enables linking analytics back to original post)
- **platform_post_id:** Platform-specific post ID
- **measured_at:** When metric was captured
- **likes, comments, shares, views, impressions, reach, clicks, saves:** Engagement tallies
- **engagement_rate:** (likes+comments+shares) / impressions
- **raw_payload:** Complete API response (enables future feature extraction + audit)

Used by: W40 (collects), W41 (analyzes for insights), W42 (uses insights for optimization)

#### `channels` (distribution metadata)
Added columns for multi-platform distribution:
- **api_endpoint:** Platform-specific API URL (e.g., Instagram Graph API)
- **oauth_token_ref:** Reference to n8n credential ID
- **rate_limit_per_hour:** Platform-enforced rate limit (prevents throttling)
- **active:** Boolean (false by default; requires manual OAuth setup per environment)
- **posting_window:** JSONB with {weekday_best: ["18:00","20:00"], weekend_best: ["10:00","14:00"]}

Seeded with 12 platform variants:
- Instagram (IT/EN) — reel format
- Facebook (IT/EN) — engaging format
- TikTok (IT/EN) — trend format
- Twitter (IT/EN) — witty format
- LinkedIn (EN) — professional format
- Mastodon (EN) — community format
- Bluesky (EN) — engaging format
- Reddit (EN) — community format

All seeded with `active=false` (requires manual OAuth credential setup per environment).

#### `posts_queue` (intelligent approval)
Added approval scoring for auto-approve gate:
- **approval_score:** 0.0-100.0 (LLM self-rating before posting)
- **approval_reasoning:** Audit trail (why the score)
- **auto_approved:** Boolean (true if score > auto_approve_threshold)

Used by: W42 (generates + scores content) → auto-approve if score ≥ 90, else human review.

#### `content_seeds` (orchestrator optimization)
Added performance tracking:
- **topic_tag:** Categorical tag ("astrology", "privacy", "browser-wars") for filtering
- **perf_score:** 0.0-1.0 normalized score from W41 learning (weights seed selection)

Used by: W42 (picks high-perf seeds), W41 (updates scores continuously).

### Seeded Configuration

#### `marketing_config` (autonomy parameters)
6 new keys inserted/updated:
- **topic_scores:** {} (populated by W41)
- **best_post_times:** {platform: [times]} (defaults seeded; overridable by W41)
- **auto_approve_threshold:** 90 (approval_score > 90 auto-approves)
- **engagement_reply_threshold_min_sentiment:** 0.6 (only reply if sentiment > 0.6)
- **engagement_reply_escalate_intents:** ["complaint", "legal_question", "press_request"] (escalate to human)
- **learning_loop_lookback_days:** 14 (W41 uses last 14 days for analysis)

## Indices

All tables are indexed for efficient querying:

### performance_insights
- `(insight_type, valid_until DESC)` — W41 lookups by type with expiry filtering
- `(key, insight_type)` — Orchestra lookups by topic/format

### ab_tests
- `(draft_id, status)` — Find all variants for a draft
- `(draft_id) WHERE status='winner'` — Quick winner lookup

### engagement_inbox
- `(status, priority DESC, created_at DESC)` — Queue for W43 processing
- `(platform, source_post_id)` — Find all comments on a post
- `(created_at DESC) WHERE status IN ('new', 'drafted')` — Unhandled inbox

### metrics
- `(social_published_id, measured_at DESC)` — Fetch latest metrics for a post
- `(platform, measured_at DESC)` — Platform-level trend analysis

## Execution Notes

All migrations are **idempotent**: can be re-run without errors.
- `CREATE TABLE IF NOT EXISTS` — skips if table exists
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — skips existing columns
- `INSERT ... ON CONFLICT ... DO UPDATE` — upserts seed data

## Running Migrations

```bash
# Via docker-compose
docker exec n8n-postgres psql -U n8n -d n8n -f /path/to/migration.sql

# Or local psql with port mapping
psql -h localhost -U n8n -d n8n -f migration.sql
```

## Schema Diagram (Relationships)

```
gemini_copy_drafts ──┬──→ ab_tests (draft_id FK)
                     └──→ posts_queue (indirect via workflow)

social_published ──→ metrics (social_published_id FK)

channels ──(many)─→ content_seeds (implicit via orchestrator)

engagement_inbox ──(standalone, per-platform)
  └─ status: new → drafted → sent/escalated/ignored

performance_insights ──(standalone, queried by W41/W42)
  └─ types: topic_score, hashtag_perf, best_time, format_rank, persona_score

marketing_config ──(key-value store, referenced globally)
```

## Testing & Validation

Verify after applying migrations:

```sql
-- Check new tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'adoff_autopilot' 
AND tablename IN ('performance_insights', 'ab_tests', 'engagement_inbox');

-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'adoff_autopilot' 
AND table_name = 'metrics' 
AND column_name IN ('social_published_id', 'engagement_rate', 'raw_payload');

-- Check indices exist
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'adoff_autopilot' 
AND tablename IN ('performance_insights', 'ab_tests', 'engagement_inbox', 'metrics');

-- Check seeds
SELECT COUNT(*) FROM adoff_autopilot.marketing_config 
WHERE key IN ('topic_scores', 'best_post_times', 'auto_approve_threshold');

SELECT COUNT(*) FROM adoff_autopilot.channels 
WHERE platform IN ('instagram', 'facebook', 'tiktok', 'twitter', 'linkedin');
```
