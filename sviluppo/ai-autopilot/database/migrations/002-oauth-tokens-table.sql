-- Migration: Create oauth_tokens table for W42 OAuth Token Manager
-- Version: 1.0
-- Created: 2026-05-20
-- Description: Stores OAuth tokens for 8 social platforms with refresh management

BEGIN;

-- Create oauth_tokens table
CREATE TABLE IF NOT EXISTS adoff_autopilot.oauth_tokens (
  id BIGSERIAL PRIMARY KEY,

  -- Platform identifier (unique constraint)
  platform TEXT NOT NULL UNIQUE CHECK (platform IN ('twitter', 'reddit', 'mastodon', 'bluesky', 'instagram', 'facebook', 'tiktok', 'linkedin')),

  -- Token data
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,

  -- Metadata
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  refresh_endpoint TEXT,
  client_id TEXT,
  client_secret_ref TEXT,  -- Reference to env var key
  scopes TEXT,  -- comma-separated

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending_oauth')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_platform ON adoff_autopilot.oauth_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_status ON adoff_autopilot.oauth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON adoff_autopilot.oauth_tokens(expires_at);

-- Seed initial 8 platform rows
INSERT INTO adoff_autopilot.oauth_tokens (platform, status, scopes) VALUES
('twitter', 'pending_oauth', 'tweet.read,tweet.write,offline.access'),
('reddit', 'pending_oauth', 'read,submit,history'),
('mastodon', 'pending_oauth', 'read:statuses,write:statuses,read:accounts'),
('bluesky', 'pending_oauth', 'com.atproto.server'),
('instagram', 'pending_oauth', 'instagram_basic,instagram_graph_user_media,pages_read_engagement'),
('facebook', 'pending_oauth', 'pages_read_engagement,pages_manage_posts,pages_read_user_content'),
('tiktok', 'pending_oauth', 'user.info.basic,video.list,video.publish'),
('linkedin', 'pending_oauth', 'w_member_social,r_organization_social')
ON CONFLICT (platform) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION adoff_autopilot.update_oauth_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oauth_tokens_update_timestamp ON adoff_autopilot.oauth_tokens;
CREATE TRIGGER oauth_tokens_update_timestamp
BEFORE UPDATE ON adoff_autopilot.oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION adoff_autopilot.update_oauth_tokens_timestamp();

COMMIT;
