# AdOff — Strategia Trial, Referral & Recensioni

> ⚠️ **SUPERSEDED (2026-06-02) — modello pricing/trial sotto è OBSOLETO.** Il documento descrive
> trial **15gg** + tier **trimestrale/semestrale** non più in uso. **Modello attuale (canonico):**
> trial **30 giorni**, **piano unico** — Mensile **€2,99** · Annuale **Founder €19,99** (primi 100, poi €24,99) ·
> **Founder Lifetime €99**. Fonti di verità: `site/data/constants.json`, `docs/PRICING-PLAN.md`,
> `brand-bible.json` v2.0.0. Conservato solo come analisi storica (logica referral/recensioni ancora utile).

## 1. Trial 15gg: Downgrade a Free (Opzione A)

### Flusso completo

```
INSTALL → Trial 15gg (tutto Pro attivo) → SCADENZA → Downgrade automatico a Free
                                                    ↓
                                         Popup: "Trial scaduto"
                                         [Passa a Pro] [3 mesi -10%] [Continua Free]
```

### Cosa perde l'utente Free (rispetto al Trial/Pro)

| Feature | Free | Trial/Pro |
|---|---|---|
| Blocco ads network (107 regole) | SI | SI |
| CSS hiding universale | SI | SI |
| Whitelist siti | SI | SI |
| Popup con contatori | SI | SI |
| Toggle globale | SI | SI |
| **Stealth anti-detection** | NO | SI |
| **YouTube skip avanzato** | Base | Completo |
| **Cookie auto-reject** | NO | SI |
| **Statistiche dettagliate** | NO | SI |
| **Supporto prioritario** | NO | SI |
| **Badge Pro** | NO | SI |

### Trigger psicologico post-trial

Quando un sito anti-adblock blocca un utente Free, nel popup appare:

> "example.com ha rilevato il tuo ad blocker.
> Con AdOff Pro saresti invisibile.
> [Attiva Pro — 2.99/mese]"

Questo momento di frustrazione = massima conversione.

### Storage keys nuove

```
adoffTrialEnd        → timestamp fine trial (gia' esistente)
adoffTrialExpired    → boolean, true dopo primo downgrade
adoffTrialExpiredAt  → timestamp del downgrade
adoffProExpiredAt    → timestamp scadenza abbonamento Pro (se non rinnova)
```

### Logica nel license-client.js

```javascript
// checkPro() flow aggiornato:
// 1. Trial attivo? → isPro: true, plan: "trial"
// 2. Licenza Pro/Lifetime valida? → isPro: true, plan: "pro"/"lifetime"
// 3. Trial scaduto? → isPro: false, plan: "free", wasTrialUser: true
// 4. Mai avuto trial? → isPro: false, plan: "free"
```

---

## 2. Flussi di pagamento

### 2a. Senza carta (default — al primo install)

```
Install → Trial 15gg automatico (zero input utente)
         → Scade → Free
         → L'utente decide quando/se comprare
```

- Massima adozione (zero frizione)
- Nessun dato carta richiesto
- L'utente compra quando vuole dalla pagina Opzioni > Licenza

### 2b. Con carta (Stripe Checkout)

```
Utente clicca "Passa a Pro" → Stripe Checkout
  → Inserisce carta
  → trial_period_days: 15 nella subscription
  → 15gg gratis, poi addebito automatico 2.99/mese
  → Cancella quando vuole dal portale Stripe
```

Configurazione Stripe:
```javascript
// Stripe product configuration
const subscription = {
  price: "price_adoff_pro_monthly",  // 2.99 EUR/mese
  trial_period_days: 15,
  payment_method_collection: "always",
  cancel_url: "https://adoff.app/cancelled",
  success_url: "https://adoff.app/success?session_id={CHECKOUT_SESSION_ID}"
};
```

### 2c. Piani disponibili (conferma pricing)

| Piano | Prezzo | Stripe Price ID | Note |
|---|---|---|---|
| Mensile | 2.99/mese | price_monthly | Con trial 15gg |
| Trimestrale | 7.49 (2.50/mese) | price_quarterly | -16%, trial 15gg |
| Semestrale | 13.99 (2.33/mese) | price_semiannual | -22%, trial 15gg |
| Annuale | 24.99 (2.08/mese) | price_annual | -30%, trial 15gg |
| Lifetime | 14.99 una tantum | price_lifetime | No trial (pagamento unico) |

