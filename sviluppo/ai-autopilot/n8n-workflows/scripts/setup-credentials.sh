#!/bin/bash
# Crea credentials n8n via SQL diretto + cifratura compatibile crypto-js.
# Genera: Postgres credential per i workflow autopilot.

set -euo pipefail

ENC_KEY="471c71315d63ab02bfe4a545d98b7438066f689033f76deaa2e68d6b5267ac67"
PG_CONTAINER="n8n-postgres"
PG_USER="n8n"
PG_DB="n8n"

# Helper: cifra una stringa con OpenSSL compat crypto-js
encrypt_n8n() {
    local payload="$1"
    echo -n "$payload" | openssl enc -aes-256-cbc -md md5 -salt -pass pass:"$ENC_KEY" -base64 -A 2>/dev/null
}

# 1. PG credential per workflow AdOff
PG_HOST="n8n-postgres"
PG_PORT="5432"
PG_DB_NAME="n8n"
PG_USER_CRED="n8n"
PG_PASS="4UILvk1jH4KybyEg3hp9FQbQAj5L5G"

PG_CRED_JSON=$(cat <<EOF
{"host":"$PG_HOST","port":$PG_PORT,"database":"$PG_DB_NAME","user":"$PG_USER_CRED","password":"$PG_PASS","allowUnauthorizedCerts":false,"ssl":"disable"}
EOF
)

PG_CRED_ENC=$(encrypt_n8n "$PG_CRED_JSON")
PG_CRED_ID="adoff-pg-autopilot-credential-1234"  # 36 chars max, hard-coded for refs

echo "Postgres credential encrypted ($(echo -n "$PG_CRED_ENC" | wc -c) chars)"

# Owner user id (esistono in tabella user, prendiamo il global:owner)
OWNER_ID=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT id FROM \"user\" WHERE \"roleSlug\"='global:owner' LIMIT 1;" 2>/dev/null)
if [ -z "$OWNER_ID" ]; then
    OWNER_ID=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT id FROM \"user\" LIMIT 1;" 2>/dev/null)
fi
echo "Owner user id: $OWNER_ID"

# Personal project (n8n usa shared_credentials con projectId)
PROJECT_ID=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT p.id FROM project p JOIN project_relation pr ON pr.\"projectId\"=p.id WHERE pr.\"userId\"='$OWNER_ID' AND p.type='personal' LIMIT 1;" 2>/dev/null)
echo "Personal project id: $PROJECT_ID"

# Insert credential + shared_credentials
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" <<SQL
INSERT INTO credentials_entity (id, name, data, type, "isManaged", "isGlobal", "isResolvable", "resolvableAllowFallback")
VALUES ('$PG_CRED_ID', 'AdOff Autopilot Postgres', '$PG_CRED_ENC', 'postgres', false, false, false, false)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW();

INSERT INTO shared_credentials ("credentialsId", "projectId", role)
VALUES ('$PG_CRED_ID', '$PROJECT_ID', 'credential:owner')
ON CONFLICT DO NOTHING;
SQL

echo "=== Credential created ==="
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -c "SELECT id, name, type FROM credentials_entity WHERE id='$PG_CRED_ID';"

echo
echo "=== Patching workflows: replace PLACEHOLDER_PG_CREDENTIAL -> $PG_CRED_ID ==="
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -c "
UPDATE workflow_entity
SET nodes = REPLACE(nodes::text, 'PLACEHOLDER_PG_CREDENTIAL', '$PG_CRED_ID')::json
WHERE nodes::text LIKE '%PLACEHOLDER_PG_CREDENTIAL%';
"

echo "=== Done ==="
