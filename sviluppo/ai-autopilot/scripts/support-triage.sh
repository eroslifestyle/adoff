#!/usr/bin/env bash
# =============================================================================
# AdOff — Triage automatico ticket di supporto (Claude)
# -----------------------------------------------------------------------------
# Lanciato dal timer systemd adoff-support-triage.timer (ogni ora).
# Claude legge i ticket APERTI (TK-) e i thread di messaggistica aperti (MSG-), li classifica BASE vs COMPLESSO:
#   - BASE  → compone risposta, la invia all'utente (email) e marca 'resolved'.
#   - COMPLESSO → posta su Telegram (topic Supporto) "DA ANALIZZARE INSIEME",
#                 marca 'in_progress' (no risposta automatica).
#
# SICUREZZA — l'invio email a clienti reali è irreversibile:
#   - Default (SUPPORT_AUTO_REPLY != 1) = PROPOSE: per i BASE NON invia,
#     posta su Telegram la BOZZA di risposta perché tu la approvi/invii.
#   - Con SUPPORT_AUTO_REPLY=1 = AUTO: i BASE vengono risposti e risolti da solo.
#   I rimborsi/fatturazione/legale/dispute licenza sono SEMPRE complessi (mai auto).
# =============================================================================
set -euo pipefail

PROJECT_ROOT="/home/mrxxx/adoff"
API_BASE="https://api.adoff.app"

if [ -f "$HOME/.secrets/adoff-stores.env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.secrets/adoff-stores.env"
fi
if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "[$(date -Iseconds)] ERRORE: ADMIN_TOKEN non disponibile, esco."
  exit 0
fi

AUTO_REPLY="${SUPPORT_AUTO_REPLY:-0}"
export ADMIN_TOKEN API_BASE PROJECT_ROOT AUTO_REPLY

cd "$PROJECT_ROOT"

PROMPT=$(cat <<'EOF'
Sei l'addetto al triage del supporto di AdOff (estensione ad-blocker, IT/multi-lingua).
Variabili d'ambiente per i tuoi comandi Bash: $ADMIN_TOKEN, $API_BASE, $AUTO_REPLY.

CONTESTO PRODOTTO (per rispondere ai BASE):
- AdOff blocca ads su siti web (banner/popup/tracker) nel piano FREE; il blocco ads VIDEO (piattaforme streaming) è solo PRO/Trial.
- Trial Pro = 30 giorni. Prezzi: Mensile €2,99 · Annuale Founder €19,99 (primi 100) poi €24,99 · Founder Lifetime €99. Garanzia rimborso 30 giorni.
- Licenza Pro: chiave "ADOFF-..." da inserire in Opzioni → Licenza, valida su ~3 dispositivi personali. Multi-browser: Chrome/Firefox/Edge/Opera/Brave (Safari in arrivo).
- Whitelist: Opzioni → Siti esclusi. Zero-log: nessun dato di navigazione lascia il dispositivo.
- Pagina supporto: https://adoff.app/support

PASSI:
1. Ticket aperti: curl -s "$API_BASE/tickets?status=open" -H "X-Admin-Token: $ADMIN_TOKEN"  → {tickets:[{id,category,subject,email,status,createdAt}]}.
2. Se nessun ticket aperto: esci (niente da fare).
3. Per OGNI ticket aperto: leggi il dettaglio: curl -s "$API_BASE/ticket/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" → {ticket:{description,...}}.
4. CLASSIFICA:
   - SEMPRE COMPLESSO (mai auto): category refund o billing; qualsiasi cosa con soldi/pagamenti/rimborsi, dispute o problemi di licenza/attivazione, questioni legali/privacy/GDPR, sicurezza, toni arrabbiati, richieste ambigue, o qualsiasi cosa NON rispondibile con certezza dal contesto prodotto qui sopra.
   - BASE (gestibile da solo): domande chiare e standard rispondibili dal contesto (come installo, come metto un sito in whitelist, dov'è la chiave, funziona su browser X, perché gli ads video si vedono ancora → serve Pro, come avvio il trial, ecc.).
5. AZIONE:
   - BASE, se $AUTO_REPLY == "1": componi una risposta utile, cortese, NELLA LINGUA del ticket, e inviala chiudendo il ticket:
     curl -s -X POST "$API_BASE/ticket/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"reply":"<testo>","status":"resolved","by":"ai"}'
     (questo invia l'email all'utente). Poi logga su Telegram (topic Supporto, thread 7):
     curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"✅ <b>Ticket base gestito in automatico</b>\n🆔 <ID>\n<sintesi>"}'
   - BASE, se $AUTO_REPLY != "1" (DEFAULT): NON inviare nulla all'utente. Posta su Telegram la BOZZA per approvazione:
     curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"📝 <b>Bozza risposta (BASE) — da approvare</b>\n🆔 <ID>\n<bozza risposta>"}'
     (non cambiare lo stato del ticket).
   - COMPLESSO: NON rispondere. Posta su Telegram (topic Supporto) per analisi congiunta e marca in_progress:
     curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"🧠 <b>DA ANALIZZARE INSIEME</b>\n🆔 <ID> — <categoria>\n📌 <oggetto>\n<sintesi del problema + cosa proporresti>"}'
     curl -s -X POST "$API_BASE/ticket/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"status":"in_progress"}'

