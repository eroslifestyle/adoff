-- AdOff — NotebookLM → YouTube pipeline schema
-- Pattern allineato a adoff_autopilot.media_queue (claim FOR UPDATE SKIP LOCKED).
-- Applica su leobox:  docker exec -i n8n-postgres psql -U n8n -d n8n < youtube_queue.sql

CREATE SCHEMA IF NOT EXISTS adoff_autopilot;

-- Coda job NotebookLM. Un job = un video YouTube.
CREATE TABLE IF NOT EXISTS adoff_autopilot.youtube_queue (
    job_id        TEXT PRIMARY KEY,
    brand         TEXT NOT NULL DEFAULT 'adoff',
    title_hint    TEXT,                           -- titolo desiderato (opz, l'LLM lo rifinisce)
    source_pdfs   TEXT[] NOT NULL,                -- path PDF locali (lato worker)
    topic         TEXT,                           -- prompt/topic per NotebookLM (opz)
    lang          TEXT NOT NULL DEFAULT 'it',
    mode          TEXT NOT NULL DEFAULT 'both'    -- 'A' = solo Video Overview nativo
                  CHECK (mode IN ('A','B','both')),-- 'B' = audio Deep Dive + render ffmpeg
                                                  -- 'both' = entrambi
    status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','done','error')),
    -- output (path lato container n8n: /files == /opt/n8n/local-files host)
    video_a_path  TEXT,                           -- Video Overview nativo (draft)
    video_b_path  TEXT,                           -- render 1080p audio+caption (finale)
    audio_path    TEXT,                           -- mp3 Deep Dive grezzo
    transcript    TEXT,                           -- testo trascrizione/summary NotebookLM
    duration_sec  INTEGER,
    -- publish
    published     BOOLEAN NOT NULL DEFAULT FALSE,
    yt_video_id   TEXT,                           -- id YouTube dopo upload
    yt_title      TEXT,
    yt_desc       TEXT,
    yt_tags       TEXT[],
    -- telemetria
    error         TEXT,
    gen_seconds   INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    published_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ytq_status   ON adoff_autopilot.youtube_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_ytq_publish  ON adoff_autopilot.youtube_queue (status, published)
    WHERE status = 'done' AND published = FALSE;

-- Log pubblicazioni (audit immutabile, separato dalla coda mutabile).
CREATE TABLE IF NOT EXISTS adoff_autopilot.youtube_published (
    id            BIGSERIAL PRIMARY KEY,
    job_id        TEXT NOT NULL,
    yt_video_id   TEXT NOT NULL,
    yt_url        TEXT NOT NULL,
    title         TEXT,
    variant       TEXT,                           -- 'A' | 'B'
    published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vista comoda per il dispatcher (job pronti, non ancora pubblicati).
CREATE OR REPLACE VIEW adoff_autopilot.youtube_ready AS
SELECT * FROM adoff_autopilot.youtube_queue
WHERE status = 'done' AND published = FALSE
ORDER BY completed_at;
