#!/usr/bin/env python3
"""W02 final fix: LLM rewrite -> Ollama copy-max direct, single-line prompt (no literal newlines)."""
import subprocess
import json

MATCH = "%02 - Social Cross-post%"


def psql(sql=None, stdin=None):
    if stdin is not None:
        return subprocess.run(
            ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
            input=stdin, capture_output=True, text=True, check=True)
    return subprocess.run(
        ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc", sql],
        capture_output=True, text=True, check=True)


# Prompt as a single n8n expression. \\n inside the JS string literal stays as
# the two-char escape sequence backslash-n (valid JSON when JSON.stringify runs).
BRIEF = (
    "={{ JSON.stringify({"
    "model:'copy-max',"
    "stream:false,"
    "options:{temperature:0.85,top_p:0.92,repeat_penalty:1.18,"
    "num_predict:$json.platform==='reddit'?800:500},"
    "prompt:'BRIEF:\\n- platform: '+String($json.platform||'twitter')"
    "+'\\n- persona: auto\\n- framework: auto\\n- language: '+String($json.lang||'en')"
    "+'\\n- topic: '+String($json.seed||'')"
    "+'\\n- context: Cross-post rewrite. Adapt voice and length to platform "
    "conventions. One seamless copy, no framework labels, no preamble.'"
    "+'\\n\\nProduce 1 polished post for the platform above. Output copy text ONLY.'"
    "}) }}"
)


def main():
    nodes = json.loads(psql(
        f"SELECT nodes FROM workflow_entity WHERE name LIKE '{MATCH}';"
    ).stdout.strip())

    for n in nodes:
        p = n.get("parameters", {})
        nm = n.get("name")
        if nm == "LLM rewrite":
            p["url"] = "http://172.17.0.1:11434/api/generate"
            p["jsonBody"] = BRIEF
            p.setdefault("options", {})["timeout"] = 180000
            print("LLM rewrite -> copy-max direct (single-line prompt)")
        if nm == "Quality gate" and "jsonBody" in p:
            p["jsonBody"] = p["jsonBody"].replace(
                "String($json.output && $json.output.copy || '')",
                "String($json.response || '')",
            )
            print("Quality gate -> .response")
        if nm == "Assemble post" and "jsCode" in p:
            p["jsCode"] = p["jsCode"].replace(
                "$('LLM rewrite').item.json.output.copy",
                "$('LLM rewrite').item.json.response",
            )
            print("Assemble post -> .response")

    payload = json.dumps(nodes, ensure_ascii=False).replace("'", "''")
    sql = (
        f"UPDATE workflow_entity SET nodes='{payload}'::jsonb WHERE name LIKE '{MATCH}';"
        f"UPDATE workflow_history SET nodes='{payload}'::jsonb WHERE \"workflowId\" IN "
        f"(SELECT id FROM workflow_entity WHERE name LIKE '{MATCH}');"
    )
    r = psql(stdin=sql)
    print(r.stdout.strip() or r.stderr.strip())
    print("[OK] W02 final patch applied")


if __name__ == "__main__":
    main()
