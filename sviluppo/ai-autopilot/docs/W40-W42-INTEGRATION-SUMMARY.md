# W40 v2 + W42 OAuth Token Manager — Integration Summary

**Date**: 2026-05-20  
**Workflows**: W40 (Analytics Collector v2), W42 (OAuth Token Manager)  
**Status**: Ready for import and testing

---

## Overview

**W40 v2** now supports 8 social platforms (up from 4) with token management delegated to **W42**.

| Aspect | W40 v1 | W40 v2 |
|--------|--------|--------|
| Platforms | 4 (Twitter, Reddit, Mastodon, Bluesky) | 8 (+ Instagram, Facebook, TikTok, LinkedIn) |
| Token source | Environment variables | `adoff_autopilot.oauth_tokens` table |
| Missing token handling | Silent skip (no log) | Graceful skip with WARNING log to W30 |
| New endpoints | Manual trigger webhook | Same |

**W42** is a new workflow that manages OAuth token lifecycle across all 8 platforms:
- Auto-refresh every 6 hours (24h before expiry)
- Stores tokens in single table (source of truth)
- Provides `/oauth/inject-token` for manual setup
- Provides `/oauth/list-status` for debugging
- Logs all refresh events

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         W42 OAuth Token Manager                  │
│                                                                   │
│  Every 6h: Check oauth_tokens WHERE expires_at < NOW() + 24h   │
│  ├─ Fetch expiring tokens from DB                               │
│  ├─ Switch on platform → Call refresh endpoint                  │
│  ├─ Handle response → Update DB with new token/expiry           │
│  └─ On failure: Set status='expired', log alert                 │
│                                                                   │
│  Webhooks:                                                       │
│  ├─ POST /oauth/inject-token (HMAC auth)                        │
│  │  └─ UPSERT token in oauth_tokens table                       │
│  └─ POST /oauth/list-status (HMAC auth)                         │
│     └─ Return array of 8 platforms + status                     │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                    oauth_tokens table
                    (single source of truth)
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│              W40 Analytics Collector v2                          │
│                                                                   │
│  Every 60min: Query social_published (14d window)               │
│  ├─ For each post, Load token from oauth_tokens                 │
│  ├─ If token missing/expired: SKIP + log WARNING to W30         │
│  ├─ Call API endpoint (Twitter/IG/FB/TikTok/LinkedIn/etc)       │
│  ├─ Normalize metrics → INSERT into adoff_autopilot.metrics     │
│  └─ Check if post deleted → UPDATE social_published status      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

**Table**: `adoff_autopilot.oauth_tokens`

```sql
id BIGSERIAL PK,
platform TEXT NOT NULL UNIQUE,           -- twitter|reddit|mastodon|bluesky|instagram|facebook|tiktok|linkedin
access_token TEXT,                       -- Current access token
refresh_token TEXT,                      -- For platforms supporting refresh
expires_at TIMESTAMPTZ,                  -- When token expires
last_refreshed TIMESTAMPTZ DEFAULT NOW(),-- Last successful refresh
refresh_endpoint TEXT,                   -- URL for token refresh (optional)
client_id TEXT,                          -- Reference only
client_secret_ref TEXT,                  -- ENV var key (e.g., 'TWITTER_CLIENT_SECRET')
scopes TEXT,                             -- comma-separated scope list
status TEXT DEFAULT 'active',            -- active|expired|revoked|pending_oauth
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**Seed Data** (8 rows, all initially `pending_oauth`):
```
twitter    | NULL | NULL | NULL       | pending_oauth
reddit     | NULL | NULL | NULL       | pending_oauth
mastodon   | NULL | NULL | NULL       | pending_oauth
bluesky    | NULL | NULL | NULL       | pending_oauth
instagram  | NULL | NULL | NULL       | pending_oauth
facebook   | NULL | NULL | NULL       | pending_oauth
tiktok     | NULL | NULL | NULL       | pending_oauth
linkedin   | NULL | NULL | NULL       | pending_oauth
```

---

## File Structure

```
desenvolvuo/ai-autopilot/
├── n8n-workflows/
│   └── workflows/
│       ├── 40-analytics-collector.json          ← W40 v2 (8 platforms)
│       ├── 40-analytics-collector.json.bak.20260520-pre-v2  ← Backup original
│       └── 42-oauth-token-manager.json          ← W42 NEW
├── database/
│   └── migrations/
│       └── 002-oauth-tokens-table.sql           ← Schema + seed
└── docs/
    ├── W40-ANALYTICS-COLLECTOR.md               ← Existing docs (update if needed)
    ├── W42-OAUTH-TOKEN-MANAGER.md               ← NEW (comprehensive runbook)
    └── W40-W42-INTEGRATION-SUMMARY.md           ← THIS FILE
