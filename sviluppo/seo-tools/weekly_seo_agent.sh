#!/usr/bin/env bash
# =============================================================================
# AdOff — Agente SEO settimanale v2
# "Una suite deterministica trova i problemi, l'LLM li ripara."
#
# Fasi:
#   0. Preflight: working tree pulito, backlog worker (wontfix), scelta modello
#      ibrida (code-max locale su :8774 se vivo, altrimenti sonnet cloud)
#   1. Misura: sync GSC + snapshot, keyword research, backup tar di site/,
#      seo_audit.py (audit deterministico -> audit_findings.json)
#   2. Triage (python, zero LLM): AUTO (auto:true) / PROPOSE (auto:false),
#      esclusi i finding gia' marcati wontfix nel backlog del worker
#   3. AUTO   -> branch seo/auto-$DATE, UNA chiamata claude -p (timeout 3600s)
#                con solo i finding AUTO, verifica con re-audit, commit+merge
#                su main+push+deploy (automatico: fix auto = risposta unica)
#   4. PROPOSE -> messaggio Telegram (max 10, piu' gravi prima) + pending_*.txt
#                per seo_apply_watcher.sh. NON applicate ora.
#   5. Ingest run nel worker POST /admin/seo-agent/ingest (SEMPRE, anche a vuoto;
#                un ingest fallito non fa fallire il run)
#
# --dry-run: esegue fasi 0-2 (misura+triage), non tocca file/git/deploy/ingest.
#
# NOTA: il flag --model va SEMPRE passato a claude -p esplicitamente: senza,
# la CLI muore con "Input must be provided either through stdin or...".
#
# Schedulato: domenica 08:00 (crontab). Lancio: bash weekly_seo_agent.sh [--dry-run]
# =============================================================================
set -uo pipefail

PROJECT_ROOT="/mnt/nvme2/projects/Progetti/ChromePlugin"
SEO_DIR="$PROJECT_ROOT/sviluppo/seo-tools"
STATE_DIR="$SEO_DIR/.state"
LOG_DIR="$PROJECT_ROOT/sviluppo/logs"
SECRETS="/home/mrxxx/.secrets/adoff-stores.env"
LOCAL_LLM_SECRETS="/home/mrxxx/.claude/secrets/local-llm.env"
TG_THREAD_SEO=44
CLAUDE_BIN="/home/mrxxx/.local/bin/claude"
CLAUDE_TIMEOUT_S=3600
DEPLOY_TIMEOUT_S=180
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

mkdir -p "$STATE_DIR" "$LOG_DIR"
TS="$(date +%Y%m%d_%H%M)"
DATESTAMP="$(date +%Y%m%d)"
BRANCH="seo/auto-$DATESTAMP"
LOG="$LOG_DIR/seo_weekly_$TS.log"
SNAPSHOT="$STATE_DIR/gsc_snapshot.json"
AUDIT="$STATE_DIR/audit_findings.json"
TRIAGE="$STATE_DIR/triage.json"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# Alert di fase: dice QUALE fase e' fallita e perche', poi interrompe.
die() { log "ERRORE (fase $1): $2"; tg_send "⛔ Agente SEO — fase $1 FALLITA: $2. Run interrotto (dry_run=$DRY_RUN)."; exit 1; }

# --- secrets ---
# shellcheck disable=SC1090
source "$SECRETS" 2>/dev/null || { log "ERRORE: secrets non trovati"; exit 1; }
ADMIN_TOKEN="$(grep '^export ADMIN_TOKEN=' "$SECRETS" | sed 's/export ADMIN_TOKEN=//; s/"//g')"

# Alert via POST /admin/notify del worker (thread 44): il markup supportato da
# mdToTelegramHtml e' **bold** / *bold* / backtick / blocchi ```.
tg_send() {
  curl -s -X POST "https://api.adoff.app/admin/notify" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'text':sys.argv[1],'thread_id':${TG_THREAD_SEO}}))" "$1")" \
    >/dev/null 2>&1
}

