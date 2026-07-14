# Stripe Configuration — AdOff (SANDBOX/TEST)

> ⚠️ **SUPERATO per il listino (2026-06-01).** Questo file documenta solo l'account **TEST sandbox**.
> Il listino reale è il **modello Founder** (vedi `docs/PRICING-PLAN.md`): Mensile €2,99 · Annuale Founder €19,99→€24,99 · Founder Lifetime €99 · piano unico + counter X/100.
> Il checkout NON usa i Price ID qui sotto: il worker crea le sessioni con `price_data` inline e prezzo deciso server-side (gating Founder). I Price ID/prezzi qui (2,99/8,07/14,35/25,12/47,90) sono artefatti test, non il listino.
> **ARCHIVIATI 2026-06-01:** i 5 prodotti/prezzi test e i payment link test sono stati impostati `active=false` su Stripe. L'account LIVE non ha prezzi fissi (solo price_data inline). Le variabili `STRIPE_PRICE_*`/`STRIPE_LINK_*`/`STRIPE_PROD_*` nei secrets sono commentate.

Data: 2026-04-18
Ambiente: Sandbox (test mode)

## API Keys

- Publishable: `pk_test_51TNZi9GPf5LKScOfLdBaM9MkBJ1RnO0mdcFceqx9SNC71uJVQ0p1SM3tQGWY8ZzxmsM2P4Rk8fXPdDoysRcbr3bb00FCkwrB83`
- Secret: `sk_test_51TNZi9GPf5LKScOfLNcGgWmGP0lUjJfhncI0aq0iwrZxGlZCYlXel4k4oWcz1BiPPOdOYdRAsMmLQppMpIgRT5ky00qa2ARcKo`

## Prodotti e Prezzi

| Piano | Product ID | Price ID | Prezzo | Tipo |
|---|---|---|---|---|
| Mensile | prod_UMIQ5NyM9hsopi | price_1TNZqDGPf5LKScOfbJZxsJxZ | 2.99 EUR/mese | Recurring |
| Trimestrale | prod_UMIQJToIX527Is | price_1TNZqFGPf5LKScOfejxSHPxK | 8.07 EUR/3 mesi | Recurring |
| Semestrale | prod_UMIQBY8j7d6VN1 | price_1TNZqIGPf5LKScOf63k2lFO3 | 14.35 EUR/6 mesi | Recurring |
| Annuale | prod_UMIQijUybOQO01 | price_1TNZqLGPf5LKScOfbaPcv1cR | 25.12 EUR/anno | Recurring |
| Lifetime | prod_UMIQpJ4uAUiZD4 | price_1TNZrqGPf5LKScOfkYuyE2Ts | 47.90 EUR | One-time |

## Payment Links (Test)

| Piano | URL |
|---|---|
| Mensile | https://buy.stripe.com/test_dRm4gzfEH1ukeBU5tY77O00 |
| Trimestrale | https://buy.stripe.com/test_eVqdR92RV0qg0L409E77O01 |
| Semestrale | https://buy.stripe.com/test_7sY9ATbora0Q3Xg4pU77O02 |
| Annuale | https://buy.stripe.com/test_7sY9AT9gjb4UctM6y277O03 |
| Lifetime | https://buy.stripe.com/test_28EfZhgILdd2fFY3lQ77O04 |

Tutti i link reindirizzano a: `https://adoff.app/success?session_id={CHECKOUT_SESSION_ID}`

## Webhook

- ID: `we_1TNZr1GPf5LKScOfr9Gb3R2o`
- URL: `https://api.adoff.app/stripe-webhook`
- Secret: `whsec_Z6Bvn4yJTwFNtkhLlUOdIINYnIekNe5y`
- Eventi: checkout.session.completed, customer.subscription.deleted, charge.refunded

## Note

- Queste sono chiavi di TEST (sandbox) — nessun pagamento reale
- Per andare live: attivare account Stripe, ottenere chiavi `pk_live_` e `sk_live_`, ricreare prodotti/prezzi/webhook in live mode
- Il webhook secret va settato nel Cloudflare Worker: `wrangler secret put STRIPE_WEBHOOK_SECRET`
