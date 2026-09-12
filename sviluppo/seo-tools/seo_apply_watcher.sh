#!/usr/bin/env bash
# =============================================================================
# AdOff — Watcher approvazione SEO (Componente B)
#
# Gira ogni ~15 min (cron). Legge l'ultima risposta nel topic Telegram SEO
# (consumata da /admin/seo-reply) e, se c'è una proposta in staging:
#   - "ok / approva / pubblica / si"  → DEPLOY del sito + notifica
#   - "annulla / scarta / no"         → ripristina il backup + notifica
#   - altro testo (feedback)          → claude -p rielabora secondo il feedback e ripropone
#
# Lancio manuale: bash seo_apply_watcher.sh
# =============================================================================
set -uo pipefail

PROJECT_ROOT="/mnt/nvme2/projects/Progetti/ChromePlugin"
SEO_DIR="$PROJECT_ROOT/sviluppo/seo-tools"
STATE_DIR="$SEO_DIR/.state"
LOG_DIR="$PROJECT_ROOT/sviluppo/logs"
SECRET_BIN="/home/mrxxx/.local/bin/secret"
TG_THREAD_SEO=44
CLAUDE_BIN="/home/mrxxx/.local/bin/claude"
LOG="$LOG_DIR/seo_watcher_$(date +%Y%m%d).log"
mkdir -p "$STATE_DIR" "$LOG_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }

# shellcheck disable=SC1090
set -a; source "$("$SECRET_BIN" file adoff-stores)" 2>/dev/null || exit 1; set +a
ADMIN_TOKEN="$("$SECRET_BIN" get adoff-stores.ADMIN_TOKEN)"

# Alert via POST /admin/notify del worker (che conosce gia' il gruppo admin):
# l'id di gruppo e il token bot restano secret del worker, non duplicati qui.
tg_send() {
  curl -s -X POST "https://api.adoff.app/admin/notify" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'text':sys.argv[1],'thread_id':${TG_THREAD_SEO}}))" "$1")" \
    >/dev/null 2>&1
}

# --- 1) Consuma l'ultima risposta ---
REPLY_JSON="$(curl -s "https://api.adoff.app/admin/seo-reply" -H "X-Admin-Token: $ADMIN_TOKEN" 2>/dev/null)"
REPLY="$(echo "$REPLY_JSON" | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('reply');print(r['text'] if r else '')" 2>/dev/null)"
[ -z "$REPLY" ] && exit 0   # nessuna risposta nuova

log "Risposta ricevuta: $REPLY"

# --- 2) C'è una proposta in staging? ---
PENDING_DATE="$(cat "$STATE_DIR/pending_date.txt" 2>/dev/null)"
PENDING_BACKUP="$(cat "$STATE_DIR/pending_backup.txt" 2>/dev/null)"
PENDING_BRANCH="$(cat "$STATE_DIR/pending_branch.txt" 2>/dev/null)"
if [ -z "$PENDING_DATE" ]; then
  log "Nessuna proposta in staging, ignoro."
  tg_send "ℹ️ Non c'è una proposta SEO in attesa. (Il prossimo report arriva domenica.)"
  exit 0
fi

REPLY_LC="$(echo "$REPLY" | tr '[:upper:]' '[:lower:]' | xargs)"

clear_pending() { rm -f "$STATE_DIR/pending_date.txt" "$STATE_DIR/pending_backup.txt" "$STATE_DIR/pending_branch.txt"; }

deploy_site() {
  cd "$PROJECT_ROOT" || return 1
  export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:-}" CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-3e114c0bdfe0d194745de3f2de4d6f7d}"
  timeout 120 npx --yes wrangler pages deploy site/ --project-name adoff-site --commit-dirty=true >> "$LOG" 2>&1
}

