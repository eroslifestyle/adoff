# SPEC — Checkout Premium (Stripe Integration)

> Worker implementation spec. Source of truth for the developer. Reference: `.claude/PLAN-vpn-dns-redesign.md` section "Schema licenza & pagamenti".
> **Status**: DESIGN (PENDING test E2E, FASE 1bis).

---

## 1. Panoramica

Il checkout Premium estende il checkout esistente aggiungendo un nuovo SKU `premium` con i seguenti obiettivi:
- Emissione licenza con `tier: "premium"` (non `"pro"`)
- Token firmato ECDSA che include `tier: "premium"` + `expiresAt`
- Upgrade Pro→Premium con proration Stripe
- Multi-valuta con prezzi fissi psicologici (EUR/USD/GBP/CHF)
- Tutti i metodi di pagamento: Carta + PayPal + Apple Pay + Google Pay + Crypto (USDT/USDC via BTCPay/Coinbase Commerce)
- Pool Founder Premium separato (nuovi 100 posti, contatore distinto da founder_seats adblock)

---

## 2. Prezzi (from constants.json)

### EUR (default)
| Piano | Prezzo | Note |
|---|---|---|
| Premium Mensile | €4,99/mese | Rinnovo automatico |
| Premium Annuale Founder (1° anno) | €29,99/anno | Pool 100 posti separato; rinnovo standard €49,99 |
| Premium Annuale Standard | €49,99/anno | Oltre i 100 posti Founder |

### Multi-valuta (prezzi fissi psicologici)
| Valuta | Mensile | Annuale Founder (1°) | Annuale Std |
|---|---|---|---|
| USD | $4,99 | $29,99 | $49,99 |
| GBP | £4,49 | £26,99 | £44,99 |
| CHF | CHF 5,50 | CHF 29,99 | CHF 54,99 |

---

## 3. SKU / Product Strategy

**Pattern**: `price_data` inline nella creazione della checkout session (NON pre-creare Price ID Stripe).

```
stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{
    price_data: {
      currency: detectedCurrency,          // EUR|usd|gbp|chf
      product_data: {
        name: 'AdOff Premium',
        description: 'AdBlock Pro + VPN integrata'
      },
      unit_amount: priceInCents,         // from constants.json
      recurring: { interval: 'month' | 'year' }
    },
    quantity: 1
  }],
  ...
})
```

### Abbonamento annuale
- Stripe automaticamente gestisce il rinnovo annuale con lo stesso `price_data`
- Il prezzo di rinnovo (dopo il 1° anno Founder) viene gestito via `subscription_schedule` con `phases`:
  - Fase 1: prezzo Founder (€29,99/anno)
  - Fase 2 (dopo 1 anno): prezzo standard (€49,99/anno)
  Oppure via `subscription.default_settings.default_payment_behavior: 'past_due'` + email pre-scadenza

### Gating Founder Premium
```
GET /founder-status-premium  →  { seats: N, total: 100 }
```
Se `seats <= 0` → redirect a piano standard o messaggio "Posti Founder esauriti".

**Meccanismo**: counter atomico D1 `founder_premium_seats` (decrementato in webhook `checkout.session.completed`).

---

## 4. Upgrade Pro → Premium (Proration)

Quando un utente Pro esistente acquista Premium:

1. Il frontend reindirizza a `/api/create-checkout-session` con parametri:
   - `upgrade_from: 'pro'` (da passare al checkout session)
2. Il worker crea una checkout session con proration:
   ```
   stripe.checkout.sessions.create({
     mode: 'subscription',
     line_items: [{
       price_data: {
         ... premium price ...
       },
       quantity: 1
     }],
     subscription_data: {
       // Stripe gestisce la proration automaticamente sul rinnovo
     }
   })
   ```
