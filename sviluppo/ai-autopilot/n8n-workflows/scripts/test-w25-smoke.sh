#!/bin/bash

# Smoke test per W25 - Approve & Publish Gemini Drafts
# Prerequisiti: n8n running on localhost:5678, PostgreSQL accessible
# Usage: bash scripts/test-w25-smoke.sh

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== W25 Smoke Test ===${NC}\n"

# 1. Crea draft di test
echo -e "${YELLOW}1. Creating test draft...${NC}"
TEST_DRAFT=$(psql -U autopilot -d adoff_autopilot -t -c \
  "INSERT INTO adoff_autopilot.gemini_copy_drafts (workflow, asset_type, platform, lang, status, body, tokens_in, tokens_out) \
   VALUES ('W20-test', 'caption_social', 'instagram', 'it', 'draft', '{\"text\":\"Test caption for smoke test\",\"hashtags\":\"#adoff\"}'::jsonb, 100, 50) \
   RETURNING id;" | xargs)

if [ -z "$TEST_DRAFT" ]; then
  echo -e "${RED}✗ Failed to create test draft${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Created draft ID: $TEST_DRAFT${NC}\n"

# 2. Approva via webhook
echo -e "${YELLOW}2. Testing /draft-approve webhook...${NC}"
APPROVE_RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/draft-approve \
  -H "Content-Type: application/json" \
  -d "{\"draft_id\": $TEST_DRAFT, \"approver\": \"smoke-test@adoff.app\", \"action\": \"approve\"}")

if echo "$APPROVE_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ Webhook response: $(echo $APPROVE_RESPONSE | jq -r '.message')${NC}\n"
else
  echo -e "${RED}✗ Webhook failed: $APPROVE_RESPONSE${NC}"
  exit 1
fi

# 3. Verifica status nel DB
echo -e "${YELLOW}3. Verifying DB status...${NC}"
STATUS=$(psql -U autopilot -d adoff_autopilot -t -c \
  "SELECT status, approved_by FROM adoff_autopilot.gemini_copy_drafts WHERE id=$TEST_DRAFT;" | xargs)

if [[ "$STATUS" == "approved smoke-test@adoff.app" ]]; then
  echo -e "${GREEN}✓ Status: approved by smoke-test@adoff.app${NC}\n"
else
  echo -e "${RED}✗ Status verification failed: $STATUS${NC}"
  exit 1
fi

# 4. Test /draft-list
echo -e "${YELLOW}4. Testing /draft-list webhook...${NC}"
LIST_RESPONSE=$(curl -s http://localhost:5678/webhook/draft-list?status=approved\&limit=5)

if echo "$LIST_RESPONSE" | jq . > /dev/null 2>&1 && echo "$LIST_RESPONSE" | grep -q '"ok":true'; then
  TOTAL=$(echo "$LIST_RESPONSE" | jq -r '.total')
  ITEMS=$(echo "$LIST_RESPONSE" | jq '.items | length')
  echo -e "${GREEN}✓ Listed $ITEMS items (total: $TOTAL)${NC}\n"
else
  echo -e "${RED}✗ /draft-list failed: $LIST_RESPONSE${NC}"
  exit 1
fi

# 5. Test /draft-bulk-approve
echo -e "${YELLOW}5. Testing /draft-bulk-approve webhook...${NC}"
BULK_RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/draft-bulk-approve \
  -H "Content-Type: application/json" \
  -d "{\"draft_ids\": [$TEST_DRAFT], \"approver\": \"bulk-test@adoff.app\"}")

if echo "$BULK_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ Bulk approve response: $(echo $BULK_RESPONSE | jq -r '.message')${NC}\n"
else
  echo -e "${RED}✗ Bulk approve failed: $BULK_RESPONSE${NC}"
  exit 1
fi

# 6. Cleanup
echo -e "${YELLOW}6. Cleanup test data...${NC}"
psql -U autopilot -d adoff_autopilot -c "DELETE FROM adoff_autopilot.gemini_copy_drafts WHERE id=$TEST_DRAFT" > /dev/null
echo -e "${GREEN}✓ Deleted test draft ID: $TEST_DRAFT${NC}\n"

echo -e "${GREEN}=== All tests passed! ===${NC}"