# Fase 5 — ingest del run nella console admin. Un fallimento NON fa fallire il
# run (il lavoro sul sito e' gia' stato fatto): log + alert Telegram.
do_ingest() {
  local body rc
  body="$(python3 - "$STATE_DIR" "$COMMIT" "$DEPLOYED" "$MODEL_USED" "$SECONDS" <<'PY'
import json, sys
state, commit, deployed, model, duration = sys.argv[1:6]
out = json.load(open(f"{state}/audit_findings.json"))
out["commit"] = commit or None
out["deployed"] = deployed == "true"
out["model_used"] = model
out["duration_s"] = int(duration) if duration else None
try:
    v = json.load(open(f"{state}/verify.json"))
    out["applied"], out["proposed"] = v["applied"], []
except Exception:
    out["applied"], out["proposed"] = [], []
try:
    out["proposed"] = [f["id"] for f in json.load(open(f"{state}/triage.json"))["propose"]]
except Exception:
    pass
print(json.dumps(out, ensure_ascii=False))
PY
)"
  rc=$(curl -s -m 30 -o /tmp/seo_ingest_resp.json -w '%{http_code}' \
    -X POST "https://api.adoff.app/admin/seo-agent/ingest" \
    -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
    -d "$body")
  if [ "$rc" = "200" ]; then
    log "Ingest worker OK ($(head -c 200 /tmp/seo_ingest_resp.json))"
  else
    log "WARNING: ingest fallito (http=$rc: $(head -c 200 /tmp/seo_ingest_resp.json))"
    tg_send "⚠️ Agente SEO — fase 5: ingest nel worker fallito (http=$rc). Il lavoro sul sito è stato comunque completato."
  fi
  rm -f /tmp/seo_ingest_resp.json
}

log "=== AGENTE SEO SETTIMANALE v2 — $TS (dry_run=$DRY_RUN) ==="

# ── FASE 0: preflight e contesto ─────────────────────────────────────────────
log "=== FASE 0: preflight ==="
cd "$PROJECT_ROOT" || exit 1

