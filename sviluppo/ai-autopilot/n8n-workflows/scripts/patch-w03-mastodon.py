#!/usr/bin/env python3
"""Patch W03 Posts Dispatcher: cambia URL fosstodon -> mastodon.social + aggiunge credential httpHeaderAuth."""
import subprocess
import json
import sys

WORKFLOW_MATCH = "%03%Posts Dispatcher%"
CRED_ID = "adoff-mastodon-credential-001"
CRED_NAME = "AdOff Mastodon @adoffadblock"
NEW_URL = "https://mastodon.social/api/v1/statuses"


def run(cmd, check=True):
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def get_nodes():
    r = run([
        "docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc",
        f"SELECT nodes FROM workflow_entity WHERE name LIKE '{WORKFLOW_MATCH}';"
    ])
    return json.loads(r.stdout.strip())


def patch_nodes(nodes):
    found = False
    for n in nodes:
        if n.get("id") == "post-mast":
            n["parameters"]["url"] = NEW_URL
            n["credentials"] = {
                "httpHeaderAuth": {
                    "id": CRED_ID,
                    "name": CRED_NAME,
                }
            }
            url = n["parameters"]["url"]
            cred = n["credentials"]
            print("Patched POST Mastodon node:")
            print("  URL  ->", url)
            print("  Cred ->", cred)
            found = True
    if not found:
        sys.exit("Node post-mast not found in workflow")
    return nodes


def write_back(nodes):
    payload = json.dumps(nodes, ensure_ascii=False)
    # Doubled single quotes for SQL literal escape (json has no single-quotes normally, but safe)
    payload_sql = payload.replace("'", "''")
    sql_entity = (
        f"UPDATE workflow_entity SET nodes = '{payload_sql}'::jsonb "
        f"WHERE name LIKE '{WORKFLOW_MATCH}';"
    )
    sql_history = (
        f"UPDATE workflow_history SET nodes = '{payload_sql}'::jsonb "
        f"WHERE name LIKE '{WORKFLOW_MATCH}';"
    )
    # Use stdin pipe to avoid arg-length limits
    p1 = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql_entity, capture_output=True, text=True, check=True,
    )
    print("workflow_entity:", p1.stdout.strip() or p1.stderr.strip())
    p2 = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql_history, capture_output=True, text=True, check=True,
    )
    print("workflow_history:", p2.stdout.strip() or p2.stderr.strip())
    print("[OK] W03 workflow_entity + workflow_history aggiornati")


def main():
    nodes = get_nodes()
    print(f"Loaded {len(nodes)} nodes from W03")
    nodes = patch_nodes(nodes)
    write_back(nodes)


if __name__ == "__main__":
    main()
