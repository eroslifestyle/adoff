#!/usr/bin/env bash
# =============================================================================
# AdOff — Firma/submit Firefox AMO (listed) con retry-friendly + notifica Telegram.
# Usato per ritentare dopo il throttle AMO. Builda firefox 3.4.x e fa web-ext sign.
# Notifica l'esito nel topic Supporto (thread 7) via /admin/suggestions/notify.
# =============================================================================
set -euo pipefail

PROJECT_ROOT="/home/mrxxx/adoff"
API_BASE="https://api.adoff.app"

# shellcheck disable=SC1091
[ -f "$HOME/.secrets/adoff-stores.env" ] && source "$HOME/.secrets/adoff-stores.env"

cd "$PROJECT_ROOT"

notify() {
  [ -n "${ADMIN_TOKEN:-}" ] || return 0
  curl -s -X POST "$API_BASE/admin/suggestions/notify" \
    -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d "{\"thread\":7,\"text\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$1")}" >/dev/null 2>&1 || true
}

VER=$(python3 -c "import json;print(json.load(open('app-firefox/manifest.json'))['version'])")
echo "[$(date -Iseconds)] AMO sign start (v$VER)"

# Build firefox aggiornato (store = leggibile, AMO-friendly)
node sviluppo/scripts/build.js --store --target firefox >/tmp/amo-build.log 2>&1 || { echo "build fail"; notify "❌ <b>AMO $VER</b>: build fallita"; exit 1; }

OUT=$(npx --no-install web-ext sign \
  --api-key="$AMO_API_KEY" --api-secret="$AMO_API_SECRET" \
  --channel=listed --source-dir=sviluppo/build-firefox \
  --artifacts-dir=sviluppo/amo-artifacts 2>&1) || true
echo "$OUT" | tail -20

if echo "$OUT" | grep -qiE "Signed and ready|submitted|downloaded to|listed on"; then
  notify "✅ <b>AMO $VER</b>: submission inviata (listed). In review su addons.mozilla.org."
  echo "[$(date -Iseconds)] AMO sign OK"
elif echo "$OUT" | grep -qi "throttled"; then
  SECS=$(echo "$OUT" | grep -oE "[0-9]+ seconds" | grep -oE "[0-9]+" | head -1 || echo "?")
  notify "⏳ <b>AMO $VER</b>: ancora throttled (~${SECS}s). Riprovare più tardi."
  echo "[$(date -Iseconds)] AMO still throttled ($SECS s)"
  exit 2
else
  notify "❌ <b>AMO $VER</b>: errore submit. Controlla i log."
  echo "[$(date -Iseconds)] AMO sign error"
  exit 1
fi
