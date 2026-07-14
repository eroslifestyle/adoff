# Handoff — Pannello Utente

**Generato:** 2026-07-11
**Worker:** v8f5ec667 su api.adoff.app
**File:** sviluppo/license-system/worker.js, admin.html

## Contesto
L'utente non riesce ad accedere al "pannello utente" di AdOff (licenze utente finale, non admin).

## Ricerca da fare
1. Cercare nel worker.js endpoint relativi a gestione licenza utente (activate, deactivate, /me, /licenses, /account)
2. Cercare nel front-end (site/ o admin.html) riferimenti a "pannello utente" / "user panel" / gestione licenza
3. Verificare se esiste una route del worker per `/panel` o `/account` o `/license`
4. Cercare nella tab "Account" o "Licenses" dell'admin.html se c'è una sezione utente finale
5. Cercare in admin.html la funzione `fetchLicenses` o simili per capire come funziona il pannello licenze

## Endpoint noti (da worker.js)
- POST /validate — valida license key
- POST /activate — attiva key su dispositivo
- POST /deactivate — rimuove dispositivo
- GET /affiliate/me — stats affiliazione
- GET /referral/stats — stats referral
- POST /trial — richiedi trial

## Possibili fix
- Il pannello utente potrebbe essere servito da CF Pages (site/panel.html o simile)
- Oppure essere embedded nell'admin.html con token utente diverso da admin
- Oppure non esistere ancora (da costruire)

## Domande da fare all'utente
- Che URL usi per accedere al pannello utente?
- L'errore è HTTP (quale?) o la pagina carica ma non funziona?
- Hai un token utente? Di che tipo?