```

---

## W40 v2 Node Changes

### Key Additions:

1. **Load token from oauth_tokens** (NEW)
   - Code node that queries `oauth_tokens` table
   - Returns error path if token not found or status != 'active'
   - Passes `oauth_token` field downstream to API calls

2. **Is Instagram?** / **Is Facebook?** / **Is TikTok?** / **Is LinkedIn?** (NEW)
   - Four new IF nodes to route platforms to correct API endpoint

3. **Fetch Instagram metrics** / **Fetch Facebook metrics** / **Fetch TikTok metrics** / **Fetch LinkedIn metrics** (NEW)
   - HTTP Request nodes with Meta/TikTok/LinkedIn Graph API endpoints
   - All use `{{ $json.oauth_token }}` from oauth_tokens table

4. **Normalize Instagram** / **Normalize Facebook** / **Normalize TikTok** / **Normalize LinkedIn** (NEW)
   - Code nodes that extract likes, comments, shares, views, impressions, reach, etc.
   - Standardized format for insertion into metrics table

### Removed/Changed:

- **Check token exists** node REMOVED
- **Token present?** IF node REMOVED
- Token logic now handled by single "Load token from oauth_tokens" node (cleaner, single source of truth)

### Flow:

```
Query posts (14d window)
  ↓
Load token from oauth_tokens
  ↓
Token ready? (IF)
  ├─ YES → Is Twitter? → Fetch Twitter → Normalize Twitter
  │     └─ Is Reddit? → Fetch Reddit → Normalize Reddit
  │     └─ ... (8 platforms total)
  │     └─ Rate limit pause → Insert metrics → Check deleted
  │
  └─ NO → Log skip warning → Rate limit pause
```

---

## W42 Node Structure

### Trigger Points:

1. **Every 6 hours** (Schedule)
   - Fetches expiring tokens from oauth_tokens
   - Routes to platform-specific refresh handlers

2. **POST /oauth/inject-token** (Webhook)
   - Manual token setup
   - Request: `{ platform, access_token, refresh_token, expires_in }`
   - Response: `{ status, platform, message, expires_at }`

3. **POST /oauth/list-status** (Webhook)
   - Debugging endpoint
   - Lists all 8 platforms + status, expiry, last refreshed
   - Response: `{ status, timestamp, total_platforms, tokens: [...] }`

### Refresh Logic (per platform):

| Platform | Refresh Method | Endpoint |
|----------|---|---|
| Twitter | POST with grant_type=refresh_token | https://api.twitter.com/2/oauth2/token |
| Instagram | GET with grant_type=fb_exchange_token | https://graph.facebook.com/v18.0/oauth/access_token |
| Facebook | GET with grant_type=fb_exchange_token | https://graph.facebook.com/v18.0/oauth/access_token |
| TikTok | POST with grant_type=refresh_token | https://open.tiktokapis.com/v2/oauth/token/ |
| LinkedIn | POST with grant_type=refresh_token | https://www.linkedin.com/oauth/v2/accessToken |
| Reddit | (Static token, no auto-refresh) | — |
| Mastodon | (Static token, no auto-refresh) | — |
| Bluesky | (Static token, no auto-refresh) | — |

---

## Environment Variables Required

Set in n8n Worker or `.env` file (all 16):

```bash
# Twitter
TWITTER_CLIENT_ID=xxxxxxxxxxx
TWITTER_CLIENT_SECRET=xxxxxxxxxxx

# Instagram (Meta)
INSTAGRAM_CLIENT_ID=xxxxxxxxxxx
INSTAGRAM_CLIENT_SECRET=xxxxxxxxxxx

