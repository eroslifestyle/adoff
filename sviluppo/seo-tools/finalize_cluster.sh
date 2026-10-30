#!/usr/bin/env bash
# finalize_cluster.sh — attende la fine di translate_cluster.py, ritenta i falliti,
# bake, sitemap, commit (NO push), deploy condizionato, verifica live.
# Idempotente: rilanciarlo non rompe nulla (resume + git idempotenti).
set -u

ROOT="/mnt/nvme2/projects/Progetti/ChromePlugin"
CLUSTER_DIR="$ROOT/sviluppo/seo-tools/streaming-cluster"
CONTENT_DIR="$CLUSTER_DIR/content"
LOG="$CLUSTER_DIR/finalize.log"
LANGS="de,es,fr,pt,ru,ja,zh,ko,tr,pl,id,ar,hi"
TRANSLATE="python3 $ROOT/sviluppo/seo-tools/translate_cluster.py --langs $LANGS"
BAKE="python3 $ROOT/sviluppo/seo-tools/bake_streaming_cluster.py"
SITEMAP="python3 $ROOT/sviluppo/scripts/audit/gen_sitemap.py"
POLL_INTERVAL=120
MAX_WAIT_SECONDS=$((20*3600))
MAX_RETRY_PASSES=2

cd "$ROOT" || { echo "cd fallito" >&2; exit 1; }
mkdir -p "$CLUSTER_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# ---------- 1. Attesa termine translate_cluster.py ----------
log "=== INIZIO finalize_cluster ==="
waited=0
while pgrep -f "translate_cluster.py" > /dev/null 2>&1; do
    if [ "$waited" -ge "$MAX_WAIT_SECONDS" ]; then
        log "ERRORE: translate_cluster.py ancora attivo dopo 20 ore ($MAX_WAIT_SECONDS s). Esco senza fare nulla."
        exit 1
    fi
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
done
log "translate_cluster.py terminato (atteso ${waited}s)."

# ---------- 2. Retry dei falliti ----------
declare -a RETRY_LOG=()
for pass in $(seq 1 "$MAX_RETRY_PASSES"); do
    before=$(find "$CONTENT_DIR" -name '*.json' 2>/dev/null | wc -l)
    log "Retry passata $pass/$MAX_RETRY_PASSES..."
    if ! $TRANSLATE >> "$LOG" 2>&1; then
        log "ATTENZIONE: translate_cluster.py (retry $pass) exit non-zero, proseguo."
    fi
    after=$(find "$CONTENT_DIR" -name '*.json' 2>/dev/null | wc -l)
    gained=$((after - before))
    RETRY_LOG+=("passata $pass: +$gained pagine (totale $after)")
    log "Retry passata $pass: +$gained nuove pagine (totale $after)."
    if [ "$gained" -eq 0 ]; then
        log "Nessun file nuovo nella passata $pass: fermo i retry."
        break
    fi
done

