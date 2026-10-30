# W42 - OAuth Token Manager

**Workflow ID**: `w42-oauth-token-manager`  
**Version**: 1.0  
**Status**: Ready for import

---

## Overview

W42 manages OAuth token lifecycle for 8 social platforms: Twitter, Instagram, Facebook, TikTok, LinkedIn, Reddit, Mastodon, Bluesky.

**Features:**
- Stores all tokens in `adoff_autopilot.oauth_tokens` table (single source of truth)
- Auto-refreshes tokens every 6 hours (24h before expiration)
- Graceful error handling (marks expired tokens, logs failures)
- Webhook endpoint for manual token injection: `POST /oauth/inject-token`
- Webhook endpoint for status listing: `POST /oauth/list-status`
- All webhooks secured with HMAC signature validation (W29 compatible)

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS adoff_autopilot.oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,  -- twitter, reddit, mastodon, bluesky, instagram, facebook, tiktok, linkedin
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  last_refreshed TIMESTAMPTZ DEFAULT NOW(),
  refresh_endpoint TEXT,  -- URL for refresh (auto-determined by workflow)
  client_id TEXT,  -- For reference; actual client_id/secret read from env vars
  client_secret_ref TEXT,  -- Reference to env var key (e.g., 'TWITTER_CLIENT_SECRET')
  scopes TEXT,  -- comma-separated scopes requested
  status TEXT DEFAULT 'active',  -- active, expired, revoked, pending_oauth
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_oauth_tokens_platform ON adoff_autopilot.oauth_tokens(platform);
```

## Seed Data

After creating the table, seed 8 platform rows:

```sql
INSERT INTO adoff_autopilot.oauth_tokens (platform, status, client_id, scopes) VALUES
('twitter', 'pending_oauth', NULL, 'tweet.read tweet.write offline.access'),
('reddit', 'pending_oauth', NULL, 'read submit'),
('mastodon', 'pending_oauth', NULL, 'read write'),
('bluesky', 'pending_oauth', NULL, 'com.atproto.server'),
('instagram', 'pending_oauth', NULL, 'instagram_basic,instagram_graph_user_media'),
('facebook', 'pending_oauth', NULL, 'pages_read_engagement,pages_manage_posts'),
('tiktok', 'pending_oauth', NULL, 'user.info.basic,video.list'),
('linkedin', 'pending_oauth', NULL, 'w_member_social,r_organization_social')
ON CONFLICT (platform) DO NOTHING;
```

---

## OAuth Setup Runbook (Per Platform)

### 1. Twitter (X)

**Endpoint**: `https://developer.twitter.com/en/portal/dashboard`

1. Create/Select app
2. Setup > App Settings > OAuth 2.0 Redirect URLs → Add `https://n8n.adoff.app/oauth/twitter-callback` (placeholder)
3. Copy `Client ID` → `TWITTER_CLIENT_ID` env var
4. Copy `Client Secret` → `TWITTER_CLIENT_SECRET` env var
5. Generate Bearer token (or let W42 manage refresh via refresh_token)
6. Inject token via W42 webhook:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -H "x-adoff-signature: $(echo -n '...' | openssl dgst -sha256 -hmac "$WEBHOOK_SIGNING_SECRET")" \
     -H "Content-Type: application/json" \
     -d '{"platform":"twitter","access_token":"TWITTER_BEARER_TOKEN","expires_in":7200}'
   ```

**Scopes**: `tweet.read`, `tweet.write`, `offline.access`

---

### 2. Instagram (Meta)

**Endpoint**: `https://developers.facebook.com/apps/`

1. Create/Select app → Instagram > Instagram Graph API
2. Settings > Basic → Copy `App ID` → `INSTAGRAM_CLIENT_ID`
3. Settings > Basic → Copy `App Secret` → `INSTAGRAM_CLIENT_SECRET`
4. Go to Instagram Testers (for test account) or Business Account
5. Authorize your app via Instagram login flow (get long-lived token)
6. Inject token via W42:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -H "x-adoff-signature: $(echo ...)" \
     -d '{"platform":"instagram","access_token":"IG_LONG_LIVED_TOKEN","expires_in":5183944}'
   ```

**Scopes**: `instagram_basic`, `instagram_graph_user_media`, `pages_read_engagement`

---

### 3. Facebook

**Endpoint**: `https://developers.facebook.com/apps/`