# Facebook (Meta)
FACEBOOK_CLIENT_ID=xxxxxxxxxxx
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxx

# TikTok
TIKTOK_CLIENT_ID=xxxxxxxxxxx
TIKTOK_CLIENT_SECRET=xxxxxxxxxxx

# LinkedIn
LINKEDIN_CLIENT_ID=xxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxx

# Webhook signing secret (from W29)
WEBHOOK_SIGNING_SECRET=dev-secret
```

---

## Smoke Test Plan

### Test 1: Database Setup

```bash
# Connect to n8n PostgreSQL
psql -U adoff_autopilot -d adoff -h localhost

-- Verify table exists
SELECT COUNT(*) FROM adoff_autopilot.oauth_tokens;
-- Expected: 8

-- Check seed data
SELECT platform, status FROM adoff_autopilot.oauth_tokens ORDER BY platform;
-- Expected:
-- bluesky    | pending_oauth
-- facebook   | pending_oauth
-- instagram  | pending_oauth
-- linkedin   | pending_oauth
-- mastodon   | pending_oauth
-- reddit     | pending_oauth
-- tiktok     | pending_oauth
-- twitter    | pending_oauth
```

### Test 2: W42 Status Endpoint (No Auth)

```bash
# Generate HMAC signature
HMAC=$(echo -n '{}' | openssl dgst -sha256 -hmac 'dev-secret' | cut -d' ' -f2)

# Call endpoint
curl -X POST http://localhost:5678/webhook/oauth/list-status \
  -H "x-adoff-signature: $HMAC" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response:
# {
#   "status": "success",
#   "timestamp": "2026-05-20T14:30:00Z",
#   "total_platforms": 8,
#   "tokens": [
#     {
#       "platform": "bluesky",
#       "status": "pending_oauth",
#       "expires_at": null,
#       "days_until_expiry": null,
#       "has_token": false
#     },
#     ...
#   ]
# }
```

### Test 3: W42 Token Injection

```bash
# Inject dummy Twitter token
PAYLOAD='{"platform":"twitter","access_token":"test_token_123","expires_in":3600}'
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac 'dev-secret' | cut -d' ' -f2)

curl -X POST http://localhost:5678/webhook/oauth/inject-token \
  -H "x-adoff-signature: $HMAC" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

# Expected response:
# {
#   "status": "ok",
#   "platform": "twitter",
#   "message": "Token injected successfully",
#   "expires_at": "2026-05-20T15:30:00Z"
# }

# Verify in DB:
# SELECT platform, access_token, status FROM adoff_autopilot.oauth_tokens WHERE platform='twitter';
# Expected:
# twitter | test_token_123 | active
```

### Test 4: W40 v2 with Tokens

```bash
# Trigger W40 manually with HMAC
PAYLOAD='{}'
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac 'dev-secret' | cut -d' ' -f2)

curl -X POST http://localhost:5678/webhook/analytics-collect-now \
  -H "x-adoff-signature: $HMAC" \
  -H "Content-Type: application/json" \
  -d "{}"

# Expected behavior:
# ✓ Queries social_published (14d window) → 0 posts (empty)
# ✓ Loads tokens from oauth_tokens (finds dummy Twitter token)
# ✓ Attempts to fetch Twitter metrics but gets 401/404 (expected, dummy token)
# ✓ Normalizes response → Insert 0 metrics (because query returned 0 posts)
# ✓ Zero errors in logs (graceful handling)

# Check logs:
# grep "[W40 ANALYTICS]" /var/log/n8n/execution.log
```

### Test 5: W40 v2 with Missing Token

```bash
# After test 4, delete the injected token
DELETE FROM adoff_autopilot.oauth_tokens WHERE platform='twitter';
UPDATE adoff_autopilot.oauth_tokens SET status='pending_oauth' WHERE platform='twitter';

# Trigger W40 again
curl -X POST http://localhost:5678/webhook/analytics-collect-now \
  -H "x-adoff-signature: $HMAC" \
  -d "{}"

