-- AdOff Experiment Engine — schema (estende ai-autopilot/n8n-workflows/infra/db-schema.sql)
-- Applicare su Postgres n8n: psql ... -f experiment-schema.sql

CREATE TABLE IF NOT EXISTS experiments (
  id           TEXT PRIMARY KEY,                 -- es. 'E2'
  variable     TEXT,                             -- V1..V9 (PIANO-ESPERIMENTI §1)
  hypothesis   TEXT,
  ice          NUMERIC(3,1),
  status       TEXT DEFAULT 'backlog',           -- backlog|running|won|lost|inconclusive
  variant_a    JSONB,                            -- {template,lang,props}
  variant_b    JSONB,
  started_at   TIMESTAMPTZ,
  decided_at   TIMESTAMPTZ,
  winner       TEXT                              -- 'A' | 'B' | NULL
);

CREATE TABLE IF NOT EXISTS post_metrics (
  id             BIGSERIAL PRIMARY KEY,
  post_id        BIGINT REFERENCES posts_queue(id),
  exp_id         TEXT,
  variant        TEXT,                           -- 'A' | 'B'
  platform       TEXT,
  captured_at    TIMESTAMPTZ DEFAULT NOW(),
  views          INT,
  saves          INT,
  shares         INT,
  watch_pct      NUMERIC(4,1),
  profile_clicks INT,
  installs       INT
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_exp ON post_metrics (exp_id, variant, captured_at);
CREATE INDEX IF NOT EXISTS idx_experiments_status_ice ON experiments (status, ice DESC);
