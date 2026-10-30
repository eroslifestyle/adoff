import json, subprocess, secrets, sys

WID = "70061a93-ac0f-49bb-a685-1784d549d2a3"
NAME = "AdOff 01 - Multi-language Translator (IT -> 14)"

def psql(sql):
    return subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-c", sql],
        capture_output=True, text=True)

def col(c):
    rr = psql("SELECT " + c + " FROM workflow_entity WHERE id='" + WID + "';")
    if rr.returncode != 0:
        print("READ FAIL", c, rr.stderr); sys.exit(1)
    return rr.stdout.strip()

nodes = json.loads(col("nodes"))
connections = json.loads(col("connections"))
vcounter = int(col("\"versionCounter\"")) + 1

new_body = open("/tmp/w01_llm_body.txt").read().strip()
patched = False
for n in nodes:
    if n.get("name") == "LLM translate" and n.get("type") == "n8n-nodes-base.httpRequest":
        n.setdefault("parameters", {})["jsonBody"] = new_body
        n["parameters"].setdefault("options", {})["timeout"] = 240000
        patched = True
if not patched:
    print("NODE NOT FOUND"); sys.exit(1)

new_nodes = json.dumps(nodes, ensure_ascii=False)
conn_json = json.dumps(connections, ensure_ascii=False)
new_vid = secrets.token_hex(8)

for tag in ("$ADFN$", "$ADFC$", "$ADFNAME$"):
    if tag in new_nodes or tag in conn_json or tag in NAME:
        print("TAG COLLISION", tag); sys.exit(1)

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
open("/tmp/patch_w01.sql", "w").write(sql)
print("PREPARED versionId=" + new_vid + " vcounter=" + str(vcounter) + " body_len=" + str(len(new_body)))
