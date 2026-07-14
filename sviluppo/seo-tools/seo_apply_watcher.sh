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

PROJECT_ROOT="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin"
SEO_DIR="$PROJECT_ROOT/sviluppo/seo-tools"
STATE_DIR="$SEO_DIR/.state"
LOG_DIR="$PROJECT_ROOT/sviluppo/logs"
SECRETS="/home/mrxxx/.secrets/adoff-stores.env"
TG_THREAD_SEO=44
CLAUDE_BIN="/home/mrxxx/.local/bin/claude"
LOG="$LOG_DIR/seo_watcher_$(date +%Y%m%d).log"
mkdir -p "$STATE_DIR" "$LOG_DIR"

log() { echo "[$(date +%H:%M:%S)] $*" >> "$LOG"; }

# shellcheck disable=SC1090
source "$SECRETS" 2>/dev/null || exit 1
source /home/mrxxx/.secrets/adoff-telegram.env 2>/dev/null  # TELEGRAM_BOT_TOKEN + CHAT_ID
ADMIN_TOKEN="$(grep '^export ADMIN_TOKEN=' "$SECRETS" | sed 's/export ADMIN_TOKEN=//; s/"//g')"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT="${TELEGRAM_CHAT_ID:-}"

tg_send() {
  [ -z "$TG_TOKEN" ] && return
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'chat_id':'${TG_CHAT}','message_thread_id':${TG_THREAD_SEO},'text':sys.argv[1],'parse_mode':'Markdown','disable_web_page_preview':True}))" "$1")" \
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
if [ -z "$PENDING_DATE" ]; then
  log "Nessuna proposta in staging, ignoro."
  tg_send "ℹ️ Non c'è una proposta SEO in attesa. (Il prossimo report arriva domenica.)"
  exit 0
fi

REPLY_LC="$(echo "$REPLY" | tr '[:upper:]' '[:lower:]' | xargs)"

clear_pending() { rm -f "$STATE_DIR/pending_date.txt" "$STATE_DIR/pending_backup.txt"; }

deploy_site() {
  cd "$PROJECT_ROOT" || return 1
  export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:-}" CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:-3e114c0bdfe0d194745de3f2de4d6f7d}"
  timeout 120 npx --yes wrangler pages deploy site/ --project-name adoff-site --commit-dirty=true >> "$LOG" 2>&1
}

case "$REPLY_LC" in
  ok|approva|pubblica|si|sì|"approva ok"|publish|deploy)
    log "APPROVATO → deploy"
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
