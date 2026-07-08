# SEO Dashboard — Setup Guide

## Stato: CODICE COMPLETATO (2026-07-08)

Cosa è stata implementata:
- Worker: 8 nuovi endpoint `/admin/seo/*` (GSC + GA4 + Sitemap + URL Inspect + Export CSV)
- Frontend: tab "🔍 SEO / AEO" nella dashboard admin con filtri, KPI, chart, azioni
- Cache: 1 ora, force refresh via bottone "↻ Aggiorna"

## Cosa manca: configurazione OAuth (5 min)

### Passi (da fare UNA SOLA VOLTA)

**Il worker usa OAuth già configurato** (GSC_CLIENT_ID/SECRET/REFRESH_TOKEN).
Devi solo verificare che i token abbiano gli scope giusti.

### 1. Verifica scope esistenti

Vai su https://myaccount.google.com/permissions → cerca "adoff" o "AdOff".
Controlla che ci sia accesso a:
- ✅ Google Search Console (sempre concesso)
- ✅ Google Analytics (deve esserci)

Se Analytics NON c'è → vai al passo 2.
Se Analytics c'è → **è tutto pronto**, vai a "Deploy".

### 2. Aggiungi Google Analytics scope

Se il token esistente non ha Analytics:

**Opzione A (più rapida): revoca e ri-autorizza**
1. Revoca l'accesso AdOff da https://myaccount.google.com/permissions
2. Sul sito adoff.app/admin → ricarica → Google chiederà di nuovo l'autorizzazione
3. questa volta autorizza **entrambi**: Search Console + Analytics

**Opzione B (OAuth Playground)**
1. Vai su https://developers.google.com/oauthplayground
2. Settings → ✅ "Use your own OAuth credentials" → inserisci GSC_CLIENT_ID e GSC_CLIENT_SECRET
3. Nel riquadro a sinistra seleziona gli scope:
   - `https://www.googleapis.com/auth/webmasters.readonly`
   - `https://www.googleapis.com/auth/analytics.readonly`
4. Click "Authorize APIs" → autorizza
5. Click "Exchange authorization code for tokens" → copia il nuovo refresh_token
6. Aggiorna in Cloudflare Workers secrets: `GSC_REFRESH_TOKEN` col nuovo token

### 3. Trova GA4 Property ID

1. Google Analytics → https://analytics.google.com
2. Seleziona la proprietà adoff.app
3. Vai su Admin → Property Settings → **Property ID** (è un numero come `123456789`)

### 4. Aggiungi GA4_PROPERTY_ID ai secrets

```bash
# Dal terminale, nella cartella license-system:
npx wrangler secret put GA4_PROPERTY_ID
# Inserisci: <il numero che hai trovato al passo 3>
```

### 5. Deploy Worker

```bash
cd /mnt/backup/Dropbox/1\ Programmazione/Progetti/ChromePlugin/sviluppo/license-system
npx wrangler deploy
```

### 6. Sync admin.html al KV

```bash
npx wrangler kv:key put --namespace-id=<ADOFF_LICENSES_NAMESPACE_ID> admin:html --path=admin.html
```

### 7. Verifica

1. Vai su adoff.app/admin
2. Login
3. Click "🔍 SEO / AEO" tab
4. Click "↻ Aggiorna" (verde in alto a destra)
5. Dovresti vedere i dati GSC caricarsi

## Se qualcosa non funziona

| Problema | Soluzione |
|---|---|
| "Errore: GSC secrets non configurati" | Verifica che GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN siano nei wrangler secrets |
| "GA4 non configurato" | È normale se GA4_PROPERTY_ID non è impostato — GA4 semplicemente non appare, GSC funziona comunque |
| URL Inspector dà errore | Google può rifiutare se l'URL non è nella proprietà Search Console verificata |
| Dati vuoti / "Nessun dato" | GSC ha ~2 giorni di ritardo sui dati — prova con date passate |

## Cron auto-update

Il worker aggiorna i dati SEO automaticamente ogni ora (tramite `syncGscDaily` nel scheduled handler).
I dati sono cachati in KV per 1 ora — il bottone "↻ Aggiorna" forza un refresh immediato.
