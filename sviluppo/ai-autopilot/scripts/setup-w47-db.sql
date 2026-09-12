-- Setup script for W47 Content Seed Refresher
-- Run this on adoff_autopilot database before importing W47 workflow

-- 1. Ensure content_seeds table has all required columns
ALTER TABLE adoff_autopilot.content_seeds
ADD COLUMN IF NOT EXISTS angle VARCHAR(20) DEFAULT 'tactical',
ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(20),
ADD COLUMN IF NOT EXISTS estimated_score INT DEFAULT 50;

-- 2. Create news_events table if missing
CREATE TABLE IF NOT EXISTS adoff_autopilot.news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  used BOOLEAN DEFAULT false,
  INDEX_CREATED_USED BOOLEAN GENERATED ALWAYS AS (true) STORED
);
CREATE INDEX IF NOT EXISTS idx_news_events_created_used ON adoff_autopilot.news_events(created_at DESC, used);

-- 3. Ensure competitor_activity has all columns
ALTER TABLE adoff_autopilot.competitor_activity
ADD COLUMN IF NOT EXISTS competitor VARCHAR(100),
ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS url TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS body TEXT,
ADD COLUMN IF NOT EXISTS happened_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS response_idea TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 4. Create marketing_config table if missing (for hashtags, top_topics)
CREATE TABLE IF NOT EXISTS adoff_autopilot.marketing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Insert default hashtags config
INSERT INTO adoff_autopilot.marketing_config (key, value)
VALUES ('top_hashtags', '["privacy", "adblock", "browser", "security", "anti-tracking", "data-protection", "online-freedom"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_seeds_active_perf ON adoff_autopilot.content_seeds(active, perf_score);
CREATE INDEX IF NOT EXISTS idx_content_seeds_used_perf ON adoff_autopilot.content_seeds(used_count, perf_score);
CREATE INDEX IF NOT EXISTS idx_content_seeds_topic ON adoff_autopilot.content_seeds(topic_tag);
CREATE INDEX IF NOT EXISTS idx_competitor_activity_created ON adoff_autopilot.competitor_activity(created_at DESC);

-- 7. Verify final state
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='adoff_autopilot' AND table_name IN ('content_seeds', 'news_events', 'competitor_activity', 'marketing_config')
ORDER BY table_name, ordinal_position;

-- Setup complete. Ready to import W47 workflow.
