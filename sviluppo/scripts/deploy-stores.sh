#!/bin/bash
# AdOff — Deploy to All Stores
# Usage: ./deploy-stores.sh [chrome|firefox|edge|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_FILE="$HOME/.secrets/adoff-stores.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load secrets
if [ -f "$SECRETS_FILE" ]; then
    source "$SECRETS_FILE"
else
    echo -e "${RED}ERROR: Secrets file not found: $SECRETS_FILE${NC}"
    exit 1
fi

# Get version from manifest
VERSION=$(grep '"version"' "$PROJECT_ROOT/app/manifest.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo -e "${GREEN}=== AdOff v$VERSION — Store Deployment ===${NC}\n"

TARGET="${1:-all}"

# Build if needed
build_packages() {
    echo -e "${YELLOW}Building packages...${NC}"
    cd "$PROJECT_ROOT"
    node sviluppo/scripts/build.js
    echo ""
}

# Chrome Web Store
deploy_chrome() {
    echo -e "${YELLOW}[Chrome Web Store]${NC}"

    # Get access token
    ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
        -d "client_id=$CWS_CLIENT_ID" \
        -d "client_secret=$CWS_CLIENT_SECRET" \
        -d "refresh_token=$CWS_REFRESH_TOKEN" \
        -d "grant_type=refresh_token" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

    if [ -z "$ACCESS_TOKEN" ]; then
        echo -e "${RED}  Failed to get access token${NC}"
        return 1
    fi

    # Upload
    UPLOAD_RESULT=$(curl -s -X PUT \
        "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_EXTENSION_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "x-goog-api-version: 2" \
        -T "$PROJECT_ROOT/sviluppo/adoff-chrome-store.zip")

    if echo "$UPLOAD_RESULT" | grep -q '"uploadState": "SUCCESS"'; then
        echo -e "${GREEN}  Upload: OK${NC}"

        # Publish
        PUBLISH_RESULT=$(curl -s -X POST \
            "https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_EXTENSION_ID/publish" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "x-goog-api-version: 2")

        if echo "$PUBLISH_RESULT" | grep -q '"status"'; then
            echo -e "${GREEN}  Publish: Submitted for review${NC}"
        else
            echo -e "${YELLOW}  Publish: Check manually${NC}"
        fi
    else
        echo -e "${RED}  Upload failed: $UPLOAD_RESULT${NC}"
        return 1
    fi
}

# Firefox AMO
deploy_firefox() {
    echo -e "${YELLOW}[Firefox AMO]${NC}"

    cd "$PROJECT_ROOT/sviluppo/build-firefox"

    RESULT=$(npx web-ext sign \
        --api-key="$AMO_API_KEY" \
        --api-secret="$AMO_API_SECRET" \
        --channel=listed 2>&1)

    if echo "$RESULT" | grep -q "Signed xpi downloaded"; then
        echo -e "${GREEN}  Upload & Sign: OK${NC}"
        echo -e "${GREEN}  Published to AMO${NC}"
    else
        echo -e "${RED}  Failed: $RESULT${NC}"
        return 1
    fi
}

# Edge Add-ons
deploy_edge() {
    echo -e "${YELLOW}[Edge Add-ons]${NC}"

    # Upload
    UPLOAD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: ApiKey $EDGE_API_KEY" \
        -H "X-ClientID: $EDGE_CLIENT_ID" \
        -H "Content-Type: application/zip" \
        -T "$PROJECT_ROOT/sviluppo/adoff-chrome-prod.zip" \
        "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions/draft/package")

    if [ "$UPLOAD_CODE" = "202" ]; then
        echo -e "${GREEN}  Upload: OK${NC}"

        # Publish
        PUBLISH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "Authorization: ApiKey $EDGE_API_KEY" \
            -H "X-ClientID: $EDGE_CLIENT_ID" \
            -H "Content-Type: application/json" \
            -d "{\"notes\":\"v$VERSION - Updates and improvements\"}" \
            "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions")

        if [ "$PUBLISH_CODE" = "202" ]; then
            echo -e "${GREEN}  Publish: Submitted for review${NC}"
        else
            echo -e "${YELLOW}  Publish: HTTP $PUBLISH_CODE${NC}"
        fi
    else
        echo -e "${RED}  Upload failed: HTTP $UPLOAD_CODE${NC}"
        return 1
    fi
}

# Deploy site (Cloudflare Pages)
deploy_site() {
    echo -e "${YELLOW}[Cloudflare Pages]${NC}"
    cd "$PROJECT_ROOT"
    wrangler pages deploy site/ --project-name adoff-site 2>&1 | tail -3
}

# Main
case "$TARGET" in
    chrome)
        deploy_chrome
        ;;
    firefox)
        deploy_firefox
        ;;
    edge)
        deploy_edge
        ;;
    site)
        deploy_site
        ;;
    all)
        build_packages
        deploy_chrome
        echo ""
        deploy_firefox
        echo ""
        deploy_edge
        echo ""
        deploy_site
        ;;
    *)
        echo "Usage: $0 [chrome|firefox|edge|site|all]"
        exit 1
        ;;
esac

echo -e "\n${GREEN}=== Deployment complete ===${NC}"
