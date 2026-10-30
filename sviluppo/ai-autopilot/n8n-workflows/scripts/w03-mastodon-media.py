#!/usr/bin/env python3
"""W03: add Mastodon media upload. Pick query + JOIN image_queue, then
Is Mastodon? -> MA read img -> MA upload media -> POST Mastodon (media_ids)."""
import subprocess
import json

MATCH = "%03 - Posts Dispatcher%"
MASTO_CRED = {"id": "adoff-mastodon-credential-001", "name": "AdOff Mastodon @adoffadblock"}


def psql(sql=None, stdin=None):
    if stdin is not None:
        return subprocess.run(
            ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
            input=stdin, capture_output=True, text=True, check=True)
    return subprocess.run(
        ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc", sql],
        capture_output=True, text=True, check=True)


def main():
    nodes = json.loads(psql(f"SELECT nodes FROM workflow_entity WHERE name LIKE '{MATCH}';").stdout.strip())
    conns = json.loads(psql(f"SELECT connections FROM workflow_entity WHERE name LIKE '{MATCH}';").stdout.strip())

    # 1. Pick query: JOIN image_queue, return img_file (container path if image done)
    for n in nodes:
        if n.get("name") == "Pick next 3 posts":
            n["parameters"]["query"] = (
                "WITH next_post AS (SELECT pq.* FROM adoff_autopilot.posts_queue pq "
                "LEFT JOIN adoff_autopilot.accounts a ON pq.account_id = a.id "
                "WHERE pq.status='queued' AND pq.scheduled_at <= NOW() "
                "AND (pq.quality_score IS NULL OR pq.quality_score >= 6) "
                "AND (a.id IS NULL OR (a.action_count_24h < 5 AND "
                "(a.cooldown_until IS NULL OR a.cooldown_until <= NOW()))) "
                "ORDER BY pq.scheduled_at LIMIT 3) "
                "UPDATE adoff_autopilot.posts_queue SET status='posting' FROM next_post "
                "WHERE adoff_autopilot.posts_queue.id = next_post.id "
                "RETURNING adoff_autopilot.posts_queue.*, "
                "(SELECT iq.image_path FROM adoff_autopilot.image_queue iq "
                "WHERE iq.job_id = adoff_autopilot.posts_queue.image_job_id "
                "AND iq.status='done' LIMIT 1) AS img_file;"
            )
            print("Pick query: + img_file (image_queue JOIN)")

    # 2. New node: MA read img (readWriteFile read, onError continue)
    ma_read = {
        "id": "ma-read",
        "name": "MA read img",
        "type": "n8n-nodes-base.readWriteFile",
        "position": [900, 320],
        "parameters": {
            "operation": "read",
            "fileSelector": "={{ $json.img_file || '/nonexistent' }}",
            "options": {"dataPropertyName": "img"}
        },
        "onError": "continueRegularOutput",
        "typeVersion": 1
    }

    # 3. New node: MA upload media (multipart POST /api/v2/media, onError continue)
    ma_upload = {
        "id": "ma-upload",
        "name": "MA upload media",
        "type": "n8n-nodes-base.httpRequest",
        "position": [1120, 320],
        "parameters": {
            "url": "https://mastodon.social/api/v2/media",
            "method": "POST",
            "sendBody": True,
            "contentType": "multipart-form-data",
            "bodyParameters": {
                "parameters": [
                    {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "img"}
                ]
            },
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "options": {"timeout": 60000, "response": {"response": {"neverError": True}}}
        },
        "credentials": {"httpHeaderAuth": MASTO_CRED},
        "onError": "continueRegularOutput",
        "typeVersion": 4.2
    }

    # 4. Patch POST Mastodon: include media_ids if media upload returned an id
    for n in nodes:
        if n.get("id") == "post-mast":
            n["parameters"]["jsonBody"] = (
                "={{ JSON.stringify(Object.assign("
                "{ status: ($('Pick next 3 posts').item.json.body || '').slice(0,500), visibility: 'public' }, "
                "($json && $json.id) ? { media_ids: [$json.id] } : {}"
                ")) }}"
            )
            n["parameters"]["options"]["timeout"] = 60000
            n["onError"] = "continueRegularOutput"
            print("POST Mastodon: media_ids conditional")

    nodes.extend([ma_read, ma_upload])

    # 5. Rewire: Is Mastodon? true -> MA read img -> MA upload media -> POST Mastodon
    conns["Is Mastodon?"] = {"main": [
        [{"node": "MA read img", "type": "main", "index": 0}],
        []
    ]}
    conns["MA read img"] = {"main": [[{"node": "MA upload media", "type": "main", "index": 0}]]}
    conns["MA upload media"] = {"main": [[{"node": "POST Mastodon", "type": "main", "index": 0}]]}

    nj = json.dumps(nodes, ensure_ascii=False).replace("'", "''")
    cj = json.dumps(conns, ensure_ascii=False).replace("'", "''")
    sql = (
        f"UPDATE workflow_entity SET nodes='{nj}'::jsonb, connections='{cj}'::jsonb WHERE name LIKE '{MATCH}';"
        f"UPDATE workflow_history SET nodes='{nj}'::jsonb, connections='{cj}'::jsonb "
        f"WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name LIKE '{MATCH}');"
    )
    r = psql(stdin=sql)
    print(r.stdout.strip() or r.stderr.strip())
    print("[OK] W03 Mastodon media upload wired")


if __name__ == "__main__":
    main()
