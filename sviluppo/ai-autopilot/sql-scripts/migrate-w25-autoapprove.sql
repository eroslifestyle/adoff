-- W25 Intelligent Approval Gate — Migration SQL
-- Aggiungi colonne necessarie per auto-approve loop e linkage posts_queue
-- Data: 2026-05-20

BEGIN;

-- 1. Aggiungi colonne auto-approve su gemini_copy_drafts
ALTER TABLE adoff_autopilot.gemini_copy_drafts
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_score INTEGER CHECK (approval_score >= 0 AND approval_score <= 100),
  ADD COLUMN IF NOT EXISTS brand_guard_reason TEXT;

-- 2. Aggiungi source_draft_id su posts_queue per linkage
ALTER TABLE adoff_autopilot.posts_queue
  ADD COLUMN IF NOT EXISTS source_draft_id BIGINT REFERENCES adoff_autopilot.gemini_copy_drafts(id) ON DELETE SET NULL;

-- 3. Aggiungi indice su (status, brand_guard_ok, approval_score) per query auto-approve
CREATE INDEX IF NOT EXISTS idx_gemini_drafts_autoapprove_candidates
  ON adoff_autopilot.gemini_copy_drafts(status, brand_guard_ok, approval_score)
  WHERE status = 'draft' AND brand_guard_ok = true AND approval_score IS NULL AND asset_type IN ('caption_social', 'ad_copy', 'landing_section', 'email_drip');

-- 4. Indice su auto_approved per metric queries
CREATE INDEX IF NOT EXISTS idx_gemini_drafts_autoapprove_metric
  ON adoff_autopilot.gemini_copy_drafts(auto_approved, approved_at);

-- 5. Test data: 3 draft per smoke test
DELETE FROM adoff_autopilot.gemini_copy_drafts
  WHERE workflow = 'w25-test' AND created_at > NOW() - INTERVAL '1 hour';

INSERT INTO adoff_autopilot.gemini_copy_drafts
  (workflow, asset_type, platform, lang, body, status, brand_guard_ok)
VALUES
  ('w25-test', 'caption_social', 'instagram', 'it',
   '🚀 AdOff blocca tutte le pubblicità, invisibile ai sistemi anti-adblock. Naviga pulito. Prova ora!',
   'draft', true),

  ('w25-test', 'caption_social', 'instagram', 'it',
   'Stanco di banner invasivi? AdOff scherma tutto. Siamo il addon più veloce del mercato.',
   'draft', true),

  ('w25-test', 'caption_social', 'instagram', 'it',
   'ATTENZIONE: questo contenuto cita YouTube e il prezzo di 149 KB. Brand leak test.',
   'draft', true);

COMMIT;

-- Verifica
SELECT
  COUNT(*) as total_drafts,
  COUNT(*) FILTER (WHERE status = 'draft' AND brand_guard_ok = true AND approval_score IS NULL) as autoapprove_candidates,
  COUNT(*) FILTER (WHERE auto_approved = true) as already_autoapproved
FROM adoff_autopilot.gemini_copy_drafts
WHERE workflow = 'w25-test';
