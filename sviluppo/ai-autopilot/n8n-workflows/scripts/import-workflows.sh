#!/bin/bash
# Import workflow JSON nel DB n8n direttamente via SQL.
# Bypassa il bug del CLI n8n import:workflow che richiede id pre-computato.
# Uso: ./import-workflows.sh [file.json | dir]

set -euo pipefail

INPUT="${1:-/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/ai-autopilot/n8n-workflows/workflows}"
PG_CONTAINER="n8n-postgres"
PG_USER="n8n"
PG_DB="n8n"

import_one() {
    local file="$1"
    [ -f "$file" ] || { echo "[skip] $file not found"; return; }

    local name
    name=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['name'])" "$file")

    local wf_id
    wf_id=$(python3 -c "import uuid; print(uuid.uuid4())")
    local ver_id
    ver_id=$(python3 -c "import uuid; print(uuid.uuid4())")

    # Estrai nodes/connections/settings come JSON compatti
    python3 <<PYEOF > /tmp/wf_${wf_id}.sql
import json, sys
data = json.load(open("$file"))
nodes = json.dumps(data.get('nodes', []))
conns = json.dumps(data.get('connections', {}))
settings = json.dumps(data.get('settings', {}))
meta = json.dumps({})
# SQL-escape single quotes
def esc(s): return s.replace("'", "''")
print(f"""
INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "versionId", "triggerCount", "isArchived", "versionCounter", meta, "createdAt", "updatedAt")
VALUES (
    '$wf_id',
    '{esc(data.get('name',''))}',
    false,
    '{esc(nodes)}'::json,
    '{esc(conns)}'::json,
    '{esc(settings)}'::json,
    '$ver_id',
    0,
    false,
    1,
    '{esc(meta)}'::json,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
""")
PYEOF

    docker cp /tmp/wf_${wf_id}.sql ${PG_CONTAINER}:/tmp/import.sql >/dev/null
    if docker exec ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -f /tmp/import.sql 2>&1 | grep -q "INSERT"; then
        echo "[ok]   ${name}  (id=${wf_id})"
    else
        echo "[fail] ${name}  (id=${wf_id})"
        docker exec ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -f /tmp/import.sql 2>&1 | tail -3
    fi
    rm -f /tmp/wf_${wf_id}.sql
}

if [ -d "$INPUT" ]; then
    for f in "$INPUT"/*.json; do
        import_one "$f"
    done
else
    import_one "$INPUT"
fi

echo
echo "=== Workflow caricati ==="
docker exec ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -c "SELECT id, name, active FROM workflow_entity ORDER BY \"createdAt\";"
