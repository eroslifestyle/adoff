-- Migration: Add published_at column to gemini_copy_drafts
-- Date: 2026-05-20
-- Purpose: Track when a draft is published to external systems

ALTER TABLE adoff_autopilot.gemini_copy_drafts
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for the schedule trigger to filter efficiently
CREATE INDEX IF NOT EXISTS idx_gemini_copy_drafts_status_published
ON adoff_autopilot.gemini_copy_drafts (status, published_at)
WHERE status = 'approved' AND published_at IS NULL;

-- Comment for clarity
COMMENT ON COLUMN adoff_autopilot.gemini_copy_drafts.published_at IS 'Timestamp when draft was published to external system (posts_queue, email, ads, etc). NULL = unpublished.';