1. Same app as Instagram (Meta Graph API)
2. Copy `App ID` → `FACEBOOK_CLIENT_ID`
3. Copy `App Secret` → `FACEBOOK_CLIENT_SECRET`
4. Pages → Select page → Generate long-lived Page Access Token
5. Inject token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"facebook","access_token":"PAGE_ACCESS_TOKEN","expires_in":5183944}'
   ```

**Scopes**: `pages_read_engagement`, `pages_manage_posts`, `pages_read_user_content`

---

### 4. TikTok

**Endpoint**: `https://developers.tiktok.com/apps`

1. Create app → Business Type: Service Provider
2. Copy `Client ID` → `TIKTOK_CLIENT_ID`
3. Copy `Client Secret` → `TIKTOK_CLIENT_SECRET`
4. Auth Settings → Redirect URI: `https://n8n.adoff.app/oauth/tiktok-callback`
5. Follow OAuth 2.0 Authorization Code Flow (get auth code, exchange for token)
6. Inject token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"tiktok","access_token":"TIKTOK_ACCESS_TOKEN","refresh_token":"TIKTOK_REFRESH_TOKEN","expires_in":2592000}'
   ```

**Scopes**: `user.info.basic`, `video.list`, `video.publish`

---

### 5. LinkedIn

**Endpoint**: `https://www.linkedin.com/developers/apps`

1. Create app → Copy `Client ID` → `LINKEDIN_CLIENT_ID`
2. Copy `Client Secret` → `LINKEDIN_CLIENT_SECRET`
3. Auth Settings → Authorized redirect URLs: `https://n8n.adoff.app/oauth/linkedin-callback`
4. Follow OAuth 2.0 Authorization Code Flow
5. Inject token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"linkedin","access_token":"LINKEDIN_ACCESS_TOKEN","refresh_token":"LINKEDIN_REFRESH_TOKEN","expires_in":5184000}'
   ```

**Scopes**: `w_member_social`, `r_organization_social`

---

### 6. Reddit

**Endpoint**: `https://www.reddit.com/prefs/apps`

1. Create app (script) → Copy `Client ID` and `Secret`
2. Set `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` env vars
3. Reddit uses Basic Auth (client_id:secret in Authorization header)
4. Inject token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"reddit","access_token":"REDDIT_OAUTH_TOKEN","expires_in":3600}'
   ```

**Scopes**: `read`, `submit`, `history`

---

### 7. Mastodon

**Endpoint**: `https://mastodon.social/settings/applications`

1. Create app → Copy `Access Token`
2. Set `MASTODON_TOKEN` env var (bearer token, no refresh)
3. Mastodon tokens don't have expiry by default
4. Inject token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"mastodon","access_token":"MASTODON_TOKEN"}'
   ```

**Scopes**: `read:statuses`, `write:statuses`, `read:accounts`

---

### 8. Bluesky

**Endpoint**: `https://bsky.app/`

1. Go to Settings > Advanced > App Passwords
2. Generate app password (NOT your main password)
3. Set `BLUESKY_SESSION_TOKEN` env var
4. Bluesky uses DID + session-based auth, not traditional OAuth
5. Inject session token:
   ```bash
   curl -X POST http://n8n-host:5678/webhook/oauth/inject-token \
     -d '{"platform":"bluesky","access_token":"BLUESKY_SESSION_TOKEN"}'
   ```

---

## Environment Variables Required

Set these in n8n Worker (or .env file):

```bash
# Twitter
TWITTER_CLIENT_ID=xxxx
TWITTER_CLIENT_SECRET=xxxx

# Instagram (Meta)
INSTAGRAM_CLIENT_ID=xxxx
INSTAGRAM_CLIENT_SECRET=xxxx

# Facebook (Meta)
FACEBOOK_CLIENT_ID=xxxx
FACEBOOK_CLIENT_SECRET=xxxx

# TikTok
TIKTOK_CLIENT_ID=xxxx
TIKTOK_CLIENT_SECRET=xxxx

# LinkedIn
LINKEDIN_CLIENT_ID=xxxx
LINKEDIN_CLIENT_SECRET=xxxx

# Reddit
REDDIT_CLIENT_ID=xxxx
REDDIT_CLIENT_SECRET=xxxx

# Webhook signing secret (from W29)
WEBHOOK_SIGNING_SECRET=xxxx
```

---

## Webhook Endpoints

All endpoints require HMAC signature validation.

### POST /oauth/inject-token

