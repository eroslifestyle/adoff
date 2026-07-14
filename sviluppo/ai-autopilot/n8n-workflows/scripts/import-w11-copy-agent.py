#!/usr/bin/env python3
"""Importa W11 Copy Agent workflow su n8n via SQL diretto."""
import subprocess
import json
import uuid
from pathlib import Path

WORKFLOW_FILE = Path(__file__).parent.parent / "workflows" / "W11-copy-agent.json"


def run(cmd, check=True, input_str=None):
    return subprocess.run(cmd, capture_output=True, text=True, check=check, input=input_str)


def main():
    wf = json.loads(WORKFLOW_FILE.read_text(encoding="utf-8"))

    workflow_id = str(uuid.uuid4()).replace("-", "")[:16]
    nodes_json = json.dumps(wf["nodes"], ensure_ascii=False)
    connections_json = json.dumps(wf["connections"], ensure_ascii=False)
    settings_json = json.dumps(wf.get("settings", {}), ensure_ascii=False)
    name = wf["name"]
    active = wf.get("active", True)

    # Escape singles
    name_sql = name.replace("'", "''")
    nodes_sql = nodes_json.replace("'", "''")
    connections_sql = connections_json.replace("'", "''")
    settings_sql = settings_json.replace("'", "''")

    # First check if exists
    check = run([
        "docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc",
        f"SELECT id FROM workflow_entity WHERE name = '{name_sql}';"
    ])
    existing_id = check.stdout.strip()

    if existing_id:
        print(f"Workflow esiste (id={existing_id}), UPDATE")
        sql = (
            f"UPDATE workflow_entity SET "
            f"nodes = '{nodes_sql}'::jsonb, "
            f"connections = '{connections_sql}'::jsonb, "
            f"settings = '{settings_sql}'::jsonb, "
            f"active = {str(active).lower()}, "
            f"\"updatedAt\" = NOW() "
            f"WHERE id = '{existing_id}';"
        )
    else:
        print(f"Workflow nuovo (id={workflow_id}), INSERT")
        sql = (
            f"INSERT INTO workflow_entity "
            f"(id, name, active, nodes, connections, settings, \"createdAt\", \"updatedAt\", \"isArchived\", \"triggerCount\", \"versionId\") "
            f"VALUES ("
            f"'{workflow_id}', '{name_sql}', {str(active).lower()}, "
            f"'{nodes_sql}'::jsonb, '{connections_sql}'::jsonb, '{settings_sql}'::jsonb, "
            f"NOW(), NOW(), false, 0, '{str(uuid.uuid4())}'"
            f");"
        )

    p = run([
        "docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"
    ], input_str=sql)
    print(p.stdout.strip() or p.stderr.strip())

    # Share with personal project
    project = run([
        "docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc",
        "SELECT id FROM project WHERE type='personal' LIMIT 1;"
    ])
    project_id = project.stdout.strip()
    if project_id:
        wid = existing_id if existing_id else workflow_id
        share_sql = (
            f"INSERT INTO shared_workflow (\"workflowId\", \"projectId\", role) "
            f"VALUES ('{wid}', '{project_id}', 'workflow:owner') "
            f"ON CONFLICT DO NOTHING;"
        )
        run([
            "docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"
        ], input_str=share_sql)
        print(f"Shared with project {project_id}")

    print("[OK] W11 Copy Agent imported")

    # Force n8n to reload workflows (restart container is heaviest, here we just print info)
    print("\nN.B.: Per attivare il webhook serve restart container n8n: docker restart n8n n8n-worker")


if __name__ == "__main__":
    main()
