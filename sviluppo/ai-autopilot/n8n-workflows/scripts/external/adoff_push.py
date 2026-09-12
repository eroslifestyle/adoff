#!/usr/bin/env python3
"""omnia → AdOff bridge (hybrid SMM).

Inserisce un deliverable omnia nella coda di produzione AdOff come SORGENTE di
qualità superiore, rispettando il gate di approvazione n8n esistente:
  - gemini_copy_drafts  (status='draft')   ← copy/caption
  - media_queue         (status='done')    ← media già renderizzato da omnia
linkati via draft_id. NON tocca posts_queue (resta a n8n → niente publish diretto).

Sicurezza:
  - DRY-RUN di default: stampa copia file + SQL, non scrive nulla.
  - --execute richiesto per scrivere; transazione singola (ON_ERROR_STOP).
  - status draft di default: entra nel flusso di approvazione, non pubblica.
  - brand guard: blocca never_say / nomi competitor dal brand.yaml.

DB: schema adoff_autopilot in container n8n-postgres (via docker exec psql).
Media: copiati in /opt/n8n/local-files (= /files nel container n8n).
"""
from __future__ import annotations
import argparse, json, re, shutil, subprocess, sys, uuid
from pathlib import Path

try:
    import yaml
except ImportError:
    print("manca pyyaml: pip install pyyaml", file=sys.stderr); sys.exit(2)

LOCAL_FILES_HOST = Path("/opt/n8n/local-files")
LOCAL_FILES_CONTAINER = "/files"
PG = ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n", "-d", "n8n",
      "-v", "ON_ERROR_STOP=1"]
# omnia channel -> piattaforma DB AdOff
CHAN2PLATFORM = {"reels": "instagram", "shorts": "youtube", "tiktok": "tiktok",
                 "feed": "instagram", "linkedin": "linkedin"}

def dq(s: str, tag: str = "om") -> str:
    """dollar-quote sicuro (sceglie un tag non presente nel testo)."""
    t = tag
    while f"${t}$" in (s or ""):
        t += "x"
    return f"${t}$" + (s or "") + f"${t}$"

def load_brand(brand_dir: Path) -> dict:
    f = brand_dir / "brand.yaml"
    return yaml.safe_load(f.read_text(encoding="utf-8")) if f.exists() else {}

def brand_guard(text: str, brand: dict) -> tuple[bool, str]:
    voce = brand.get("voce", {}) or {}
    never = [x.lower() for x in voce.get("never_say", [])]
    comp = ["ublock", "adblock plus", "ghostery"]
    low = (text or "").lower()
    for n in never:
        if n and n in low:
            return False, f"never_say: '{n}'"
    for c in comp:
        if c in low:
            return False, f"competitor citato: '{c}'"
    return True, ""

def parse_captions(md: Path) -> dict:
    """Estrae caption per piattaforma da caption.md (## Heading -> testo)."""
    out, cur, buf = {}, None, []
    for line in md.read_text(encoding="utf-8").splitlines():
        if re.match(r"##\s", line):                  # heading di sezione piattaforma
            if cur: out[cur] = "\n".join(buf).strip()
            cur, buf = re.sub(r"^#+\s", "", line).strip().lower(), []
        elif line.strip() == "---":                  # footer/separatore: chiude la sezione
            if cur: out[cur] = "\n".join(buf).strip(); cur = None
        elif cur and not re.match(r"#\s", line):      # NON saltare le righe #hashtag (solo heading '# ')
            buf.append(line)
    if cur: out[cur] = "\n".join(buf).strip()
    return out

def caption_for(channel: str, caps: dict, fallback: str) -> str:
    for k, v in caps.items():
        if channel in k or CHAN2PLATFORM.get(channel, "") in k:
            return v
    return fallback

def extract_hashtags(text: str) -> list[str]:
    return re.findall(r"#\w+", text or "")

def build_sql(draft: dict, media: dict) -> str:
    body = json.dumps(draft["body"], ensure_ascii=False)
    return f"""WITH d AS (
  INSERT INTO adoff_autopilot.gemini_copy_drafts
    (workflow, asset_type, platform, lang, concept, body, status, brand_guard_ok, brand_guard_reason, model, approval_score)
  VALUES ({dq(draft['workflow'])}, {dq(draft['asset_type'])}, {dq(draft['platform'])}, {dq(draft['lang'])},
          {dq(draft['concept'])}, {dq(body)}::jsonb, {dq(draft['status'])}, {str(draft['brand_guard_ok']).lower()},
          {('NULL' if not draft['brand_guard_reason'] else dq(draft['brand_guard_reason']))},
          {dq(draft['model'])}, {draft['approval_score']})
  RETURNING id
)
INSERT INTO adoff_autopilot.media_queue
  (brand, platform, format_type, media_type, status, output_path, draft_id, duration_sec, width, height, dimensions, requested_by, model, prompt_used)
SELECT {dq('adoff')}, {dq(media['platform'])}, {dq(media['format_type'])}, {dq(media['media_type'])}, {dq('done')},
       {dq(media['output_path'])}, d.id, {media['duration_sec']}, {media['width']}, {media['height']},
       {dq(media['dimensions'])}, {dq('omnia')}, {dq(media['model'])}, {dq(media['prompt_used'])}
FROM d
RETURNING draft_id, job_id;"""

