#!/bin/bash
# snapshot.sh — Snapshot + rollback di rules-feed.json
set -euo pipefail

BASE="/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin"
FEED="$BASE/site/rules-feed.json"
SNAP_DIR="$BASE/sviluppo/autofix/snapshots"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
LABEL="${1:-}"

mkdir -p "$SNAP_DIR"

snapshot() {
  local tag="${LABEL:-${DATE}_${TIME}}"
  local snap="$SNAP_DIR/${DATE}_${TIME}.json"
  cp "$FEED" "$snap"
  # Salva metadata
  echo "{\"tag\":\"$tag\",\"date\":\"$DATE\",\"time\":\"$TIME\",\"file\":\"$snap\",\"rules\":$(python3 -c "import json; f=open('$FEED'); d=json.load(f); print(len(d.get('rules',[])))")}" > "$SNAP_DIR/${DATE}_${TIME}.meta.json"
  echo "SNAPSHOT: $snap ($(cat "$SNAP_DIR/${DATE}_${TIME}.meta.json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["rules"], "regole")'))"
}

rollback() {
  local snap_file
  if [[ -z "${1:-}" ]]; then
    # Ultimo snapshot
    snap_file=$(ls -t "$SNAP_DIR"/*.json 2>/dev/null | head -1)
  else
    snap_file=$(ls -t "$SNAP_DIR"/*"${1}"*.json 2>/dev/null | head -1)
  fi
  if [[ -z "$snap_file" ]]; then
    echo "ERRORE: snapshot non trovato: $1"; exit 1;
  fi
  cp "$snap_file" "$FEED"
  echo "ROLLBACK: $FEED <- $snap_file"
}

case "${1:-snapshot}" in
  snapshot) snapshot ;;
  rollback) rollback "${2:-}" ;;
  *) echo "Uso: $0 [snapshot|rollback [tag]]" ;;
esac