# ---------- 3. Conteggio per lingua ----------
log "--- Conteggio pagine per lingua ---"
total_pages=0
for lang in ${LANGS//,/ }; do
    n=$(find "$CONTENT_DIR" -name "*.${lang}.json" 2>/dev/null | wc -l)
    total_pages=$((total_pages + n))
    log "$lang: $n/25"
done
log "TOTALE pagine tradotte: $total_pages"

# ---------- 3b. Riparazione deterministica lunghezze (pre-bake) ----------
log "--- Repair lunghezze ---"
REPAIR="python3 $ROOT/sviluppo/seo-tools/repair_cluster_lengths.py"
if repair_out=$($REPAIR 2>&1); then
    echo "$repair_out" >> "$LOG"
    log "Repair completato: $(echo "$repair_out" | tail -1)"
else
    rc=$?
    echo "$repair_out" >> "$LOG"
    log "ATTENZIONE: repair exit=$rc, proseguo (il bake rifiuterà eventuali fuori-limite residui)."
fi

# ---------- 4. Bake ----------
log "--- Bake ---"
bake_out=$($BAKE 2>&1)
bake_rc=$?
echo "$bake_out" >> "$LOG"
log "bake_streaming_cluster.py exit=$bake_rc"
# cerca la sezione ERRORI (n) generata dallo script di bake
bake_errors=$(echo "$bake_out" | grep -oP 'ERRORI \(\K[0-9]+' | tail -1)
bake_errors=${bake_errors:-0}
log "Errori di bake segnalati: $bake_errors"
if [ "$bake_errors" -gt 0 ]; then
    log "Pagine problematiche (sezione ERRORI):"
    echo "$bake_out" | sed -n '/ERRORI/,$p' | head -50 >> "$LOG"
fi

# ---------- 5. Sitemap ----------
log "--- Sitemap ---"
if ! $SITEMAP >> "$LOG" 2>&1; then
    log "ATTENZIONE: gen_sitemap.py fallito, proseguo."
fi

# ---------- 6. Commit (mai push) ----------
log "--- Commit ---"
deploy_done="no"
if [ "$total_pages" -gt 0 ]; then
    body="Pagine per lingua:"
    for lang in ${LANGS//,/ }; do
        n=$(find "$CONTENT_DIR" -name "*.${lang}.json" 2>/dev/null | wc -l)
        body="$body $lang=$n"
    done
    body="$body | totale=$total_pages"
    if git add site/ sviluppo/seo-tools/ && git commit -m "feat(seo): cluster streaming tradotto in 13 lingue con LLM locale" -m "$body" >> "$LOG" 2>&1; then
        log "Commit creato ($body). NESSUN push (vietato: origin divergente)."
    else
        log "ATTENZIONE: git commit non ha prodotto commit (niente di nuovo o errore), proseguo."
    fi
else
    log "Zero pagine tradotte: salto commit."
fi

# ---------- 7. Deploy condizionato ----------
if [ "$bake_errors" -eq 0 ] && [ "$total_pages" -gt 0 ]; then
    log "--- Deploy ---"
    deploy_out=$(cd "$ROOT/site" && npx wrangler pages deploy . --project-name adoff-site 2>&1)
    deploy_rc=$?
    echo "$deploy_out" >> "$LOG"
    if [ "$deploy_rc" -ne 0 ]; then
        log "ALLARME: deploy fallito (exit=$deploy_rc). Output completo sopra. Esco con errore."
        exit 2
    fi
    if echo "$deploy_out" | grep -q "Compiled Worker successfully" && echo "$deploy_out" | grep -q "Uploading Functions bundle"; then
        log "Deploy OK: Functions compilate e uploadate."
        deploy_done="yes"
    else
        log "ALLARME: deploy completato MA 'Compiled Worker successfully'/'Uploading Functions bundle' MANCANTI: le Functions non sono state compilate, i redirect /r/... si romperanno in produzione."
        # deploy fatto ma sospetto: proseguo con verifica, segnalato nel riepilogo
        deploy_done="yes (SOSPETTO: Functions non compilate)"
    fi
else
    log "Deploy SALTATO: bake_errors=$bake_errors, total_pages=$total_pages."
    log "Il deploy richiede zero errori di bake e almeno una pagina tradotta."
    if [ "$bake_errors" -gt 0 ]; then
        log "Pagine problematiche che bloccano il deploy:"
        echo "$bake_out" | sed -n '/ERRORI/,$p' | head -50 >> "$LOG"
    fi
fi

# ---------- 8. Verifica live ----------
live_summary="non eseguita (deploy non fatto)"
if [[ "$deploy_done" == "yes"* ]]; then
    log "--- Verifica live ---"
    live_ok=0
    live_tot=0
    for url in \
        https://adoff.app/de/streaming-ad-blocking \
        https://adoff.app/ja/twitch-ad-blocker \
        https://adoff.app/ar/streaming-ad-blocking \
        https://adoff.app/ru/netflix-ad-blocker \
        https://adoff.app/zh/streaming-ad-blocking \
        https://adoff.app/hi/streaming-ad-blocking; do
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url")
        live_tot=$((live_tot + 1))
        [ "$code" = "200" ] && live_ok=$((live_ok + 1))
        log "LIVE $code $url"
    done
    loc_count=$(curl -s --max-time 30 https://adoff.app/sitemap.xml | grep -c "<loc>" || true)
    log "Sitemap live: $loc_count URL in <loc>."
    live_summary="$live_ok/$live_tot URL a 200, sitemap live: $loc_count URL"
fi

# ---------- 9. Riepilogo finale ----------
log "=============================================="
log "=========== RIEPILOGO FINALE ================="
log "=============================================="
log "Retry: ${RETRY_LOG[*]:-nessuna passata utile}"
log "Pagine tradotte per lingua:"
for lang in ${LANGS//,/ }; do
    n=$(find "$CONTENT_DIR" -name "*.${lang}.json" 2>/dev/null | wc -l)
    log "  $lang: $n/25"
done
log "Pagine tradotte totali: $total_pages"
log "Pagine bakeate: vedi output bake sopra (exit=$bake_rc)"
log "Errori residui di bake: $bake_errors"
log "Deploy effettuato: $deploy_done"
log "Verifica live: $live_summary"
if [ -f "$CLUSTER_DIR/REVIEW-NEEDED.md" ]; then
    log "--- Contenuto REVIEW-NEEDED.md (richiede occhio umano) ---"
    cat "$CLUSTER_DIR/REVIEW-NEEDED.md" >> "$LOG"
else
    log "REVIEW-NEEDED.md assente: nessuna pagina da revisione manuale."
fi
log "=== FINE finalize_cluster ==="
exit 0