6. MESSAGGI IN-ESTENSIONE (thread MSG-): stesso identico criterio applicato ai thread di messaggistica dell'estensione (Opzioni → Messaggi).
   a. Thread aperti: curl -s "$API_BASE/admin/messages?status=open" -H "X-Admin-Token: $ADMIN_TOKEN" → {ok,threads:[{id,email,subject,status,lang,unread_by_user,created_at,updated_at}]}.
   b. Se nessun thread aperto: salta al riepilogo.
   c. Per OGNI thread aperto leggi il dettaglio: curl -s "$API_BASE/admin/messages/<ID>" -H "X-Admin-Token: $ADMIN_TOKEN" → {ok,thread,messages:[{sender,text,textIt,created_at,attachmentUrl}]}. Usa `textIt` (già tradotto in italiano dal server) se il thread non è in italiano; considera solo i messaggi con sender "user".
   d. CLASSIFICA con lo STESSO criterio dei ticket (punto 4): rimborsi/fatturazione/licenza/legale/sicurezza/toni arrabbiati/ambiguità → SEMPRE COMPLESSO; domande standard rispondibili dal contesto prodotto → BASE.
   e. AZIONE:
      - BASE, se $AUTO_REPLY == "1": componi la risposta in italiano (il server la traduce da solo nella lingua del thread) e inviala:
        curl -s -X POST "$API_BASE/admin/messages/<ID>/reply" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"text":"<testo IT>"}'
        (marca automaticamente il thread "resolved" e invia l'email, non serve indicare stato). Poi logga su Telegram (topic Supporto, thread 7):
        curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"✅ <b>Messaggio base gestito in automatico</b>\n🆔 <ID>\n<sintesi>"}'
      - BASE, se $AUTO_REPLY != "1" (DEFAULT): NON inviare nulla. Posta su Telegram la BOZZA per approvazione (rispondere "ok" al messaggio con l'ID la invia, stesso meccanismo già attivo per i ticket TK-):
        curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"📝 <b>Bozza risposta (Messaggio base) — da approvare</b>\n🆔 <ID>\n<bozza risposta in italiano>"}'
      - COMPLESSO: NON rispondere. Posta su Telegram per analisi congiunta:
        curl -s -X POST "$API_BASE/admin/suggestions/notify" -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"thread":7,"text":"🧠 <b>DA ANALIZZARE INSIEME (Messaggio)</b>\n🆔 <ID>\n📌 <oggetto>\n<sintesi del problema + cosa proporresti>"}'
        NOTA: a differenza dei ticket non esiste uno stato "in_progress" per i thread messaggio — resta "open" e verrà rivalutato al giro successivo. Se dal contesto Telegram recente risulta già segnalato e nulla è cambiato, scrivi "(ancora in attesa, già segnalato in precedenza)" invece di ripetere l'intera sintesi.

VINCOLI:
- HTML Telegram safe: solo <b>,<i>,<code>,<a>. Testo email professionale, niente promesse non vere.
- NON toccare ticket/thread già non-open (status resolved). In dubbio sulla classificazione → COMPLESSO.
- Rispondi sempre nella lingua dell'utente. Firma le risposte come "Il team AdOff".
Concludi con un riepilogo: quanti ticket e quanti messaggi, quanti BASE (auto/bozza), quanti COMPLESSI, in totale.
EOF
)

echo "[$(date -Iseconds)] START triage supporto (AUTO_REPLY=$AUTO_REPLY)"

claude -p "$PROMPT" \
  --dangerously-skip-permissions \
  --add-dir "$PROJECT_ROOT" \
  --max-turns 60 \
  2>&1 || echo "[$(date -Iseconds)] claude exit non-zero"

echo "[$(date -Iseconds)] END triage supporto"
