import json, subprocess, secrets, sys

WID = "8c1826fc31f4439f"
NAME = "AdOff 99 - Copy Agent (centralized)"

def psql(sql):
    return subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-c", sql],
        capture_output=True, text=True)

def col(c):
    rr = psql("SELECT " + c + " FROM workflow_entity WHERE id='" + WID + "';")
    if rr.returncode != 0:
        print("READ FAIL", c, rr.stderr)
        sys.exit(1)
    return rr.stdout.strip()

nodes = json.loads(col("nodes"))
connections = json.loads(col("connections"))
vcounter = int(col("\"versionCounter\"")) + 1

new_code = open("/tmp/parse_node.js").read()
patched = False
http_patched = False
for n in nodes:
    if n.get("name") == "Parse Copy Agent output" and n.get("type") == "n8n-nodes-base.code":
        n.setdefault("parameters", {})["jsCode"] = new_code
        patched = True
    if n.get("name") == "Call copy-max" and n.get("type") == "n8n-nodes-base.httpRequest":
        p = n.setdefault("parameters", {})
        p.setdefault("options", {})["timeout"] = 300000
        jb = p.get("jsonBody", "")
        if "keep_alive" not in jb:
            jb = jb.replace("model: 'copy-max',", "model: 'copy-max',\n  keep_alive: '30m',")
            p["jsonBody"] = jb
        http_patched = True
if not patched or not http_patched:
    print("NODE NOT FOUND patched=%s http=%s" % (patched, http_patched))
    sys.exit(1)

new_nodes = json.dumps(nodes, ensure_ascii=False)
conn_json = json.dumps(connections, ensure_ascii=False)
new_vid = secrets.token_hex(8)

for tag in ("$ADFN$", "$ADFC$", "$ADFNAME$"):
    if tag in new_nodes or tag in conn_json or tag in NAME:
        print("TAG COLLISION", tag)
        sys.exit(1)

sql = (
    "BEGIN;\n"
    "INSERT INTO workflow_history "
    "(\"versionId\",\"workflowId\",authors,\"createdAt\",\"updatedAt\",nodes,connections,name,autosaved,description) "
    "VALUES ('" + new_vid + "','" + WID + "','AdOff Autopilot', now(), now(), "
    "$ADFN$" + new_nodes + "$ADFN$::json, "
    "$ADFC$" + conn_json + "$ADFC$::json, "
    "$ADFNAME$" + NAME + "$ADFNAME$, false, NULL);\n"
    "UPDATE workflow_entity SET "
    "nodes = $ADFN$" + new_nodes + "$ADFN$::json, "
    "\"versionId\" = '" + new_vid + "', "
    "\"versionCounter\" = " + str(vcounter) + ", "
    "\"activeVersionId\" = '" + new_vid + "', "
    "\"updatedAt\" = now() "
    "WHERE id = '" + WID + "';\n"
    "COMMIT;\n"
)
open("/tmp/patch.sql", "w").write(sql)
print("PREPARED versionId=" + new_vid + " versionCounter=" + str(vcounter) + " nodes_bytes=" + str(len(new_nodes)))
