#!/bin/bash
# Retry publish Edge 3.5.36 — riprova finché la submission pendente Microsoft si sblocca.
# Il draft package 3.5.36 è già caricato e validato; serve solo il publish.
set -e
source ~/.secrets/adoff-stores.env
cd "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin"

HTTP=$(curl -s -o /tmp/edge-retry-body.txt -w "%{http_code}" -X POST \
  -H "Authorization: ApiKey $EDGE_API_KEY" \
  -H "X-ClientID: $EDGE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"notes":"v3.5.36"}' \
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
