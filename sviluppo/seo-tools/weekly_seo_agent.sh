#!/usr/bin/env bash
# =============================================================================
# AdOff — Agente SEO/AEO settimanale (Componente A: analisi + proposta)
#
# Flusso:
#   1. Forza un sync GSC fresco e scarica lo snapshot
#   2. claude -p fa la REGIA: legge i dati, decide gli interventi SEO + AEO
#      (ottimizzazione per AI search bot), li APPLICA in un branch git del sito,
#      committa (NON deploya) e scrive un report
#   3. Posta il report nel topic Telegram "SEO / AI Search" (thread 44) chiedendo
#      approvazione. Il deploy avviene solo dopo "OK" (gestito da seo_apply_watcher.sh)
#
# Modello: IBRIDO — la generazione di contenuti/markdown è delegata ai modelli
# locali (qwen3-coder / gemma via la policy LOCAL-LLM del CLAUDE.md), la regia e
# l'applicazione sicura le fa Claude.
#
# Schedulato: domenica 08:00 (vedi crontab). Lancio manuale: bash weekly_seo_agent.sh [--dry-run]
# =============================================================================
set -uo pipefail

PROJECT_ROOT="/home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin"
SEO_DIR="$PROJECT_ROOT/sviluppo/seo-tools"
STATE_DIR="$SEO_DIR/.state"
LOG_DIR="$PROJECT_ROOT/sviluppo/logs"
SECRETS="/home/mrxxx/.secrets/adoff-stores.env"
TG_THREAD_SEO=44
CLAUDE_BIN="/home/mrxxx/.local/bin/claude"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

mkdir -p "$STATE_DIR" "$LOG_DIR"
TS="$(date +%Y%m%d_%H%M)"
DATESTAMP="$(date +%Y%m%d)"
BRANCH="seo/auto-$DATESTAMP"
LOG="$LOG_DIR/seo_weekly_$TS.log"
REPORT="$STATE_DIR/report_$DATESTAMP.md"
SNAPSHOT="$STATE_DIR/gsc_snapshot.json"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# --- secrets ---
# shellcheck disable=SC1090
source "$SECRETS" 2>/dev/null || { log "ERRORE: secrets non trovati"; exit 1; }
source /home/mrxxx/.secrets/adoff-telegram.env 2>/dev/null  # TELEGRAM_BOT_TOKEN + CHAT_ID
ADMIN_TOKEN="$(grep '^export ADMIN_TOKEN=' "$SECRETS" | sed 's/export ADMIN_TOKEN=//; s/"//g')"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT="${TELEGRAM_CHAT_ID:-}"

tg_send() {
  local text="$1"
  [ -z "$TG_TOKEN" ] && { log "Telegram non configurato, skip"; return; }
  curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'chat_id':'${TG_CHAT}','message_thread_id':${TG_THREAD_SEO},'text':sys.argv[1],'parse_mode':'Markdown','disable_web_page_preview':True}))" "$text")" \
    >/dev/null 2>&1
}

log "=== AGENTE SEO SETTIMANALE — $TS (dry_run=$DRY_RUN) ==="

# --- 1) Sync + snapshot GSC ---
log "Sync GSC..."
curl -s -X POST "https://api.adoff.app/admin/gsc/sync" -H "X-Admin-Token: $ADMIN_TOKEN" >/dev/null 2>&1
curl -s "https://api.adoff.app/admin/gsc" -H "X-Admin-Token: $ADMIN_TOKEN" > "$SNAPSHOT" 2>/dev/null
if ! python3 -c "import json;d=json.load(open('$SNAPSHOT'));assert d.get('snapshot')" 2>/dev/null; then
  log "ERRORE: snapshot GSC non disponibile"; tg_send "⚠️ Agente SEO: snapshot GSC non disponibile, salto questa settimana."; exit 1
fi
log "Snapshot OK ($(wc -c < "$SNAPSHOT") bytes)"

# --- 1b) Keyword research + trend (Google Autocomplete, multilingua) ---
log "Keyword research settimanale..."
if timeout 180 python3 "$SEO_DIR/keyword_research.py" >> "$LOG" 2>&1; then
  log "Keyword research OK ($(grep -c '^- ' "$STATE_DIR/keyword_report.md" 2>/dev/null) voci)"
else
  log "Keyword research fallita (proseguo con i soli dati GSC)"
fi

# --- 2) Backup di site/ (rollback sicuro, niente git sulla Dropbox) ---
cd "$PROJECT_ROOT" || exit 1
BACKUP="$STATE_DIR/site_backup_$DATESTAMP.tar.gz"
tar czf "$BACKUP" site/ 2>/dev/null && log "Backup site/ creato ($(wc -c < "$BACKUP") bytes)"
echo "$BACKUP" > "$STATE_DIR/pending_backup.txt"

PROMPT="$(cat <<'PROMPT_END'
Sei l'agente SEO/AEO settimanale di AdOff (estensione ad-blocker, sito statico in site/ servito su Cloudflare Pages = adoff.app, 15 lingue).

OBIETTIVO: rendere il sito massimamente indicizzabile e CITABILE dai motori di ricerca tradizionali E dalle AI search bot (ChatGPT/Perplexity/Google AI Overviews/Claude) — AEO/GEO. Le AI sono il futuro del traffico.

DATI REALI Google Search Console (ultimi 28g) in sviluppo/seo-tools/.state/gsc_snapshot.json: leggilo. Contiene totals, topQuery, topPage, topCountry, opportunities (query in pos 5-20 da spingere), trend.