if [ -n "$(git status --porcelain)" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    log "WARNING: working tree git sporco (in dry-run proseguo; un run reale verrebbe annullato)."
  else
    die 0 "working tree git sporco, non tocco nulla. Pulire e rilanciare."
  fi
fi

# Backlog dal worker: i finding wontfix non vanno riproposti. Il worker giu'
# NON blocca la manutenzione del sito.
if curl -s -m 15 "https://api.adoff.app/admin/seo-agent" -H "X-Admin-Token: $ADMIN_TOKEN" \
     -o "$STATE_DIR/backlog.json" \
   && python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$STATE_DIR/backlog.json" 2>/dev/null; then
  log "Backlog worker caricato ($(wc -c < "$STATE_DIR/backlog.json") bytes)"
else
  log "WARNING: backlog worker non raggiungibile, prosigo senza filtro wontfix"
  echo '{}' > "$STATE_DIR/backlog.json"
fi

# Scelta modello ibrida: code-max locale se risponde 200, altrimenti sonnet cloud.
HTTP_CODE="$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8774/v1/messages \
  -X POST -H 'content-type: application/json' \
  -d '{"model":"code-max","max_tokens":8,"messages":[{"role":"user","content":"ping"}]}')"
if [ "$HTTP_CODE" = "200" ]; then
  MODEL_NAME="code-max"
  MODEL_USED="code-max (locale :8774)"
  # shellcheck disable=SC1090
  source "$LOCAL_LLM_SECRETS" 2>/dev/null || true
  CLAUDE_ENV=(ANTHROPIC_BASE_URL="${LOCAL_LLM_API_BASE:-http://127.0.0.1:8774}" ANTHROPIC_API_KEY="${LOCAL_LLM_API_KEY:-}")
else
  MODEL_NAME="sonnet"
  MODEL_USED="sonnet (cloud)"
  CLAUDE_ENV=()
fi
log "Modello scelto: $MODEL_USED (preflight http=$HTTP_CODE)"

# ── FASE 1: misura ───────────────────────────────────────────────────────────
log "=== FASE 1: misura ==="
log "Sync GSC..."
curl -s -X POST "https://api.adoff.app/admin/gsc/sync" -H "X-Admin-Token: $ADMIN_TOKEN" >/dev/null 2>&1
curl -s "https://api.adoff.app/admin/gsc" -H "X-Admin-Token: $ADMIN_TOKEN" > "$SNAPSHOT" 2>/dev/null
if ! python3 -c "import json,sys;d=json.load(open(sys.argv[1]));assert d.get('snapshot')" "$SNAPSHOT" 2>/dev/null; then
  die 1 "snapshot GSC non disponibile"
fi
GSC_SUMMARY="$(python3 -c '
import json,sys
s=json.load(open(sys.argv[1]))["snapshot"]
t=s.get("totals",{})
print("clicks=%s impressions=%s ctr=%s%% pos=%s opportunities=%s pagine=%s" % (
  t.get("clicks"), t.get("impressions"), t.get("ctr"), t.get("position"),
  len(s.get("opportunities") or []), len(s.get("topPage") or [])))' "$SNAPSHOT")"
log "GSC: $GSC_SUMMARY"

log "Keyword research settimanale..."
if timeout 180 python3 "$SEO_DIR/keyword_research.py" >> "$LOG" 2>&1; then
  log "Keyword research OK ($(grep -c '^- ' "$STATE_DIR/keyword_report.md" 2>/dev/null) voci)"
else
  log "Keyword research fallita (proseguo)"
fi

# Backup di site/ (rollback del watcher + riferimento pre-fix)
BACKUP="$STATE_DIR/site_backup_$DATESTAMP.tar.gz"
tar czf "$BACKUP" site/ 2>/dev/null && log "Backup site/ creato ($(wc -c < "$BACKUP") bytes)"

log "Audit deterministico (seo_audit.py)..."
python3 "$SEO_DIR/seo_audit.py" --json >/dev/null 2>>"$LOG"
[ -s "$AUDIT" ] || die 1 "seo_audit non ha prodotto $AUDIT"
read -r HEALTH AUDIT_SUMMARY <<EOF
$(python3 -c '
import json,sys
d=json.load(open(sys.argv[1]))
f=d["findings"]; sev={"high":0,"medium":0,"low":0}
for x in f: sev[x["severity"]] = sev.get(x["severity"],0)+1
print(d["metrics"]["health_score"],
      "finding=%d (high=%d medium=%d low=%d) check_err=%d" % (
        len(f), sev["high"], sev["medium"], sev["low"],
        sum(1 for c in d["checks"] if c["status"]=="error")))' "$AUDIT")
EOF
log "Audit: $AUDIT_SUMMARY"

# ── FASE 2: triage (python, zero LLM) ────────────────────────────────────────
log "=== FASE 2: triage ==="
python3 - "$STATE_DIR" <<'PY' >>"$LOG" 2>&1
import json, sys
state = sys.argv[1]
audit = json.load(open(f"{state}/audit_findings.json"))
try:
    backlog = json.load(open(f"{state}/backlog.json"))
except Exception:
    backlog = {}
# raccoglie gli id marcati wontfix da qualunque lista del backlog del worker
wontfix = set()
def scan(node):
    if isinstance(node, dict):
        if node.get("status") == "wontfix" and node.get("finding_id"):
            wontfix.add(node["finding_id"])
        for v in node.values():
            scan(v)
    elif isinstance(node, list):
        for it in node:
            scan(it)
scan(backlog)
tri = {"auto": [], "propose": [], "wontfix_excluded": []}
for f in audit["findings"]:
    if f["id"] in wontfix:
        tri["wontfix_excluded"].append(f["id"])
    elif f.get("auto"):
        tri["auto"].append(f)
    else:
        tri["propose"].append(f)
json.dump(tri, open(f"{state}/triage.json", "w"), ensure_ascii=False, indent=1)
print("TRIAGE AUTO=%d PROPOSE=%d wontfix_esclusi=%d" % (
    len(tri["auto"]), len(tri["propose"]), len(tri["wontfix_excluded"])))
PY
read -r N_AUTO N_PROPOSE N_WONTFIX <<EOF
$(sed -n 's/^.*TRIAGE AUTO=\([0-9]*\) PROPOSE=\([0-9]*\) wontfix_esclusi=\([0-9]*\).*/\1 \2 \3/p' "$LOG" | tail -1)
EOF
N_AUTO="${N_AUTO:-0}"; N_PROPOSE="${N_PROPOSE:-0}"; N_WONTFIX="${N_WONTFIX:-0}"
log "Triage: AUTO=$N_AUTO PROPOSE=$N_PROPOSE wontfix_esclusi=$N_WONTFIX"

STAMP_LINE="Health score: *$HEALTH/100* — GSC: $GSC_SUMMARY"

if [ "$N_AUTO" -eq 0 ] && [ "$N_PROPOSE" -eq 0 ]; then
  log "Nessun intervento necessario."
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] manderei Telegram: 'nessun intervento necessario, $STAMP_LINE' e farei l'ingest."
  else
    tg_send "📊 *Agente SEO — $DATESTAMP*: nessun intervento necessario. $STAMP_LINE."
    # Fase 5 (ingest a vuoto, per la cronologia della console)
    COMMIT=""; DEPLOYED=false; APPLIED_IDS=(); PROPOSED_IDS=()
    do_ingest
  fi
  log "=== FINE (run senza interventi) ==="
  exit 0
fi

# ── FASE 3: riparazione automatica (senza chiedere) ──────────────────────────
APPLIED_IDS=(); FAILED_IDS=(); PROPOSED_IDS=(); COMMIT=""; DEPLOYED=false
if [ "$N_AUTO" -gt 0 ]; then
  log "=== FASE 3: riparazione automatica ($N_AUTO finding AUTO) ==="
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] creerei branch $BRANCH e lancerei UNA chiamata: claude -p --model $MODEL_NAME (timeout ${CLAUDE_TIMEOUT_S}s) sui soli finding AUTO; poi re-audit di verifica, commit+merge+push+deploy se verificati."
  else
    git checkout -b "$BRANCH" || die 3 "creazione branch $BRANCH fallita"
    AUTO_JSON="$(python3 -c '