Manually inject or update a token.

**Request:**
```json
{
  "platform": "twitter",
  "access_token": "BEARER_TOKEN",
  "refresh_token": "OPTIONAL_REFRESH_TOKEN",
  "expires_in": 7200
}
```

**Response (200):**
```json
{
  "status": "ok",
  "platform": "twitter",
  "message": "Token injected successfully",
  "expires_at": "2026-05-22T10:30:00Z"
}
```

---

### POST /oauth/list-status

Get current status of all 8 tokens.

**Request:**
```json
{}
```

**Response (200):**
```json
{
  "status": "success",
  "timestamp": "2026-05-20T14:30:00Z",
  "total_platforms": 8,
  "tokens": [
    {
      "platform": "twitter",
      "status": "active",
      "expires_at": "2026-05-22T10:30:00Z",
      "last_refreshed": "2026-05-20T10:30:00Z",
      "days_until_expiry": 2,
      "has_token": true,
      "client_id": "xxxx"
    },
    ...
  ]
}
```

---

## Refresh Logic

W42 runs every 6 hours. For each token:

1. **Check expiry**: If expires_at < NOW() + 24h
2. **Call refresh endpoint** (platform-specific):
   - Twitter: POST `/oauth/token` with `grant_type=refresh_token`
   - Meta (IG/FB): GET `/oauth/access_token` with `grant_type=fb_exchange_token`
   - TikTok: POST `/oauth/token/` with `grant_type=refresh_token`
   - LinkedIn: POST `/oauth/v2/accessToken` with `grant_type=refresh_token`
   - Reddit: POST `/oauth/token` with `grant_type=refresh_token`
   - Mastodon/Bluesky: No auto-refresh (static tokens)
3. **Update DB**: If success, UPDATE `access_token`, `expires_at`, `last_refreshed`, set `status='active'`
4. **On failure**: Set `status='expired'`, log error, trigger Telegram alert (integrate with W30)

---

## Integration with W40 Analytics Collector

W40 v2 reads tokens from `adoff_autopilot.oauth_tokens`:

```javascript
// In W40 "Load token from oauth_tokens" node:
SELECT access_token FROM adoff_autopilot.oauth_tokens 
WHERE platform=$1 AND status='active' LIMIT 1
```

If token is NULL or status != 'active', W40 skips that platform gracefully (logs warning, no error).

---

## Testing

### Smoke Test: List Status

```bash
curl -X POST http://localhost:5678/webhook/oauth/list-status \
  -H "x-adoff-signature: $(echo -n '{}' | openssl dgst -sha256 -hmac 'dev-secret' | cut -d' ' -f2)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected output: JSON array with 8 platforms, all with status='pending_oauth' initially.

### Smoke Test: Inject Token

```bash
curl -X POST http://localhost:5678/webhook/oauth/inject-token \
  -H "x-adoff-signature: $(echo -n '{"platform":"twitter","access_token":"test_token"}' | openssl dgst -sha256 -hmac 'dev-secret' | cut -d' ' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"platform":"twitter","access_token":"test_token","expires_in":3600}'
```

Expected: status='ok', token upserted in DB.

### Smoke Test: Run W40 v2 with Tokens

After injecting tokens:

1. POST to `http://localhost:5678/webhook/analytics-collect-now` with valid HMAC
2. Should insert 0 metrics (because no posts in social_published yet) but 0 errors
3. Check logs: should see "[W40 ANALYTICS]" entries with platform names

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Token injection returns "Invalid signature" | Check WEBHOOK_SIGNING_SECRET env var matches W29 |
| List status returns empty array | Check oauth_tokens table exists and is seeded |
| Refresh fails with "Missing env vars" | Ensure CLIENT_ID/SECRET env vars are set in n8n Worker |
| W40 skips all platforms | Check tokens are seeded with status='active' in oauth_tokens table |
| Token expires within hours | Check expires_in calculation (should add to NOW(), not use fixed timestamp) |

---

## Future Enhancements

- [ ] OAuth 2.0 Authorization Code Flow UI (hosted callback handler)
- [ ] Per-platform encryption for tokens at rest
- [ ] Token rotation policy (force refresh every N days)
- [ ] Metrics on token refresh success rate (track in metrics table)
- [ ] Integration with HashiCorp Vault for secrets management

---

**Last Updated**: 2026-05-20  
**Workflow Version**: 1.0  
**Database Schema Version**: 1.0
