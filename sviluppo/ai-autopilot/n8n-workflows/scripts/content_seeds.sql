CREATE TABLE IF NOT EXISTS adoff_autopilot.content_seeds (
  id          SERIAL PRIMARY KEY,
  seed        TEXT NOT NULL,
  angle       TEXT,
  used_count  INT NOT NULL DEFAULT 0,
  last_used   TIMESTAMPTZ,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO adoff_autopilot.content_seeds (seed, angle) VALUES
('Ads secretly track everything you do online. AdOff blocks them invisibly across the entire web - faster pages, full privacy, undetectable to anti-adblock systems. Try AdOff free at adoff.app.', 'privacy-tracking'),
('Tired of waiting for pages buried under ads? AdOff strips them out before they load, everywhere you browse. Lighter, faster, distraction-free. Get AdOff free at adoff.app.', 'speed'),
('Most ad blockers get detected and break sites. AdOff stays invisible: no anti-adblock walls, no nag screens, just clean browsing on every site. Try it at adoff.app.', 'stealth'),
('Your attention is the product being sold. AdOff quietly removes the ads and trackers that monetize you, so the web works for you again. Free at adoff.app.', 'attention-economy'),
('Video ads stealing your time? AdOff skips and silences them automatically so content just plays. Works across the web, undetected. AdOff, free at adoff.app.', 'video-ads'),
('Every ad is a tracker following you between sites. AdOff cuts the chain - block ads and the surveillance behind them in one tap. Get it at adoff.app.', 'surveillance'),
('Clean web, less data burned, longer battery. AdOff blocks the heavy ad payloads most pages force on you. Simple, invisible, free at adoff.app.', 'performance-battery'),
('You should not have to fight pop-ups to read an article. AdOff removes the noise so the page is just the page. Try AdOff free at adoff.app.', 'ux-noise'),
('Anti-adblock detectors keep beating your blocker? AdOff was built to stay invisible to them - protection that does not get switched off. adoff.app.', 'anti-detection'),
('Privacy should be the default, not a setting you fight for. AdOff blocks ads and trackers automatically on every site, quietly. Free at adoff.app.', 'privacy-default')
ON CONFLICT DO NOTHING;

SELECT count(*) AS seeds FROM adoff_autopilot.content_seeds;
