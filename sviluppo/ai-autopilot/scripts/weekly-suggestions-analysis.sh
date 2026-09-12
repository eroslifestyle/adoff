#!/usr/bin/env bash
# =============================================================================
# AdOff — Analisi settimanale suggerimenti (FASE PROPOSE, read-only sul codice)
# -----------------------------------------------------------------------------
# Lanciato dal timer systemd adoff-suggestions-analysis.timer (settimanale).
# Claude legge i suggerimenti utente (D1 via admin API), li clusterizza,
# genera proposte di fix CONCRETE e le posta nel topic Telegram Suggerimenti
# (thread 8), marcando le suggestions come 'proposed'. NON tocca il codice.
# L'esecuzione effettiva avviene solo dopo approvazione (suggestions-execute-approved.sh).
# =============================================================================
set -euo pipefail

PROJECT_ROOT="/home/mrxxx/adoff"
API_BASE="https://api.adoff.app"
# Log: systemd cattura stdout/stderr via StandardOutput=append:/var/log/...
# Lo script scrive solo su stdout (mrxxx non può scrivere direttamente in /var/log).

# Carica i segreti (ADMIN_TOKEN, ecc.). Graceful se assente.
if [ -f "$HOME/.secrets/adoff-stores.env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.secrets/adoff-stores.env"
fi
if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "[$(date -Iseconds)] ERRORE: ADMIN_TOKEN non disponibile, esco."  exit 0
fi

export ADMIN_TOKEN API_BASE PROJECT_ROOT

cd "$PROJECT_ROOT"

PROMPT=$(cat <<'EOF'
Sei l'analista settimanale dei suggerimenti di AdOff (estensione ad-blocker).
OBIETTIVO: analizzare i suggerimenti utente e PROPORRE fix concreti su Telegram. NON modificare codice in questa fase.

Variabili d'ambiente disponibili per i tuoi comandi Bash: $ADMIN_TOKEN, $API_BASE.

PASSI:
1. Recupera i nuovi suggerimenti:
   curl -s "$API_BASE/admin/suggestions/digest" -H "X-Admin-Token: $ADMIN_TOKEN"
   Il JSON ha {ok, items:[{id,type,title,description,votes,...}], byType, total}.
2. Se total == 0: posta un breve messaggio "Nessun nuovo suggerimento questa settimana." su Telegram (vedi passo 5) ed esci.
3. Clusterizza gli item per tema (es. "cookie banner", "performance", "compatibilità sito X", "UI/UX", "falso positivo"). Assegna priorità in base a voti + frequenza + impatto.
4. Per i 3-6 cluster più rilevanti, scrivi una PROPOSTA DI FIX concreta e attuabile: cosa cambiare, in quali file (app/src/, regole, ecc.), rischio, e gli ID suggestions coinvolti. Sii specifico e tecnico ma conciso.
5. Posta il riepilogo numerato su Telegram (topic Suggerimenti) con una sola chiamata:
   curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"text":"<HTML semplice: <b>..</b>, max 3500 char, lista numerata di proposte con ID>"}'
   Nel testo, per ogni proposta indica come approvare: «rispondi "ok <ID>" o "esegui <numero>" per autorizzare; "rifiuta <ID>" per scartare».
6. Per OGNI suggerimento incluso in una proposta, aggiorna stato e proposta in D1:
   curl -s -X POST "$API_BASE/admin/suggestions/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"status":"proposed","cluster":"<tema>","proposal":"<sintesi proposta per questo item>"}'

VINCOLI:
- NON eseguire build, NON deployare, NON modificare file dell'estensione o del sito in questa fase.
- Mantieni i messaggi Telegram in italiano, HTML-safe (niente tag non supportati: usa solo <b>, <i>, <code>, <a>).
- Idempotente: lavora solo sugli item con status new/triaged (il digest li filtra già).
Concludi con un riepilogo testuale di quante proposte hai postato e su quali ID.
EOF
)

echo "[$(date -Iseconds)] START analisi suggerimenti"
# Headless: ambiente controllato dell'owner, permessi bypass (come da policy progetto).
claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --add-dir "$PROJECT_ROOT" \
  --max-turns 40 \
  2>&1 || echo "[$(date -Iseconds)] claude exit non-zero"
echo "[$(date -Iseconds)] END analisi suggerimenti"