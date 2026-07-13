-- Tabella Affiliati
CREATE TABLE IF NOT EXISTS affiliates (
    id TEXT PRIMARY KEY, -- codice univoco scelto o generato (es. 'leo-dg')
    user_id TEXT UNIQUE, -- collegato opzionalmente a un utente
    email TEXT UNIQUE NOT NULL,
    payout_method TEXT DEFAULT 'paypal',
    payout_address TEXT,
    commission_rate REAL DEFAULT 0.20, -- 20% commissione standard
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Referral (Vendite effettuate tramite affiliato)
CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    stripe_session_id TEXT UNIQUE NOT NULL,
    amount_total INTEGER NOT NULL, -- centesimi (es. 299 per 2.99 EUR)
    currency TEXT NOT NULL,
    commission_amount INTEGER NOT NULL, -- centesimi spettanti all'affiliato
    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'paid', 'refunded'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(affiliate_id) REFERENCES affiliates(id)
);

-- Tabella Click (Opzionale, per statistiche)
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(affiliate_id) REFERENCES affiliates(id)
);

-- Tabella Founder Seats (contatore reale dei primi 100 abbonati a prezzo Founder)
-- Inserita dal webhook Stripe su pagamento completato con metadata.founder=1.
-- stripe_session_id UNIQUE rende l'insert idempotente sui webhook ritentati.
CREATE TABLE IF NOT EXISTS founder_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    plan TEXT,                          -- 'annual' (prezzo Founder) o 'lifetime'
    stripe_session_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INSTALL / UNINSTALL / HEARTBEAT TRACKING
-- Device-level tracking per retention analysis.
-- device_id = SHA-256(server_salt + adoffDeviceId) — non tracciabile dall'esterno.
-- Tutti i piani: Free, Pro trial, Pro pagante.
-- =============================================

-- Installazioni: una riga per installazione unica (stesso device re-installa = nuova riga).
CREATE TABLE IF NOT EXISTS install_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,            -- hashed, non tracciabile
    install_ts INTEGER NOT NULL,        -- Unix ms
    country TEXT,                       -- ISO 3166-1 alpha-2
    browser TEXT,                       -- chrome|firefox|safari|edge|opera
    source TEXT,                        -- chrome-store|firefox-addon|safari|direct
    plan TEXT DEFAULT 'free',          -- free|trial|pro
    version TEXT,                       -- versione estensione
    timezone TEXT,
    UNIQUE(device_id, install_ts)
);

-- Disinstallazioni: una riga per evento disinstallazione.
CREATE TABLE IF NOT EXISTS uninstall_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,           -- hashed, coincide con install_events.device_id
    uninstall_ts INTEGER NOT NULL,      -- Unix ms
    reason TEXT,                        -- broken_site|ads_visible|confusing|performance|found_better|other
    comment TEXT,
    version TEXT,                       -- versione estensione al momento della disinstallazione
    was_pro INTEGER DEFAULT 0,          -- 1 se Pro o Trial, 0 se Free
    country TEXT
);

-- Heartbeat: ultima attività nota per ogni device (upsert).
-- Usato per calcolare la retention (giorni dall'ultimo heartbeat).
CREATE TABLE IF NOT EXISTS device_heartbeat (
    device_id TEXT PRIMARY KEY,         -- hashed
    last_seen INTEGER NOT NULL,         -- Unix ms
    country TEXT,
    browser TEXT,
    plan TEXT DEFAULT 'free',
    version TEXT,
    install_ts INTEGER                   -- quando è stato installato (dato puro, non calcolato)
);

-- =============================================
-- LICENSES BACKUP (KV mirror — fonte secondaria)
-- =============================================

CREATE TABLE IF NOT EXISTS licenses (
    raw TEXT PRIMARY KEY,
    adoff_key TEXT,
    email TEXT,
    plan TEXT,
    expires INTEGER,
    device_limit INTEGER DEFAULT 3,
    revoked INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    generated_by TEXT DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS licenses_devices (
    raw TEXT NOT NULL,
    device_id TEXT NOT NULL,
    name TEXT,
    last_seen INTEGER,
    ip TEXT,
    PRIMARY KEY (raw, device_id),
    FOREIGN KEY (raw) REFERENCES licenses(raw) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS licenses_email_index (
    email TEXT PRIMARY KEY,
    raw_keys TEXT NOT NULL
);

-- =============================================
-- TRIAL ANTI-ABUSE (fingerprint tracking)
-- Evita abuse tramite reinstall/redevice.
-- =============================================
CREATE TABLE IF NOT EXISTS trial_fingerprints (
    fingerprint TEXT PRIMARY KEY,           -- hash univoco del dispositivo
    trial_start INTEGER NOT NULL,         -- Unix ms: inizio trial
    trial_end INTEGER NOT NULL,           -- Unix ms: fine trial
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collegamento account per via di fuga (sblocca trial bloccato)
CREATE TABLE IF NOT EXISTS trial_accounts (
    fingerprint TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,             -- id account che sblocca
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fingerprint) REFERENCES trial_fingerprints(fingerprint)
);

-- =============================================
-- KV SNAPSHOT (backup cron)
-- =============================================

CREATE TABLE IF NOT EXISTS kv_backup (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_backup_meta (
    key TEXT PRIMARY KEY DEFAULT 'snapshot',
    snapshot_at INTEGER NOT NULL,
    kv_version INTEGER DEFAULT 1,
    total_keys INTEGER DEFAULT 0
);
