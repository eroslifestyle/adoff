#!/bin/bash
# Retry publish Edge — riprova finché la submission pendente Microsoft si sblocca.
# Il draft package è già caricato e validato; serve solo il publish.
# La versione è letta da app/manifest.json (single source of truth), mai hardcoded.
set -e
source ~/.secrets/adoff-stores.env
cd "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin"

VERSION=$(python3 -c "import json;print(json.load(open('app/manifest.json'))['version'])")

HTTP=$(curl -s -o /tmp/edge-retry-body.txt -w "%{http_code}" -X POST \
  -H "Authorization: ApiKey $EDGE_API_KEY" \
  -H "X-ClientID: $EDGE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d "{\"notes\":\"v$VERSION\"}" \
  -D /tmp/edge-retry-headers.txt \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions")

OP=$(grep -i "location" /tmp/edge-retry-headers.txt | tr -d '\r' | awk '{print $2}')
[ "$HTTP" != "202" ] && { echo "publish POST HTTP=$HTTP"; cat /tmp/edge-retry-body.txt; exit 1; }

for i in $(seq 1 12); do
  RESP=$(curl -s -H "Authorization: ApiKey $EDGE_API_KEY" -H "X-ClientID: $EDGE_CLIENT_ID" \
    "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions/operations/$OP")
  STATUS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
  echo "[$i] $STATUS"
  [ "$STATUS" = "Succeeded" ] && { echo "EDGE_PUBLISH_OK"; exit 0; }
  [ "$STATUS" = "Failed" ] && { echo "$RESP"; exit 2; }
  sleep 5
done
exit 3
