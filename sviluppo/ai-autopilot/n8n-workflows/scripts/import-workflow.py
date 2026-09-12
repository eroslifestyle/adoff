#!/usr/bin/env python3
"""Generic n8n workflow importer via direct DB.
Usage: import-workflow.py <workflow.json>
Handles: workflow_entity + workflow_history + activeVersionId + webhook_entity + shared_workflow.
"""
import json
import subprocess
import sys
import uuid
from pathlib import Path


def psql(sql=None, stdin=None):
    if stdin is not None:
        return subprocess.run(
            ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
            input=stdin, capture_output=True, text=True, check=True)
    return subprocess.run(
        ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc", sql],
        capture_output=True, text=True, check=True)


def esc(s):
    return s.replace("'", "''")


def main():
    wf_path = Path(sys.argv[1])
    wf = json.loads(wf_path.read_text(encoding="utf-8"))
    name = wf["name"]
    nodes = json.dumps(wf["nodes"], ensure_ascii=False)
    conns = json.dumps(wf["connections"], ensure_ascii=False)
    settings = json.dumps(wf.get("settings", {}), ensure_ascii=False)
    wf_id = uuid.uuid4().hex[:16]

    project_id = psql(
        "SELECT id FROM project WHERE type='personal' LIMIT 1;"
    ).stdout.strip()

    # Clean any existing
    psql(stdin=(
        f"DELETE FROM webhook_entity WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name='{esc(name)}');"
        f"DELETE FROM shared_workflow WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name='{esc(name)}');"
        f"DELETE FROM workflow_history WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name='{esc(name)}');"
        f"DELETE FROM workflow_entity WHERE name='{esc(name)}';"
    ))

    # Insert entity + history + shared + activeVersion
    sql = f"""
INSERT INTO workflow_entity (id,name,active,nodes,connections,settings,"isArchived","createdAt","updatedAt","versionId")
VALUES ('{wf_id}','{esc(name)}',true,'{esc(nodes)}'::jsonb,'{esc(conns)}'::jsonb,'{esc(settings)}'::jsonb,false,NOW(),NOW(),'{wf_id}');
INSERT INTO workflow_history ("versionId","workflowId",authors,"createdAt","updatedAt",nodes,connections)
VALUES ('{wf_id}','{wf_id}','system',NOW(),NOW(),'{esc(nodes)}'::json,'{esc(conns)}'::json);
UPDATE workflow_entity SET "activeVersionId"='{wf_id}' WHERE id='{wf_id}';
INSERT INTO shared_workflow ("workflowId","projectId",role) VALUES ('{wf_id}','{project_id}','workflow:owner');
"""
    psql(stdin=sql)

    # Register webhooks
    for n in wf["nodes"]:
        if n.get("type") == "n8n-nodes-base.webhook":
            p = n["parameters"]
            path = p["path"]
            method = p.get("httpMethod", "GET")
            psql(stdin=(
                f"INSERT INTO webhook_entity (\"webhookPath\",method,node,\"webhookId\",\"pathLength\",\"workflowId\") "
                f"VALUES ('{path}','{method}','{esc(n['name'])}','{n.get('webhookId','')}',1,'{wf_id}') "
                f"ON CONFLICT DO NOTHING;"
            ))
            print(f"  webhook: {method} /{path}")

    print(f"[OK] '{name}' imported id={wf_id}")


if __name__ == "__main__":
    main()