import json,sys
tri=json.load(open(sys.argv[1]+"/triage.json"))
keep=("id","title","severity","evidence","fix","files")
print(json.dumps([{k:f[k] for k in keep} for f in tri["auto"]], ensure_ascii=False, indent=1))' "$STATE_DIR")"
    PROMPT="$(cat <<PROMPT_END
Sei l'agente di riparazione SEO del sito AdOff (statico in site/, 15 lingue, servito su adoff.app).
La lista qui sotto contiene SOLO finding gia' accertati da una suite di audit deterministica: non devi valutare o decidere, devi RIPARARE.

FINDING DA RIPARARE (JSON: id, title, severity, evidence, fix, files):
$AUTO_JSON

REGOLE TASSATIVE:
1. Lavora SOLO dentro site/. Mai in app/, app-firefox/, app-safari/ o in qualunque altra directory.
2. Vincoli i18n (hanno gia' causato rotture reali): adoff-i18n.js sovrascrive gli elementi [data-i18n] via textContent, quindi la fonte di verita' e' il dizionario site/i18n/<lang>.json — correggi dizionario e HTML INSIEME, per tutte le lingue toccate; NON inserire elementi <a> dentro elementi con data-i18n (verrebbero cancellati a runtime); NON rinominare MAI una chiave i18n (rinominare una chiave ha rotto il binding in tutte e 15 le lingue).
3. Ogni fix deve far sparire il finding corrispondente: segui il campo "fix" di ciascun id. Nessun refactoring extra, nessun intervento non richiesto.
4. NON fare deploy, NON fare push, NON fare commit: li faccio io dopo la verifica.
5. Se un finding non e' riparabile in modo sicuro, lascialo stare e passa oltre.
Rispondi solo con un breve elenco (un rigo per finding) di cosa hai corretto.
PROMPT_END
)"
    log "Lancio claude -p ($MODEL_USED, timeout ${CLAUDE_TIMEOUT_S}s)..."
    env "${CLAUDE_ENV[@]}" timeout "$CLAUDE_TIMEOUT_S" "$CLAUDE_BIN" -p "$PROMPT" \
      --model "$MODEL_NAME" --permission-mode acceptEdits --add-dir "$PROJECT_ROOT" >>"$LOG" 2>&1
    CLAUDE_RC=$?
    log "claude -p terminato (exit $CLAUDE_RC)"

    # Verifica: re-audit; i finding AUTO ancora presenti = FALLITI (non risolti).
    log "Re-audit di verifica..."
    python3 "$SEO_DIR/seo_audit.py" --json >/dev/null 2>>"$LOG"
    if [ -s "$AUDIT" ]; then
      python3 - "$STATE_DIR" <<'PY' >>"$LOG" 2>&1