case "$REPLY_LC" in
  ok|approva|pubblica|si|sì|"approva ok"|publish|deploy)
    log "APPROVATO → merge branch + deploy"
    # Merge del branch proposto su main PRIMA del deploy: se il merge fallisce
    # non pubblico nulla (i file di lavoro sono sul branch, main resta coerente).
    if [ -n "$PENDING_BRANCH" ]; then
      if git -C "$PROJECT_ROOT" checkout main && git -C "$PROJECT_ROOT" merge --no-edit "$PENDING_BRANCH" \
         && git -C "$PROJECT_ROOT" push origin main \
         && git -C "$PROJECT_ROOT" branch -d "$PENDING_BRANCH"; then
        log "Merge $PENDING_BRANCH su main OK"
      else
        log "ERRORE: merge/push di $PENDING_BRANCH fallito, deploy annullato."
        tg_send "⚠️ Merge git di $PENDING_BRANCH fallito: deploy ANNULLATO, modifiche restano sul branch. Controlla i log."
        exit 1
      fi
    fi
    tg_send "🚀 Approvato. Pubblico le migliorie SEO sul sito..."
    if deploy_site; then
      tg_send "✅ *Pubblicato!* Le migliorie SEO/AEO del $PENDING_DATE sono live su adoff.app. I motori e le AI bot le vedranno alla prossima scansione."
      log "Deploy OK"
    else
      tg_send "⚠️ Deploy fallito. Controlla i log: \`sviluppo/logs/seo_watcher_$(date +%Y%m%d).log\`. Le modifiche restano in staging."
      log "Deploy FALLITO"
      exit 1
    fi
    clear_pending
    ;;
  annulla|scarta|no|reject|rifiuta|cancella)
    log "RIFIUTATO → ripristino backup"
    if [ -n "$PENDING_BACKUP" ] && [ -f "$PENDING_BACKUP" ]; then
      cd "$PROJECT_ROOT" && rm -rf site.bak && mv site site.bak && tar xzf "$PENDING_BACKUP" && rm -rf site.bak
      tg_send "↩️ Proposta scartata. Ripristinato lo stato precedente di site/. Nessuna modifica pubblicata."
    else
      tg_send "↩️ Proposta scartata (backup non trovato, ma nulla è stato pubblicato)."
    fi
    # Pulizia git: il backup tar e' il vero rollback dei file, il branch si butta.
    if [ -n "$PENDING_BRANCH" ]; then
      git -C "$PROJECT_ROOT" checkout main && git -C "$PROJECT_ROOT" branch -D "$PENDING_BRANCH" && log "Branch $PENDING_BRANCH eliminato"
    fi
    clear_pending
    ;;
  *)
    # Feedback → rielabora
    log "FEEDBACK → rielaboro con claude -p"
    tg_send "🔧 Ricevuto. Rielaboro la proposta secondo le tue indicazioni, un momento..."
    cd "$PROJECT_ROOT" || exit 1
    FB_PROMPT="Sei l'agente SEO di AdOff. C'è una proposta di modifiche SEO/AEO già applicata in staging dentro site/ (data $PENDING_DATE). L'utente ha chiesto di MIGLIORARLA con questo feedback:

\"$REPLY\"

Applica le modifiche richieste dentro site/ (solo site/, mai app/). Delega la generazione di testo ai modelli locali (policy LOCAL-LLM). NON fare deploy. Aggiorna il report in sviluppo/seo-tools/.state/report_$PENDING_DATE.md riassumendo cosa hai cambiato secondo il feedback (max 20 righe, in italiano)."
    echo "$FB_PROMPT" | "$CLAUDE_BIN" -p --permission-mode acceptEdits --add-dir "$PROJECT_ROOT" >> "$LOG" 2>&1
    REPORT_TXT="$(head -30 "$STATE_DIR/report_$PENDING_DATE.md" 2>/dev/null)"
    tg_send "🔁 *Proposta aggiornata — $PENDING_DATE*

$REPORT_TXT

➡️ Rispondi *OK* per pubblicare, o dai altre indicazioni."
    ;;
esac
log "fine"