### 2d. Cosa succede alla scadenza abbonamento

```
Abbonamento attivo → Stripe addebita automaticamente
  → Pagamento OK → continua Pro
  → Pagamento FALLITO → Stripe riprova 3 volte (1, 3, 5 giorni)
    → Tutti falliti → subscription cancelled
    → Worker riceve webhook → revoca licenza
    → Estensione: prossimo checkPro() → isPro: false
    → Downgrade a Free (stesso comportamento del trial scaduto)
```

Grace period Stripe (built-in):
- Tentativo 1: giorno della scadenza
- Tentativo 2: +3 giorni
- Tentativo 3: +5 giorni
- Totale: 8 giorni di grace period prima del downgrade

---

## 3. Sistema Referral

### Meccanica base

```
Utente A (referrer) genera link → adoff.app/r/CODICE
Utente B installa AdOff tramite link
Utente B diventa PAGANTE (primo pagamento completato)
  → Utente A riceve +15 giorni Pro gratis
  → Utente B riceve +7 giorni Pro gratis (bonus benvenuto)
```

### Accumulo giorni

| Amici paganti portati | Giorni Pro gratis accumulati |
|---|---|
| 1 | 15 giorni |
| 2 | 30 giorni |
| 3 | 45 giorni |
| 5 | 75 giorni |
| 10 | 150 giorni (5 mesi!) |
| 20 | 300 giorni (~10 mesi!) |
| 34+ | AdOff Pro GRATIS per sempre* |

*34 amici x 15gg = 510 giorni = ~17 mesi. A quel punto l'utente ha generato 34 x 2.99 = ~101 EUR di revenue → vale la pena dargli il Pro gratis.

### Cap e regole

