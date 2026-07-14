#!/usr/bin/env bash
# CWS auto-retry deploy — tenta upload+publish della build store finché CWS
# non si sblocca (ITEM_NOT_UPDATABLE finché la versione precedente è in review).
# Su SUCCESS pubblica e rimuove la propria entry crontab (self-disable).
# Installato come cron ogni 30 min. Log: sviluppo/logs/cws-autoretry.log
set -u

PROJECT_ROOT="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin"
ZIP="$PROJECT_ROOT/sviluppo/adoff-chrome-store.zip"
SECRETS="$HOME/.secrets/adoff-stores.env"
LOG="$PROJECT_ROOT/sviluppo/logs/cws-autoretry.log"
LOCK="/tmp/cws-autoretry.lock"
TARGET_VERSION="3.4.9"
CRON_TAG="cws-autoretry-deploy"

mkdir -p "$(dirname "$LOG")"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

# Lock anti-overlap
exec 9>"$LOCK"
if ! flock -n 9; then
  log "skip: altra istanza in esecuzione"
  exit 0
fi

if [ ! -f "$ZIP" ]; then log "ERRORE: ZIP non trovato: $ZIP"; exit 1; fi
if [ ! -f "$SECRETS" ]; then log "ERRORE: secrets non trovati: $SECRETS"; exit 1; fi

# Verifica che lo ZIP sia davvero la versione target (no deploy accidentale)
ZIP_VER=$(unzip -p "$ZIP" manifest.json 2>/dev/null | grep -o '"version"[^,]*' | grep -o '[0-9][0-9.]*')
if [ "$ZIP_VER" != "$TARGET_VERSION" ]; then
  log "ABORT: ZIP versione $ZIP_VER != target $TARGET_VERSION — non procedo"
  exit 1
fi

# shellcheck disable=SC1090
source "$SECRETS"

ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$CWS_CLIENT_ID" -d "client_secret=$CWS_CLIENT_SECRET" \
  -d "refresh_token=$CWS_REFRESH_TOKEN" -d "grant_type=refresh_token" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','ERR'))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "ERR" ]; then
  log "ERRORE: OAuth token fallito (refresh token scaduto?). Verifica $SECRETS"
  exit 1
fi

UP=$(curl -s -X PUT "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_EXTENSION_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "x-goog-api-version: 2" -T "$ZIP")
STATE=$(echo "$UP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('uploadState','?'))" 2>/dev/null)
ERR=$(echo "$UP" | python3 -c "import sys,json;d=json.load(sys.stdin);e=d.get('itemError',[]);print(e[0]['error_code'] if e else '')" 2>/dev/null)

if [ "$STATE" = "SUCCESS" ]; then
  PUB=$(curl -s -X POST "https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_EXTENSION_ID/publish" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -H "x-goog-api-version: 2" -H "Content-Length: 0")
  PUBST=$(echo "$PUB" | python3 -c "import sys,json;print(','.join(json.load(sys.stdin).get('status',['?'])))" 2>/dev/null)
  log "SUCCESS: upload $TARGET_VERSION OK, publish status=$PUBST — disattivo il cron"
  # Self-disable: rimuove la propria entry da crontab
  ( crontab -l 2>/dev/null | grep -v "$CRON_TAG" ) | crontab - 2>>"$LOG"
  log "cron rimosso. Deploy CWS $TARGET_VERSION completato."
  exit 0
fi

if [ "$ERR" = "ITEM_NOT_UPDATABLE" ]; then
  log "ancora bloccato (ITEM_NOT_UPDATABLE): versione precedente in review. Ritento al prossimo ciclo."
  exit 0
fi

log "ESITO INATTESO state=$STATE err=$ERR resp=$(echo "$UP" | tr -d '\n' | cut -c1-300)"
exit 0
