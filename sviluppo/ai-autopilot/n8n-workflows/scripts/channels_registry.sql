-- AdOff Autopilot — Language-targeted channel registry
-- Strategia: ogni canale ha UNA lingua; la pipeline genera/traduce il contenuto nella lingua del canale.
CREATE TABLE IF NOT EXISTS adoff_autopilot.channels (
  id           SERIAL PRIMARY KEY,
  platform     TEXT NOT NULL,                 -- reddit|mastodon|quora|hn|indiehackers|devto|lemmy|forum|twitter
  channel      TEXT NOT NULL,                 -- subreddit / istanza mastodon / dominio quora / forum host
  lang         TEXT NOT NULL,                 -- it,en,de,fr,es,pt,ru,ja,ko,zh,ar,hi,tr,id,pl
  account_id   INT REFERENCES adoff_autopilot.accounts(id),
  post_style   TEXT NOT NULL DEFAULT 'generic', -- reddit|tweet|press|landing|forum|generic
  priority     INT  NOT NULL DEFAULT 3,        -- 1=alta
  status       TEXT NOT NULL DEFAULT 'planned',-- active|warming|planned|disabled
  audience_note TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, channel, lang)
);
CREATE INDEX IF NOT EXISTS idx_channels_lang_status ON adoff_autopilot.channels(lang, status);

-- Seed curato (1 lingua per canale). EN agganciato ad account esistenti=warming; resto=planned (BAN004).
INSERT INTO adoff_autopilot.channels (platform,channel,lang,post_style,priority,status,audience_note) VALUES
-- EN (account esistenti)
('reddit','privacy','en','reddit',1,'warming','privacy-focused, alta intent adblock'),
('reddit','chrome','en','reddit',1,'warming','utenti browser, adblock recommendation'),
('reddit','firefox','en','reddit',2,'warming','adblock recommendation'),
('mastodon','fosstodon.org','en','tweet',1,'warming','FOSS/privacy EN (account 3 esistente)'),
('quora','quora.com','en','press',2,'warming','Q&A EN adblock'),
('hn','news.ycombinator.com','en','press',2,'warming','tech early adopters'),
('indiehackers','indiehackers.com','en','press',3,'warming','maker audience'),
-- IT
('reddit','italy','it','reddit',1,'planned','community generalista IT'),
('reddit','Italia','it','reddit',2,'planned','IT tech/privacy'),
('mastodon','mastodon.uno','it','tweet',1,'planned','istanza Mastodon IT principale'),
('quora','it.quora.com','it','press',3,'planned','Q&A IT'),
-- DE
('reddit','de','de','reddit',1,'planned','community DE principale'),
('reddit','datenschutz','de','reddit',1,'planned','privacy DE alta intent'),
('mastodon','det.social','de','tweet',1,'planned','istanza Mastodon DE'),
('quora','de.quora.com','de','press',3,'planned','Q&A DE'),
-- FR
('reddit','france','fr','reddit',1,'planned','community FR principale'),
('reddit','vosfinances','fr','reddit',3,'planned','FR tech-savvy'),
('mastodon','piaille.fr','fr','tweet',1,'planned','istanza Mastodon FR'),
('quora','fr.quora.com','fr','press',3,'planned','Q&A FR'),
-- ES
('reddit','es','es','reddit',1,'planned','community ES (Spagna)'),
('reddit','privacidad','es','reddit',1,'planned','privacy ES'),
('mastodon','mastodon.social','es','tweet',2,'planned','ES general (no istanza ES dedicata)'),
('quora','es.quora.com','es','press',3,'planned','Q&A ES'),
-- PT
('reddit','brasil','pt','reddit',1,'planned','community PT-BR principale'),
('reddit','portugal','pt','reddit',2,'planned','community PT-PT'),
('mastodon','masto.pt','pt','tweet',1,'planned','istanza Mastodon PT'),
-- RU
('reddit','privacyru','ru','reddit',2,'planned','privacy RU'),
('habr','habr.com','ru','press',1,'planned','tech RU (account 8 esistente)'),
-- JA
('reddit','newsokur','ja','reddit',2,'planned','community JA'),
('mastodon','pawoo.net','ja','tweet',1,'planned','istanza Mastodon JA grande'),
-- KO
('reddit','korea','ko','reddit',2,'planned','community KO'),
-- ZH
('reddit','China_irl','zh','reddit',3,'planned','community ZH diaspora'),
('v2ex','v2ex.com','zh','forum',1,'planned','tech ZH (account 9 esistente)'),
-- AR
('reddit','arabs','ar','reddit',2,'planned','community AR'),
-- HI
('reddit','india','hi','reddit',2,'planned','community IN (hindi/english mix)'),
-- TR
('reddit','Turkey','tr','reddit',2,'planned','community TR'),
-- ID
('reddit','indonesia','id','reddit',2,'planned','community ID'),
-- PL
('reddit','Polska','pl','reddit',1,'planned','community PL principale'),
('mastodon','pol.social','pl','tweet',2,'planned','istanza Mastodon PL')
ON CONFLICT (platform,channel,lang) DO NOTHING;

SELECT lang, COUNT(*) AS channels, COUNT(*) FILTER (WHERE status='warming') AS active_ish
FROM adoff_autopilot.channels GROUP BY lang ORDER BY lang;
