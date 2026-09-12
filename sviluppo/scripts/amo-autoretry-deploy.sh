#!/usr/bin/env bash
# AMO auto-retry submit — ritenta web-ext sign (canale listed) finché AMO non
# esce dal throttle. Su SUCCESS rimuove la propria entry crontab (self-disable).
# Installato come cron ogni 60 min. Log: sviluppo/logs/amo-autoretry.log
set -u

PROJECT_ROOT="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin"
SRC_DIR="$PROJECT_ROOT/sviluppo/build-firefox"
SECRETS="$HOME/.secrets/adoff-stores.env"
LOG="$PROJECT_ROOT/sviluppo/logs/amo-autoretry.log"
LOCK="/tmp/amo-autoretry.lock"
TARGET_VERSION="3.4.9"
CRON_TAG="amo-autoretry-deploy"

mkdir -p "$(dirname "$LOG")"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

# Alert Telegram (best-effort): riusa le creds del clone-monitor
tg() {
  [ -f "$HOME/.secrets/adoff-telegram.env" ] || return 0
  # shellcheck disable=SC1090
  ( set -a; . "$HOME/.secrets/adoff-telegram.env"; set +a
    [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || exit 0
    curl -s --max-time 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      ${TG_THREAD_CLONES:+--data-urlencode "message_thread_id=${TG_THREAD_CLONES}"} \
      --data-urlencode "text=$1" >/dev/null 2>&1 ) || true
}

exec 9>"$LOCK"
if ! flock -n 9; then log "skip: altra istanza in esecuzione"; exit 0; fi

ZIP_VER=$(grep -o '"version"[^,]*' "$SRC_DIR/manifest.json" 2>/dev/null | grep -o '[0-9][0-9.]*' | head -1)
if [ "$ZIP_VER" != "$TARGET_VERSION" ]; then
  log "ABORT: build-firefox versione $ZIP_VER != target $TARGET_VERSION"; exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS"

OUT=$(cd "$PROJECT_ROOT" && timeout 240 npx --yes web-ext sign \
  --channel=listed \
  --api-key="$AMO_API_KEY" --api-secret="$AMO_API_SECRET" \
  --source-dir="$SRC_DIR" \
  --artifacts-dir="$PROJECT_ROOT/sviluppo/amo-artifacts" \
  --no-input 2>&1)

if echo "$OUT" | grep -qiE "Downloaded|signed and ready|Your add-on .* has been submitted|The extension .* was uploaded"; then
  log "SUCCESS: AMO submit $TARGET_VERSION OK — disattivo il cron"
  ( crontab -l 2>/dev/null | grep -v "$CRON_TAG" ) | crontab - 2>>"$LOG"
  log "cron rimosso. Submit AMO $TARGET_VERSION completato (in review Mozilla)."
  tg "✅ AdOff: Firefox AMO $TARGET_VERSION submittato con successo (in review Mozilla). Auto-retry disattivato."
  exit 0
fi

if echo "$OUT" | grep -qi "throttled"; then
  WAIT=$(echo "$OUT" | grep -oiE "available in [0-9]+ seconds" | grep -oE "[0-9]+" | head -1)
  log "ancora throttled (~${WAIT:-?}s). Ritento al prossimo ciclo."
  exit 0
fi

# 'listed' può anche rispondere che la versione è in attesa di review (già caricata)
if echo "$OUT" | grep -qiE "already exists|version .* already|cannot be overwritten"; then
  log "versione già presente su AMO — disattivo il cron"
  ( crontab -l 2>/dev/null | grep -v "$CRON_TAG" ) | crontab - 2>>"$LOG"
  exit 0
fi

log "ESITO INATTESO: $(echo "$OUT" | tr -d '\n' | tail -c 400)"
exit 0
