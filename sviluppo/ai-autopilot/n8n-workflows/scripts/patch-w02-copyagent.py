#!/usr/bin/env python3
"""Patch W02 LLM rewrite node: redirect from Ollama direct to Copy Agent webhook."""
import subprocess
import json
import sys

WORKFLOW_MATCH = "%02 - Social Cross-post%"
COPY_AGENT_URL = "http://172.17.0.1:5678/webhook/copy-agent"


def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, check=True, **kwargs)


def get_nodes():
    r = run([
        "docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc",
        f"SELECT nodes FROM workflow_entity WHERE name LIKE '{WORKFLOW_MATCH}';"
    ])
    return json.loads(r.stdout.strip())


def patch_nodes(nodes):
    found = False
    for n in nodes:
        if n.get("id") == "rewrite" and n.get("name") == "LLM rewrite":
            # Build brief from existing W02 schema
            # W02 input: { seed, platform, lang, ... }
            # Map to Copy Agent brief: { platform, persona (auto), topic, language, length_hint }
            n["parameters"]["url"] = COPY_AGENT_URL
            n["parameters"]["jsonBody"] = (
                "={{ JSON.stringify({"
                "platform: $json.platform || 'twitter',"
                "persona: null,"  # rotation
                "framework: 'auto',"
                "language: $json.lang || 'en',"
                "topic: $json.seed || '',"
                "context: 'Cross-post rewrite from seed content. Adapt voice and length to platform conventions.',"
                "include_cta: null,"
                "variants: 1"
                "}) }}"
            )
            # Increase timeout (copy-max 32B can take 30-60s)
            n["parameters"]["options"]["timeout"] = 180000
            print("Patched LLM rewrite -> copy-agent webhook")
            print(f"  URL: {n['parameters']['url']}")
            found = True
    if not found:
        sys.exit("Node 'LLM rewrite' not found")
    return nodes


def patch_downstream_parser(nodes):
    """The next node parses Ollama response (resp.response). Update to parse Copy Agent response (resp.output.copy)."""
    # Find downstream node that reads 'response' field
    for n in nodes:
        params = n.get("parameters", {})
        # Look for any reference to .response from rewrite output
        for key, val in list(params.items()):
            if isinstance(val, str) and "'LLM rewrite'" in val and ".response" in val:
                new_val = val.replace(
                    "$('LLM rewrite').first().json.response",
                    "$('LLM rewrite').first().json.output.copy"
                ).replace(
                    "$json.response",
                    "$json.output.copy"
                )
                if new_val != val:
                    params[key] = new_val
                    print(f"Patched downstream reference in node {n['name']}/{key}")
    return nodes


def write_back(nodes):
    payload = json.dumps(nodes, ensure_ascii=False)
    payload_sql = payload.replace("'", "''")
    sql = (
        f"UPDATE workflow_entity SET nodes = '{payload_sql}'::jsonb "
        f"WHERE name LIKE '{WORKFLOW_MATCH}'; "
        f"UPDATE workflow_history SET nodes = '{payload_sql}'::jsonb "
        f"WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name LIKE '{WORKFLOW_MATCH}');"
    )
    p = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql, capture_output=True, text=True, check=True,
    )
    print(p.stdout.strip() or p.stderr.strip())


def main():
    nodes = get_nodes()
    print(f"Loaded {len(nodes)} nodes from W02")
    nodes = patch_nodes(nodes)
    nodes = patch_downstream_parser(nodes)
    write_back(nodes)
    print("[OK] W02 patched. Restart n8n container to apply.")


if __name__ == "__main__":
    main()
