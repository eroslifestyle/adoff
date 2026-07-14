#!/bin/bash
# Diagnosi endpoint per i tre provider — tenta variazioni comuni di URL

set -e
source /home/mrxxx/.claude/secrets/social-apis.env

TIKHUB_KEY=${TIKHUB_API_KEY}
ENSEMBLEDATA_TOKEN=${ENSEMBLEDATA_API_TOKEN}
SCRAPECREATORS_KEY=${SCRAPECREATORS_API_KEY}

echo "================================================"
echo "DIAGNOSTICA ENDPOINT — Fase 0"
echo "================================================"
echo ""

# ============ TikHub ============
echo "[TikHub] Testing endpoints..."
echo "  Key loaded: ${TIKHUB_KEY:0:20}..."

# Attempt 1: /api/v1/posts/search
echo "  → Trying POST /api/v1/posts/search"
curl -s -X POST "https://api.tikhub.io/api/v1/posts/search" \
  -H "X-API-Key: $TIKHUB_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"productivity","platform":"tiktok","count":5}' \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed (curl error or invalid JSON)"

# Attempt 2: /v1/posts/search
echo "  → Trying GET /v1/posts/search"
curl -s -G "https://api.tikhub.io/v1/posts/search" \
  -d "keyword=productivity" -d "platform=tiktok" -d "count=5" \
  -H "X-API-Key: $TIKHUB_KEY" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

# Attempt 3: /api/posts/search
echo "  → Trying GET /api/posts/search"
curl -s -G "https://api.tikhub.io/api/posts/search" \
  -d "keyword=productivity" \
  -H "X-API-Key: $TIKHUB_KEY" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

echo ""

# ============ EnsembleData ============
echo "[EnsembleData] Testing endpoints..."
echo "  Key loaded: ${ENSEMBLEDATA_TOKEN:0:20}..."

# Attempt 1: /v1/social/posts
echo "  → Trying GET /v1/social/posts"
curl -s -G "https://api.ensembledata.com/v1/social/posts" \
  -d "hashtag=productivity" -d "platform=tiktok" \
  -H "Authorization: Bearer $ENSEMBLEDATA_TOKEN" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

# Attempt 2: /posts/search
echo "  → Trying GET /posts/search"
curl -s -G "https://api.ensembledata.com/posts/search" \
  -d "q=productivity" \
  -H "Authorization: Bearer $ENSEMBLEDATA_TOKEN" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

echo ""

# ============ ScrapeCreators ============
echo "[ScrapeCreators] Testing endpoints..."
echo "  Key loaded: ${SCRAPECREATORS_KEY:0:20}..."

# Attempt 1: /api/v1/search
echo "  → Trying GET /api/v1/search"
curl -s -G "https://api.scrapecreators.com/api/v1/search" \
  -d "query=productivity" -d "platform=tiktok" \
  -H "X-API-Key: $SCRAPECREATORS_KEY" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

# Attempt 2: /v1/posts
echo "  → Trying GET /v1/posts"
curl -s -G "https://api.scrapecreators.com/v1/posts" \
  -d "search=productivity" \
  -H "X-API-Key: $SCRAPECREATORS_KEY" \
  --max-time 5 | jq . 2>/dev/null | head -10 || echo "    ✗ Failed"

echo ""
echo "================================================"
echo "Check output above to identify working endpoints"
echo "Update fase-0-provider-comparison.py with correct endpoints"
echo "================================================"
