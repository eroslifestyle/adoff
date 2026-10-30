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

REPO_ROOT="/mnt/nvme2/projects/Progetti/ChromePlugin"   # checkout principale: .state, log, lock, secrets
PROJECT_ROOT="$REPO_ROOT"   # alias legacy per i punti che restano sul checkout principale
TS="$(date +%Y%m%d_%H%M)"
WORK_ROOT="$REPO_ROOT/sviluppo/.worktrees/seo-$TS"      # worktree isolato: claude -p e git ci lavorano qui
WORK_CREATED=""        # 1 = worktree creato (trap: va rimosso)
KEEP_BRANCH=0          # 1 = merge fallito o lavoro non pubblicato: branch conservato
DIE_SENT=0             # 1 = die() ha gia' notificato: il trap EXIT non ripete il Telegram
SEO_DIR="$REPO_ROOT/sviluppo/seo-tools"
STATE_DIR="$SEO_DIR/.state"
LOG_DIR="$REPO_ROOT/sviluppo/logs"
SECRET_BIN="/home/mrxxx/.local/bin/secret"
LOCAL_LLM_SECRETS="/home/mrxxx/.claude/secrets/local-llm.env"
TG_THREAD_SEO=44
CLAUDE_BIN="/home/mrxxx/.local/bin/claude"
CLAUDE_TIMEOUT_S=3600
DEPLOY_TIMEOUT_S=600
MAX_AEO_FIXES=8   # max domande AEO (FAQ) lavorate per run
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

mkdir -p "$STATE_DIR" "$LOG_DIR"
DATESTAMP="$(date +%Y%m%d)"
BRANCH="seo/auto-$TS"   # con l'ora: un secondo run nello stesso giorno non collide
LOG="$LOG_DIR/seo_weekly_$TS.log"
SNAPSHOT="$STATE_DIR/gsc_snapshot.json"
AUDIT="$STATE_DIR/audit_findings.json"
TRIAGE="$STATE_DIR/triage.json"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# Alert di fase: dice QUALE fase e' fallita e perche', poi interrompe.
die() { log "ERRORE (fase $1): $2"; DIE_SENT=1; tg_send "⛔ Agente SEO — fase $1 FALLITA: $2. Run interrotto (dry_run=$DRY_RUN)."; exit 1; }

# --- secrets ---
# shellcheck disable=SC1090
set -a; source "$("$SECRET_BIN" file adoff-stores)" 2>/dev/null || { log "ERRORE: vault adoff-stores non disponibile"; exit 1; }; set +a
ADMIN_TOKEN="$("$SECRET_BIN" get adoff-stores.ADMIN_TOKEN)"

# Alert via POST /admin/notify del worker (thread 44): il markup supportato da
# mdToTelegramHtml e' **bold** / *bold* / backtick / blocchi ```.
tg_send() {
  local rc
  rc=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X POST "https://api.adoff.app/admin/notify" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'text':sys.argv[1],'thread_id':${TG_THREAD_SEO}}))" "$1")" \
    2>/dev/null)
  # Solo log, mai un'uscita d'errore: tg_send e' chiamata anche da die(), e non deve
  # ne' far fallire il run ne' richiamare se stessa (loop infinito).
  [ "$rc" = "200" ] || log "WARNING: invio Telegram fallito (http=$rc)"
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

