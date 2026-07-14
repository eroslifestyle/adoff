#!/usr/bin/env bash
# =============================================================================
# AdOff — Esecuzione fix suggerimenti APPROVATI (FASE EXECUTE)
# -----------------------------------------------------------------------------
# Lanciato dal timer systemd adoff-suggestions-execute.timer.
# Claude prende le suggestions con status='approved', implementa i fix sui 3
# target (app/, app-firefox/, app-safari/), builda, deploya (Deploy Rule),
# marca le suggestions 'done' con esito. Idempotente: salta se nulla è approvato.
#
# SICUREZZA: esegue modifiche autonome + deploy. Gate rigido su status=approved.
# Disabilitato di default — abilitare il timer solo dopo il primo giro supervisionato:
#   richiede SUGG_EXECUTE_CONFIRM=1 nell'ambiente per procedere.
# =============================================================================
set -euo pipefail

PROJECT_ROOT="/home/mrxxx/adoff"
API_BASE="https://api.adoff.app"
# Log: systemd cattura stdout/stderr via StandardOutput=append:/var/log/...
# Lo script scrive solo su stdout (mrxxx non può scrivere direttamente in /var/log).

if [ -f "$HOME/.secrets/adoff-stores.env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.secrets/adoff-stores.env"
fi
if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "[$(date -Iseconds)] ERRORE: ADMIN_TOKEN non disponibile, esco."  exit 0
fi

# Guard di sicurezza: la fase EXECUTE deve essere esplicitamente confermata.
if [ "${SUGG_EXECUTE_CONFIRM:-0}" != "1" ]; then
  echo "[$(date -Iseconds)] EXECUTE non confermato (SUGG_EXECUTE_CONFIRM!=1). Esco senza modifiche."  exit 0
fi

export ADMIN_TOKEN API_BASE PROJECT_ROOT

cd "$PROJECT_ROOT"

PROMPT=$(cat <<'EOF'
Sei l'esecutore dei fix approvati per AdOff (estensione ad-blocker multi-browser).
Variabili d'ambiente: $ADMIN_TOKEN, $API_BASE. CWD = root progetto (/home/mrxxx/adoff).

PASSI:
1. Recupera i suggerimenti approvati:
   curl -s "$API_BASE/admin/suggestions?status=approved" -H "X-Admin-Token: $ADMIN_TOKEN"
   Restituisce {ok, suggestions:[{id,type,title,description,proposal,cluster,...}]}.
2. Se la lista è vuota: esci senza fare nulla.
3. Per ciascun suggerimento approvato, in ordine di priorità:
   a. Marca in_progress: curl -s -X POST "$API_BASE/admin/suggestions/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"status":"in_progress"}'
   b. Implementa il fix descritto in `proposal`. RISPETTA le regole del progetto in CLAUDE.md:
      - Multi-Browser Sync: i file condivisi vanno propagati IDENTICI in app/, app-firefox/src/ e app-safari/src/ (eccetto le differenze strutturali Firefox/Safari documentate).
      - Brand Name Policy: niente brand nel codice/asset.
      - Privacy: nessun dato personale nei file di produzione.
   c. Marca done con esito: curl -s -X POST "$API_BASE/admin/suggestions/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"status":"done","resolution":"<cosa hai cambiato + file>"}'
4. Dopo aver implementato tutti i fix:
   - Bumpa versione nei 3 manifest se hai toccato l'estensione.
   - Build: node sviluppo/scripts/build.js
   - Deploy secondo la Deploy Rule del CLAUDE.md (wrangler pages deploy site/ per il sito; ZIP/store per l'estensione; wrangler deploy per il worker se modificato).
5. Posta un report finale su Telegram:
   curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"text":"<report HTML in italiano: cosa è stato fatto, build/deploy ok/ko, ID done>"}'

VINCOLI:
- Esegui SOLO i fix con status=approved. Mai toccare item non approvati.
- Se un fix è troppo rischioso/ambiguo, NON forzarlo: rimettilo a 'triaged' con resolution che spiega perché, e segnalalo nel report.
- Verifica sempre il build prima di deployare. Se il build fallisce, NON deployare, marca l'item 'triaged' e riporta l'errore.
EOF
)

echo "[$(date -Iseconds)] START esecuzione fix approvati"
claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --add-dir "$PROJECT_ROOT" \
  --max-turns 120 \
  2>&1 || echo "[$(date -Iseconds)] claude exit non-zero"
echo "[$(date -Iseconds)] END esecuzione fix approvati"