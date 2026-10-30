import json, sys, subprocess

eid = sys.argv[1]
r = subprocess.run(
    ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-c",
     "SELECT data FROM execution_data WHERE \"executionId\"=" + eid + ";"],
    capture_output=True, text=True)
raw = r.stdout.strip()
arr = json.loads(raw)


def deref(v, seen=0):
    if seen > 60:
        return v
    if isinstance(v, str) and v.isdigit() and int(v) < len(arr):
        return deref(arr[int(v)], seen + 1)
    return v


# find any object that has a "copy" key
def walk(o, depth=0):
    if depth > 8:
        return
    if isinstance(o, dict):
        if "copy" in o:
            yield o
        for val in o.values():
            yield from walk(deref(val), depth + 1)
    elif isinstance(o, list):
        for it in o:
            yield from walk(deref(it), depth + 1)


found = []
for i in range(len(arr)):
    node = arr[i]
    if isinstance(node, dict) and "copy" in node:
        c = deref(node["copy"])
        found.append(c)

for c in found:
    if isinstance(c, str):
        print("COPY:", c)
