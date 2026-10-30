-- Fase 1: Schema Postgres per ViralContentEngine
-- Database: adoff_autopilot (stesso DB di W40/W41)
-- Tables: viral_patterns, pattern_performance
-- Created: 2026-05-22

-- Extension per vector support (se non già presente)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabella principale: pattern virali estratti
CREATE TABLE IF NOT EXISTS viral_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificazione e source
  source TEXT NOT NULL CHECK (source IN ('external_instagram', 'external_tiktok', 'internal_adoff')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('hook', 'pacing', 'structure', 'pain_point', 'angle', 'trend')),

  -- Contenuto del pattern
  description TEXT NOT NULL,  -- "es: Video hook da 0-3s con domanda retorica + dramatic pause"
  example_captions TEXT[],    -- Array di caption che incarnano il pattern

  -- Performance
  perf_score FLOAT DEFAULT 0.0,  -- Media engagement_rate da pattern_performance
  perf_score_yt FLOAT DEFAULT 0.0,  -- per TikTok: completion_rate
  perf_score_ig FLOAT DEFAULT 0.0,  -- per IG: save-rate/share-rate blended

  -- Vector embedding (nomic-embed-text 384 dims)
  embedding VECTOR(384) DEFAULT NULL,

  -- Metadata
  last_scored_at TIMESTAMP DEFAULT NULL,  -- Ultima volta che rerank ha aggiornato perf_score
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_viral_patterns_source ON viral_patterns(source);
CREATE INDEX IF NOT EXISTS ix_viral_patterns_platform ON viral_patterns(platform);
CREATE INDEX IF NOT EXISTS ix_viral_patterns_pattern_type ON viral_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS ix_viral_patterns_perf_score ON viral_patterns(perf_score DESC);
CREATE INDEX IF NOT EXISTS ix_viral_patterns_embedding ON viral_patterns USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Tabella: link tra pattern estratto e post pubblicato + metriche risultanti
CREATE TABLE IF NOT EXISTS pattern_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link a pattern estratto
  pattern_id UUID NOT NULL REFERENCES viral_patterns(id) ON DELETE CASCADE,

  -- Link a post pubblicato (da social_published table di W40)
  post_id TEXT NOT NULL,  -- ID da IG Graph API o TikTok API
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),

  -- Metriche risultato effettivo
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  saves INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  watch_time_seconds INT DEFAULT 0,
  completion_rate FLOAT DEFAULT 0.0,  -- TikTok specific

  -- Aggregati
  engagement_rate FLOAT DEFAULT 0.0,  -- (saves + shares) / views (IG metric)
  virality_score FLOAT DEFAULT 0.0,  -- Calcolato come (shares + saves * 0.8) / (likes + 1)

  -- Timing
  published_at TIMESTAMP,
  metrics_collected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_pattern_performance_pattern_id ON pattern_performance(pattern_id);
CREATE INDEX IF NOT EXISTS ix_pattern_performance_post_id ON pattern_performance(post_id);
CREATE INDEX IF NOT EXISTS ix_pattern_performance_platform ON pattern_performance(platform);
CREATE INDEX IF NOT EXISTS ix_pattern_performance_engagement_rate ON pattern_performance(engagement_rate DESC);

-- Tabella: log di run scrape+analyze (audit trail)
CREATE TABLE IF NOT EXISTS viral_ce_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata run
  run_type TEXT NOT NULL CHECK (run_type IN ('scrape', 'analyze', 'rerank', 'full-pipeline')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'all')),

  -- Cosa è stato fatto
  hashtags_processed TEXT[],
  posts_scraped INT DEFAULT 0,
  posts_analyzed INT DEFAULT 0,
  new_patterns_found INT DEFAULT 0,
  patterns_ranked INT DEFAULT 0,

  -- Risultati
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INT
);

CREATE INDEX IF NOT EXISTS ix_viral_ce_runs_run_type ON viral_ce_runs(run_type);
CREATE INDEX IF NOT EXISTS ix_viral_ce_runs_platform ON viral_ce_runs(platform);
CREATE INDEX IF NOT EXISTS ix_viral_ce_runs_completed_at ON viral_ce_runs(completed_at DESC);

-- View: Top performing patterns by platform
CREATE OR REPLACE VIEW v_top_patterns AS
SELECT
  p.id,
  p.source,
  p.platform,
  p.pattern_type,
  p.description,
  p.perf_score,
  CASE WHEN p.platform = 'tiktok' THEN p.perf_score_yt ELSE p.perf_score_ig END as platform_specific_score,
  p.example_captions,
  p.created_at,
  p.last_scored_at,
  COUNT(DISTINCT pp.post_id) as usage_count
FROM viral_patterns p
LEFT JOIN pattern_performance pp ON p.id = pp.pattern_id
GROUP BY p.id
ORDER BY platform_specific_score DESC NULLS LAST;

-- View: Pattern performance over time (for trend analysis)
CREATE OR REPLACE VIEW v_pattern_performance_timeline AS
SELECT
  p.pattern_id,
  p.platform,
  DATE_TRUNC('week', p.metrics_collected_at) as week,
  AVG(p.engagement_rate) as avg_engagement_rate,
  AVG(p.virality_score) as avg_virality_score,
  COUNT(*) as posts_with_pattern,
  AVG(p.views) as avg_views
FROM pattern_performance p
GROUP BY p.pattern_id, p.platform, DATE_TRUNC('week', p.metrics_collected_at)
ORDER BY week DESC;

-- Trigger: auto-update updated_at on viral_patterns
CREATE OR REPLACE FUNCTION update_viral_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER viral_patterns_update_timestamp
BEFORE UPDATE ON viral_patterns
FOR EACH ROW
EXECUTE FUNCTION update_viral_patterns_updated_at();

-- Grant permissions (if needed)
-- GRANT SELECT, INSERT, UPDATE ON viral_patterns TO adoff_api_user;
-- GRANT SELECT, INSERT ON pattern_performance TO adoff_api_user;
-- GRANT SELECT ON v_top_patterns TO adoff_api_user;

-- Initial seed: sample patterns for testing
INSERT INTO viral_patterns (source, platform, pattern_type, description, example_captions, perf_score)
VALUES
  (
    'external_tiktok',
    'tiktok',
    'hook',
    'Video hook 0-3s: opening con domanda retorica + dramatic pause prima di risposta',
    ARRAY['Wait, did you know...', 'Most people get this wrong...', 'This changed everything for me...'],
    0.0
  ),
  (
    'external_instagram',
    'instagram',
    'pain_point',
    'Caption che inizia con pain point relatable prima di posizionare solution',
    ARRAY['Tired of wasting hours?', 'This one mistake costs you $1000/month', 'Your biggest productivity killer...'],
    0.0
  ),
  (
    'internal_adoff',
    'instagram',
    'angle',
    'Angle: contrarian take che sfida status quo + data point supporting',
    ARRAY['Everyone is wrong about X', 'The secret nobody talks about', 'Science proves this works'],
    0.0
  )
ON CONFLICT DO NOTHING;

-- Nota: embeddings saranno generati dal cron job scrape+analyze via nomic-embed
-- quando i pattern reali vengono estratti
