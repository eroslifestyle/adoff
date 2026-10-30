#!/usr/bin/env python3
"""W02: insert image pipeline. Assemble -> Enqueue image (async) -> Queue to posts.
Only twitter/mastodon get an image (reddit is text-first)."""
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


STYLE = (", minimalist dark tech aesthetic, deep space black background, "
         "glowing purple violet shield motif, geometric, premium privacy software "
         "branding, clean composition, soft volumetric glow, no text, no words, "
         "no letters, cinematic lighting")


def main():
    nodes = json.loads(psql(
        f"SELECT nodes FROM workflow_entity WHERE name LIKE '{MATCH}';"
    ).stdout.strip())
    conns = json.loads(psql(
        f"SELECT connections FROM workflow_entity WHERE name LIKE '{MATCH}';"
    ).stdout.strip())

    # 1. Patch Assemble post: add image_prompt + wants_image
    for n in nodes:
        if n.get("name") == "Assemble post":
            code = n["parameters"]["jsCode"]
            inject = (
                "\nconst _wantsImg = ['twitter','mastodon'].includes(fanout.platform);\n"
                "const _imgPrompt = _wantsImg ? (String(draft).slice(0,160).replace(/[\\n\\r]/g,' ').replace(/#\\w+/g,'').replace(/https?:\\S+/g,'').trim() + "
                f"{json.dumps(STYLE)}) : null;\n"
            )
            # inject before final return
            code = code.replace("return [{ json: {", inject + "return [{ json: {")
            code = code.replace(
                "reddit_subs: fanout.reddit_subs\n}}];",
                "reddit_subs: fanout.reddit_subs,\n  wants_image: _wantsImg,\n  image_prompt: _imgPrompt\n}}];"
            )
            n["parameters"]["jsCode"] = code
            print("Assemble post: + image_prompt / wants_image")

    # 2. New node: Enqueue image (Postgres, conditional via SQL)
    enqueue_img = {
        "id": "enqimg",
        "name": "Enqueue image",
        "type": "n8n-nodes-base.postgres",
        "position": [1340, 400],
        "parameters": {
            "operation": "executeQuery",
            "query": (
                "INSERT INTO adoff_autopilot.image_queue "
                "(prompt, width, height, steps, requested_by) "
                "SELECT $1, 768, 768, 4, 'w02-crosspost' "
                "WHERE $2 = 'true' "
                "RETURNING job_id;"
            ),
            "options": {
                "queryReplacement": "={{ [$json.image_prompt || '', String($json.wants_image)] }}"
            }
        },
        "credentials": {
            "postgres": {"id": "adoff-pg-autopilot-credential-1234", "name": "n8n-postgres"}
        },
        "onError": "continueRegularOutput",
        "typeVersion": 2.5
    }
    nodes.append(enqueue_img)

    # 3. Merge image job_id back: modify "Queue to posts" to include image_job_id
    for n in nodes:
        if n.get("name") == "Queue to posts":
            q = n["parameters"]["query"]
            # add image_job_id column + value
            q = q.replace(
                "INSERT INTO adoff_autopilot.posts_queue (workflow, platform, lang, body, quality_score, status, scheduled_at)",
                "INSERT INTO adoff_autopilot.posts_queue (workflow, platform, lang, body, quality_score, status, image_job_id, scheduled_at)"
            )
            q = q.replace(
                "VALUES ($1,$2,$3,$4,$5,$6, NOW()",
                "VALUES ($1,$2,$3,$4,$5,$6,$7, NOW()"
            )
            n["parameters"]["query"] = q
            n["parameters"]["options"]["queryReplacement"] = (
                "={{ [$('Assemble post').item.json.workflow, "
                "$('Assemble post').item.json.platform, "
                "$('Assemble post').item.json.lang, "
                "$('Assemble post').item.json.body, "
                "$('Assemble post').item.json.quality_score, "
                "$('Assemble post').item.json.status, "
                "$json.job_id || null] }}"
            )
            print("Queue to posts: + image_job_id column")

    # 4. Rewire connections: Assemble -> Enqueue image -> Queue to posts
    conns["Assemble post"] = {"main": [[{"node": "Enqueue image", "type": "main", "index": 0}]]}
    conns["Enqueue image"] = {"main": [[{"node": "Queue to posts", "type": "main", "index": 0}]]}

    nj = json.dumps(nodes, ensure_ascii=False).replace("'", "''")
    cj = json.dumps(conns, ensure_ascii=False).replace("'", "''")
    sql = (
        f"UPDATE workflow_entity SET nodes='{nj}'::jsonb, connections='{cj}'::jsonb "
        f"WHERE name LIKE '{MATCH}';"
        f"UPDATE workflow_history SET nodes='{nj}'::jsonb, connections='{cj}'::jsonb "
        f"WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name LIKE '{MATCH}');"
    )
    r = psql(stdin=sql)
    print(r.stdout.strip() or r.stderr.strip())
    print("[OK] W02 image pipeline wired")


if __name__ == "__main__":
    main()