import json, sys
state = sys.argv[1]
tri = json.load(open(f"{state}/triage.json"))
now = {f["id"] for f in json.load(open(f"{state}/audit_findings.json"))["findings"]}
applied = [f["id"] for f in tri["auto"] if f["id"] not in now]
failed = [f["id"] for f in tri["auto"] if f["id"] in now]
json.dump({"applied": applied, "failed": failed}, open(f"{state}/verify.json", "w"), indent=1)
print("VERIFICA: applicati=%d falliti=%d" % (len(applied), len(failed)))
PY
      mapfile -t APPLIED_IDS < <(python3 -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1]+"/verify.json"))["applied"]))' "$STATE_DIR" | grep . )
      mapfile -t FAILED_IDS  < <(python3 -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1]+"/verify.json"))["failed"]))'  "$STATE_DIR" | grep . )
      HEALTH_AFTER="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["metrics"]["health_score"])' "$AUDIT")"
    else
      FAILED_IDS=($(python3 -c 'import json,sys;print(" ".join(f["id"] for f in json.load(open(sys.argv[1]+"/triage.json"))["auto"]))' "$STATE_DIR"))
      HEALTH_AFTER="$HEALTH"
      log "WARNING: re-audit non disponibile: nessun fix considerato verificato."
    fi
    log "Verifica: applicati=${#APPLIED_IDS[@]} falliti=${#FAILED_IDS[@]} (health $HEALTH -> $HEALTH_AFTER)"

    if [ "${#APPLIED_IDS[@]}" -eq 0 ]; then
      # Nulla di verificato: niente merge, niente deploy. Il branch resta per ispezione.
      git checkout main || die 3 "checkout main fallito"
      log "Nessun fix verificato: branch $BRANCH conservato per ispezione (NON mergiato)."
      tg_send "⚠️ Agente SEO — fase 3: nessun fix AUTO verificato (${#FAILED_IDS[@]} falliti). Branch $BRANCH NON pubblicato, serve ispezione manuale."
    else
      git add site/ || die 3 "git add site/ fallito"
      git commit -m "fix(seo): auto-fix agente $DATESTAMP (${#APPLIED_IDS[@]} finding, health $HEALTH->$HEALTH_AFTER)" \
        || die 3 "commit fallito"
      if git checkout main && git merge --no-edit "$BRANCH" && git push origin main && git branch -d "$BRANCH"; then
        COMMIT="$(git rev-parse --short HEAD)"
        log "Merge su main OK ($COMMIT)"
      else
        die 3 "merge/push di $BRANCH fallito (fix rimasti sul branch, deploy NON eseguito)"
      fi
      log "Deploy del sito..."
      export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:-}" CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-3e114c0bdfe0d194745de3f2de4d6f7d}"
      if timeout "$DEPLOY_TIMEOUT_S" npx --yes wrangler pages deploy site/ --project-name adoff-site --commit-dirty=true >>"$LOG" 2>&1; then
        DEPLOYED=true
        log "Deploy OK (fix AUTO live su adoff.app)"
      else
        log "WARNING: deploy fallito (fix mergiati su main ma non online); run prosegue."
        tg_send "⚠️ Agente SEO — fase 3: deploy fallito dopo il merge di $BRANCH ($COMMIT). Fix su main ma NON online."
      fi
    fi
  fi
