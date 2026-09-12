#!/usr/bin/env python3
"""AdOff Image Worker — pesca job da adoff_autopilot.image_queue, genera con Flux via sd-server, salva PNG.

Lanciato da systemd timer ogni 2 min. Processa 1 job alla volta (CPU-bound, evita contention).
"""
import json
import subprocess
import sys
import time
import uuid
from pathlib import Path

OUTPUT_DIR = Path("/home/mrxxx/sdcpp/output")
SD_SERVER = "http://localhost:7860/sdapi/v1/txt2img"
PG_BASE = ["docker", "exec", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n", "-tAc"]

BRAND_STYLE_SUFFIX = (
    ", dark deep-space background hex 0a0a1a, purple accent hex 7c5cfc, "
    "geometric clean flat design, premium SaaS aesthetic, no text, centered composition, high quality"
)
BRAND_NEGATIVE = "text, watermark, signature, people, faces, hands, cluttered, blurry, low quality, jpeg artifacts, nsfw"


def psql_query(sql):
    r = subprocess.run(PG_BASE + [sql], capture_output=True, text=True)
    return r.stdout.strip()


def psql_exec(sql):
    subprocess.run(PG_BASE + [sql], capture_output=True, text=True, check=True)


def claim_job():
    """Atomically claim 1 queued job."""
    sql = """
WITH next_job AS (
  SELECT id FROM adoff_autopilot.image_queue
  WHERE status='queued'
  ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
)
UPDATE adoff_autopilot.image_queue q
SET status='processing', started_at=NOW()
FROM next_job WHERE q.id=next_job.id
RETURNING q.id, q.job_id, q.prompt, q.negative_prompt, q.width, q.height, q.steps, q.cfg_scale, q.seed;
"""
    out = psql_query(sql)
    if not out:
        return None
    # psql -tAc appends command tag "UPDATE N" as last line for RETURNING; take first line only
    first_line = out.split("\n")[0].strip()
    if not first_line:
        return None
    parts = first_line.split("|")
    if len(parts) < 9:
        return None
    return {
        "id": parts[0],
        "job_id": parts[1],
        "prompt": parts[2],
        "negative_prompt": parts[3] or BRAND_NEGATIVE,
        "width": int(parts[4] or 768),
        "height": int(parts[5] or 768),
        "steps": int(parts[6] or 4),
        "cfg_scale": float(parts[7] or 1.0),
        "seed": int(parts[8] or -1),
    }


def generate(job):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{job['job_id']}.png"

    full_prompt = job["prompt"]
    if "deep-space" not in full_prompt and "aesthetic" not in full_prompt:
        full_prompt = full_prompt + BRAND_STYLE_SUFFIX

    payload = json.dumps({
        "prompt": full_prompt,
        "negative_prompt": job["negative_prompt"],
        "steps": job["steps"],
        "cfg_scale": job["cfg_scale"],
        "width": job["width"],
        "height": job["height"],
        "sampler_name": "euler",
        "seed": job["seed"],
    })

    r = subprocess.run(
        ["curl", "-sS", "-m", "600", "-X", "POST", SD_SERVER,
         "-H", "Content-Type: application/json", "-d", payload],
        capture_output=True, text=True,
    )
    if r.returncode != 0 or not r.stdout:
        raise RuntimeError(f"sd-server call failed: rc={r.returncode} err={r.stderr[:200]}")

    data = json.loads(r.stdout)
    imgs = data.get("images", [])
    if not imgs:
        raise RuntimeError("sd-server returned no images")

    import base64
    out_path.write_bytes(base64.b64decode(imgs[0]))
    return str(out_path), out_path.stat().st_size


def main():
    job = claim_job()
    if not job:
        print("[worker] no queued jobs")
        return 0

    print(f"[worker] processing job {job['job_id']} ({job['width']}x{job['height']})")
    t0 = time.time()
    try:
        path, size = generate(job)
        elapsed = int(time.time() - t0)
        sql = f"""
UPDATE adoff_autopilot.image_queue
SET status='done', image_path='{path}', file_size={size},
    gen_seconds={elapsed}, completed_at=NOW()
WHERE id='{job['id']}';
"""
        psql_exec(sql)
        print(f"[worker] DONE {job['job_id']} -> {path} ({size}b, {elapsed}s)")
    except Exception as e:
        err = str(e).replace("'", "''")[:500]
        sql = f"""
UPDATE adoff_autopilot.image_queue
SET status='failed', error='{err}', completed_at=NOW()
WHERE id='{job['id']}';
"""
        psql_exec(sql)
        print(f"[worker] FAILED {job['job_id']}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
