#!/usr/bin/env bash
# AdOff Multilang autopilot scheduler — host cron (evita deadlock queue-mode n8n).
# Prende il prossimo seed least-recently-used, lancia W11 per tutte le lingue warming.
set -euo pipefail

PSQL="docker exec n8n-postgres psql -U n8n -d n8n -t -A -c"
W11_URL="http://192.168.1.74:5678/webhook/adoff-ml-publish"
LOG="/home/mrxxx/adoff-ml-cron.log"

# 1. Pick + claim next seed (LRU), atomically bump usage
SEED=$($PSQL "WITH pick AS (SELECT id FROM adoff_autopilot.content_seeds WHERE active ORDER BY last_used NULLS FIRST, used_count ASC, id ASC LIMIT 1) UPDATE adoff_autopilot.content_seeds s SET used_count=used_count+1, last_used=now() FROM pick WHERE s.id=pick.id RETURNING s.seed;")

if [ -z "$SEED" ]; then
  echo "[$(date -u +%F\ %T)] NO active seed, abort" >> "$LOG"
  exit 0
fi

# 2. Fire W11 for all warming channels, all languages, real publish (queued)
PAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'seed_post': sys.argv[1], 'status_filter':['warming'], 'dry_run': False}))" "$SEED")
RESP=$(curl -s --max-time 280 -X POST "$W11_URL" -H "Content-Type: application/json" -d "$PAYLOAD" || echo '{"ok":false,"error":"curl_failed"}')

echo "[$(date -u +%F\ %T)] seed='${SEED:0:60}...' resp=$RESP" >> "$LOG"