# Fase 6 — riepilogo AEO/keyword, va mandato SEMPRE (anche quando l'audit non
# trova nulla e il run esce presto). Idempotente: puo' essere chiamata sia dal
# ramo "nessun intervento" sia in fondo allo script, ma parte una sola volta.
SUMMARY_SENT=0
send_weekly_summary() {
  [ "$SUMMARY_SENT" -eq 1 ] && return 0
  SUMMARY_SENT=1

  log "=== FASE 6: riepilogo AEO/keyword ==="
  AEO_BACKEND="${AEO_BACKEND:-local}" timeout 900 python3 "$SEO_DIR/aeo_probe.py" >>"$LOG" 2>&1 || log "WARNING: aeo_probe fallito (riepilogo AEO parziale)"
  timeout 900 python3 "$SEO_DIR/keyword_research.py" >>"$LOG" 2>&1 || log "WARNING: keyword_research fallito"
  timeout 600 python3 "$SEO_DIR/authority_signals.py" >>"$LOG" 2>&1 || log "WARNING: authority_signals fallito"

  # Contatori REALI del run corrente: gli array esistono solo se ci sono stati
  # interventi, e con set -u non si possono leggere se mai dichiarati.
  local n_app=0 n_fail=0 n_aeo=0 n_aeo_pages=0
  [ "${APPLIED_IDS+x}" = x ] && n_app=${#APPLIED_IDS[@]}
  [ "${FAILED_IDS+x}" = x ] && n_fail=${#FAILED_IDS[@]}
  [ "${N_AEO+x}" = x ] && n_aeo=$N_AEO
  [ "${AEO_PAGES+x}" = x ] && n_aeo_pages=$AEO_PAGES

  SUMMARY_MSG="$(python3 - "$STATE_DIR" "${HEALTH:-n/d}" "${HEALTH_AFTER:-${HEALTH:-n/d}}" "$n_app" "$n_fail" "$n_aeo" "$n_aeo_pages" <<'PY'
import json, sys

state, health, health_after, n_app, n_fail, n_aeo, n_aeo_pages = sys.argv[1:8]
lines = ["📈 *AdOff — SEO/AEO settimanale*"]

try:
    aeo = json.load(open(f"{state}/aeo_report.json"))
    _err = aeo.get("errorCount") or 0
    lines.append(
        f"Visibilita' AEO (domande in cui gli assistenti ci citano): "
        f"{aeo['backend']} {aeo['citedCount']}/{aeo['total']}"
        + (f" (+{_err} in errore)" if _err else "")
    )
except Exception:
    aeo = None

try:
    snap = json.load(open(f"{state}/gsc_snapshot.json")).get("snapshot") or {}
    top = max(snap.get("topQuery") or [], key=lambda r: r.get("impressions", 0))
    lines.append(
        f"Query principale: {top.get('key', '?')} — "
        f"{top.get('clicks', 0)} click, {top.get('impressions', 0)} impression"
    )
except Exception:
    pass

# Contatori del run corrente, passati da bash (verify.json e' stantio nei run senza fix)
_aeo_line = f" | AEO: {n_aeo} domande, FAQ su {n_aeo_pages} pagine" if int(n_aeo) else ""
lines.append(
    f"GSC/Audit: health {health}/100 -> {health_after}/100 | "
    f"fix applicati: {n_app} | falliti: {n_fail}{_aeo_line}"
)

try:
    kw = json.load(open(f"{state}/keyword_report.json"))
    gaps = kw["gaps"]
    lines.append(f"Keyword: {kw['totalKeywords']} trovate, {len(gaps)} senza una pagina che risponda")

    def gap_text(g):
        if isinstance(g, dict):
            return g.get("keyword") or g.get("query") or g.get("term") or str(g)
        return str(g)

    if gaps:
        lines.append("Prossime guide da scrivere: " + " | ".join(gap_text(g) for g in gaps[:5]))
except Exception:
    pass

if aeo:
    try:
        uncited = [
            r["q"] for r in aeo.get("results", [])
            if r.get("retrieval_hit") and not r.get("cited")
        ][:3]
        if uncited:
            lines.append("Coperte ma gli assistenti non ci citano: " + " | ".join(uncited))
    except Exception:
        pass

lines.append("Report: .state/aeo_report.json, keyword_report.json, audit_findings.json")
print("\n".join(lines))
PY
)"

  log "Riepilogo AEO/keyword composto:"
  echo "$SUMMARY_MSG" | tee -a "$LOG"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] riepilogo NON inviato su Telegram."
  else
    tg_send "$SUMMARY_MSG"
  fi
}

log "=== AGENTE SEO SETTIMANALE v2 — $TS (dry_run=$DRY_RUN) ==="

# ── FASE 0: preflight e contesto ─────────────────────────────────────────────
log "=== FASE 0: preflight ==="
cd "$REPO_ROOT" || exit 1

