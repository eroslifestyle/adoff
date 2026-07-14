-- =========================================================================
-- Migration: 002-autonomy-evolution.sql
-- Date: 2026-05-20
-- Purpose: Schema evolution for autonomous social media manager
-- Supports: W40 (metrics/analytics), W41 (learning), engagement inbox,
--           A/B testing, multi-platform distribution, content approvals
-- =========================================================================

SET search_path TO adoff_autopilot, public;

-- =========================================================================
-- 1. METRICS TABLE EVOLUTION
-- =========================================================================
-- Current metrics table tracks workflow-level metrics (rate limits, errors).
-- Evolve to track post-level analytics from W40 (social media API feedback).
-- Keep existing columns, add new ones for platform-specific metrics.

ALTER TABLE adoff_autopilot.metrics
ADD COLUMN IF NOT EXISTS social_published_id BIGINT REFERENCES adoff_autopilot.social_published(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS platform_post_id TEXT,
ADD COLUMN IF NOT EXISTS measured_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reach INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS saves INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(6,4),
ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Add indexes for efficient queries by W41 learning loop
CREATE INDEX IF NOT EXISTS idx_metrics_social_published_measured
ON adoff_autopilot.metrics (social_published_id, measured_at DESC)
WHERE social_published_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metrics_platform_measured
ON adoff_autopilot.metrics (platform, measured_at DESC)
WHERE platform IS NOT NULL;

COMMENT ON COLUMN adoff_autopilot.metrics.social_published_id IS 'FK to social_published; enables linking analytics back to original post';
COMMENT ON COLUMN adoff_autopilot.metrics.engagement_rate IS 'Calculated as (likes+comments+shares) / impressions; NUMERIC(6,4) for precision';
COMMENT ON COLUMN adoff_autopilot.metrics.raw_payload IS 'Complete API response (JSON); enables audit and future feature extraction';

-- =========================================================================
-- 2. PERFORMANCE_INSIGHTS TABLE (NEW)
-- =========================================================================
-- W41 learning loop: stores discovered insights (topic scores, best times, etc.)
-- Valid until expiry; allows multiple insight types per key.

CREATE TABLE IF NOT EXISTS adoff_autopilot.performance_insights (
    id              BIGSERIAL PRIMARY KEY,
    insight_type    TEXT NOT NULL,              -- topic_score|hashtag_perf|best_time|format_rank|persona_score
    key             TEXT NOT NULL,              -- "astrology" (topic), "#privacy" (hashtag), "18:00" (time), "reel+caption" (format), etc.
    value           NUMERIC NOT NULL,           -- 0.0-100.0 score
    payload         JSONB,                      -- metadata: {frequency: 12, samples: 45, confidence: 0.92}
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    valid_until     TIMESTAMPTZ,                -- NULL = indefinite; insights older than this can be refreshed
    UNIQUE(insight_type, key)
);

CREATE INDEX IF NOT EXISTS idx_perf_insights_type_validity
ON adoff_autopilot.performance_insights (insight_type, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_perf_insights_key_type
ON adoff_autopilot.performance_insights (key, insight_type);

COMMENT ON TABLE adoff_autopilot.performance_insights IS 'Consolidated output of W41 learning loop; enables W42+ to optimize content';
COMMENT ON COLUMN adoff_autopilot.performance_insights.payload IS 'Rich metadata: sample count, confidence score, competing insights, etc.';

-- =========================================================================
-- 3. AB_TESTS TABLE (NEW)
-- =========================================================================
-- Caption A/B testing: stores variants, posting history, engagement tallies.
-- Determines "winner" variant based on win_score (normalized engagement).

CREATE TABLE IF NOT EXISTS adoff_autopilot.ab_tests (
    id              BIGSERIAL PRIMARY KEY,
    draft_id        BIGINT NOT NULL REFERENCES adoff_autopilot.gemini_copy_drafts(id) ON DELETE CASCADE,
    variant         TEXT NOT NULL CHECK (variant IN ('A', 'B', 'C')),  -- uppercase single char
    body            JSONB NOT NULL,             -- {caption: "...", hashtags: [...], cta: "..."}
    posted_count    INT DEFAULT 0,              -- times this variant was posted
    total_engagement INT DEFAULT 0,             -- SUM(likes+comments+shares) across all posts
    win_score       NUMERIC(6,4),               -- normalized: total_engagement / posted_count / (days_active)
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'winner', 'losing', 'stopped')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(draft_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_draft_status
ON adoff_autopilot.ab_tests (draft_id, status);

CREATE INDEX IF NOT EXISTS idx_ab_tests_winner
ON adoff_autopilot.ab_tests (draft_id) WHERE status = 'winner';

COMMENT ON TABLE adoff_autopilot.ab_tests IS 'Caption variant testing; W42 runs experiments, W41 updates scores, W43 picks winner';
COMMENT ON COLUMN adoff_autopilot.ab_tests.body IS 'Structured caption data; allows variants to differ in hashtags/CTA while keeping same core message';
COMMENT ON COLUMN adoff_autopilot.ab_tests.win_score IS 'Normalized engagement score; accounts for posting frequency and duration';

-- =========================================================================
-- 4. ENGAGEMENT_INBOX TABLE (NEW)
-- =========================================================================
-- Captures comments, mentions, DMs from social media platforms.
-- W43 auto-drafts replies based on sentiment/intent; human review gate before sending.

CREATE TABLE IF NOT EXISTS adoff_autopilot.engagement_inbox (
    id              BIGSERIAL PRIMARY KEY,
    platform        TEXT NOT NULL,              -- instagram|facebook|tiktok|twitter|linkedin|mastodon|bluesky|reddit
    source_post_id  TEXT NOT NULL,              -- post on which comment appeared
    comment_id      TEXT NOT NULL,              -- unique ID per platform
    author_handle   TEXT NOT NULL,
    content         TEXT NOT NULL,              -- raw comment text
    intent          TEXT NOT NULL CHECK (intent IN ('question', 'praise', 'complaint', 'spam', 'other')),
    sentiment       NUMERIC(3,2) DEFAULT 0.0,  -- -1.0 to 1.0 (negative to positive)
    priority        INT DEFAULT 5,              -- 1-10; higher = urgent (complaints = 8, spam = 1)
    suggested_reply TEXT,                       -- LLM-drafted response (human approved before sending)
    status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'drafted', 'sent', 'escalated', 'ignored')),
    handled_at      TIMESTAMPTZ,                -- when action was taken
    handled_by      TEXT,                       -- n8n workflow, human, system
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_inbox_status_priority
ON adoff_autopilot.engagement_inbox (status, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_inbox_platform_post
ON adoff_autopilot.engagement_inbox (platform, source_post_id);

CREATE INDEX IF NOT EXISTS idx_engagement_inbox_new_unhandled
ON adoff_autopilot.engagement_inbox (created_at DESC) WHERE status IN ('new', 'drafted');

COMMENT ON TABLE adoff_autopilot.engagement_inbox IS 'Incoming comments/mentions; W43 drafts replies, human reviews, system auto-sends safe ones';
COMMENT ON COLUMN adoff_autopilot.engagement_inbox.sentiment IS 'Sentiment score from NLP (e.g. Hugging Face zero-shot); -1=hostile, 0=neutral, 1=adoring';
COMMENT ON COLUMN adoff_autopilot.engagement_inbox.priority IS 'Urgency ranking; complaints (8), questions (6), praise (4), spam (1)';

-- =========================================================================
-- 5. CHANNELS TABLE ENRICHMENT
-- =========================================================================
-- Add distribution metadata: API endpoints, OAuth, rate limits, posting windows.

ALTER TABLE adoff_autopilot.channels
ADD COLUMN IF NOT EXISTS api_endpoint TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_ref TEXT,
ADD COLUMN IF NOT EXISTS rate_limit_per_hour INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS posting_window JSONB;  -- {weekday_best: ["18:00","20:00"], weekend_best: ["10:00","14:00"]}

COMMENT ON COLUMN adoff_autopilot.channels.api_endpoint IS 'Platform-specific API URL (e.g., Instagram Graph API base)';
COMMENT ON COLUMN adoff_autopilot.channels.oauth_token_ref IS 'Reference to n8n credential ID (n8n stores actual tokens)';
COMMENT ON COLUMN adoff_autopilot.channels.rate_limit_per_hour IS 'Platform-enforced limit; used by W40 scheduler to avoid throttling';
COMMENT ON COLUMN adoff_autopilot.channels.posting_window IS 'JSON: best times to post per day-of-week; W42 uses for scheduling';

-- =========================================================================
-- 6. POSTS_QUEUE TABLE ENRICHMENT
-- =========================================================================
-- Add intelligent approval scoring and auto-approve gate.

ALTER TABLE adoff_autopilot.posts_queue
ADD COLUMN IF NOT EXISTS approval_score NUMERIC(5,2),  -- 0.0-100.0; LLM self-rating before posting
ADD COLUMN IF NOT EXISTS approval_reasoning TEXT,      -- Why score is what it is (for audit)
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;  -- Did it pass auto-approve threshold?

COMMENT ON COLUMN adoff_autopilot.posts_queue.approval_score IS 'Quality score from content generation; >90 = auto-approve, else human review';
COMMENT ON COLUMN adoff_autopilot.posts_queue.auto_approved IS 'true if passed auto-approve gate without human intervention';

-- =========================================================================
-- 7. CONTENT_SEEDS TABLE ENRICHMENT
-- =========================================================================
-- Track topic tags and performance scores for orchestrator picking.

ALTER TABLE adoff_autopilot.content_seeds
ADD COLUMN IF NOT EXISTS topic_tag TEXT,          -- "astrology"|"privacy"|"browser-wars" etc.
ADD COLUMN IF NOT EXISTS perf_score NUMERIC(6,4) DEFAULT 0.5;  -- 0.0-1.0 from W41 learning

COMMENT ON COLUMN adoff_autopilot.content_seeds.topic_tag IS 'Categorical tag; W42 filters by topic when generating new content';
COMMENT ON COLUMN adoff_autopilot.content_seeds.perf_score IS 'How well this seed performs; updated by W41; used by orchestrator for weighting';

-- =========================================================================
-- 8. MARKETING_CONFIG SEED/UPDATE
-- =========================================================================
-- Upsert config keys for autonomy:
-- - topic_scores (populated by W41)
-- - best_post_times (default; overridable by W41)
-- - auto_approve_threshold
-- - engagement reply rules
-- - learning loop lookback

INSERT INTO adoff_autopilot.marketing_config (key, value)
VALUES
    ('topic_scores', '{}'),
    ('best_post_times', '{"instagram": ["18:00","20:00"], "facebook": ["12:00","19:00"], "tiktok": ["17:00","21:00"], "twitter": ["09:00","15:00"], "linkedin": ["08:00","12:00","17:00"]}'),
    ('auto_approve_threshold', '90'),
    ('engagement_reply_threshold_min_sentiment', '0.6'),
    ('engagement_reply_escalate_intents', '["complaint", "legal_question", "press_request"]'),
    ('learning_loop_lookback_days', '14')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =========================================================================
-- 9. CHANNELS TABLE SEED/UPDATE
-- =========================================================================
-- Ensure all major platforms are registered with placeholder OAuth refs.
-- active=false by default (requires manual OAuth setup per environment).

INSERT INTO adoff_autopilot.channels (platform, channel, lang, post_style, priority, status, active)
VALUES
    ('instagram', '@adoffapp', 'it', 'reel', 1, 'planned', false),
    ('instagram', '@adoffapp', 'en', 'reel', 1, 'planned', false),
    ('facebook', '/adoffapp', 'it', 'engaging', 2, 'planned', false),
    ('facebook', '/adoffapp', 'en', 'engaging', 2, 'planned', false),
    ('tiktok', '@adoffapp', 'it', 'trend', 1, 'planned', false),
    ('tiktok', '@adoffapp', 'en', 'trend', 1, 'planned', false),
    ('twitter', '@adoffapp', 'it', 'witty', 3, 'planned', false),
    ('twitter', '@adoffapp', 'en', 'witty', 3, 'planned', false),
    ('linkedin', '/company/adoff', 'en', 'professional', 2, 'planned', false),
    ('mastodon', '@adoff@fosstodon.org', 'en', 'community', 3, 'planned', false),
    ('bluesky', '@adoff.app', 'en', 'engaging', 3, 'planned', false),
    ('reddit', 'r/AdOff', 'en', 'community', 3, 'planned', false)
ON CONFLICT (platform, channel, lang) DO UPDATE SET active = false, status = 'planned';

-- =========================================================================
-- SUMMARY COMMENTS
-- =========================================================================
-- Evolution enables:
-- W40: Fetch metrics from APIs → metrics table (social_published_id + engagement columns)
-- W41: Analyze metrics → performance_insights table (topic scores, best times, etc.)
-- W42: Pick seeds + generate content → uses perf_score, topic_tag, best_post_times from insights
--      Intelligently approve (approval_score > auto_approve_threshold) → posts_queue
-- W43: Monitor engagement → engagement_inbox table
--      Draft replies (LLM) based on sentiment/intent → engagement_inbox.suggested_reply
--      Auto-send safe ones (sentiment > threshold, intent NOT in escalate list)
-- A/B tests: Variants stored in ab_tests; W41 updates win_score; winner picked for rollout

COMMENT ON SCHEMA adoff_autopilot IS 'Autonomous social media manager database; W40→W41→W42→W43 pipeline';
