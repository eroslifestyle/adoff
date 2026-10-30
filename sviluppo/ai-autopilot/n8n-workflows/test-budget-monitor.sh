#!/bin/bash
# Smoke test: W26 Budget Monitor
# Esegue il workflow manualmente via n8n API e verifica output

set -e

# Config
N8N_URL="${N8N_URL:-http://localhost:5678}"
WORKFLOW_ID="w26-budget-cap-monitor"
API_KEY="${N8N_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "❌ N8N_API_KEY non settato. Esporta: export N8N_API_KEY=<your-api-key>"
  exit 1
fi

echo "🧪 Testing Budget Monitor (W26)..."
echo "  Workflow: $WORKFLOW_ID"
echo "  n8n: $N8N_URL"

# 1. Esegui workflow manualmente
echo ""
echo "📋 Step 1: Triggering workflow execution..."
EXEC_RESPONSE=$(curl -s -X POST "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/execute" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Response: $EXEC_RESPONSE"
EXEC_ID=$(echo "$EXEC_RESPONSE" | jq -r '.id // empty')

if [ -z "$EXEC_ID" ]; then
  echo "❌ Execution failed or no ID returned"
  exit 1
fi

echo "✅ Execution ID: $EXEC_ID"

# 2. Aspetta completamento (max 30s)
echo ""
echo "⏳ Step 2: Waiting for execution to complete (max 30s)..."
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  STATUS=$(curl -s -X GET "$N8N_URL/api/v1/executions/$EXEC_ID" \
    -H "Authorization: Bearer $API_KEY" | jq -r '.status // "unknown"')

  echo "  Status: $STATUS"

  if [ "$STATUS" = "success" ]; then
    echo "✅ Execution succeeded"
    break
  elif [ "$STATUS" = "error" ]; then
    echo "❌ Execution failed"
    exit 1
  fi

  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "⚠️  Timeout waiting for execution"
fi

# 3. Verifica tabelle create
echo ""
echo "📊 Step 3: Verifying database tables..."
PSQL_OPTS="-h ${PG_HOST:-localhost} -U ${PG_USER:-postgres} -d ${PG_DB:-adoff_autopilot}"

if ! psql $PSQL_OPTS -c "SELECT 1 FROM information_schema.tables WHERE table_schema='adoff_autopilot' AND table_name='budget_alerts';" 2>/dev/null | grep -q 1; then
  echo "❌ Table budget_alerts not found"
  exit 1
fi
echo "✅ Table adoff_autopilot.budget_alerts exists"

if ! psql $PSQL_OPTS -c "SELECT 1 FROM information_schema.tables WHERE table_schema='adoff_autopilot' AND table_name='workflow_kill_switch';" 2>/dev/null | grep -q 1; then
  echo "❌ Table workflow_kill_switch not found"
  exit 1
fi
echo "✅ Table adoff_autopilot.workflow_kill_switch exists"

# 4. Verifica dati in tabelle
echo ""
echo "📈 Step 4: Checking data in tables..."
ALERT_COUNT=$(psql $PSQL_OPTS -t -c "SELECT COUNT(*) FROM adoff_autopilot.budget_alerts;" 2>/dev/null | tr -d ' ')
echo "  budget_alerts rows: $ALERT_COUNT"

KILL_SWITCH_COUNT=$(psql $PSQL_OPTS -t -c "SELECT COUNT(*) FROM adoff_autopilot.workflow_kill_switch;" 2>/dev/null | tr -d ' ')
echo "  workflow_kill_switch rows: $KILL_SWITCH_COUNT"

if [ "$KILL_SWITCH_COUNT" -gt 0 ]; then
  echo "✅ workflow_kill_switch populated"
else
  echo "⚠️  workflow_kill_switch is empty (may be expected if no critical alerts yet)"
fi

# 5. Verifica schema
echo ""
echo "🔍 Step 5: Verifying schema..."
psql $PSQL_OPTS -c "\d adoff_autopilot.budget_alerts" 2>/dev/null | head -20
echo ""
psql $PSQL_OPTS -c "\d adoff_autopilot.workflow_kill_switch" 2>/dev/null | head -20

echo ""
echo "✅ Budget Monitor (W26) smoke test complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Import 26-budget-cap-monitor.json into n8n UI"
echo "   2. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment vars"
echo "   3. Activate workflow and monitor /budget-status endpoint"
