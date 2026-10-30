# Deploy Worker Cloudflare — AdOff Tickets

## Protezioni attive

| Livello | Protezione | Dove |
|---|---|---|
| Client | Math CAPTCHA | Estensione (options.js) |
| Client | Honeypot field | Estensione (options.js) |
| Client | Rate limit 3/ora | Estensione (chrome.storage) |
| Client | Cooldown 2s bottone | Estensione (options.js) |
| **Server** | **Token nascosto** | **Worker (env secret)** |
| **Server** | **Rate limit IP 3/ora + 10/giorno** | **Worker (KV)** |
| **Server** | **Validazione input** | **Worker** |
| **Server** | **Sanitizzazione anti-injection** | **Worker** |
| **Server** | **Limite dimensione payload** | **Worker (2KB max)** |

## Setup (una volta)

```bash
# 1. Installa Wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Crea KV namespace per rate limiting
wrangler kv namespace create RATE_LIMIT
# Output: id = "abc123..." → copialo in wrangler.toml

# 4. Decommenta e aggiorna wrangler.toml:
# [[kv_namespaces]]
# binding = "RATE_LIMIT"
# id = "abc123..."

# 5. Configura secrets
wrangler secret put TELEGRAM_BOT_TOKEN
# Inserisci: 7878273225:AAFwUG8nti5nnQCJfnJLBYfwV0HcBB3X4YY

wrangler secret put TELEGRAM_CHAT_ID
# Inserisci: -1003984041260

# 6. Deploy
wrangler deploy
```

## Dopo il deploy

Aggiorna `src/options.js` — cambia queste due righe:

```js
// DA (diretto Telegram — token esposto):
const REPORT_ENDPOINT = "https://api.telegram.org/bot.../sendMessage";
const REPORT_CHAT_ID  = "-1003984041260";

// A (Worker proxy — token sicuro):
const REPORT_ENDPOINT = "https://adoff-tickets.tuoaccount.workers.dev";
const REPORT_CHAT_ID  = null; // non serve piu', gestito dal Worker
```

E nella funzione `sendReport()`, cambia il body del fetch:
```js
body: JSON.stringify({ url, type: reportType, desc, version: VERSION })
```

## Collegare al dominio adoff.app

```bash
# In wrangler.toml, aggiungi:
route = { pattern = "api.adoff.app/tickets", zone_name = "adoff.app" }

# Poi ri-deploya:
wrangler deploy
```

## Test locale

```bash
wrangler dev

curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"url":"test.com","type":"broken","desc":"Test","version":"3.0.0"}'
```
