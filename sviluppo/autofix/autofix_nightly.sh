#!/bin/bash
# autofix_nightly.sh - Orchestrazione notturna Auto-Fix AdOff
# Cron: 0 0 * * * Europe/Rome
set -euo pipefail

BASE="/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/autofix"
DATE=$(date +%Y-%m-%d)
LOG="$BASE/logs/${DATE}.log"
LOCK="$BASE/.autofix.lock"
SHADOW_MODE="${SHADOW_MODE:-1}"  # 1=shadow, 0=auto-deploy

# === FLOCK ===
exec 200>"$LOCK"
if ! flock -n 200; then
  echo "[$(date)] GIA' IN ESECUZIONE - exit" | tee -a "$LOG"
  exit 0
fi
trap 'flock -u 200' EXIT

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

log "=== AUTOFIX START $DATE ==="
log "Shadow mode: $SHADOW_MODE"

# 1. Build target list
log "[1/5] build_target_list..."
python3 "$BASE/build_target_list.py" >> "$LOG" 2>&1 || log "WARN: build_target_list failed"

# 2. Crawl
log "[2/5] crawl..."
xvfb-run -a node "$BASE/crawl.mjs" --date "$DATE" >> "$LOG" 2>&1 || log "WARN: crawl failed"

# 3. Analyze
log "[3/5] analyze..."
node "$BASE/analyze_and_fix.mjs" --date "$DATE" >> "$LOG" 2>&1 || log "WARN: analyze failed"

# 4. Canary (solo se ci sono candidate)
CANDIDATES="$BASE/candidate_rules/${DATE}.json"
CANDIDATES_COUNT=0
if [[ -f "$CANDIDATES" ]]; then
  CANDIDATES_COUNT=$(python3 -c "import json; f=open('$CANDIDATES'); d=json.load(f); print(d.get('new_candidates',0))" 2>/dev/null || echo "0")
fi

if [[ "$CANDIDATES_COUNT" -gt 0 ]]; then
  log "[4/5] canary..."
  xvfb-run -a node "$BASE/canary_runner.mjs" >> "$LOG" 2>&1 || {
    log "CANARY FALLITO - skip deploy"
    SHADOW_MODE=1
  }
else
  log "[4/5] canary skipped (no candidates)"
fi

# 5. Deploy (solo se shadow mode OFF)
if [[ "$SHADOW_MODE" == "0" ]]; then
  log "[5/5] deploy rules-feed..."
  bash "$BASE/snapshot.sh" snapshot >> "$LOG" 2>&1 || true
  # Merge new candidates into site/rules-feed.json
  node -e "
const fs=require('fs');
const feed=JSON.parse(fs.readFileSync('$BASE/../site/rules-feed.json','utf8'));
const cand=JSON.parse(fs.readFileSync('$CANDIDATES','utf8'));
const existing=new Set(feed.rules.map(r=>r.condition.urlFilter));
let added=0;
for(const c of cand.candidates||[]){
  if(existing.has(c.condition.urlFilter))continue;
  const rule={priority:c.priority||1,action:c.action,condition:{urlFilter:c.condition.urlFilter,resourceTypes:c.condition.resourceTypes||['script','xmlhttprequest','image','sub_frame']}};
  if(c.condition.domains)rule.condition.domains=c.condition.domains;
  feed.rules.push(rule); existing.add(rule.condition.urlFilter); added++;
}
feed._autofix={date:new Date().toISOString(),candidates_added:added};
feed.updated=new Date().toISOString().slice(0,10);
fs.writeFileSync('$BASE/../site/rules-feed.json',JSON.stringify(feed,null,2));
console.log('Merged '+added+' new rules ('+feed.rules.length+' total)');
" >> "$LOG" 2>&1
  log "Deploying to CF Pages (branch main = Production)..."
  source ~/.secrets/adoff-stores.env 2>/dev/null
  wrangler pages deploy "$BASE/../site/" --project-name adoff-site --branch main --commit-dirty=true >> "$LOG" 2>&1
else
  log "[5/5] SHADOW MODE - no deploy"
fi

# 6. Report
log "[6/6] report..."
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}" \
  TELEGRAM_CHANNEL_ID="${TELEGRAM_CHANNEL_ID:--1004293812042}" \
  node "$BASE/report.mjs" --date "$DATE" --telegram >> "$LOG" 2>&1 || true

log "=== AUTOFIX END ==="
