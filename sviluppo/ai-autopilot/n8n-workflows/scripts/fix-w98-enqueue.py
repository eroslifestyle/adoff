#!/usr/bin/env python3
"""Fix W98 Enqueue + Lookup queryReplacement to n8n array format (like W02 working pattern)."""
import subprocess
import json

MATCH = "%98%"


def psql(sql=None, stdin=None):
    if stdin is not None:
        return subprocess.run(
            ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
            input=stdin, capture_output=True, text=True, check=True)
    return subprocess.run(
        ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc", sql],
        capture_output=True, text=True, check=True)


def main():
    raw = psql(f"SELECT nodes FROM workflow_entity WHERE name LIKE '{MATCH}';").stdout.strip()
    nodes = json.loads(raw)

    for n in nodes:
        nm = n.get("name")
        if nm == "Enqueue job":
            opt = n["parameters"].setdefault("options", {})
            opt["queryReplacement"] = (
                '={{ [$json.body.prompt, $json.body.negative_prompt || "", '
                '$json.body.width || 768, $json.body.height || 768, '
                '$json.body.steps || 4, $json.body.cfg_scale || 1.0, '
                '$json.body.seed || -1, $json.body.requested_by || "n8n"] }}'
            )
            print("Enqueue job -> array queryReplacement")
        elif nm == "Lookup status":
            opt = n["parameters"].setdefault("options", {})
            opt["queryReplacement"] = "={{ [$json.query.job_id] }}"
            print("Lookup status -> array queryReplacement")

    payload = json.dumps(nodes, ensure_ascii=False).replace("'", "''")
    sql = (
        f"UPDATE workflow_entity SET nodes='{payload}'::jsonb WHERE name LIKE '{MATCH}';"
        f"UPDATE workflow_history SET nodes='{payload}'::jsonb "
        f"WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name LIKE '{MATCH}');"
    )
    r = psql(stdin=sql)
    print(r.stdout.strip() or r.stderr.strip())
    print("[OK] W98 enqueue/lookup fixed")


if __name__ == "__main__":
    main()
