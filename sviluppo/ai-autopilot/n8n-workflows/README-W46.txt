W46 — Proactive Engagement Discovery v1.0
=========================================

READY FOR IMPORT into n8n 2.21.5+

File: workflows/46-proactive-engagement-discovery.json
Docs: docs/W46-PROACTIVE-DISCOVERY.md

FEATURES:
- Schedule: 60 min + Webhook /proactive-scan-now (HMAC W29)
- Discovery: Reddit (OAuth), HackerNews (public), Mastodon (public)
- Brand-safety filter: 6 automated checks
- Gemini Flash relevance scoring (0-100)
- Automatic INSERT engagement_inbox with status/priority
- Daily Telegram report (19:00 CET)
- Anti-spam caps: 5/platform, 15/day max

ENV REQUIRED:
- WEBHOOK_HMAC_SECRET=<hex>
- REDDIT_OAUTH_TOKEN=<token> (optional, graceful skip)
- TELEGRAM_BOT_TOKEN=<token>
- TELEGRAM_CHAT_ID=<id>
- PG_CRED_ID=<n8n-postgres-id>
- PROACTIVE_DISCOVERY_DISABLED=false

SMOKE TEST:
1. Import JSON into n8n
2. Activate schedule trigger
3. Wait 60min OR POST webhook:
   curl -X POST http://n8n-host:5678/webhook/proactive-scan-now \
     -H "x-adoff-signature: <hmac-sha256>" \
     -H "Content-Type: application/json" \
     -d '{}'
4. Check engagement_inbox for rows with intent='proactive_outreach'

LINKAGE:
- W46 discovers → W45 posts (same engagement_inbox pipeline)
- Rows status='proactive_drafted' flow to W45 for actual posting
- Rows status='proactive_review' await human approval (admin panel)

STATUS: Production-ready
