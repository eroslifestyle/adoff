# AdOff — Guida Deploy Completa

## Architettura: ZERO VPS, ZERO Hosting tradizionale

```
TUTTO SU CLOUDFLARE (gratis):

┌─ Cloudflare Pages (GRATIS) ──────────────────┐
│  adoff.app          → Sito landing page       │
│  adoff.app/admin    → Admin dashboard licenze  │
└───────────────────────────────────────────────┘

┌─ Cloudflare Workers (GRATIS) ────────────────┐
│  api.adoff.app      → API licenze (serverless) │
│  100K richieste/giorno incluse                 │
└───────────────────────────────────────────────┘

┌─ Cloudflare KV (GRATIS) ─────────────────────┐
│  Database licenze (key-value)                  │
│  100K letture/giorno, 1K scritture/giorno      │
└───────────────────────────────────────────────┘

┌─ Chrome Web Store ───────────────────────────┐
│  Estensione AdOff ($5 una tantum)             │
└───────────────────────────────────────────────┘
```

**Non serve VPS, non serve hosting, non serve database.**
Cloudflare gestisce tutto — gratis, con CDN globale, SSL automatico.

---

## Step-by-Step Deploy

### PREREQUISITI

1. Account Cloudflare gratuito: https://dash.cloudflare.com/sign-up
2. Node.js installato (per wrangler CLI)
3. Dominio `adoff.app` registrato (su Cloudflare o Porkbun)

---

### STEP 1: Installa Wrangler (CLI Cloudflare)

```bash
npm install -g wrangler
wrangler login
```

Si apre il browser — accedi con il tuo account Cloudflare.

---

### STEP 2: Crea il KV Database

```bash
cd sviluppo/license-system
wrangler kv:namespace create ADOFF_LICENSES
```

Output:
```
Created namespace "ADOFF_LICENSES" (id: abc123...)
```

Copia l'ID e mettilo nel `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "ADOFF_LICENSES"
id = "abc123..."    # <-- METTI QUI IL TUO ID
```

---

### STEP 3: Setta i Secret

```bash
# Il secret per firmare le license key (HMAC)
# GENERALO con: python -c "import secrets; print(secrets.token_hex(32))"
wrangler secret put ADOFF_SECRET

# Il token admin per revocare licenze
wrangler secret put ADMIN_TOKEN
```

**IMPORTANTE:** Il ADOFF_SECRET deve essere lo STESSO usato nel keygen.py.
Settalo anche nel tuo terminale:
```bash
export ADOFF_SECRET="il_tuo_secret_qui"
```

---

### STEP 4: Deploy API Licenze

```bash
cd sviluppo/license-system
wrangler deploy
```

Output:
```
Published adoff-license-api
  https://adoff-license-api.YOUR_SUBDOMAIN.workers.dev
```

Testa:
```bash
curl https://adoff-license-api.YOUR_SUBDOMAIN.workers.dev/health
```

Deve rispondere: `{"status":"ok","service":"AdOff License API"}`

---

### STEP 5: Custom Domain (opzionale)

Per usare `api.adoff.app` invece dell'URL workers.dev:

1. Vai su Cloudflare Dashboard → Workers → adoff-license-api
2. Settings → Triggers → Add Custom Domain
3. Inserisci: `api.adoff.app`
4. Cloudflare configura DNS e SSL automaticamente

---

### STEP 6: Deploy Sito Web + Admin

```bash
# Dalla root del progetto
# Crea la cartella del sito
mkdir -p site
# Copia admin nella cartella site
cp sviluppo/license-system/admin.html site/admin.html
# Crea index.html (landing page — da creare)

# Deploy su Cloudflare Pages
wrangler pages deploy site --project-name=adoff-site
```

Oppure via GitHub:
1. Push il repo su GitHub
2. Cloudflare Dashboard → Pages → Create Project
3. Collega il repo GitHub
4. Build directory: `site/`
5. Deploy automatico ad ogni push

---

### STEP 7: Aggiorna l'estensione

In `src/license-client.js`, cambia l'API URL:
```javascript
const API_URL = "https://api.adoff.app";
// oppure
const API_URL = "https://adoff-license-api.YOUR_SUBDOMAIN.workers.dev";
```

---

### STEP 8: Pubblica l'estensione

```bash
# Chrome
# 1. Vai su: https://chrome.google.com/webstore/devconsole
# 2. Paga $5 (una tantum)
# 3. Carica ZIP della cartella del progetto
# 4. Compila listing, screenshot, privacy policy

# Edge (stessa estensione, zero modifiche)
# 1. Vai su: https://partner.microsoft.com/dashboard/microsoftedge
# 2. Gratuito
# 3. Carica stesso ZIP

# Firefox (modifiche minime)
# 1. Vai su: https://addons.mozilla.org/developers/
# 2. Gratuito
# 3. Carica ZIP (potrebbe servire adattare manifest)
```

---

## Costi Totali

| Cosa | Costo | Frequenza |
|---|---|---|
| Cloudflare Account | GRATIS | — |
| Cloudflare Workers | GRATIS | 100K req/giorno |
| Cloudflare KV | GRATIS | 100K read/giorno |
| Cloudflare Pages | GRATIS | Illimitato |
| Dominio adoff.app | ~$12 | /anno |
| Chrome Web Store | $5 | una tantum |
| Edge Add-ons | GRATIS | — |
| Firefox AMO | GRATIS | — |
| **TOTALE ANNO 1** | **~$17** | |

---

## Flusso Completo Utente

```
1. Utente trova AdOff sul Chrome Web Store
2. Installa → si apre pagina onboarding
3. Trial 15 giorni Pro attivo automaticamente
4. Dopo 15 giorni → Free (blocco ads base)
5. Vuole Pro → va nelle Opzioni → vede pricing
6. Clicca "Acquista" → va su adoff.app/pricing
7. Paga con Stripe → riceve key via email
8. Inserisce key nelle Opzioni → Pro attivato
9. Estensione valida via api.adoff.app ogni 7 giorni
```

---

## Comandi Utili

```bash
# Genera una license key
python keygen.py --plan pro --months 1 --email user@example.com

# Genera batch di 10 lifetime
python keygen.py --plan lifetime --batch 10 --output keys.json

# Testa API
curl -X POST https://api.adoff.app/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"RAW_KEY_HERE"}'

# Revoca una licenza
curl -X POST https://api.adoff.app/revoke \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"key":"RAW_KEY_HERE"}'

# Controlla health
curl https://api.adoff.app/health

# Aggiorna Worker
cd sviluppo/license-system && wrangler deploy

# Aggiorna sito
wrangler pages deploy site --project-name=adoff-site
```