# Expected behavior:
# ✓ Loads tokens → Twitter token NOT FOUND
# ✓ Skips Twitter with WARNING log: "[W40 ANALYTICS] ... | SKIP | TWITTER | Token not found..."
# ✓ Continues with other platforms (if seeded)
# ✓ No HTTP errors, workflow completes successfully
```

---

## Integration Checklist

- [ ] Create `adoff_autopilot.oauth_tokens` table (run migration 002-oauth-tokens-table.sql)
- [ ] Import W40 v2 JSON into n8n (40-analytics-collector.json)
- [ ] Import W42 JSON into n8n (42-oauth-token-manager.json)
- [ ] Set 16 environment variables (Twitter, Instagram, Facebook, TikTok, LinkedIn client IDs/secrets + WEBHOOK_SIGNING_SECRET)
- [ ] Run Smoke Test 1 (Database setup) ✓
- [ ] Run Smoke Test 2 (W42 status endpoint) ✓
- [ ] Run Smoke Test 3 (W42 token injection) ✓
- [ ] Run Smoke Test 4 (W40 v2 with tokens) ✓
- [ ] Run Smoke Test 5 (W40 v2 with missing token) ✓
- [ ] Update `.claude/PROGRESS.md` with completion status
- [ ] Archive old W40 backup (40-analytics-collector.json.bak.20260520-pre-v2)

---

## Deliverables Checklist

| Item | Path | Status |
|------|------|--------|
| W40 v2 (8 platforms) | `workflows/40-analytics-collector.json` | ✓ Created |
| W40 v1 Backup | `workflows/40-analytics-collector.json.bak.20260520-pre-v2` | ✓ Created |
| W42 OAuth Token Manager | `workflows/42-oauth-token-manager.json` | ✓ Created |
| Database Migration | `database/migrations/002-oauth-tokens-table.sql` | ✓ Created |
| OAuth Setup Runbook | `docs/W42-OAUTH-TOKEN-MANAGER.md` | ✓ Created |
| Integration Summary | `docs/W40-W42-INTEGRATION-SUMMARY.md` | ✓ THIS |

---

## Known Limitations

1. **Reddit/Mastodon/Bluesky**: No auto-refresh (static tokens). Must be manually injected via W42 webhook. Consider implementing refresh logic once token expiry is confirmed.

2. **Instagram/Facebook**: Meta uses long-lived tokens (~60 days) but recommends quarterly refresh. W42 will refresh 24h before expiry if configured.

3. **TikTok**: Requires `client_secret` for refresh, which must be set in env vars. OAuth flow is provider-initiated (no direct API callback).

4. **LinkedIn**: Refresh token is required and must be persisted in DB. Ensure refresh_token is injected alongside access_token.

5. **Rate Limiting**: W40 has 1.5s pause between API calls. Adjust if hitting platform rate limits.

---

## Troubleshooting

### "Token not found in oauth_tokens table"
- Check table exists: `SELECT COUNT(*) FROM adoff_autopilot.oauth_tokens;`
- Seed data: `INSERT INTO adoff_autopilot.oauth_tokens (platform, status) VALUES (...)...`

### "Invalid signature on webhook"
- Verify `WEBHOOK_SIGNING_SECRET` is set in n8n Worker
- Ensure HMAC is calculated over JSON.stringify(body)
- Check header name is exactly `x-adoff-signature`

### "Refresh failed: Missing env vars"
- Verify all 16 env vars are set (grep `TWITTER_CLIENT_ID` in n8n settings)
- Restart n8n worker to apply changes
- Check for typos (case-sensitive)

### "W40 skips all platforms"
- Check oauth_tokens table has status='active' (not pending_oauth or expired)
- Verify token injection was successful (run Smoke Test 3)
- Check logs for "[W40 ANALYTICS] ... | SKIP | ..." warnings

---

## Next Steps

1. Import both workflows into n8n
2. Run database migration
3. Execute smoke tests (all 5)
4. Document token injection endpoints in team wiki
5. Schedule weekly token audit (check expiry dates in oauth_tokens)
6. Integrate W42 refresh failures with Telegram alerts (W30)
7. Monitor token refresh success rate in metrics dashboard

---

**Last Updated**: 2026-05-20  
**Workflow Versions**: W40 v2.0, W42 v1.0  
**Database Schema Version**: 1.0
