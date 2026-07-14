#!/usr/bin/env python3
"""
Patches all Postgres nodes that use queryReplacement: CSV template -> JS array expression.
Reason: queryReplacement="=a,b,c" splits on commas, but interpolated values can contain commas
breaking the binding. JS array expression `={{ [a, b, c] }}` is safe.
"""
import json, re, subprocess, sys

def psql(sql):
    r = subprocess.run(["docker","exec","-i","n8n-postgres","psql","-U","n8n","-d","n8n","-tAc",sql], capture_output=True, text=True, timeout=30)
    return r.stdout

def psql_exec(sql):
    r = subprocess.run(["docker","exec","-i","n8n-postgres","psql","-U","n8n","-d","n8n"], input=sql, capture_output=True, text=True, timeout=30)
    if r.returncode: print("ERR:", r.stderr[:300])

def parse_csv_template(s):
    """Parse '=a,b,c' template, splitting on commas BUT respecting {{ ... }} blocks."""
    if not s.startswith("="): return None
    body = s[1:]
    parts = []
    cur, depth, i = "", 0, 0
    while i < len(body):
        ch = body[i]
        if ch == "{" and i+1 < len(body) and body[i+1] == "{":
            depth += 1; cur += "{{"; i += 2; continue
        if ch == "}" and i+1 < len(body) and body[i+1] == "}":
            depth -= 1; cur += "}}"; i += 2; continue
        if ch == "," and depth == 0:
            parts.append(cur.strip()); cur = ""; i += 1; continue
        cur += ch; i += 1
    if cur.strip(): parts.append(cur.strip())
    return parts

def to_js_expr(part):
    """Convert one CSV part (literal or {{expr}}) to a JS array element."""
    m = re.fullmatch(r"\{\{\s*(.*?)\s*\}\}", part, re.S)
    if m: return m.group(1)
    # literal
    return json.dumps(part)

def patch_workflow(wf_id, wf_name):
    nodes_raw = psql(f"SELECT nodes::text FROM workflow_entity WHERE id='{wf_id}';").strip()
    if not nodes_raw: return
    nodes = json.loads(nodes_raw)
    changed = 0
    for n in nodes:
        if n.get("type") != "n8n-nodes-base.postgres": continue
        opts = n.get("parameters", {}).get("options", {})
        qr = opts.get("queryReplacement")
        if not qr or not isinstance(qr, str) or not qr.startswith("="): continue
        # Already array?
        if qr.startswith("={{") and "[" in qr[:10]: continue
        parts = parse_csv_template(qr)
        if not parts: continue
        js_arr = "[" + ", ".join(to_js_expr(p) for p in parts) + "]"
        opts["queryReplacement"] = "={{ " + js_arr + " }}"
        changed += 1
        print(f"  patched node: {n.get('name')}")
    if not changed:
        print(f"[skip] {wf_name}")
        return
    nodes_json = json.dumps(nodes).replace("'","''")
    psql_exec(f"UPDATE workflow_entity SET nodes='{nodes_json}'::json, \"updatedAt\"=NOW() WHERE id='{wf_id}';")
    psql_exec(f"UPDATE workflow_history SET nodes='{nodes_json}'::json WHERE \"workflowId\"='{wf_id}';")
    print(f"[ok]   {wf_name}: {changed} node(s) patched")

for line in psql("SELECT id||'|'||name FROM workflow_entity WHERE name LIKE 'AdOff%' ORDER BY name;").strip().splitlines():
    wf_id, wf_name = line.split("|", 1)
    patch_workflow(wf_id, wf_name)
