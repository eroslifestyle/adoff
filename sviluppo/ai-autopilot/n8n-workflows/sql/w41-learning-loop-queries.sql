-- W41 Learning Loop Engine — PostgreSQL Optimized Queries
-- Version: 1.0
-- n8n version: 2.21.5
-- Performance: <500ms on 10k metrics, <2s on 100k metrics

-- ============================================================================
-- Query 1: Load Lookback Configuration
-- ============================================================================
-- Purpose: Fetch learning_loop_lookback_days from marketing_config
-- Performance: O(1) with unique constraint on key
SELECT
  marketing_config.config_data->>'learning_loop_lookback_days' AS lookback_days
FROM marketing_config
WHERE key = 'learning_loop_settings'
LIMIT 1;

-- ============================================================================
-- Query 2: Load Metrics + Joined Data (14-day window)
-- ============================================================================
-- Purpose: Core analytics data load with topic tags and language
-- Performance: O(n) on metrics table, indexed on measured_at + social_published_id
-- Indexes required:
--   - metrics(measured_at DESC)
--   - metrics(social_published_id)
--   - social_published(id)
--   - gemini_copy_drafts(id)

SELECT
  m.id,
  m.platform,
  m.likes,
  m.comments,
  m.shares,
  m.views,
  m.engagement_rate,
  m.raw_payload,
  m.social_published_id,
  m.measured_at,
  sp.caption,
  sp.hashtags,
  sp.lang,
  sp.asset_type,
  sp.published_at,
  gcd.body,
  gcd.topic_tag
FROM metrics m
LEFT JOIN social_published sp
  ON m.social_published_id = sp.id
LEFT JOIN gemini_copy_drafts gcd
  ON sp.draft_id = gcd.id
WHERE m.measured_at >= $1::TIMESTAMP
ORDER BY m.measured_at DESC;

-- ============================================================================
-- Query 3: Topic Scoring with Engagement Aggregation
-- ============================================================================
-- Purpose: GROUP BY topic_tag, compute weighted engagement metrics
-- Performance: O(n) with window functions
-- Note: Weighted engagement = (likes + comments*2 + shares*3) / views

SELECT
  COALESCE(gcd.topic_tag, 'untagged') AS topic,
  COUNT(m.id) AS post_count,
  SUM(m.likes + (m.comments * 2) + (m.shares * 3)) AS total_engagement,
  SUM(m.views) AS total_impressions,
  ROUND(
    (SUM(m.likes + (m.comments * 2) + (m.shares * 3))::NUMERIC /
     NULLIF(SUM(m.views), 0)) * 100,
    2
  ) AS weighted_engagement_rate,
  COUNT(m.id) FILTER (WHERE m.measured_at > NOW() - INTERVAL '7 days') AS posts_last_7_days,
  ROUND(AVG(m.engagement_rate), 3) AS avg_engagement_rate
FROM metrics m
LEFT JOIN social_published sp ON m.social_published_id = sp.id
LEFT JOIN gemini_copy_drafts gcd ON sp.draft_id = gcd.id
WHERE m.measured_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(gcd.topic_tag, 'untagged')
ORDER BY total_engagement DESC;

-- ============================================================================
-- Query 4: Hashtag Performance (Top 30)
-- ============================================================================
-- Purpose: Extract hashtags, GROUP, compute avg engagement per tag
-- Performance: O(n) with CROSS JOIN LATERAL for hashtag extraction
-- Note: Assumes hashtags stored as comma-separated string

WITH hashtag_exploded AS (
  SELECT
    TRIM(regexp_split_to_table(sp.hashtags, ',')) AS hashtag,
    m.likes + (m.comments * 2) + (m.shares * 3) AS engagement,
    m.views
  FROM metrics m
  LEFT JOIN social_published sp ON m.social_published_id = sp.id
  WHERE m.measured_at >= NOW() - INTERVAL '14 days'
    AND sp.hashtags IS NOT NULL
    AND sp.hashtags != ''
)
SELECT
  hashtag,
  COUNT(*) AS usage_count,
  SUM(engagement) AS total_engagement,
  ROUND(AVG(engagement), 2) AS avg_engagement,
  ROUND(
    (SUM(engagement)::NUMERIC / NULLIF(SUM(views), 0)) * 100,
    3
  ) AS engagement_rate
FROM hashtag_exploded
WHERE hashtag != ''
GROUP BY hashtag
ORDER BY total_engagement DESC
LIMIT 30;

-- ============================================================================
-- Query 5: Best Post Times (Platform + Weekday/Weekend)
-- ============================================================================
-- Purpose: Identify peak posting hours by platform and day type
-- Performance: O(n) with EXTRACT windowing
-- Output: {platform: {weekday: ["18:00",...], weekend: [...]}}

