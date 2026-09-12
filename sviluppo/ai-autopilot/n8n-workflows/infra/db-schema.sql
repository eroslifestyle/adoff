-- AdOff Autopilot DB schema
-- Eseguito su n8n-postgres (database: n8n, schema: adoff_autopilot)
-- Idempotente: safe da rilanciare

CREATE SCHEMA IF NOT EXISTS adoff_autopilot;
SET search_path TO adoff_autopilot, public;

-- ===================================================================
-- MENTIONS: tracking di ogni menzione AdOff/competitor su web
-- ===================================================================
CREATE TABLE IF NOT EXISTS mentions (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT NOT NULL,              -- reddit, hn, twitter, mastodon, quora, habr, v2ex, ...
    source_id       TEXT NOT NULL,              -- id univoco per piattaforma (post id, comment id)
    url             TEXT NOT NULL,
    lang            TEXT,                       -- en, it, ru, ja, ...
    author          TEXT,
    title           TEXT,
    body            TEXT,
    keywords_matched TEXT[],                    -- ["adoff", "ublock", "manifest v3"]
    sentiment       TEXT,                       -- positive | neutral | negative | hostile
    intent          TEXT,                       -- question | recommendation | complaint | news
    hotness_score   INTEGER DEFAULT 0,          -- 0-100 calcolato (upvotes + age + lang priority)
    responded       BOOLEAN DEFAULT FALSE,
    response_id     BIGINT,                     -- FK to posts_queue.id se risposto
    discovered_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_mentions_discovered ON mentions(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_hotness ON mentions(hotness_score DESC) WHERE NOT responded;
CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source);
CREATE INDEX IF NOT EXISTS idx_mentions_lang ON mentions(lang);

-- ===================================================================
-- ACCOUNTS: pool di account social con stato warming
-- ===================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    platform        TEXT NOT NULL,              -- reddit, twitter, mastodon, hn, quora, habr, v2ex, ...
    handle          TEXT NOT NULL,              -- u/adoff_dev, @adoffapp
    purpose         TEXT NOT NULL,              -- founder, automated, backup
    status          TEXT DEFAULT 'warming',     -- warming, active, suspended, banned
    karma           INTEGER DEFAULT 0,
    age_days        INTEGER DEFAULT 0,
    last_action_at  TIMESTAMPTZ,
    action_count_24h INTEGER DEFAULT 0,
    cooldown_until  TIMESTAMPTZ,                -- circuit breaker
    credentials_ref TEXT,                       -- n8n credential id
    proxy_ref       TEXT,                       -- residential proxy se serve
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, handle)
);

-- ===================================================================
-- POSTS_QUEUE: ogni post pianificato/eseguito (cross-post, warming, reply)
-- ===================================================================
CREATE TABLE IF NOT EXISTS posts_queue (
    id              BIGSERIAL PRIMARY KEY,
    workflow        TEXT NOT NULL,              -- crosspost, warming, reddit_hunter, quora, mention_reply
    platform        TEXT NOT NULL,
    account_id      BIGINT REFERENCES accounts(id),
    target_url      TEXT,                       -- thread/post we're replying to (null if original)
    parent_mention_id BIGINT REFERENCES mentions(id),
    lang            TEXT,
    body            TEXT NOT NULL,
    quality_score   NUMERIC(3,2),               -- LLM self-rated 0-10
    status          TEXT DEFAULT 'queued',      -- queued, posted, failed, blocked, skipped
    scheduled_at    TIMESTAMPTZ DEFAULT NOW(),
    posted_at       TIMESTAMPTZ,
    response_url    TEXT,                       -- url del post pubblicato
    error           TEXT,
    retry_count     INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_queue_status ON posts_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_queue_platform ON posts_queue(platform);

-- ===================================================================
-- OUTREACH: cold email drip a journalist/blogger/influencer
-- ===================================================================
CREATE TABLE IF NOT EXISTS outreach (
    id              BIGSERIAL PRIMARY KEY,
    target_type     TEXT NOT NULL,              -- journalist, blogger, influencer, partner
    name            TEXT,
    org             TEXT,
    email           TEXT NOT NULL,
    twitter_handle  TEXT,
    lang            TEXT,
    topic_match     TEXT,                       -- "adblock", "privacy", "chrome ext"
    sequence_step   INTEGER DEFAULT 0,          -- 0 = not yet emailed, 1-4 = drip steps
    last_email_at   TIMESTAMPTZ,
    replied         BOOLEAN DEFAULT FALSE,
    reply_text      TEXT,
    unsubscribed    BOOLEAN DEFAULT FALSE,
    status          TEXT DEFAULT 'active',      -- active, completed, bounced, blacklist
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email)
);
CREATE INDEX IF NOT EXISTS idx_outreach_next ON outreach(sequence_step, last_email_at) WHERE status='active' AND NOT replied AND NOT unsubscribed;

