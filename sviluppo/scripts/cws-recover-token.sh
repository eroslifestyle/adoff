#!/bin/bash
# AdOff — CWS OAuth Token Recovery
#
# Run this AFTER:
#   1. Publishing OAuth consent screen (Testing -> In production)
#   2. Creating new OAuth Client ID (Desktop app type)
#   3. Obtaining new refresh token via OAuth Playground
#
# This script:
#   - Validates the new credentials with a test access-token request
#   - Updates ~/.secrets/adoff-stores.env in place
#   - Tests upload to Chrome Web Store (dry-run, no publish)
#
# Usage: ./cws-recover-token.sh

set -e

SECRETS="$HOME/.secrets/adoff-stores.env"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== CWS OAuth Token Recovery ===${NC}\n"

read -p "New CWS_CLIENT_ID:     " NEW_CLIENT_ID
read -p "New CWS_CLIENT_SECRET: " NEW_CLIENT_SECRET
read -p "New CWS_REFRESH_TOKEN: " NEW_REFRESH_TOKEN

echo ""
echo -e "${YELLOW}[1/3] Validating new credentials...${NC}"

RESPONSE=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
    -d "client_id=$NEW_CLIENT_ID" \
    -d "client_secret=$NEW_CLIENT_SECRET" \
    -d "refresh_token=$NEW_REFRESH_TOKEN" \
    -d "grant_type=refresh_token")

if ! echo "$RESPONSE" | grep -q '"access_token"'; then
    echo -e "${RED}FAILED:${NC}"
    echo "$RESPONSE"
    echo ""
    echo "Common causes:"
    echo "  - Consent screen still in 'Testing' (publish it first)"
    echo "  - Wrong scope used in OAuth Playground"
    echo "    (must be: https://www.googleapis.com/auth/chromewebstore)"
    echo "  - Authorization not granted with the same Google account"
    echo "    that owns the Chrome Web Store developer dashboard"
    exit 1
fi

ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo -e "${GREEN}OK — access token obtained (length=${#ACCESS_TOKEN}).${NC}"

echo ""
echo -e "${YELLOW}[2/3] Updating $SECRETS...${NC}"

# Backup
cp "$SECRETS" "${SECRETS}.backup-$(date +%Y%m%d-%H%M%S)"

# Update in place using sed (cross-shell quote-safe)
python3 << EOF
import re
path = "$SECRETS"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = re.sub(r'^export CWS_CLIENT_ID=.*$',
                 f'export CWS_CLIENT_ID="$NEW_CLIENT_ID"',
                 content, count=1, flags=re.MULTILINE)
content = re.sub(r'^export CWS_CLIENT_SECRET=.*$',
                 f'export CWS_CLIENT_SECRET="$NEW_CLIENT_SECRET"',
                 content, count=1, flags=re.MULTILINE)
content = re.sub(r'^export CWS_REFRESH_TOKEN=.*$',
                 f'export CWS_REFRESH_TOKEN="$NEW_REFRESH_TOKEN"',
                 content, count=1, flags=re.MULTILINE)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated.")
EOF

echo -e "${GREEN}OK — credentials saved.${NC}"

echo ""
echo -e "${YELLOW}[3/3] Testing CWS API access (read item info)...${NC}"

source "$SECRETS"
INFO=$(curl -s -X GET \
    "https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_EXTENSION_ID?projection=DRAFT" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "x-goog-api-version: 2")

if echo "$INFO" | grep -q '"id"'; then
    echo -e "${GREEN}OK — CWS API responding correctly.${NC}"
    echo "$INFO" | python3 -m json.tool 2>/dev/null | head -20 || echo "$INFO"
else
    echo -e "${RED}WARN — unexpected response:${NC}"
    echo "$INFO"
fi

echo ""
echo -e "${GREEN}=== Recovery complete ===${NC}"
echo ""
echo "Next: upload v3.3.0 with"
echo "  bash sviluppo/scripts/deploy-stores.sh chrome"
echo "or manually:"
echo "  curl -X PUT \"https://www.googleapis.com/upload/chromewebstore/v1.1/items/\$CWS_EXTENSION_ID\" \\"
echo "    -H \"Authorization: Bearer \$ACCESS_TOKEN\" -H \"x-goog-api-version: 2\" \\"
echo "    -T sviluppo/adoff-chrome-store.zip"
