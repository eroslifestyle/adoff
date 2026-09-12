#!/usr/bin/env python3
"""AdOff Image Queue Worker — polls adoff_autopilot.image_queue, renders via sd-server.

Runs as systemd daemon on leobox host. Uses `docker exec n8n-postgres psql` for DB
(no psycopg2 dependency) and HTTP to local sd-server (127.0.0.1:1234).
"""
import base64
import json
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

POLL_SECONDS = 8
SD_SERVER = "http://127.0.0.1:1234/sdapi/v1/txt2img"
# Saved in n8n bind-mount: host /opt/n8n/local-files == container /files
OUTPUT_DIR = Path("/opt/n8n/local-files")
CONTAINER_PREFIX = "/files"
SCHEMA = "adoff_autopilot.image_queue"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAqc"]


def sql(q):
    r = subprocess.run(PG + [q], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql error: {r.stderr.strip()}")
    return r.stdout.strip()


def sql_safe(q):
    """Run mutating SQL via stdin to avoid arg quoting issues."""
    r = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n"],
        input=q, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql error: {r.stderr.strip()}")
    return r.stdout.strip()


def esc(s):
    return str(s).replace("'", "''")


def claim_job():
    """Atomically claim one queued job."""
    out = sql(
        f"UPDATE {SCHEMA} SET status='processing', started_at=NOW() "
        f"WHERE id = (SELECT id FROM {SCHEMA} WHERE status='queued' "
        f"ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) "
        f"RETURNING job_id||'|'||prompt||'|'||COALESCE(negative_prompt,'')||'|'||"
        f"width||'|'||height||'|'||steps||'|'||cfg_scale||'|'||seed;"
    )
    if not out:
        return None
    parts = out.split("|", 7)
    if len(parts) < 8:
        return None
    return {
        "job_id": parts[0], "prompt": parts[1], "negative": parts[2],
        "width": int(parts[3]), "height": int(parts[4]), "steps": int(parts[5]),
        "cfg_scale": float(parts[6]), "seed": int(parts[7]),
    }


def render(job):
    payload = json.dumps({
        "prompt": job["prompt"],
        "negative_prompt": job["negative"],
        "steps": job["steps"],
        "cfg_scale": job["cfg_scale"],
        "width": job["width"],
        "height": job["height"],
        "sampler_name": "euler",
        "seed": job["seed"],
        "batch_size": 1,
    }).encode()
    req = urllib.request.Request(
        SD_SERVER, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as resp:
        data = json.loads(resp.read())
    imgs = data.get("images") or []
    if not imgs:
        raise RuntimeError("sd-server returned no image")
    return base64.b64decode(imgs[0])


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[{datetime.now(timezone.utc).isoformat()}] image-queue-worker started, poll={POLL_SECONDS}s")
    while True:
        try:
            job = claim_job()
        except Exception as e:
            print(f"claim error: {e}")
            time.sleep(POLL_SECONDS)
            continue
        if not job:
            time.sleep(POLL_SECONDS)
            continue

        jid = job["job_id"]
        print(f"[{datetime.now(timezone.utc).isoformat()}] rendering job {jid} "
              f"({job['width']}x{job['height']}, {job['steps']} steps)")
        t0 = time.time()
        try:
            png = render(job)
            fname = f"adoff-{jid}.png"
            fpath = OUTPUT_DIR / fname
            fpath.write_bytes(png)
            container_path = f"{CONTAINER_PREFIX}/{fname}"
            secs = int(time.time() - t0)
            sql_safe(
                f"UPDATE {SCHEMA} SET status='done', image_path='{esc(container_path)}', "
                f"file_size={len(png)}, gen_seconds={secs}, completed_at=NOW() "
                f"WHERE job_id='{jid}';"
            )
            print(f"  done in {secs}s -> {fpath} (db path {container_path}, {len(png)} bytes)")
        except Exception as e:
            secs = int(time.time() - t0)
            sql_safe(
                f"UPDATE {SCHEMA} SET status='error', error='{esc(e)[:500]}', "
                f"gen_seconds={secs}, completed_at=NOW() WHERE job_id='{jid}';"
            )
            print(f"  ERROR after {secs}s: {e}")


if __name__ == "__main__":
    main()