-- ===================================================================
-- LEADS: capture da popup/lead-magnet sul sito
-- ===================================================================
CREATE TABLE IF NOT EXISTS leads (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    source          TEXT,                       -- popup_exit, leadmagnet_guide, ph_launch, ...
    lang            TEXT,
    country         TEXT,
    referrer        TEXT,
    captured_at     TIMESTAMPTZ DEFAULT NOW(),
    sequence_step   INTEGER DEFAULT 0,
    converted_to_install BOOLEAN DEFAULT FALSE,
    converted_to_pro BOOLEAN DEFAULT FALSE
);

-- ===================================================================
-- NEWS_EVENTS: newsjacking opportunities tracker
-- ===================================================================
CREATE TABLE IF NOT EXISTS news_events (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT NOT NULL,              -- google_news, hn, twitter, github_release
    url             TEXT NOT NULL UNIQUE,
    title           TEXT,
    summary         TEXT,
    relevance       TEXT,                       -- mv3, anti-adblock, youtube-ads, browser-policy, competitor
    urgency         TEXT DEFAULT 'normal',      -- low, normal, high, critical
    response_draft  TEXT,                       -- LLM-generated draft response
    response_status TEXT DEFAULT 'draft',       -- draft, posted, skipped
    published_at    TIMESTAMPTZ,
    discovered_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_urgency ON news_events(urgency, discovered_at DESC);

-- ===================================================================
-- COMPETITOR_ACTIVITY: changelog di competitor (uBO, ABP, AdGuard, etc)
-- ===================================================================
CREATE TABLE IF NOT EXISTS competitor_activity (
    id              BIGSERIAL PRIMARY KEY,
    competitor      TEXT NOT NULL,              -- ublock, adblock, adguard, ghostery, brave
    activity_type   TEXT NOT NULL,              -- release, tweet, blogpost, github_issue
    url             TEXT UNIQUE,
    title           TEXT,
    body            TEXT,
    happened_at     TIMESTAMPTZ,
    discovered_at   TIMESTAMPTZ DEFAULT NOW(),
    response_idea   TEXT
);

-- ===================================================================
-- METRICS: rate-limit + circuit breaker state
-- ===================================================================
CREATE TABLE IF NOT EXISTS metrics (
    id              BIGSERIAL PRIMARY KEY,
    workflow        TEXT NOT NULL,
    platform        TEXT,
    metric          TEXT NOT NULL,              -- posts_per_day, errors_per_hour, ban_signals
    value           NUMERIC,
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metrics_workflow ON metrics(workflow, captured_at DESC);

-- ===================================================================
-- SEED: account founder + competitor list + keyword list
-- ===================================================================
INSERT INTO accounts (platform, handle, purpose, status, notes) VALUES
    ('reddit',   'u/adoff_dev',          'automated', 'warming', 'Main founder account'),
    ('twitter',  '@adoffapp',            'automated', 'warming', 'Main brand handle'),
    ('mastodon', '@adoff@fosstodon.org', 'automated', 'warming', 'FOSS community'),
    ('hn',       'adoff_dev',            'automated', 'warming', 'Show HN ready'),
    ('producthunt', 'adoffapp',          'founder',   'warming', 'PH launch'),
    ('alternativeto', 'adoff',           'automated', 'active',  'Directory listing'),
    ('indiehackers', 'adoff_dev',        'automated', 'warming', 'Build-in-public'),
    ('habr',     'adoff',                'automated', 'warming', 'RU market'),
    ('v2ex',     'adoff',                'automated', 'warming', 'ZH market'),
    ('quora',    'adoff_dev',            'automated', 'warming', 'EN+IT+HI answers')
ON CONFLICT (platform, handle) DO NOTHING;

-- View comoda: posts da inviare ora
CREATE OR REPLACE VIEW posts_ready AS
SELECT * FROM posts_queue
WHERE status = 'queued'
  AND scheduled_at <= NOW()
  AND (quality_score IS NULL OR quality_score >= 6.0)
ORDER BY scheduled_at;

-- View: account disponibili per posting (non in cooldown, sotto rate limit)
CREATE OR REPLACE VIEW accounts_available AS
SELECT * FROM accounts
WHERE status = 'active'
  AND (cooldown_until IS NULL OR cooldown_until <= NOW())
  AND action_count_24h < 5;
