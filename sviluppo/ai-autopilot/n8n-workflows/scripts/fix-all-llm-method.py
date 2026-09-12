#!/usr/bin/env python3
"""Fix-all: set method=POST + sane timeout + onError on every LLM httpRequest node
(Ollama 11434) across ALL AdOff workflows. Idempotent."""
import subprocess
import json

OLLAMA_MARK = "11434"


def psql(sql=None, stdin=None):
    if stdin is not None:
        return subprocess.run(
            ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
            input=stdin, capture_output=True, text=True, check=True)
    return subprocess.run(
        ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc", sql],
        capture_output=True, text=True, check=True)


def main():
    rows = psql(
        "SELECT id, name FROM workflow_entity WHERE name LIKE 'AdOff%';"
    ).stdout.strip().splitlines()

    total_patched = 0
    for line in rows:
        if "|" not in line:
            continue
        wf_id, wf_name = line.split("|", 1)
        nodes = json.loads(psql(
            f"SELECT nodes FROM workflow_entity WHERE id='{wf_id}';"
        ).stdout.strip())

        changed = False
        for n in nodes:
            if n.get("type") != "n8n-nodes-base.httpRequest":
                continue
            p = n.get("parameters", {})
            url = str(p.get("url", ""))
            if OLLAMA_MARK not in url:
                continue
            # Ensure POST
            if p.get("method") != "POST":
                p["method"] = "POST"
                changed = True
            # Ensure timeout >= 180s (LLM can be slow under load)
            opts = p.setdefault("options", {})
            if opts.get("timeout", 0) < 180000:
                opts["timeout"] = 180000
                changed = True
            # Resilient: don't kill workflow if a single LLM call fails
            if n.get("onError") != "continueRegularOutput":
                n["onError"] = "continueRegularOutput"
                changed = True
            if changed:
                print(f"  [{wf_name}] {n.get('name')} -> POST, timeout=180s, onError=continue")

        if changed:
            payload = json.dumps(nodes, ensure_ascii=False).replace("'", "''")
            sql = (
                f"UPDATE workflow_entity SET nodes='{payload}'::jsonb WHERE id='{wf_id}';"
                f"UPDATE workflow_history SET nodes='{payload}'::jsonb "
                f"WHERE \"workflowId\"='{wf_id}';"
            )
            psql(stdin=sql)
            total_patched += 1

    print(f"[OK] Patched {total_patched} workflows")


if __name__ == "__main__":
    main()