# Cleanup garantito del worktree (a qualunque uscita). Il branch, se c'e' lavoro
# non mergiato, resta in git: si ispeziona con `git log seo/auto-*`.
cleanup_worktree() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$DIE_SENT" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
    # uscita inaspettata (set -u, errore non gestito): die() non ha notificato
    log "ERRORE: run interrotto con exit $rc"
    DIE_SENT=1; tg_send "⛔ Agente SEO — run interrotto (exit $rc), vedi log $LOG"
  fi
  if [ -n "$WORK_CREATED" ] && git worktree list --porcelain 2>/dev/null | grep -q "^worktree $WORK_ROOT$"; then
    git worktree remove --force "$WORK_ROOT" >>"$LOG" 2>&1 || log "WARNING: rimozione worktree fallita"
    git worktree prune >>"$LOG" 2>&1
    log "Worktree rimosso$([ "$KEEP_BRANCH" = 1 ] && echo " (branch $BRANCH conservato)")"
    # Branch da cancellare se non conservato E senza commit oltre main
    # (run a vuoto o hook di test: un branch vuoto e' solo rumore).
    if [ "$KEEP_BRANCH" != 1 ] && git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
      if [ "$(git rev-list --count "main..$BRANCH" 2>/dev/null || echo 1)" = "0" ]; then
        git branch -D "$BRANCH" >>"$LOG" 2>&1
        log "Branch $BRANCH eliminato (0 commit oltre main)"
      fi
    fi
  fi
}
trap cleanup_worktree EXIT

# Worktree isolato (run reale): claude -p e git girano qui, cosi' le modifiche
# non committate di altre sessioni nel checkout principale non finiscono mai
# nel commit/deploy dell'agente. I gitignored (.state, node_modules) arrivano
# via symlink: i tool li risolvono sul checkout principale.
if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$REPO_ROOT/sviluppo/.worktrees"
  git worktree add -b "$BRANCH" "$WORK_ROOT" main >>"$LOG" 2>&1 || die 0 "creazione worktree $WORK_ROOT fallita"
  WORK_CREATED=1
  # git traccia un file dentro .state/ (report_20260712.md): nel worktree esiste
  # gia' come directory reale, va sostituita col symlink (critical.css ecc.).
  rm -rf "$WORK_ROOT/sviluppo/seo-tools/.state"
  ln -s "$STATE_DIR" "$WORK_ROOT/sviluppo/seo-tools/.state"
  ln -s "$REPO_ROOT/node_modules" "$WORK_ROOT/node_modules"
  log "Worktree creato: $WORK_ROOT (branch $BRANCH)"
  # SOLO PER TEST: esce subito dopo worktree+symlink, il trap ripulisce tutto.
  if [ "${SEO_TEST_STOP_AFTER_WORKTREE:-}" = "1" ]; then log "TEST: stop dopo worktree"; exit 0; fi
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

# Backup di site/ ISOLATO (worktree nel run reale: il checkout principale puo'
# avere sporco di altre sessioni che non va nel riferimento pre-fix).
# seo_audit risolve ROOT da __file__: nel run reale usa la copia nel worktree
# per auditare lo stesso site/ isolato (output su .state condiviso via symlink).
SITE_ROOT="$REPO_ROOT"
AUDIT_PY="$SEO_DIR/seo_audit.py"
if [ -n "$WORK_CREATED" ]; then
  SITE_ROOT="$WORK_ROOT"
  AUDIT_PY="$WORK_ROOT/sviluppo/seo-tools/seo_audit.py"
fi
BACKUP="$STATE_DIR/site_backup_$DATESTAMP.tar.gz"
tar czf "$BACKUP" -C "$SITE_ROOT" site/ 2>/dev/null && log "Backup site/ creato ($(wc -c < "$BACKUP") bytes)"

log "Audit deterministico (seo_audit.py)..."
python3 "$AUDIT_PY" --json >/dev/null 2>>"$LOG"
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
    else:
        # 2026-09-27: applichiamo TUTTO il non-wontfix, niente report passivi:
        # la rete di sicurezza e' il re-audit di fase 3 + il branch conservato.
        tri["auto"].append(f)
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