fi

# ── FASE 4: proposta (chiede l'OK, non applica) ──────────────────────────────
PROPOSED_IDS=()
if [ "$N_PROPOSE" -gt 0 ]; then
  log "=== FASE 4: proposta ($N_PROPOSE finding PROPOSE) ==="
  PROPOSED_IDS=($(python3 -c 'import json,sys;print(" ".join(f["id"] for f in json.load(open(sys.argv[1]+"/triage.json"))["propose"]))' "$STATE_DIR"))
  MSG="$(python3 - "$STATE_DIR" "$DATESTAMP" "$HEALTH" "${HEALTH_AFTER:-$HEALTH}" \
         "${#APPLIED_IDS[@]}" "$DEPLOYED" "$MODEL_USED" <<'PY'
import json, sys
state, date, h_before, h_after, n_applied, deployed, model = sys.argv[1:8]
tri = json.load(open(f"{state}/triage.json"))
props = tri["propose"][:10]  # gia' ordinate per gravita' dall'audit
lines = [f"📋 *Proposta SEO — {date}*", ""]
lines.append(f"Health: *{h_before}/100*" + (f" → *{h_after}/100* dopo i fix automatici" if h_after != h_before else ""))
if int(n_applied):
    lines.append(f"✅ Gia' riparati e pubblicati oggi: *{n_applied}* finding automatici (deploy: {deployed}).")
lines.append("")
lines.append(f"✋ *{len(tri['propose'])} interventi che richiedono la tua OK* (riscrittura prosa, max 10 mostrati):")
for f in props:
    lines.append(f"• *{f['severity'].upper()}* `{f['id'][:8]}` {f['title']}")
    ev = f["evidence"][:180]
    lines.append(f"  {ev}")
lines.append("")
lines.append("Rispondi con indicazioni su cosa fare: il watcher le fara' implementare. (Modelli: " + model + ")")
print("\n".join(lines))
PY
)"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] manderei questa proposta su Telegram (thread $TG_THREAD_SEO) e scriverei pending_date/pending_backup:"
    echo "$MSG" | tee -a "$LOG"
  else
    echo "$DATESTAMP" > "$STATE_DIR/pending_date.txt"
    echo "$BACKUP" > "$STATE_DIR/pending_backup.txt"
    rm -f "$STATE_DIR/pending_branch.txt"   # le proposte NON sono pre-applicate: nessun branch
    log "Invio proposta su Telegram (thread $TG_THREAD_SEO)..."
    tg_send "$MSG"
  fi
fi

# ── FASE 5: ingest nella console admin (sempre) ──────────────────────────────
if [ "$DRY_RUN" -eq 1 ]; then
  log "[DRY-RUN] farei POST /admin/seo-agent/ingest con audit + applied=${#APPLIED_IDS[@]} proposed=${#PROPOSED_IDS[@]} deployed=$DEPLOYED model=$MODEL_USED."
else
  do_ingest
fi
log "=== FINE — run completato (dry_run=$DRY_RUN, model=$MODEL_USED, health $HEALTH${HEALTH_AFTER:+->$HEALTH_AFTER}) ==="
exit 0
