-- Migration for W49 Multi-Format Content Factory
-- Adds new asset_type values to gemini_copy_drafts table
-- Created: 2026-05-20
-- Status: Ready for deployment

BEGIN;

-- Step 1: Verify table exists
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'adoff_autopilot'
AND table_name = 'gemini_copy_drafts'
OR RAISE EXCEPTION 'Table adoff_autopilot.gemini_copy_drafts not found';

-- Step 2: Drop existing constraint (if exists) to avoid conflict
ALTER TABLE adoff_autopilot.gemini_copy_drafts
DROP CONSTRAINT IF EXISTS check_asset_type;

-- Step 3: Add new CHECK constraint with extended asset_type values
ALTER TABLE adoff_autopilot.gemini_copy_drafts
ADD CONSTRAINT check_asset_type
CHECK (asset_type IN (
  'caption_social',      -- W20: Single caption for social (existing)
  'thread',              -- W49: Twitter thread (new)
  'carousel',            -- W49: Instagram/LinkedIn carousel (new)
  'reel_script',         -- W49: TikTok/Reels video script (new)
  'short_script'         -- W49: YouTube Shorts script (new)
));

-- Step 4: Verify constraint applied
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'adoff_autopilot'
AND table_name = 'gemini_copy_drafts'
AND constraint_name = 'check_asset_type'
OR RAISE EXCEPTION 'CHECK constraint not applied';

-- Step 5: Create index on (asset_type, created_at) for W49 queries
CREATE INDEX IF NOT EXISTS idx_gemini_copy_drafts_asset_type_created
ON adoff_autopilot.gemini_copy_drafts(asset_type, created_at DESC);

COMMIT;

-- Verification queries (run separately):
-- SELECT COUNT(*) as caption_count FROM adoff_autopilot.gemini_copy_drafts WHERE asset_type = 'caption_social';
-- SELECT COUNT(*) as thread_count FROM adoff_autopilot.gemini_copy_drafts WHERE asset_type = 'thread';
-- SELECT COUNT(*) as carousel_count FROM adoff_autopilot.gemini_copy_drafts WHERE asset_type = 'carousel';
-- SELECT DISTINCT asset_type FROM adoff_autopilot.gemini_copy_drafts ORDER BY asset_type;