# ── Selezione domande AEO da lavorare in fase 3 ──────────────────────────────
# Usa l'aeo_report.json della run PRECEDENTE: aeo_probe gira in FASE 6, cioe'
# dopo questa fase nello stesso run (primo run senza report = 0 domande).
AEO_SEL="$(python3 - "$STATE_DIR" "$DRY_RUN" "$MAX_AEO_FIXES" <<'PYAEOMARK'
import json, sys, datetime
state, dry, max_fixes = sys.argv[1], sys.argv[2], int(sys.argv[3])
try:
    rep = json.load(open(f"{state}/aeo_report.json"))
except Exception:
    rep = {}
today = datetime.date.today()
try:
    att = json.load(open(f"{state}/aeo_attempted.json"))
except Exception:
    att = {}
def recent(q):
    d = att.get(q)
    if not d:
        return False
    try:
        return (today - datetime.date.fromisoformat(d)).days < 28
    except Exception:
        return False
todo = []
for r in rep.get("results", []):
    q = (r.get("q") or "").strip()
    if not q or r.get("cited") or r.get("llm_cited"):
        continue   # gia' citata dagli assistenti: nessun lavoro
    if recent(q):
        continue   # tentata da meno di 28 giorni: non riprovare
    todo.append(q)
todo = todo[:max_fixes]
if dry != "1" and "SEO_TEST_FAKE_FIX" not in __import__("os").environ:
    for q in todo:
        att[q] = today.isoformat()
    json.dump(att, open(f"{state}/aeo_attempted.json", "w"), ensure_ascii=False, indent=1)
json.dump(todo, open(f"{state}/aeo_todo.json", "w"), ensure_ascii=False, indent=1)
print("AEO_TODO=%d" % len(todo))
PYAEOMARK
)"
read -r N_AEO <<EOF
$(echo "$AEO_SEL" | sed -n 's/^AEO_TODO=\([0-9]*\)$/\1/p')
EOF
N_AEO="${N_AEO:-0}"
# SOLO PER TEST: con FAKE_FIX nessuna domanda AEO (claude -p e' saltato)
[ -n "${SEO_TEST_FAKE_FIX:-}" ] && N_AEO=0
log "AEO: $N_AEO domande da lavorare (limite $MAX_AEO_FIXES)"

if [ "$N_AUTO" -eq 0 ] && [ "$N_PROPOSE" -eq 0 ] && [ "$N_AEO" -eq 0 ] && [ -z "${SEO_TEST_FAKE_FIX:-}" ]; then
  log "Nessun intervento necessario."
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] manderei Telegram: 'nessun intervento necessario, $STAMP_LINE' e farei l'ingest."
  else
    tg_send "📊 *Agente SEO — $DATESTAMP*: nessun intervento necessario. $STAMP_LINE."
    # Fase 5 (ingest a vuoto, per la cronologia della console)
    COMMIT=""; DEPLOYED=false; APPLIED_IDS=(); PROPOSED_IDS=()
    do_ingest
  fi
  send_weekly_summary
  log "=== FINE (run senza interventi) ==="
  exit 0
fi

# ── FASE 3: riparazione automatica (senza chiedere) ──────────────────────────
APPLIED_IDS=(); FAILED_IDS=(); PARTIAL_IDS=(); PROPOSED_IDS=(); COMMIT=""; DEPLOYED=false
HEALTH_AFTER="$HEALTH"
if [ "$N_AUTO" -gt 0 ] || [ "$N_AEO" -gt 0 ] || [ -n "${SEO_TEST_FAKE_FIX:-}" ]; then
  log "=== FASE 3: riparazione automatica ($N_AUTO finding AUTO, $N_AEO domande AEO) ==="
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] creerei branch $BRANCH e lancerei UNA chiamata: claude -p --model $MODEL_NAME (timeout ${CLAUDE_TIMEOUT_S}s) sui soli finding AUTO; poi re-audit di verifica, commit+merge+push+deploy se verificati."
  else
    # Tutte le operazioni site/git di questa fase girano nel worktree (gia' creato
    # in fase 0, branch $BRANCH gia' checked out): il checkout principale resta
    # intatto, le modifiche sporche di altre sessioni non vengono mai toccate.
    cd "$WORK_ROOT" || die 3 "accesso al worktree fallito"
    AUTO_JSON="$(python3 -c '
