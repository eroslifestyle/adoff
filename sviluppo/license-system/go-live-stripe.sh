#!/usr/bin/env bash
# AdOff — Stripe Test → Live switch
# Swappa i 2 secret Stripe del worker (price_data inline → nessuna ricreazione prodotti).
# Lancialo TU con le chiavi live + wrangler autenticato (global key CF).
#
#   export STRIPE_SECRET_KEY_LIVE="sk_live_xxx"
#   export STRIPE_WEBHOOK_SECRET_LIVE="whsec_xxx"
#   bash go-live-stripe.sh
set -euo pipefail

SECRETS_ENV="${HOME}/.secrets/adoff-stores.env"
WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$WORKER_DIR"

sk="${STRIPE_SECRET_KEY_LIVE:-}"
wh="${STRIPE_WEBHOOK_SECRET_LIVE:-}"

# --- Guard: anti-errore test ---
if [[ -z "$sk" || -z "$wh" ]]; then
  echo "ERRORE: esporta STRIPE_SECRET_KEY_LIVE e STRIPE_WEBHOOK_SECRET_LIVE." >&2
  exit 1
fi
if [[ "$sk" != sk_live_* ]]; then
  echo "ERRORE: STRIPE_SECRET_KEY_LIVE non inizia con 'sk_live_' (hai passato una chiave test?)." >&2
  exit 1
fi
if [[ "$wh" != whsec_* ]]; then
  echo "ERRORE: STRIPE_WEBHOOK_SECRET_LIVE non inizia con 'whsec_'." >&2
  exit 1
fi

command -v wrangler >/dev/null || { echo "ERRORE: wrangler non trovato." >&2; exit 1; }

echo "==> 1/4 Setto i secret del worker (adoff-license-api)"
printf '%s' "$sk" | wrangler secret put STRIPE_SECRET_KEY
printf '%s' "$wh" | wrangler secret put STRIPE_WEBHOOK_SECRET

echo "==> 2/4 Aggiorno ${SECRETS_ENV} (backup automatico)"
if [[ -f "$SECRETS_ENV" ]]; then
  cp "$SECRETS_ENV" "${SECRETS_ENV}.bak.$(date +%s)"
  # aggiorna in-place le righe note (lascia intatto il resto)
  tmp="$(mktemp)"
  sed -E \
    -e 's|^export STRIPE_MODE=.*|export STRIPE_MODE="live"|' \
    -e "s|^export STRIPE_SECRET_KEY=.*|export STRIPE_SECRET_KEY=\"$sk\"|" \
    -e "s|^export STRIPE_WEBHOOK_SECRET=.*|export STRIPE_WEBHOOK_SECRET=\"$wh\"|" \
    "$SECRETS_ENV" > "$tmp" && mv "$tmp" "$SECRETS_ENV"
  chmod 600 "$SECRETS_ENV"
else
  echo "  (skip: $SECRETS_ENV non esiste)"
fi

echo "==> 3/4 Deploy worker (propaga; nessuna modifica al codice)"
wrangler deploy

echo "==> 4/4 Verifica"
echo -n "  /health → "; curl -fsS https://api.adoff.app/health || echo "(health non OK)"
echo ""
echo -n "  /stripe-webhook senza firma (atteso 401) → "
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://api.adoff.app/stripe-webhook -d '{}')
echo "$code $([[ "$code" == 401 ]] && echo OK || echo 'ATTENZIONE: atteso 401')"

echo ""
echo "FATTO. Ora fai un checkout reale di prova e verifica l'evento checkout.session.completed = 200 sul dashboard Stripe (Live)."
