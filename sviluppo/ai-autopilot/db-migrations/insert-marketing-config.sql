-- AdOff W28 Config Loader — Insert marketing_config rows
-- Execute on: adoff_autopilot Postgres (after table creation)
-- All values stored as JSONB for flexibility

INSERT INTO adoff_autopilot.marketing_config (key, value, updated_at) VALUES
(
  'brand_blacklist',
  '["YouTube", "Google", "Facebook", "Instagram", "TikTok", "Twitter", "X", "Amazon", "Reddit", "Twitch", "GitHub", "LinkedIn", "Chrome", "Firefox", "Safari", "Microsoft Edge", "Opera"]'::jsonb,
  NOW()
),
(
  'forbidden_phrases',
  '["149 KB", "149KB", "149 kilobyte", "149 kilobytes", "149-KB"]'::jsonb,
  NOW()
),
(
  'lang_names',
  '{"it":"italiano","en":"English","de":"Deutsch","fr":"français","es":"español","pt":"português","ru":"русский","ar":"العربية","zh":"中文","tr":"Türkçe","id":"Bahasa Indonesia","pl":"polski","hi":"हिन्दी","ja":"日本語","ko":"한국어"}'::jsonb,
  NOW()
),
(
  'platform_caps',
  '{"instagram":{"caption_min":30,"caption_max":2000,"hashtag_min":5,"hashtag_max":10},"facebook":{"caption_min":30,"caption_max":2000,"hashtag_min":3,"hashtag_max":6},"tiktok":{"caption_min":30,"caption_max":1500,"hashtag_min":4,"hashtag_max":8}}'::jsonb,
  NOW()
),
(
  'brand_voice',
  '{"tone":"energica, brillante, diretta (stile Ava Multilingual)","frasi_brevi":true,"ritmo_alto":true}'::jsonb,
  NOW()
),
(
  'synonyms',
  '{"YouTube":"piattaforme video","Google":"motori di ricerca","Facebook":"social media","Instagram":"social media","TikTok":"piattaforme video brevi","Amazon":"e-commerce","Reddit":"forum online","Twitch":"piattaforme live streaming","Chrome":"browser","Firefox":"browser"}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
