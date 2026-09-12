-- AdOff — Social publishing pipeline schema (Instagram + Facebook + TikTok)
-- Pattern allineato a adoff_autopilot.youtube_queue (queue mutabile + log immutabile).
-- Applica su leobox:  docker exec -i n8n-postgres psql -U n8n -d n8n < social_queue.sql
-- Idempotente: safe da rilanciare.

CREATE SCHEMA IF NOT EXISTS adoff_autopilot;

-- ===================================================================
-- SOCIAL_POSTS: un job = un post su una piattaforma (IG | FB | TikTok)
-- La thin admin UI inserisce job in status='draft', l'umano approva
-- (status='approved') dopo aver visto preview + creator_info; il
-- dispatcher pubblica (publishing -> published|failed).
-- ===================================================================
CREATE TABLE IF NOT EXISTS adoff_autopilot.social_posts (
    id              BIGSERIAL PRIMARY KEY,
    brand           TEXT NOT NULL DEFAULT 'adoff',
    platform        TEXT NOT NULL
                    CHECK (platform IN ('instagram','facebook','tiktok')),
    account_ref     TEXT NOT NULL,              -- ig_user_id | fb_page_id | tiktok open_id
    -- media: file locale lato worker (/opt/n8n/local-files == /files container).
    -- IG richiede un URL pubblico al publish: media_public_url popolato dal dispatcher.
    media_type      TEXT NOT NULL DEFAULT 'video'
                    CHECK (media_type IN ('video','photo')),
    media_path      TEXT NOT NULL,              -- path host del file sorgente
    media_public_url TEXT,                      -- URL pubblico (richiesto da IG al publish)
    no_logo_variant BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = render senza logo (TikTok ToS)
    caption         TEXT NOT NULL DEFAULT '',
    hashtags        TEXT NOT NULL DEFAULT '',
    lang            TEXT NOT NULL DEFAULT 'it',
    -- TikTok-specific (audit hard requirements). Per IG/FB ignorati.
    privacy_level   TEXT,                       -- TikTok: PUBLIC_TO_EVERYONE|MUTUAL_FOLLOW_FRIENDS|SELF_ONLY (NO default)
    allow_comment   BOOLEAN NOT NULL DEFAULT FALSE,
    allow_duet      BOOLEAN NOT NULL DEFAULT FALSE,
    allow_stitch    BOOLEAN NOT NULL DEFAULT FALSE,
    commercial_disclosure BOOLEAN NOT NULL DEFAULT FALSE,
    your_brand      BOOLEAN NOT NULL DEFAULT FALSE,   -- "Promotional content"
    branded_content BOOLEAN NOT NULL DEFAULT FALSE,   -- "Paid partnership" (non Private)
    ai_generated    BOOLEAN NOT NULL DEFAULT TRUE,    -- contenuto sintetico: AI-label 2026
    -- creator_info cache (snapshot mostrato all'umano al momento dell'approvazione)
    creator_info    JSONB,
    -- workflow
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','publishing','published','failed','skipped')),
    consent_at      TIMESTAMPTZ,                -- timestamp del consenso esplicito umano
    consent_by      TEXT,                       -- chi ha approvato (basic auth user)
    published_url   TEXT,
    platform_post_id TEXT,
    error           TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    publishing_at   TIMESTAMPTZ,
    published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_status
    ON adoff_autopilot.social_posts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_social_dispatch
    ON adoff_autopilot.social_posts (platform, status)
    WHERE status = 'approved';

-- Audit immutabile: una riga per pubblicazione riuscita.
CREATE TABLE IF NOT EXISTS adoff_autopilot.social_published (
    id              BIGSERIAL PRIMARY KEY,
    post_id         BIGINT NOT NULL,
    platform        TEXT NOT NULL,
    account_ref     TEXT NOT NULL,
    platform_post_id TEXT NOT NULL,
    published_url   TEXT NOT NULL,
    caption         TEXT,
    consent_by      TEXT,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vista dispatcher: job approvati pronti da pubblicare.
CREATE OR REPLACE VIEW adoff_autopilot.social_ready AS
SELECT * FROM adoff_autopilot.social_posts
WHERE status = 'approved'
ORDER BY approved_at;

-- Vista UI: coda da revisionare (draft) + esito recenti.
CREATE OR REPLACE VIEW adoff_autopilot.social_inbox AS
SELECT id, platform, account_ref, media_type, media_path, lang,
       LEFT(caption, 80) AS caption_preview, status, created_at,
       approved_at, published_at, published_url, error
FROM adoff_autopilot.social_posts
WHERE status IN ('draft','approved','publishing','failed')
   OR published_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