import json,sys
tri=json.load(open(sys.argv[1]+"/triage.json"))
keep=("id","title","severity","evidence","fix","files")
print(json.dumps([{k:f[k] for k in keep} for f in tri["auto"]], ensure_ascii=False, indent=1))' "$STATE_DIR")"
    AEO_JSON="$(python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1]+"/aeo_todo.json")), ensure_ascii=False, indent=1))' "$STATE_DIR" 2>/dev/null || echo "[]")"
    PROMPT="$(cat <<PROMPT_END
Sei l'agente di riparazione SEO del sito AdOff (statico in site/, 15 lingue, servito su adoff.app).
La lista qui sotto contiene SOLO finding gia' accertati da una suite di audit deterministica: non devi valutare o decidere, devi RIPARARE.

FINDING DA RIPARARE (JSON: id, title, severity, evidence, fix, files):
$AUTO_JSON

DOMANDE AEO (JSON, puo' essere vuota — una query per elemento):
$AEO_JSON
Per ciascuna query: aggiungi una Q&A alla pagina ESISTENTE piu' pertinente nella lingua della query (site/ oppure site/<lang>/). Domanda quasi alla lettera; prima frase = risposta diretta che nomina AdOff; 40-80 parole. Va inserita SIA nel blocco FAQ visibile SIA nel JSON-LD FAQPage (aggiungilo se manca: vedi pattern di site/undetectable-ad-blocker.html). SOLO fatti gia' presenti su quella pagina o in site/llms-full.txt; AdOff e' gratis al 100% e non richiede account; nessun claim su competitor; MAI creare pagine nuove; se nessuna pagina e' pertinente, salta la query.

REGOLE TASSATIVE:
1. Lavora SOLO dentro site/. Mai in app/, app-firefox/, app-safari/ o in qualunque altra directory.
2. Vincoli i18n (hanno gia' causato rotture reali): adoff-i18n.js sovrascrive gli elementi [data-i18n] via textContent, quindi la fonte di verita' e' il dizionario site/i18n/<lang>.json — correggi dizionario e HTML INSIEME, per tutte le lingue toccate; un elemento che contiene markup (<a>, <code>, ...) deve usare data-i18n-html e il dizionario deve contenere lo stesso markup in tutte le lingue; NON rinominare MAI una chiave i18n (rinominare una chiave ha rotto il binding in tutte e 15 le lingue).
3. Ogni fix deve far sparire il finding corrispondente: segui il campo "fix" di ciascun id. Nessun refactoring extra, nessun intervento non richiesto.
4. NON fare deploy, NON fare push, NON fare commit: li faccio io dopo la verifica.
5. Se un finding non e' riparabile in modo sicuro, lascialo stare e passa oltre.
Rispondi solo con un breve elenco (un rigo per finding) di cosa hai corretto.
PROMPT_END
)"
    # SOLO PER TEST: SEO_TEST_FAKE_FIX=<path relativo sotto site/> salta claude -p
    # e appone una riga di commento al file, simulando un fix dell'agente. Il
    # flusso segue poi normalmente (re-audit, commit, merge, deploy, Telegram).
    if [ -n "${SEO_TEST_FAKE_FIX:-}" ]; then
      log "TEST: fake fix su site/$SEO_TEST_FAKE_FIX (claude -p saltato)"
      printf '<!-- seo-pipeline-test %s -->\n' "$TS" >> "$WORK_ROOT/site/$SEO_TEST_FAKE_FIX"
      CLAUDE_RC=0
    else
    log "Lancio claude -p ($MODEL_USED, timeout ${CLAUDE_TIMEOUT_S}s, cwd=$WORK_ROOT)..."
    (cd "$WORK_ROOT" && env "${CLAUDE_ENV[@]}" timeout "$CLAUDE_TIMEOUT_S" "$CLAUDE_BIN" -p "$PROMPT" \
      --model "$MODEL_NAME" --permission-mode acceptEdits --add-dir "$WORK_ROOT" >>"$LOG" 2>&1)
    CLAUDE_RC=$?
    fi
    log "claude -p terminato (exit $CLAUDE_RC)"

    # Verifica: re-audit; i finding AUTO ancora presenti = FALLITI (non risolti).
    log "Re-audit di verifica..."
    python3 "$WORK_ROOT/sviluppo/seo-tools/seo_audit.py" --json >/dev/null 2>>"$LOG"
    if [ -s "$AUDIT" ]; then
      python3 - "$STATE_DIR" "$HEALTH" <<'PY' >>"$LOG" 2>&1
import json, sys
state, health_before = sys.argv[1], int(sys.argv[2])
tri = json.load(open(f"{state}/triage.json"))
audit = json.load(open(f"{state}/audit_findings.json"))
# L'id e' sha1(area|title|primo_file): un fix PARZIALE cambia il file peggiore e
# quindi l'id, e sembrerebbe risolto. L'identita' stabile e' (area, title).
def key(f):
    return (f["area"], f["title"])
now = {key(f): f for f in audit["findings"]}
applied, failed, partial = [], [], []
for f in tri["auto"]:
    cur = now.get(key(f))
    if cur is None:
        applied.append(f["id"])
    else:
        failed.append(f["id"])
        if cur["evidence"] != f["evidence"]:
            partial.append(f["id"])
pre_high = {key(f) for f in tri["auto"] + tri["propose"] if f["severity"] == "high"}
new_high = [key(f) for f in audit["findings"] if f["severity"] == "high" and key(f) not in pre_high]
health_after = audit["metrics"]["health_score"]
# Si pubblica se il sito non e' peggiorato: il fix parziale e' comunque valore,
# ma resta contato come NON risolto (la console admin non deve mentire).
publish_ok = health_after >= health_before and not new_high
json.dump({"applied": applied, "failed": failed, "partial": partial,
           "publish_ok": publish_ok}, open(f"{state}/verify.json", "w"), indent=1)
print("VERIFICA: risolti=%d non_risolti=%d (parziali=%d) nuovi_high=%d publish_ok=%s" % (
    len(applied), len(failed), len(partial), len(new_high), publish_ok))
PY
      mapfile -t APPLIED_IDS < <(python3 -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1]+"/verify.json"))["applied"]))' "$STATE_DIR" | grep . )
      mapfile -t FAILED_IDS  < <(python3 -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1]+"/verify.json"))["failed"]))'  "$STATE_DIR" | grep . )
      mapfile -t PARTIAL_IDS < <(python3 -c 'import json,sys;print("\n".join(json.load(open(sys.argv[1]+"/verify.json")).get("partial",[])))' "$STATE_DIR" | grep . )
      PUBLISH_OK="$(python3 -c 'import json,sys;print(1 if json.load(open(sys.argv[1]+"/verify.json")).get("publish_ok") else 0)' "$STATE_DIR")"
      HEALTH_AFTER="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["metrics"]["health_score"])' "$AUDIT")"
    else
      FAILED_IDS=($(python3 -c 'import json,sys;print(" ".join(f["id"] for f in json.load(open(sys.argv[1]+"/triage.json"))["auto"]))' "$STATE_DIR"))
      HEALTH_AFTER="$HEALTH"
      PARTIAL_IDS=(); PUBLISH_OK=0
      log "WARNING: re-audit non disponibile: nessun fix considerato verificato."
    fi
    # Pagine AEO toccate dal run: file site/*.html modificati (sul branch, prima
    # del commit; tra qui e git add site/ nessun passo tocca site/)
    AEO_PAGES="$(git status --porcelain site/ | grep -c '\.html$' || true)"
    AEO_PAGES="${AEO_PAGES:-0}"
    log "Verifica: risolti=${#APPLIED_IDS[@]} non risolti=${#FAILED_IDS[@]} (parziali=${#PARTIAL_IDS[@]}) health $HEALTH -> $HEALTH_AFTER, publish_ok=$PUBLISH_OK, AEO=$N_AEO domande / $AEO_PAGES pagine FAQ"

    # Il lavoro va committato sul branch in ogni caso: cosi' il working tree resta
    # pulito anche quando non si pubblica, e il branch resta ispezionabile.
    HAS_WORK=0
    if [ -n "$(git status --porcelain site/)" ]; then
      git add site/ || die 3 "git add site/ fallito"
      AEO_TAG=""; if [ "$N_AEO" -gt 0 ]; then AEO_TAG=", AEO: $N_AEO domande, FAQ su $AEO_PAGES pagine"; fi
      git commit -q -m "fix(seo): auto-fix agente $DATESTAMP (${#APPLIED_IDS[@]} risolti, ${#PARTIAL_IDS[@]} parziali, health $HEALTH->$HEALTH_AFTER$AEO_TAG)" \
        || die 3 "commit fallito"
      HAS_WORK=1
    else
      log "claude -p non ha modificato nulla in site/."
    fi

    if [ "$HAS_WORK" -eq 0 ] || [ "$PUBLISH_OK" != "1" ]; then
      KEEP_BRANCH=1
      log "Non pubblico (lavoro=$HAS_WORK publish_ok=$PUBLISH_OK): branch $BRANCH conservato per ispezione."
      if [ "$HAS_WORK" -eq 1 ]; then
        tg_send "⚠️ Agente SEO — fase 3: fix NON pubblicati (health $HEALTH->$HEALTH_AFTER, ${#FAILED_IDS[@]} non risolti). Branch $BRANCH conservato, serve ispezione manuale."
      fi
    else
      # Merge nel checkout principale (ff-only: se main e' avanzato o un file
      # sporco sovrapposto blocca, branch conservato e NESSUN deploy).
      if git -C "$REPO_ROOT" merge --ff-only "$BRANCH" >>"$LOG" 2>&1; then
        COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
        KEEP_BRANCH=0
        log "Merge ff su main OK ($COMMIT) — push su origin/main saltato: origin/main e' uno snapshot pubblico sanificato scollegato dalla storia locale, non un mirror continuo (vedi remediation sicurezza 2026-09-12)."
      else
        KEEP_BRANCH=1
        MERGE_ERR="$(git -C "$REPO_ROOT" merge --ff-only "$BRANCH" 2>&1 | head -3 | tr '\n' ' ')"
        log "Merge ff-only di $BRANCH fallito: $MERGE_ERR — branch conservato, NESSUN deploy."
        tg_send "⚠️ Agente SEO — fase 3: merge di $BRANCH su main fallito ($MERGE_ERR). Fix sul branch, NESSUN deploy. Serve intervento manuale."
        die 3 "merge ff-only fallito (branch conservato, deploy saltato)"
      fi
      log "Deploy del sito (dal worktree: stato committato, non il checkout principale)..."
      export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:-}" CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-3e114c0bdfe0d194745de3f2de4d6f7d}"
      # Deploy centralizzato via deploy-site.sh (gate i18n + leak + staging dir
      # con functions/ compilata da wrangler). Timeout esteso: lo script include
      # i gate pre-deploy oltre al deploy stesso. Girando nel worktree, usa i
      # SOLO file committati sul branch, ignora lo sporco del checkout principale.
      mkdir -p "$WORK_ROOT/sviluppo/seo-tools/.state" && cp -f "$STATE_DIR/critical.css" "$WORK_ROOT/sviluppo/seo-tools/.state/critical.css"   # .state e' gitignorato: manca nel worktree
      if timeout "$DEPLOY_TIMEOUT_S" bash "$WORK_ROOT/sviluppo/scripts/deploy-site.sh" >>"$LOG" 2>&1; then
        DEPLOYED=true
        log "Deploy OK (fix AUTO live su adoff.app)"
      else
        log "WARNING: deploy fallito (fix mergiati su main ma non online); run prosegue."
        tg_send "⚠️ Agente SEO — fase 3: deploy fallito dopo il merge di $BRANCH ($COMMIT). Fix su main ma NON online."
      fi
      # Branch mergiato: lo cancella il trap EXIT, DOPO la rimozione del worktree
      # (branch -d qui fallirebbe: il branch e' ancora checked out nel worktree).
    fi
    cd "$REPO_ROOT" || exit 1
  fi