KEYWORD RESEARCH SETTIMANALE in sviluppo/seo-tools/.state/keyword_report.md (+ .json): leggilo. Contiene le keyword reali "del momento" da Google Autocomplete in 10 lingue, le keyword GAP (cercate dagli utenti ma su cui il sito NON appare → priorità per nuovo contenuto / sezioni / FAQ) e le keyword DA SPINGERE. USA queste keyword: integra le GAP ad alto valore nei title/heading/FAQ/contenuto delle pagine pertinenti (in modo naturale, mai keyword stuffing), dando priorità a quelle coerenti col prodotto (ad blocker stealth/invisibile, privacy, video). Allinea il contenuto ai trend di ricerca correnti.

REGOLE OPERATIVE (TASSATIVE):
- Lavora SOLO dentro site/. NON toccare app/ app-firefox/ app-safari/ (estensione).
- Rispetta la pipeline: data/constants.json è SSoT dei numeri; se modifichi homepage rigenera con gen-lang-homepages.py. Leggi site/ prima di editare.
- Per GENERARE testo/contenuti (FAQ, descrizioni, traduzioni) DELEGA ai modelli locali (policy LOCAL-LLM del CLAUDE.md: code_local/chat_local) per risparmiare. La REGIA e l'applicazione le fai tu.
- NON fare deploy, NON push. Solo modifiche + git commit nel branch corrente.
- Massimo ~6 interventi ad alto impatto, non stravolgere il sito.

INTERVENTI PRIORITARI da valutare in base ai dati:
1. AEO/AI bot: aggiungi/migliora JSON-LD schema.org (Organization, SoftwareApplication con aggregateRating SOLO se reale, FAQPage, BreadcrumbList). Crea/aggiorna site/llms.txt (standard per AI crawler) e verifica robots.txt non blocchi GPTBot/PerplexityBot/ClaudeBot/Google-Extended.
2. CTR: per le pagine con molte impression ma CTR basso (vedi snapshot), riscrivi title e meta description più cliccabili (testo generato dai modelli locali).
3. Opportunità: per le query in pos 5-20 rafforza il contenuto on-page pertinente (heading, paragrafi che rispondono alla query in formato Q&A — ottimo per AEO).
4. Igiene tecnica: canonical corretti, hreflang per le 15 lingue, fix eventuale duplicazione ?lang=xx vs /xx/, redirect http→https.
5. Contenuto citabile: paragrafi di definizione chiari e autosufficienti (le AI citano risposte concise e fattuali).

Alla fine SCRIVI un report conciso in italiano nel file sviluppo/seo-tools/.state/report_DATESTAMP.md con: cosa hai cambiato (elenco puntato per file), perché (collegato ai dati), e impatto atteso. Sii sintetico (max ~25 righe).
PROMPT_END
)"
PROMPT="${PROMPT//DATESTAMP/$DATESTAMP}"

if [ "$DRY_RUN" -eq 1 ]; then
  log "[DRY-RUN] salterei claude -p. Prompt pronto ($(echo "$PROMPT" | wc -l) righe)."
  echo "# DRY RUN report $DATESTAMP" > "$REPORT"
  echo "Snapshot GSC scaricato. claude -p non eseguito (dry-run)." >> "$REPORT"
else
  log "Lancio claude -p (regia + applicazione)..."
  cd "$PROJECT_ROOT" || exit 1
  echo "$PROMPT" | "$CLAUDE_BIN" -p --permission-mode acceptEdits --add-dir "$PROJECT_ROOT" >> "$LOG" 2>&1
  log "claude -p terminato (exit $?)"
fi

# --- 3) Calcola modifiche (diff vs backup) + proposta su Telegram ---
cd "$PROJECT_ROOT" || exit 1
TMP_OLD="$(mktemp -d)"
tar xzf "$BACKUP" -C "$TMP_OLD" 2>/dev/null
FILES="$(diff -rq "$TMP_OLD/site" "$PROJECT_ROOT/site" 2>/dev/null | sed "s#$TMP_OLD/site/##; s#$PROJECT_ROOT/site/##" | head -20)"
CHANGED="$(echo "$FILES" | grep -c . )"
rm -rf "$TMP_OLD"

if [ "$CHANGED" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
  log "Nessuna modifica proposta questa settimana."
  rm -f "$STATE_DIR/pending_branch.txt" "$STATE_DIR/pending_backup.txt"
  tg_send "📊 *Agente SEO settimanale* — nessun intervento necessario questa settimana. I dati GSC sono stabili."
  exit 0
fi

if [ "$DRY_RUN" -eq 0 ]; then
  echo "$DATESTAMP" > "$STATE_DIR/pending_date.txt"
fi

REPORT_TXT="$(cat "$REPORT" 2>/dev/null | head -40)"
[ -z "$REPORT_TXT" ] && REPORT_TXT="(report non generato)"

MSG="🔍 *Proposta SEO/AEO settimanale — $DATESTAMP*

$REPORT_TXT

📁 *File modificati in site/:*
\`\`\`
$FILES
\`\`\`

Modifiche in staging (non ancora pubblicate, backup salvato).

➡️ Rispondi *OK* per pubblicare sul sito, oppure scrivi cosa migliorare."

if [ "$DRY_RUN" -eq 1 ]; then
  log "[DRY-RUN] messaggio Telegram NON inviato. Anteprima:"
  echo "$MSG" | tee -a "$LOG"
else
  log "Invio proposta su Telegram (thread $TG_THREAD_SEO)..."
  tg_send "$MSG"
fi
log "=== FINE — proposta inviata, in attesa di approvazione ==="