- I giorni si accumulano e si sommano al piano corrente
- Se l'utente e' Free: i giorni referral attivano il Pro temporaneo
- Se l'utente e' Pro: i giorni si aggiungono dopo la scadenza corrente
- Se l'utente e' Lifetime: i giorni non servono (gia' Pro per sempre)
- Il referral si attiva SOLO quando l'amico PAGA (non al trial)
- Anti-abuse: max 5 referral dallo stesso IP, verifica email univoca

### Implementazione tecnica

#### Storage keys

```
adoffReferralCode     → codice univoco utente (es. "ADO-7X9K2")
adoffReferralCount    → numero amici portati che hanno pagato
adoffReferralDays     → giorni Pro accumulati da referral
adoffReferralHistory  → [{code, date, daysEarned}]
```

#### Flusso tecnico

```
1. Utente apre Opzioni > Referral
2. Genera codice univoco (6 chars alfanumerico)
3. Link: adoff.app/r/ADO-7X9K2
4. Amico clicca link → landing page con CTA "Installa AdOff"
5. Amico installa → onboarding salva referrer_code in storage
6. Amico paga su Stripe → webhook include referrer_code nei metadata
7. Worker riceve webhook → aggiorna KV del referrer (+15 giorni)
8. Estensione del referrer: prossimo sync → riceve giorni bonus
```

#### Worker endpoint

```
POST /referral/credit
Body: { referrerCode: "ADO-7X9K2", referredEmail: "hash", amount: 2.99 }
Response: { ok: true, daysAdded: 15, totalDays: 45 }
```

#### UI nella pagina Opzioni

Nuova sezione "Invita amici":
```
╔══════════════════════════════════════════════╗
║  INVITA AMICI — Guadagna Pro gratis          ║
║                                              ║
║  Il tuo codice: ADO-7X9K2                    ║
║  [Copia link]  [Condividi WhatsApp]          ║
║                                              ║
║  Amici invitati: 3 paganti                   ║
║  Giorni Pro guadagnati: 45                   ║
║  Giorni rimanenti: 28                        ║
║                                              ║
║  +15 giorni per ogni amico che passa a Pro!  ║
║                                              ║
║  ───────────────────────────────────────────  ║
║  Storico:                                    ║
║  - 12/04: Amico 1 → +15gg                   ║
║  - 15/04: Amico 2 → +15gg                   ║
║  - 18/04: Amico 3 → +15gg                   ║
╚══════════════════════════════════════════════╝
```

---

## 4. Changelog nel Popup (post-aggiornamento)

### Meccanica

```
Aggiornamento estensione → background.js riceve onInstalled({reason: "update"})
  → Salva flag: adoffShowChangelog = true, adoffNewVersion = "3.1.0"
  → Popup: se flag attivo, mostra banner changelog prima dei contatori
```

### UI nel popup

```
╔══════════════════════════════════════╗
║  Novita' v3.1.0 (Pro)               ║
║  - Migliorato blocco video ads      ║
║  - Nuovi filtri per 20 siti         ║
║  - Fix: compatibilita' con Gmail    ║
║  [OK, capito]                       ║
╚══════════════════════════════════════╝
```

### Storage

```
adoffShowChangelog  → boolean
adoffNewVersion     → string (ultima versione aggiornata)
adoffChangelogSeen  → string[] (versioni gia' viste)
```

### Dati changelog (in background.js o file separato)

```javascript
const CHANGELOGS = {
  "3.1.0": [
    "Migliorato blocco YouTube ads",
    "Nuovi filtri per 20 siti",
    "Fix: compatibilita' con Gmail"
  ],
  "3.0.0": [
    "Nuovo design completo",
    "Sistema whitelist avanzato",
    "Supporto 6 lingue"
  ]
};
```

---

## 5. Early Adopter Badge

### Meccanica

```
Se installDate < DATA_CUTOFF (es. 2026-07-01 = 3 mesi dal lancio)
  → Badge "Founding Member" nel popup header
  → Badge permanente (non scade mai)
  → Colore speciale: oro/gradient
```

### Storage

```
adoffInstallDate    → timestamp primo install (gia' salvabile in onInstalled)
adoffIsFounder      → boolean (calcolato una volta, salvato per sempre)
```

### UI

Nel popup header, accanto al badge licenza:
```
[AdOff]  [PRO] [Founder]    ← utente Pro + early adopter
[AdOff]  [FREE] [Founder]   ← utente Free + early adopter
[AdOff]  [TRIAL 12gg]       ← utente nuovo (niente badge founder)
```

### Vantaggi Founder (opzionali, per fidelizzazione)

- Badge visivo permanente nell'estensione
- Menzione nella pagina "Chi siamo" del sito
- Accesso anticipato a nuove feature (beta channel)
- Sconto lifetime speciale (es. 9.99 invece di 14.99)

---

## 6. Strategia Recensioni Chrome Web Store

### 6a. Prompt intelligente

#### Condizioni per mostrare il prompt (TUTTE devono essere true)

```javascript
const shouldShowReviewPrompt = (
  adsBlocked >= 100 &&           // Ha visto il valore
  daysSinceInstall >= 5 &&       // Non troppo presto
  reviewPromptCount < 3 &&       // Max 3 volte nella vita
  !reviewDismissedForever &&     // Non ha detto "mai piu'"
  daysSinceLastPrompt >= 14 &&   // Min 14 giorni tra prompt
  !hasReviewed                   // Non ha gia' recensito
);
```

#### UI del prompt (nel popup)

```
╔══════════════════════════════════════╗
║  AdOff ha bloccato 847 ads!         ║
║                                      ║
║  Ti piace? Una recensione ci aiuta   ║
║  a restare gratis per tutti.         ║
║                                      ║
║  [Lascia recensione]  [Non ora]      ║
║  [Non chiedermelo piu']              ║
╚══════════════════════════════════════╝
```

#### Storage keys

```
adoffReviewPromptCount    → numero volte mostrato (max 3)
adoffReviewLastPrompt     → timestamp ultimo prompt
adoffReviewDismissed      → boolean (mai piu')
adoffReviewDone           → boolean (ha cliccato "Lascia recensione")
```

#### Link diretto allo store

```
https://chromewebstore.google.com/detail/adoff/EXTENSION_ID/reviews
```

### 6b. Trigger contestuali (momenti di massima soddisfazione)

| Trigger | Condizione | Messaggio |
|---|---|---|
| Milestone 100 | adsBlocked raggiunge 100 | "100 ads bloccati! Ti piace AdOff?" |
| Milestone 500 | adsBlocked raggiunge 500 | "500 ads fermati! Aiutaci con una recensione" |
| Milestone 1000 | adsBlocked raggiunge 1000 | "1000 ads! Sei un veterano AdOff" |
| YouTube clean | 10 video senza ads | "YouTube pulito! Facci sapere" |
| Anti-adblock OK | Stealth bypassa sito | "Sito sbloccato! Solo AdOff ci riesce" |
| 30 giorni | daysSinceInstall >= 30 | "Un mese insieme! Lascia un pensiero" |

### 6c. Canale feedback pre-recensione (intercetta frustrazione)

Nel popup, link permanente:
```
[Hai un problema?] → apre form in options.html#suggerimenti
```

Nella pagina opzioni, sezione Suggerimenti gia' esistente — aggiungere:
- Campo "Sito problematico" (dominio)
- Tipo: Bug / Sito non bloccato / Altro
- Email opzionale per follow-up

### 6d. Risposta recensioni negative (template)

**Template 1 — Bug generico:**
> Ciao, ci dispiace per il problema! Puoi scriverci a support@adoff.app con il sito specifico? Risolviamo in 24h.

**Template 2 — Sito non bloccato:**
> Grazie per la segnalazione! Abbiamo aggiunto il filtro per [sito] nell'aggiornamento v3.X. Aggiorna AdOff e riprova.

**Template 3 — Dopo fix:**
> Aggiornamento v3.X rilasciato! Il problema su [sito] e' stato risolto. Grazie per averci aiutato a migliorare.

### 6e. Referral per recensioni (confermato)

```
Utente installa → Trial 15gg
Utente porta amico PAGANTE → +15gg Pro gratis
Piu' amici paganti porta → piu' giorni accumula
```

(Dettagli completi nella sezione 3 sopra)

### 6f. Metriche target

| Metrica | Mese 1 | Mese 3 | Mese 6 |
|---|---|---|---|
| Recensioni totali | 30+ | 150+ | 500+ |
| Rating medio | 4.7+ | 4.6+ | 4.5+ |
| Risposta a negative | <24h | <24h | <24h |
| % prompt mostrati | 30% | 30% | 25% |
| % che recensiscono | 5-8% | 4-6% | 3-5% |
| Referral attivi | 50 | 300 | 1000 |
| Conversione referral | 15% | 12% | 10% |

---

## 7. Riepilogo Storage Keys (tutte)

### Esistenti
```
adoffEnabled          → boolean
adoffAdsBlocked       → number
adoffReqBlocked       → number
adoffTrialEnd         → timestamp
adoffWhitelist        → array
adoffLang             → string
adoffSuggestions      → array
adoffLicense          → object {valid, rawKey, plan, expires, ...}
```

### Nuove (da aggiungere)
```
// Trial/License
adoffTrialExpired     → boolean
adoffProExpiredAt     → timestamp

// Referral
adoffReferralCode     → string (es. "ADO-7X9K2")
adoffReferralCount    → number
adoffReferralDays     → number (giorni Pro guadagnati)
adoffReferralHistory  → array [{code, date, daysEarned}]

// Changelog
adoffShowChangelog    → boolean
adoffNewVersion       → string
adoffChangelogSeen    → array [string]

// Early Adopter
adoffInstallDate      → timestamp
adoffIsFounder        → boolean

// Recensioni
adoffReviewPromptCount → number (max 3)
adoffReviewLastPrompt  → timestamp
adoffReviewDismissed   → boolean
adoffReviewDone        → boolean
adoffMilestones        → object {100: true, 500: false, 1000: false}
```

---

## 8. Priorita' implementazione

| # | Feature | Effort | Impatto | Priorita' |
|---|---|---|---|---|
| 1 | Trial → Free downgrade | 2h | Alto (core business) | CRITICA |
| 2 | Prompt recensioni | 2h | Alto (growth) | ALTA |
| 3 | Changelog popup | 1h | Medio (retention) | MEDIA |
| 4 | Early adopter badge | 1h | Medio (fidelizzazione) | MEDIA |
| 5 | Sistema referral | 4h | Alto (growth) | ALTA |
| 6 | Stripe subscription con trial | 3h | Alto (revenue) | CRITICA |

Ordine consigliato: 1 → 6 → 2 → 5 → 3 → 4
