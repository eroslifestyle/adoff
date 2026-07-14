-- Migration: Create media_queue table for Visual Asset Pipeline (W50)
-- Date: 2026-05-20
-- Purpose: Track generated images/videos for social media platforms, bridge gemini_copy_drafts → posts_queue

-- Create table if not exists
CREATE TABLE IF NOT EXISTS adoff_autopilot.media_queue (
  id BIGSERIAL PRIMARY KEY,
  draft_id BIGINT NOT NULL REFERENCES adoff_autopilot.gemini_copy_drafts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'bluesky', 'mastodon', 'reddit')),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'carousel')),
  media_path TEXT,
  media_public_url TEXT,
  job_id UUID,
  prompt_used TEXT,
  dimensions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'generated', 'failed')),
  error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(draft_id, platform)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_media_queue_draft_id ON adoff_autopilot.media_queue(draft_id);
CREATE INDEX IF NOT EXISTS idx_media_queue_platform_status ON adoff_autopilot.media_queue(platform, status);
CREATE INDEX IF NOT EXISTS idx_media_queue_status ON adoff_autopilot.media_queue(status);
CREATE INDEX IF NOT EXISTS idx_media_queue_job_id ON adoff_autopilot.media_queue(job_id) WHERE job_id IS NOT NULL;

-- Comment for clarity
COMMENT ON TABLE adoff_autopilot.media_queue IS 'Visual asset queue: tracks image/video generation for social media drafts. Bridges gemini_copy_drafts (source) → posts_queue (consumer).';
COMMENT ON COLUMN adoff_autopilot.media_queue.draft_id IS 'Reference to gemini_copy_drafts.id, identifies the content draft this asset is for';
COMMENT ON COLUMN adoff_autopilot.media_queue.platform IS 'Target platform: tiktok (video), instagram (carousel/image), facebook (image), twitter (image), linkedin (image), text-only (bluesky/mastodon/reddit)';
COMMENT ON COLUMN adoff_autopilot.media_queue.media_type IS 'Type of asset: image (JPEG/PNG), video (MP4), carousel (multiple images)';
COMMENT ON COLUMN adoff_autopilot.media_queue.media_path IS 'Local filesystem path to generated asset, e.g., /tmp/media/adoff-ig-xxxxx.jpg';
COMMENT ON COLUMN adoff_autopilot.media_queue.media_public_url IS 'Publicly accessible URL (S3, CDN, etc.) once uploaded';
COMMENT ON COLUMN adoff_autopilot.media_queue.job_id IS 'Reference to image_queue.job_id (async image generation polling)';
COMMENT ON COLUMN adoff_autopilot.media_queue.status IS 'Generation status: pending (queued), generating (in progress), generated (ready), failed (error)';
COMMENT ON COLUMN adoff_autopilot.media_queue.error IS 'Error message if status=failed, e.g., "FLUX timeout", "generation failed after 3 retries"';
COMMENT ON COLUMN adoff_autopilot.media_queue.retry_count IS 'Number of retry attempts for failed generations';