fi

# ── Esito fase 3: notifica Telegram (anche se non pubblicato, se c'era lavoro) ─
if [ "${HAS_WORK:-0}" -eq 1 ] || [ "${N_AEO:-0}" -gt 0 ]; then
  RESULT_MSG="$(python3 - "$STATE_DIR" "$HEALTH" "${HEALTH_AFTER:-$HEALTH}" "${#APPLIED_IDS[@]}" "${#FAILED_IDS[@]}" "${#PARTIAL_IDS[@]}" "$N_AEO" "$DEPLOYED" "${AEO_PAGES:-0}" <<'PYRESULT'
import json, sys
state, hb, ha, na, nf, npar, naeo, deployed, naeo_pages = sys.argv[1:10]
tri = json.load(open(f"{state}/triage.json"))
byid = {f["id"]: f for f in tri["auto"]}
def short(ids):
    return ["%s %s" % (i[:8], byid.get(i, {}).get("title", "?")[:60]) for i in ids]
try:
    v = json.load(open(f"{state}/verify.json"))
    applied, failed = v.get("applied", []), v.get("failed", [])
except Exception:
    applied, failed = [], []
lines = ["🔧 *Agente SEO — esito fix automatici*"]
_aeo_txt = f" | AEO: {naeo} domande, FAQ su {naeo_pages} pagine" if int(naeo) else ""
lines.append(f"Health: *{hb}/100* → *{ha}/100* | deploy: {deployed} | domande AEO lavorate: {naeo}{_aeo_txt}")
if int(na):
    lines.append("✅ Risolti:")
    lines += ["  • " + x for x in short(applied)]
if int(nf):
    lines.append("❌ Non risolti (branch conservato se non pubblicato):")
    lines += ["  • " + x for x in short(failed)]
print("\n".join(lines))
PYRESULT
)"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[DRY-RUN] manderei l'esito fase 3 su Telegram:"
    echo "$RESULT_MSG" | tee -a "$LOG"
  else
    tg_send "$RESULT_MSG"
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
# ── FASE 5b: analisi completa del sito con la skill hulk-seo (sola lettura) ───
# plan mode = nessuna modifica ai file; il report va in .state/hulk_seo_report.md
if [ "$DRY_RUN" -eq 1 ]; then
  log "[DRY-RUN] lancerei claude -p con la skill hulk-seo su tutto site/ (plan mode, report in .state/hulk_seo_report.md)."
