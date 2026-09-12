#!/usr/bin/env python3
"""Import workflow AdOff 99 - Copy Agent in n8n via direct DB INSERT."""
import json
import subprocess
import uuid
from pathlib import Path

WORKFLOW_JSON = Path(__file__).parent.parent / "workflows" / "99-copy-agent.json"
WORKFLOW_NAME = "AdOff 99 - Copy Agent (centralized)"


def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, check=True, **kwargs)


def main():
    wf = json.loads(WORKFLOW_JSON.read_text(encoding="utf-8"))
    nodes_json = json.dumps(wf["nodes"], ensure_ascii=False)
    connections_json = json.dumps(wf["connections"], ensure_ascii=False)
    settings_json = json.dumps(wf.get("settings", {}), ensure_ascii=False)

    wf_id = str(uuid.uuid4()).replace("-", "")[:16]

    # Project ID (personal)
    r = run([
        "docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc",
        "SELECT id FROM project WHERE type='personal' LIMIT 1;"
    ])
    project_id = r.stdout.strip()
    print(f"Project ID: {project_id}")

    # Delete existing workflow if present
    sql_del = (
        f"DELETE FROM shared_workflow WHERE \"workflowId\" IN "
        f"(SELECT id FROM workflow_entity WHERE name = '{WORKFLOW_NAME}'); "
        f"DELETE FROM workflow_history WHERE \"workflowId\" IN "
        f"(SELECT id FROM workflow_entity WHERE name = '{WORKFLOW_NAME}'); "
        f"DELETE FROM workflow_entity WHERE name = '{WORKFLOW_NAME}';"
    )
    subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql_del, capture_output=True, text=True, check=True,
    )

    # Escape single quotes for SQL literals
    def esc(s):
        return s.replace("'", "''")

    sql_insert = f"""
INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "isArchived", "createdAt", "updatedAt", "versionId")
VALUES (
    '{wf_id}',
    '{esc(WORKFLOW_NAME)}',
    true,
    '{esc(nodes_json)}'::jsonb,
    '{esc(connections_json)}'::jsonb,
    '{esc(settings_json)}'::jsonb,
    false,
    NOW(),
    NOW(),
    '{wf_id}'
);

INSERT INTO shared_workflow ("workflowId", "projectId", role)
VALUES ('{wf_id}', '{project_id}', 'workflow:owner');

SELECT id, name, active FROM workflow_entity WHERE name = '{esc(WORKFLOW_NAME)}';
"""

    r = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql_insert, capture_output=True, text=True, check=True,
    )
    print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr)
    print(f"[OK] Workflow '{WORKFLOW_NAME}' imported with id {wf_id}")
    print("Endpoint: http://leobox:5678/webhook/copy-agent")


if __name__ == "__main__":
    main()