def main():
    ap = argparse.ArgumentParser(description="omnia → AdOff bridge")
    ap.add_argument("project", help="path progetto omnia (con 06-publish/deliverable.yaml)")
    ap.add_argument("--brand-dir", default=None, help="dir brand (default ~/omnia-studio/brands/<brand>)")
    ap.add_argument("--status", default="draft", help="status gemini_copy_drafts (default draft = entra in approvazione)")
    ap.add_argument("--execute", action="store_true", help="esegui davvero (default dry-run)")
    args = ap.parse_args()

    proj = Path(args.project).expanduser().resolve()
    deliv = yaml.safe_load((proj / "06-publish" / "deliverable.yaml").read_text(encoding="utf-8"))
    brand_slug = deliv.get("brand", "adoff")
    brand_dir = Path(args.brand_dir).expanduser() if args.brand_dir else Path.home()/"omnia-studio"/"brands"/brand_slug
    brand = load_brand(brand_dir)
    caps = parse_captions(proj / "06-publish" / "caption.md")
    master = (proj / "06-publish" / "reels").glob("*.mp4")
    master = next(master, None) or (proj / "05-edit" / "render" / "master.mp4")
    qa = deliv.get("qa", {})
    concept = ""
    cf = proj / "01-concept" / "concept.yaml"
    if cf.exists():
        concept = (yaml.safe_load(cf.read_text(encoding="utf-8")) or {}).get("hook", {}).get("testo", "")

    # media file -> /opt/n8n/local-files (container /files)
    media_name = f"omnia-{brand_slug}-{uuid.uuid4().hex[:12]}{master.suffix}"
    host_dst = LOCAL_FILES_HOST / media_name
    container_path = f"{LOCAL_FILES_CONTAINER}/{media_name}"

    print(f"[bridge] progetto: {proj}")
    print(f"[bridge] master:   {master}")
    print(f"[bridge] copia ->  {host_dst}  (container: {container_path})")
    print(f"[bridge] status:   {args.status}   execute={args.execute}")
    print(f"[bridge] canali:   {[c.get('piattaforma') for c in deliv.get('canali', [])]}\n")

    sqls = []
    for ch in deliv.get("canali", []):
        chan = ch.get("piattaforma", "")
        platform = CHAN2PLATFORM.get(chan, chan)
        cap = caption_for(chan, caps, deliv.get("cta", ""))
        ok, reason = brand_guard(cap, brand)
        if not ok:
            print(f"  [BRAND-GUARD BLOCCATO] {chan}: {reason} -> salto", file=sys.stderr)
            continue
        body = {"caption": cap, "hashtags": extract_hashtags(cap)}
        draft = {"workflow": "omnia", "asset_type": "caption_social", "platform": platform,
                 "lang": deliv.get("lang", "it"), "concept": concept, "body": body,
                 "status": args.status, "brand_guard_ok": True, "brand_guard_reason": "",
                 "model": "omnia-studio-ai", "approval_score": "NULL"}
        media = {"platform": platform, "format_type": deliv.get("formato", "reel"),
                 "media_type": "video", "output_path": container_path,
                 "duration_sec": int(float(qa.get("durata_s", 0))) or "NULL",
                 "width": int(str(qa.get("risoluzione", "0x0")).split("x")[0]) or "NULL",
                 "height": int(str(qa.get("risoluzione", "0x0")).split("x")[1]) if "x" in str(qa.get("risoluzione","")) else "NULL",
                 "dimensions": qa.get("risoluzione", ""), "model": "omnia-ffmpeg",
                 "prompt_used": "omnia pipeline (concept->storyboard->prompt->edit)"}
        # approval_score NULL: rimuovo apici
        sql = build_sql(draft, media).replace("$om$NULL$om$", "NULL")
        sqls.append((chan, platform, sql))

    if not sqls:
        print("Nessun canale valido (brand guard?).", file=sys.stderr); sys.exit(1)

    full = "BEGIN;\n" + "\n".join(s for _, _, s in sqls) + "\nCOMMIT;\n"
    if not args.execute:
        print("===== DRY-RUN (nessuna scrittura) =====")
        print(f"COPY: {master} -> {host_dst}")
        print(full)
        print("===== Per eseguire: aggiungi --execute =====")
        return

    # execute
    if not LOCAL_FILES_HOST.exists():
        print(f"ERRORE: {LOCAL_FILES_HOST} assente (mount n8n)", file=sys.stderr); sys.exit(3)
    shutil.copy2(master, host_dst)
    print(f"[ok] media copiato in {host_dst}")
    res = subprocess.run(PG, input=full, text=True, capture_output=True)
    sys.stdout.write(res.stdout); sys.stderr.write(res.stderr)
    if res.returncode != 0:
        print("[ERRORE] insert fallito, rollback automatico.", file=sys.stderr)
        host_dst.unlink(missing_ok=True); sys.exit(res.returncode)
    print(f"[ok] inseriti {len(sqls)} draft+media in adoff_autopilot (status={args.status}).")
    print("     Restano nel flusso di approvazione n8n (NESSUNA pubblicazione diretta).")

if __name__ == "__main__":
    main()
