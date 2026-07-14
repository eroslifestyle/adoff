# AdOff — Sistema Pagamenti

## Architettura

```
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────┐
│ Utente   │───▶│ Stripe       │───▶│ Cloudflare      │───▶│ KV       │
│ (browser)│    │ Checkout     │    │ Worker (webhook) │    │ Database │
└──────────┘    │ (hosted)     │    └────────┬────────┘    └──────────┘
     ▲          └──────────────┘             │
     │                                       │
     └───────────── success page ◀───────────┘
                   (mostra la key)
```

## Costi Stripe

| Voce | Costo |
|---|---|
| Account Stripe | GRATIS |
| Per transazione | 2.9% + 0.25 EUR |
| Dashboard, fatture, rimborsi | Incluso |

Esempio su vendita 2.99 EUR:
- Stripe trattiene: 0.34 EUR
- Noi incassiamo: 2.65 EUR

## Setup (10 minuti)

### Step 1: Crea account Stripe
https://dashboard.stripe.com/register

### Step 2: Crea i prodotti nel dashboard Stripe

Vai su Products → Add Product:

| Prodotto | Prezzo | Tipo |
|---|---|---|
| AdOff Pro Mensile | 2,99 EUR/mese | Ricorrente |
| AdOff Pro Annuale (Founder, primi 100, bloccato a vita) | 19,99 EUR/anno | Ricorrente |
| AdOff Pro Annuale (standard, dopo i 100) | 24,99 EUR/anno | Ricorrente |
| AdOff Founder Lifetime (offerta limitata) | 99 EUR | Una tantum |

### Step 3: Crea Payment Links

Per ogni prodotto → Actions → Create Payment Link.
Stripe genera un URL tipo: `https://buy.stripe.com/xxx`

Questi link si mettono nel sito e nella pagina opzioni dell'estensione.

### Step 4: Configura Webhook

Dashboard Stripe → Developers → Webhooks → Add endpoint:
- URL: `https://api.adoff.app/stripe-webhook`
- Eventi: `checkout.session.completed`, `customer.subscription.deleted`

### Step 5: Success Page

Dopo il pagamento Stripe redirige a:
`https://adoff.app/success?session_id={CHECKOUT_SESSION_ID}`

La success page chiama il Worker che genera la key e la mostra.

## Flusso dettagliato

### Acquisto

1. Utente va su adoff.app/pricing o nelle Opzioni estensione
2. Clicca "Acquista Pro Mensile" → apre link Stripe
3. Stripe mostra checkout (carta, Apple Pay, Google Pay, SEPA)
4. Utente paga
5. Stripe manda webhook a `api.adoff.app/stripe-webhook`
6. Il Worker:
   - Verifica la firma del webhook (sicurezza)
   - Genera una license key (HMAC)
   - La salva nel KV con email e piano
   - Restituisce la key
7. L'utente viene reindirizzato a `adoff.app/success?key=ADOFF-XXXX-XXXX-XXXX`
8. La pagina mostra la key + bottone "Copia"
9. L'utente la inserisce nelle Opzioni dell'estensione → Pro attivato

### Rinnovo (abbonamenti)

Stripe gestisce i rinnovi automaticamente.
Se il pagamento fallisce → Stripe manda webhook `invoice.payment_failed`
→ il Worker marca la licenza come scaduta.

### Cancellazione

L'utente cancella da Stripe Customer Portal.
Stripe manda webhook `customer.subscription.deleted`
→ il Worker marca la licenza come scaduta.

### Rimborso

Tu fai il rimborso dal dashboard Stripe.
Stripe manda webhook `charge.refunded`
→ il Worker revoca la licenza.

## Alternativa SENZA Stripe: pagamento manuale

Se non vuoi usare Stripe subito:

1. Utente ti contatta (email/form)
2. Tu generi la key con `keygen.py`
3. Gliela mandi via email
4. Lui la inserisce nell'estensione

Questo funziona per i primi 100 clienti. Dopo serve automatizzare.