3. Il credit pro-rata viene gestito da Stripe (non c'è bisogno di calcolarlo manualmente).
   Stripe genera un addebito per `(giorni residui Pro / 30) * (Premium - Pro)`.
4. Nel webhook `invoice.paid` (o `checkout.session.completed`) emetti licenza `tier: "premium"`.

**Nota**: Stripe subscription proration funziona con lo stesso meccanismo di upgrade mensile→annuale esistente. Non serve logica aggiuntiva.

---

## 5. Webhook Handler (checkout.session.completed)

```javascript
async function handleCheckoutSessionCompleted(session) {
  const { customer_id, subscription_id, metadata } = session;
  const tier = metadata.tier || 'premium';     // 'premium' per Premium
  const is_founder = metadata.founder === '1';  // true se prezzo Founder
  const is_upgrade = metadata.upgrade_from === 'pro';

  // 1. Verifica posti Founder se necessario
  if (is_founder) {
    const seats = await getFounderPremiumSeats();
    if (seats <= 0) {
      // Founder esauriti → applica prezzo standard retroattivamente via subscription_schedule
      await stripe.subscriptions.update(subscription_id, {
        items: [{ id: session.subscription, price_data: { ...standard_price }}]
      });
      // Notifica utente (email)
    }
  }

  // 2. Decrementa counter Founder Premium
  if (is_founder) {
    await db.prepare('UPDATE founder_premium_seats SET seats = seats - 1 ...').run();
  }

  // 3. Genera licenza tier=premium
  const deviceId = metadata.device_id || generateDeviceId();
  const license = await generateLicense({
    customerId: customer_id,
    email: session.customer_details.email,
    tier: 'premium',
    deviceId
  });
  // Token firmato ECDSA include: { deviceId, tier: 'premium', expiresAt, iat, v: 1 }

  // 4. Provisioning account VPN (lazy: al primo uso, non qui)
  // Il provisioning VPN avviene su /vpn/config chiamata (lazy)
  // Questo evita di creare account VPNresellers per utenti che non usano la VPN

  // 5. Risposta email con licenza
  await sendLicenseEmail(session.customer_details.email, license);
}
```

---

## 6. Metodi di Pagamento

### Abilitati (payment_method_types)
```javascript
payment_method_types: ['card', 'paypal', 'apple_pay', 'google_pay']
```

### Crypto (USDT/USDC)
**Gateway**: BTCPay Server (o Coinbase Commerce) — stablecoin USDT su rete TRON.

**Flow**:
1. Worker crea invoice BTCPay su endpoint interno `/api/crypto/create-invoice`
   ```
   POST https://btcpay.adoff.app/api/v1/invoices
   Body: { amount: price, currency: 'USD', metadata: { tier: 'premium', customer_id } }
   ```
2. Restituisce al frontend l'URL di pagamento BTCPay
3. Frontend reindirizza a BTCPay checkout
4. Webhook `btcpay-webhook` → conferma pagamento → emissione licenza

**Alternative semplificata**: Stripe Crypto (USDC only, gassless on Polygon/TRON) — disponibile in US/CA/EU se il volume giustifica l'integrazione. **Per ora**: BTCPay o Coinbase Commerce.

**Nota**: Prezzi crypto mostrati in USD equivalente. Pagamento in USDT/USDC al prezzo del momento (nessun sovrapprezzo).

---

## 7. Autenticazione / Sessione Utente

- Utente deve essere loggato (account esistente) per acquistare Premium
- Se non loggato → redirect a `/account.html?redirect=premium-checkout`
- Account creation inline nel checkout Stripe (stripe-hosted) se necessario
- `metadata.device_id` passato dal frontend (dal localStorage dell'estensione installata)

---

## 8. Fallback / Error Handling

| Scenario | Comportamento |
|---|---|
| Checkout fallisce | Redirect a `/success.html?error=payment_failed` con messaggio generico |
| Payment method scaduto | Stripe gestisce retry automatico + email sollecito |
| Abbonamento cancellato | Webhook `customer.subscription.deleted` → `tier: 'free'`, VPN disable immediato |
| Payment fallito | Webhook `invoice.payment_failed` → VPN disable immediato, email sollecito |
| Refund richiesto | Admin gestisce manualmente, poi webhook aggiorna licenza |

---

## 9. Cron / Auto-disable

Vedi `.claude/API-CONTRACT-vpn.md` — cron giornaliero `/vpn/auto-disable` gestisce:
- Account VPN inattivi >7gg → disable
- Abbonamento Premium scaduto → disable

---

## 10. Anti-abuso

- Rate-limit: max 2 checkout tentati/ora per IP (via KV)
- Gating server-side: ogni `/vpn/*` verifica token ECDSA tier=premium
- DeviceId lock: licenza Premium vincolata a deviceId
- Founder Premium counter: atomico D1, decrementato in webhook (non in checkout page load)
- Audit log: ogni emissione licenza logged in D1 `license_audit`

---

## 11. Dati Customer (D1)

```sql
-- Tabella licenze estesa con tier
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'premium'
  license_key TEXT,
  token_b64 TEXT,
  device_id TEXT,
  created_at INTEGER,
  expires_at INTEGER,
  is_founder INTEGER DEFAULT 0,       -- 1 se acquistato come Founder
  updated_at INTEGER
);

-- Tabella Founder Premium seats (separata da founder_seats adblock)
CREATE TABLE IF NOT EXISTS founder_premium_seats (
  id INTEGER PRIMARY KEY,
  seats INTEGER NOT NULL DEFAULT 100,
  total INTEGER NOT NULL DEFAULT 100,
  updated_at INTEGER
);
-- Init: INSERT INTO founder_premium_seats (id, seats, total) VALUES (1, 100, 100);
```

---

## 12. Endpoints del Worker

### `POST /create-checkout-session`
**Body**:
```json
{
  "plan": "premium_monthly" | "premium_annual" | "premium_annual_founder",
  "device_id": "uuid",
  "upgrade_from": "pro"          // optional, se upgrade
}
```
**Response**: `{ url: "https://checkout.stripe.com/..." }`

### `GET /founder-status-premium`
**Response**: `{ seats: N, total: 100 }`

### `POST /webhook` (Stripe)
Handles: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

---

## 13. Diff con checkout Pro esistente

Le differenze rispetto al checkout Pro sono:
1. `tier: 'premium'` invece di `'pro'` nella licenza emessa
2. Nuovi `price_data` per piano Premium
3. Counter `founder_premium_seats` (non `founder_seats`)
4. `subscription_schedule` per gestire rinnovo Founder→standard
5. Provisioning VPN lazy (non nel webhook, su `/vpn/config`)
6. PayPal + Apple/Google Pay + Crypto abilitati (vs solo carta oggi)

**Codice Pro esistente**: `worker.js` ~riga 300-500 (checkout session creation).
