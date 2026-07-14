#!/usr/bin/env python3
"""
Patches all HTTP Request nodes that call Ollama (http://172.17.0.1:11434/api/generate).
Replaces the unsafe template-string jsonBody with a JS-expression that uses JSON.stringify
so interpolated user content cannot break the JSON envelope.
"""
import json
import re
import subprocess
import sys

PG_RUN = "docker exec -i n8n-postgres psql -U n8n -d n8n -tAc".split()


def psql(sql: str) -> str:
    result = subprocess.run([*PG_RUN, sql], capture_output=True, text=True, timeout=30)
    return result.stdout


def psql_exec(sql: str):
    result = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=sql, capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        print("SQL ERROR:", result.stderr[:500])
    return result.stdout


def fix_jsonbody(orig: str) -> str:
    """
    Convert template '={ "model": "X", "prompt": "...{{ $json.foo }}..." }'
    into a JS-expression '={{ JSON.stringify({ model: "X", prompt: "..." + $json.foo + "..." }) }}'
    that guarantees JSON validity.
    """
    if not orig.startswith("="):
        return orig
    # Strip leading "="
    payload = orig[1:].strip()
    # Parse the literal JSON (with template tokens replaced by placeholders)
    placeholders = {}
    def replace_token(m):
        key = f"__TPL_{len(placeholders)}__"
        placeholders[key] = m.group(1).strip()
        return key
    safe_payload = re.sub(r"\{\{\s*(.*?)\s*\}\}", replace_token, payload, flags=re.S)
    try:
        obj = json.loads(safe_payload)
    except Exception as e:
        print(f"  [skip] non-JSON template: {e}")
        return orig

    # Walk the object: any string that contains a placeholder becomes a JS concat
    def transform(value):
        if isinstance(value, dict):
            return {k: transform(v) for k, v in value.items()}
        if isinstance(value, list):
            return [transform(v) for v in value]
        if isinstance(value, str) and any(k in value for k in placeholders):
            parts = []
            cursor = 0
            for m in re.finditer(r"__TPL_\d+__", value):
                if m.start() > cursor:
                    parts.append(("lit", value[cursor:m.start()]))
                parts.append(("expr", placeholders[m.group(0)]))
                cursor = m.end()
            if cursor < len(value):
                parts.append(("lit", value[cursor:]))
            # Emit JS concat
            js = " + ".join(
                json.dumps(p[1]) if p[0] == "lit" else f"String({p[1]} || '')"
                for p in parts
            )
            return {"__JS__": js}
        return value

    transformed = transform(obj)

    # Convert the dict back into a JS-object literal string
    def to_js(node):
        if isinstance(node, dict):
            if list(node.keys()) == ["__JS__"]:
                return node["__JS__"]
            inner = ", ".join(f"{json.dumps(k)}: {to_js(v)}" for k, v in node.items())
            return "{" + inner + "}"
        if isinstance(node, list):
            return "[" + ", ".join(to_js(v) for v in node) + "]"
        if isinstance(node, bool):
            return "true" if node else "false"
        if node is None:
            return "null"
        return json.dumps(node)

    js_object = to_js(transformed)
    return "={{ JSON.stringify(" + js_object + ") }}"


def patch_workflow(wf_id: str, wf_name: str):
    nodes_raw = psql(f"SELECT nodes::text FROM workflow_entity WHERE id='{wf_id}';").strip()
    if not nodes_raw:
        return False
    nodes = json.loads(nodes_raw)
    changed = 0
    for n in nodes:
        params = n.get("parameters", {})
        url = params.get("url", "")
        if "11434/api/generate" not in str(url):
            continue
        body = params.get("jsonBody", "")
        if not body or "JSON.stringify" in body:
            continue
        new_body = fix_jsonbody(body)
        if new_body != body:
            params["jsonBody"] = new_body
            changed += 1
            print(f"  patched node: {n.get('name')}")
    if not changed:
        print(f"[skip] {wf_name}: no LLM nodes need patching")
        return False
    nodes_json = json.dumps(nodes).replace("'", "''")
    psql_exec(f"UPDATE workflow_entity SET nodes = '{nodes_json}'::json, \"updatedAt\" = NOW() WHERE id = '{wf_id}';")
    # Sync history
    psql_exec(f"UPDATE workflow_history SET nodes = '{nodes_json}'::json WHERE \"workflowId\" = '{wf_id}';")
    print(f"[ok]   {wf_name}: {changed} node(s) patched")
    return True


def main():
    out = psql("SELECT id || '|' || name FROM workflow_entity WHERE name LIKE 'AdOff%' ORDER BY name;")
    for line in out.strip().splitlines():
        wf_id, wf_name = line.split("|", 1)
        patch_workflow(wf_id, wf_name)


if __name__ == "__main__":
    main()
