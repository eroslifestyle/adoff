# Handoff — Pannello Admin

**Generato:** 2026-07-11
**Worker:** v8f5ec667 su api.adoff.app
**File:** sviluppo/license-system/worker.js, wrangler.toml

## Contesto
Il worker `adoff-license-api` è deployato su api.adoff.app (v8f5ec667).
L'endpoint JSON `/admin/autofix/status` funziona ✅
Il pannello HTML `/admin` restituisce HTTP 404 con body "Admin panel not installed" — è graceful degradation, NON crash.

## Problema 1 (urgente — rate limit KV)
Il namespace KV `ADOFF_LICENSES` ha superato il limite giornaliero di letture (free tier).
kvGet() in worker.js cattura l'errore "limit exceeded" e ritorna null → l'handler /admin cade nel fallback 404.
Il limite si resetta a mezzanotte UTC.

**DONE-WHEN:** `/admin` restituisce HTTP 200 con l'admin panel HTML dopo reset o upgrade piano.

## Problema 2 (routing)
L'utente accede a `adoff.app/admin.html` ma le route del worker in wrangler.toml sono `/admin` (senza estensione).
Il path `/admin.html` non matcha nessuna route → passa attraverso CF Pages → serve la homepage.

**FIX:** aggiungere route `/admin.html` in wrangler.toml oppure redirect nel worker, oppure usare `/admin` senza .html nel link.

## Problema 3 (verifica post-rate-limit)
Una volta che il rate limit si resetta (dopo mezzanotte UTC), verificare che:
1. `wrangler kv key get "admin:html" --binding ADOFF_LICENSES` ritorna il contenuto HTML
2. `/admin` serve effettivamente l'admin panel (Content-Type: text/html)
3. L'admin panel carica correttamente nel browser (JS + token admin funzionanti)

## File chiave
- worker.js: riga ~6078 (handler /admin), riga ~52 (kvGet wrapper)
- wrangler.toml: route list (righe 11-15)
- admin.html: 127KB in sviluppo/license-system/ (già sync in KV)

## Token admin
È in `~/.secrets/adoff-stores.env` come `ADMIN_TOKEN` (export ADMIN_TOKEN=...)