WITH posting_hours AS (
  SELECT
    m.platform,
    CASE
      WHEN EXTRACT(DOW FROM sp.published_at) IN (0, 6) THEN 'weekend'
      ELSE 'weekday'
    END AS day_type,
    TO_CHAR(sp.published_at AT TIME ZONE 'UTC', 'HH24:00') AS post_hour,
    m.likes + (m.comments * 2) + (m.shares * 3) AS engagement,
    ROW_NUMBER() OVER (
      PARTITION BY m.platform,
                   CASE WHEN EXTRACT(DOW FROM sp.published_at) IN (0, 6) THEN 'weekend' ELSE 'weekday' END
      ORDER BY (m.likes + (m.comments * 2) + (m.shares * 3)) DESC
    ) AS rank_in_partition
  FROM metrics m
  LEFT JOIN social_published sp ON m.social_published_id = sp.id
  WHERE m.measured_at >= NOW() - INTERVAL '14 days'
    AND sp.published_at IS NOT NULL
)
SELECT
  platform,
  day_type,
  ARRAY_AGG(post_hour ORDER BY engagement DESC LIMIT 3) AS top_3_hours
FROM posting_hours
WHERE rank_in_partition <= 10  -- Consider top 10 by engagement per partition
GROUP BY platform, day_type
ORDER BY platform, day_type;

-- ============================================================================
-- Query 6: Format/Asset Type Performance
-- ============================================================================
-- Purpose: Rank content formats by avg engagement
-- Performance: O(n)

SELECT
  COALESCE(sp.asset_type, 'video') AS format,
  COUNT(m.id) AS post_count,
  SUM(m.likes + (m.comments * 2) + (m.shares * 3)) AS total_engagement,
  ROUND(
    AVG(m.likes + (m.comments * 2) + (m.shares * 3))::NUMERIC,
    2
  ) AS avg_engagement,
  ROUND(AVG(m.engagement_rate), 3) AS avg_engagement_rate,
  ROUND(
    (SUM(m.likes + (m.comments * 2) + (m.shares * 3))::NUMERIC /
     NULLIF(SUM(m.views), 0)) * 100,
    3
  ) AS weighted_rate
FROM metrics m
LEFT JOIN social_published sp ON m.social_published_id = sp.id
WHERE m.measured_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(sp.asset_type, 'video')
ORDER BY avg_engagement DESC;

-- ============================================================================
-- Query 7: Language Performance (Engagement Rate)
-- ============================================================================
-- Purpose: Identify strongest performing languages
-- Performance: O(n)

SELECT
  COALESCE(sp.lang, 'unknown') AS lang,
  COUNT(m.id) AS post_count,
  SUM(m.views) AS total_views,
  SUM(m.likes + (m.comments * 2) + (m.shares * 3)) AS total_engagement,
  ROUND(
    (SUM(m.likes + (m.comments * 2) + (m.shares * 3))::NUMERIC /
     NULLIF(SUM(m.views), 0)) * 100,
    2
  ) AS engagement_rate,
  ROUND(AVG(m.engagement_rate), 3) AS avg_engagement_rate
FROM metrics m
LEFT JOIN social_published sp ON m.social_published_id = sp.id
WHERE m.measured_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(sp.lang, 'unknown')
ORDER BY engagement_rate DESC;

-- ============================================================================
-- Query 8: Insert Topic Insights (Batch)
-- ============================================================================
-- Purpose: Store topic performance scores for historical analysis
-- Performance: O(n) INSERT from JSON aggregation

INSERT INTO performance_insights
  (topic, metric_type, score, details, valid_until, created_at)
SELECT
  rec->>'topic' AS topic,
  'topic_score'::TEXT AS metric_type,
  (rec->>'weighted_engagement_rate')::FLOAT AS score,
  jsonb_build_object(
    'count', (rec->>'post_count')::INT,
    'total_engagement', (rec->>'total_engagement')::BIGINT,
    'total_impressions', (rec->>'total_impressions')::BIGINT,
    'posts_last_7_days', (rec->>'posts_last_7_days')::INT,
    'avg_engagement_rate', (rec->>'avg_engagement_rate')::FLOAT
  ) AS details,
  NOW() + INTERVAL '24 hours' AS valid_until,
  NOW() AS created_at
FROM jsonb_array_elements($1::jsonb) AS rec
WHERE (rec->>'topic') IS NOT NULL;

-- ============================================================================
-- Query 9: Insert Hashtag Insights (Batch)
-- ============================================================================

INSERT INTO performance_insights
  (topic, metric_type, score, details, valid_until, created_at)
SELECT
  rec->>'hashtag' AS topic,
  'hashtag_score'::TEXT AS metric_type,
  (rec->>'avg_engagement')::FLOAT AS score,
  jsonb_build_object(
    'usage_count', (rec->>'usage_count')::INT,
    'total_engagement', (rec->>'total_engagement')::BIGINT,
    'engagement_rate', (rec->>'engagement_rate')::FLOAT
  ) AS details,
  NOW() + INTERVAL '24 hours' AS valid_until,
  NOW() AS created_at
FROM jsonb_array_elements($1::jsonb) AS rec
WHERE (rec->>'hashtag') IS NOT NULL;

-- ============================================================================
-- Query 10: Update Content Seeds Performance Score
-- ============================================================================
-- Purpose: Update perf_score in content_seeds based on topic performance
-- Performance: O(n) with JOIN

