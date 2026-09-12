#!/usr/bin/env bash
# Pubblicazione di AdOff 3.6.0 — il passaggio al modello gratuito per tutti.
#
# Si esegue a FASI, una per volta, perche' l'ordine conta:
# il sito non deve dire "gratis" prima che l'estensione lo sia davvero,
# e i sostenitori non vanno avvisati prima che entrambi siano usciti.
#
#   ./pubblica-3.6.0.sh worker     # 1. worker + tabella newsletter (invisibile agli utenti)
#   ./pubblica-3.6.0.sh store      # 2. Chrome Web Store, Firefox AMO, Edge
#   ./pubblica-3.6.0.sh sito       # 3. sito (dopo che gli store hanno accettato)
#   ./pubblica-3.6.0.sh verifica   # controlli, non pubblica nulla
#
# L'invio delle email ai sostenitori NON e' qui apposta: e' l'unica azione
# che non si annulla. I testi sono in sviluppo/COMUNICAZIONE-SOSTENITORI.md.

set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
VER="$(python3 -c "import json;print(json.load(open('app/manifest.json'))['version'])")"

log() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

carica_segreti() {
  [ -f ~/.secrets/adoff-stores.env ] || die "manca ~/.secrets/adoff-stores.env"
  # shellcheck disable=SC1090
  source ~/.secrets/adoff-stores.env
}

verifica() {
  log "Versione dichiarata: $VER"
  for t in app app-firefox app-safari; do
    v="$(python3 -c "import json;print(json.load(open('$t/manifest.json'))['version'])")"
    [ "$v" = "$VER" ] || die "$t/manifest.json e' a $v, non $VER"
  done
  echo "  i tre manifest concordano"

  log "Pacchetti"
  for b in chrome firefox safari; do
    z="sviluppo/adoff-$b-store.zip"
    [ -f "$z" ] || die "manca $z — esegui: node sviluppo/scripts/build.js --store"
    v="$(python3 -c "import zipfile,json;print(json.loads(zipfile.ZipFile('$z').read('manifest.json'))['version'])")"
    [ "$v" = "$VER" ] || die "$z contiene la $v, non la $VER"
    echo "  $z → $v"
  done

  log "Banchi"
  for t in test-plan-tier-consistency test-security-invariants test-license-integrity \
           test-ad-skip test-yt-quality-reload test-yt-coldload \
           test-rules-no-content-block test-newsletter-route test-portal-route; do
    node "sviluppo/tests/$t.js" >/dev/null 2>&1 && echo "  ok   $t" || die "$t FALLISCE"
  done

  log "Gate del sito"
  python3 sviluppo/scripts/i18n_manager.py check | tail -1
  python3 sviluppo/scripts/prose_i18n.py check-all >/dev/null 2>&1 || die "prose check-all fallisce"
  echo "  prose ok"

  log "Repo"
  [ -z "$(git status --porcelain -- app app-firefox app-safari site)" ] \
    || die "ci sono modifiche non committate: committa prima di pubblicare"
  echo "  pulito, HEAD = $(git rev-parse --short HEAD)"
}

fase_worker() {
  carica_segreti
  verifica
  log "Tabella newsletter su D1"
  echo "  (idempotente: CREATE TABLE IF NOT EXISTS)"
  # il database si chiama adoff-db (vedi d1_databases in license-system/wrangler.toml)
  SQL_NEWSLETTER="$(python3 - <<'SQL'
import re
s=open('sviluppo/license-system/schema.sql',encoding='utf-8').read()
m=re.search(r'CREATE TABLE IF NOT EXISTS newsletter.*?\);', s, re.S)
print(m.group(0) if m else '')
SQL
)"
  [ -n "$SQL_NEWSLETTER" ] || die "non trovo la CREATE TABLE newsletter in schema.sql"
  ( cd sviluppo/license-system && npx wrangler d1 execute adoff-db --remote --yes \
      --command "$SQL_NEWSLETTER" )
  log "Deploy del worker"
  ( cd sviluppo/license-system && npx wrangler deploy )
  log "Fatto. Il worker e' live; per gli utenti non cambia ancora nulla."
  echo "  Prova la disdetta: apri adoff.app/account da loggato e clicca il pulsante."
}

fase_store() {
  carica_segreti
  verifica

  log "Chrome Web Store"
  TOKEN="$(curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=$CWS_CLIENT_ID" -d "client_secret=$CWS_CLIENT_SECRET" \
    -d "refresh_token=$CWS_REFRESH_TOKEN" -d grant_type=refresh_token \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")"
  curl -s -X PUT "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_EXTENSION_ID" \
    -H "Authorization: Bearer $TOKEN" -H "x-goog-api-version: 2" \
    -T sviluppo/adoff-chrome-store.zip | python3 -m json.tool
  curl -s -X POST "https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_EXTENSION_ID/publish" \
    -H "Authorization: Bearer $TOKEN" -H "x-goog-api-version: 2" -H "Content-Length: 0" \
    | python3 -m json.tool

  log "Firefox AMO"
  npx web-ext sign --channel=listed \
    --api-key="$AMO_API_KEY" --api-secret="$AMO_API_SECRET" \
    --source-dir=sviluppo/build-firefox --artifacts-dir=sviluppo/amo-artifacts \
    || echo "  (se AMO risponde 409 la versione e' gia' caricata: controlla a mano)"

  log "Edge Add-ons"
  curl -s -X POST -H "Authorization: ApiKey $EDGE_API_KEY" -H "X-ClientID: $EDGE_CLIENT_ID" \
    -H "Content-Type: application/zip" --data-binary "@sviluppo/adoff-chrome-store.zip" -D - \
    "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions/draft/package" \
    | grep -i "^location:" || echo "  nessun Location: controlla la risposta"
  echo "  attendi che l'operazione risulti Succeeded, poi invia la submission:"
  echo "  curl -X POST -H \"Authorization: ApiKey \$EDGE_API_KEY\" -H \"X-ClientID: \$EDGE_CLIENT_ID\" \\"
  echo "    -H 'Content-Type: application/json' -d '{\"notes\":\"$VER — AdOff e' ora gratuito per tutti\"}' \\"
  echo "    https://api.addons.microsoftedge.microsoft.com/v1/products/\$EDGE_PRODUCT_ID/submissions"
}

fase_sito() {
  verifica
  log "Deploy del sito"
  bash sviluppo/scripts/deploy-site.sh
  log "Fatto. Ora sito ed estensione dicono la stessa cosa."
  echo "  Solo a questo punto ha senso avvisare i sostenitori:"
  echo "  i testi sono in sviluppo/COMUNICAZIONE-SOSTENITORI.md"
}

case "${1:-}" in
  worker)   fase_worker ;;
  store)    fase_store ;;
  sito)     fase_sito ;;
  verifica) verifica ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
