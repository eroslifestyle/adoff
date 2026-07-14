# RUNBOOK — Stripe Test → Live (AdOff)

> Sblocco pagamenti reali. **Semplice**: il worker usa `price_data` INLINE (`PRICE_CONFIG` worker.js:1610), NON Price ID Stripe → **non serve ricreare prodotti**. Il worker legge SOLO 2 secret Stripe: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. La publishable key NON è usata (hosted checkout).

## Stato di partenza (2026-05-28)

- `STRIPE_MODE=test`, chiavi `sk_test`/`pk_test` in `~/.secrets/adoff-stores.env`.
- Webhook test esistente: `we_1TNZr1GPf5LKScOfr9Gb3R2o` → `https://api.adoff.app/stripe-webhook`.
- Worker `adoff-license-api` LIVE su `api.adoff.app`.

## Passi MANUALI (solo tu — KYC + chiavi)

### 1. Attiva l'account Stripe (KYC)
Dashboard Stripe → **Activate account** → completa dati attività/identità. ⚠️ Qui appare il nodo **anonimato**: in Stripe diretto il tuo nome/azienda finisce sull'estratto conto del cliente. (È il motivo per cui in parallelo valutiamo Polar MoR — vedi DEC nel wiki.)

### 2. Prendi le chiavi LIVE
Dashboard (toggle **Test mode → OFF**) → Developers → API keys:
- **Secret key** `sk_live_…`
- (publishable `pk_live_…` non serve al worker; serve solo se il sito usa Stripe.js)

### 3. Crea il webhook LIVE
Developers → Webhooks → **Add endpoint** (in modalità Live):
- URL: `https://api.adoff.app/stripe-webhook`
- Eventi (TUTTI E TRE — il worker li gestisce):
  - `checkout.session.completed`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
- Salva → copia il **Signing secret** `whsec_…` (live).

## Passi AUTOMATIZZATI (script — li lanci tu con le chiavi live)

> Richiede `wrangler` autenticato con la **global key** del tuo account CF (il `CF_API_TOKEN` di Pages NON basta per i secret dei Workers — nota da hub progetto).

```bash
cd "sviluppo/license-system"
export STRIPE_SECRET_KEY_LIVE="sk_live_xxx"
export STRIPE_WEBHOOK_SECRET_LIVE="whsec_xxx"
bash go-live-stripe.sh
```

Lo script:
1. Rifiuta di procedere se le chiavi non iniziano per `sk_live_` / `whsec_` (anti-errore test).
2. `wrangler secret put STRIPE_SECRET_KEY` ← `sk_live`
3. `wrangler secret put STRIPE_WEBHOOK_SECRET` ← `whsec_live`
4. Aggiorna `~/.secrets/adoff-stores.env` (`STRIPE_MODE=live` + nuove chiavi, backup automatico).
5. `wrangler deploy` (no code change, solo per propagare; opzionale).
6. Verifica `GET /health` + che `/stripe-webhook` risponda 401 senza firma (segno che il secret è caricato).

## Verifica end-to-end (dopo lo script)

1. **Checkout reale di prova** (carta vera o tua): apri il flusso acquisto dal sito/estensione → completa.
2. Conferma sul dashboard Stripe (Live) che il pagamento appare.
3. Conferma email di attivazione account ricevuta (Resend).
4. Conferma licenza creata (admin panel `adoff.app/admin.html`).
5. Stripe dashboard → Webhooks → l'evento `checkout.session.completed` risulta **200**.

## Rollback

Re-`wrangler secret put` con le chiavi `sk_test`/`whsec_test` e `STRIPE_MODE=test`. Nessun dato distrutto (le licenze test restano in KV).

## Note

- I prezzi sono inline e corretti nel worker (modello Founder: 2,99 mensile · 19,99→24,99 annuale · 99 lifetime, centesimi 299/1999/2499/9900) → NESSUNA azione su prodotti/Price ID (il checkout usa price_data inline, gating Founder server-side).
- `STRIPE-CONFIG.md` documenta solo l'account TEST sandbox (Price ID 2,99/8,07/14,35/25,12/47,90 NON usati dal checkout): ignorare per il listino.
- Dopo il go-live, affrontare i 5 blocker del [[AdOff Backend Audit 2026-05-22]] (supporto in-app rotto, Turnstile server-side, notifica ticket).