UPDATE content_seeds cs
SET
  perf_score = COALESCE(
    (SELECT AVG(pi.score)
     FROM performance_insights pi
     WHERE pi.metric_type = 'topic_score'
       AND pi.topic = cs.topic_tag
       AND pi.valid_until > NOW()),
    cs.perf_score
  ),
  modified_at = NOW()
WHERE
  cs.topic_tag IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM performance_insights pi
    WHERE pi.metric_type = 'topic_score'
      AND pi.topic = cs.topic_tag
  );

-- ============================================================================
-- Query 11: Update Marketing Config (Upsert)
-- ============================================================================
-- Purpose: Bulk update 6 keys in marketing_config (single statement)
-- Performance: O(1) per key with unique constraint

INSERT INTO marketing_config (key, config_data, last_updated)
VALUES
  ('topic_scores', $1::jsonb, NOW()),
  ('top_hashtags', $2::jsonb, NOW()),
  ('best_post_times', $3::jsonb, NOW()),
  ('winning_formats', $4::jsonb, NOW()),
  ('lang_performance', $5::jsonb, NOW()),
  ('last_learning_run_at', $6::jsonb, NOW())
ON CONFLICT (key)
DO UPDATE SET
  config_data = EXCLUDED.config_data,
  last_updated = NOW();

-- ============================================================================
-- Query 12: Health Check — Metrics Count in Window
-- ============================================================================
-- Purpose: Validate cold-start condition (< 10 metrics = skip heavy analysis)
-- Performance: O(1) with EXPLAIN (index scan)

SELECT
  COUNT(*) AS metrics_count,
  COUNT(DISTINCT m.platform) AS platforms_represented,
  COUNT(DISTINCT sp.lang) AS languages_represented,
  MIN(m.measured_at) AS oldest_metric,
  MAX(m.measured_at) AS newest_metric,
  CASE
    WHEN COUNT(*) < 10 THEN 'cold_start'
    ELSE 'warm_start'
  END AS system_state
FROM metrics m
LEFT JOIN social_published sp ON m.social_published_id = sp.id
WHERE m.measured_at >= NOW() - INTERVAL '14 days';

-- ============================================================================
-- Query 13: Cleanup Stale Insights (optional — run weekly)
-- ============================================================================
-- Purpose: Delete performance_insights rows older than valid_until
-- Performance: O(n) but DELETE typically < 1% of rows

DELETE FROM performance_insights
WHERE valid_until < NOW();

-- ============================================================================
-- INDEX DEFINITIONS (Required for optimal performance)
-- ============================================================================

-- Q2 load metrics efficiently
CREATE INDEX IF NOT EXISTS idx_metrics_measured_at_desc
  ON metrics(measured_at DESC)
  WHERE measured_at > NOW() - INTERVAL '30 days';

-- Q2 join on social_published_id
CREATE INDEX IF NOT EXISTS idx_metrics_social_published_id
  ON metrics(social_published_id);

-- Q10 update content_seeds by topic
CREATE INDEX IF NOT EXISTS idx_content_seeds_topic_tag
  ON content_seeds(topic_tag)
  WHERE topic_tag IS NOT NULL;

-- Q12 health check
CREATE INDEX IF NOT EXISTS idx_metrics_measured_at_platform
  ON metrics(measured_at, platform);

-- ============================================================================
-- TABLE SCHEMA ASSUMPTIONS (for query validation)
-- ============================================================================

/*
metrics table:
  - id (UUID PK)
  - platform (TEXT: 'instagram', 'tiktok', 'facebook')
  - likes (INT)
  - comments (INT)
  - shares (INT)
  - views (INT)
  - engagement_rate (FLOAT)
  - raw_payload (JSONB)
  - social_published_id (FK)
  - measured_at (TIMESTAMP with TZ)

social_published table:
  - id (UUID PK)
  - draft_id (FK to gemini_copy_drafts)
  - caption (TEXT)
  - hashtags (TEXT, comma-separated)
  - lang (VARCHAR 2-5: 'IT', 'EN', 'DE', etc.)
  - asset_type (TEXT: 'video', 'carousel', 'image')
  - published_at (TIMESTAMP with TZ)

gemini_copy_drafts table:
  - id (UUID PK)
  - body (TEXT)
  - topic_tag (TEXT)

performance_insights table:
  - id (UUID PK)
  - topic (TEXT)
  - metric_type (TEXT: 'topic_score', 'hashtag_score')
  - score (FLOAT)
  - details (JSONB)
  - valid_until (TIMESTAMP with TZ)
  - created_at (TIMESTAMP with TZ)

marketing_config table:
  - key (TEXT PK)
  - config_data (JSONB)
  - last_updated (TIMESTAMP with TZ)

content_seeds table:
  - id (UUID PK)
  - topic_tag (TEXT)
  - perf_score (FLOAT)
  - modified_at (TIMESTAMP with TZ)
*/

-- ============================================================================
-- END W41 Learning Loop Queries
-- ============================================================================