else
  log "Fase 5b: analisi hulk-seo dell'intero sito (timeout ${CLAUDE_TIMEOUT_S}s)..."
  (cd "$REPO_ROOT" && env "${CLAUDE_ENV[@]}" timeout "$CLAUDE_TIMEOUT_S" "$CLAUDE_BIN" -p \
    "Usa la skill hulk-seo per analizzare TUTTO il sito in site/ (tecnico, schema/JSON-LD, AI/AEO/GEO, architettura, contenuti, i18n, hreflang). Dati reali: $STATE_DIR/audit_findings.json, gsc_snapshot.json, keyword_report.json. Non modificare nulla. Output: report in italiano, problemi ordinati per impatto, ciascuno con file e fix concreto." \
    --model "$MODEL_NAME" --permission-mode plan --add-dir "$REPO_ROOT" >"$STATE_DIR/hulk_seo_report.md" 2>>"$LOG") \
    && log "Report hulk-seo: $STATE_DIR/hulk_seo_report.md" \
    || log "WARNING: analisi hulk-seo fallita o in timeout"
fi

# ── FASE 6: riepilogo AEO/keyword (sempre, anche dry-run) ────────────────────
send_weekly_summary

log "=== FINE — run completato (dry_run=$DRY_RUN, model=$MODEL_USED, health $HEALTH${HEALTH_AFTER:+->$HEALTH_AFTER}) ==="
exit 0
