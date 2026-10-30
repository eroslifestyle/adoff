# Referral System Spec — Implementation Contract

> **CONDIVISO** tra worker server, site, extension client. Modificare SOLO con consenso.

## Glossario

- **Codice ADO-XXXXX** = referral code generato lato client al primo install (in `background.js`). Auto-assegnato. NON da confondere con "Partner Affiliato ID" (es. `leo-dg`) che invece ha registrazione esplicita.
- **Flusso "Invita Amici"** (giorni gratis) = utente condivide ADO-XXXXX, amico paga, utente referrer riceve 15 giorni Pro.
- **Flusso "Partner Affiliato"** (€) = utente registra ID nel DB `affiliates`, riceve 30 giorni Pro per ogni vendita. (Esistente, da rifinire UI.)

## Endpoint da AGGIUNGERE al worker.js

### 1. POST `/referral/register-code`

Associa il codice ADO-XXXXX dell'estensione all'email dell'utente loggato.

- **Auth**: `X-Account-Token` (verifyAccountAuth obbligatorio).
- **Body**: `{code: "ADO-YNFPB"}`. Validazione: deve matchare `^ADO-[A-Z0-9]{5,8}$`.
- **Logica**:
  1. `existing = KV.get("referral:" + code, "json")`
  2. Se `existing` esiste e `existing.email !== session.email` → reject `{ok:false, error:"Code already claimed"}` (409).
  3. Altrimenti `KV.put("referral:" + code, {email: session.email, createdAt: Date.now()})` e `KV.put("user_referral:" + session.email, code)`.
  4. Inizializza `referral_stats:CODE` se non esiste: `{count:0, daysEarned:0, history:[], paidEmails:[]}`.
- **Response**: `{ok:true, code}`. Wrappare con `withCors`.

### 2. GET `/referral/stats?code=ADO-XXXXX`

Public read (no auth). L'estensione la chiama per sincronizzare i contatori.

- **Query**: `code` (validato regex come sopra).
- **Logica**:
  1. `stats = KV.get("referral_stats:" + code, "json") || {count:0, daysEarned:0, history:[], paidEmails:[]}`
  2. Ritorna `{ok:true, code, count: stats.count, daysEarned: stats.daysEarned, history: stats.history}` (NON ritornare `paidEmails` per privacy).
- Wrappare con `withCors`.

### 3. Webhook Stripe — modifica `checkout.session.completed`

Già esiste il branch:
```js
const affiliateId = session.metadata?.affiliate || session.client_reference_id || null;
if (affiliateId) {
  await registerReferral(affiliateId, email, session.id, amount, currency, env);
}
```

**Modifica**: PRIMA di chiamare `registerReferral`, distinguere:

```js
if (affiliateId) {
  if (affiliateId.startsWith("ADO-")) {
    // Flusso "Invita Amici": accredita 15 giorni al referrer
    await creditReferralFriend(affiliateId, email, env);
  } else {
    // Flusso "Partner Affiliato": esistente
    const currency = session.currency || "eur";
    await registerReferral(affiliateId, email, session.id, amount, currency, env);
  }
}
```

### 4. Nuova funzione `creditReferralFriend(code, payerEmail, env)`

```js
async function creditReferralFriend(code, payerEmail, env) {
  if (!code || !code.startsWith("ADO-")) return;
  const REFERRAL_DAYS_PER_FRIEND = 15;
  try {
    const mapping = await env.ADOFF_LICENSES.get("referral:" + code, "json");
    if (!mapping || !mapping.email) return; // codice non registrato — nessun referrer
    const referrerEmail = mapping.email;
    if (referrerEmail.toLowerCase() === (payerEmail || "").toLowerCase()) return; // self-refer

    // Idempotenza: se questa email pagatrice è già stata accreditata, skip
    const stats = await env.ADOFF_LICENSES.get("referral_stats:" + code, "json")
      || { count: 0, daysEarned: 0, history: [], paidEmails: [] };
    if (stats.paidEmails.includes((payerEmail || "").toLowerCase())) return;

    // Accredita 15 giorni alla licenza primaria del referrer
    const userRecord = await env.ADOFF_LICENSES.get("user:" + referrerEmail, "json");
    if (userRecord && Array.isArray(userRecord.licenses) && userRecord.licenses.length > 0) {
      const rawKey = userRecord.licenses[0];
      const lic = await env.ADOFF_LICENSES.get("lic:" + rawKey, "json");
      if (lic) {
        const now = Math.floor(Date.now() / 1000);
        if (lic.expires && lic.expires > 0) {
          // Solo licenze a tempo — lifetime non beneficia
          const base = lic.expires > now ? lic.expires : now;
          lic.expires = base + (REFERRAL_DAYS_PER_FRIEND * 86400);
          lic.updatedAt = Date.now();
          await env.ADOFF_LICENSES.put("lic:" + rawKey, JSON.stringify(lic));
        }
      }
    }

    // Aggiorna stats
    stats.count += 1;
    stats.daysEarned += REFERRAL_DAYS_PER_FRIEND;
    stats.history.unshift({
      date: Date.now(),
      payerEmail: maskEmail(payerEmail),
      daysEarned: REFERRAL_DAYS_PER_FRIEND,
    });
    if (stats.history.length > 50) stats.history.length = 50;
    stats.paidEmails.push((payerEmail || "").toLowerCase());
    await env.ADOFF_LICENSES.put("referral_stats:" + code, JSON.stringify(stats));
  } catch (e) {
    console.error("creditReferralFriend error:", e.message);
  }
}

function maskEmail(email) {
  if (!email) return "";
  const [u, d] = email.split("@");
  if (!d) return "***";
  return (u.slice(0, 2) || "**") + "***@" + d;
}
```

### 5. Routing

In `fetch()` aggiungere:

```js
// GET
if (path === "/referral/stats") return withCors(handleReferralStats(request, env));
// POST
if (path === "/referral/register-code" && request.method === "POST") {
  let body;
  try { body = await request.json(); } catch { return withCors(jsonResponse({ error: "Invalid JSON" }, 400)); }
  return withCors(handleReferralRegisterCode(body, env, request));
}
```

## Site changes

### A. `site/_redirects`

Aggiungere riga:
```
/r/:code  /?ref=:code  302
```

### B. `site/account/index.html` — sezione Affiliate

Aggiungere nuova sezione/tab "Affiliato" nel pannello account utente:

- Visibile solo se utente loggato.
- Stato A (non registrato): bottone "Diventa Partner Affiliato" → POST `/affiliate/register` (auth `X-Account-Token`) → mostra success.
- Stato B (registrato): mostra
  - ID Affiliato
  - Link affiliato `https://adoff.app/?ref={ID}` (con bottone copia)
  - Stats da `GET /affiliate/stats?id={ID}`: vendite + giorni accreditati
- Si attiva navigando con `#affiliate` nell'URL.
- Endpoint stato: chiamare `GET /affiliate/me` (NUOVO endpoint nel worker, ritorna `{ok, registered, affiliate_id}` per l'utente loggato — vedi punto 6 sotto).

### 6. NUOVO endpoint `GET /affiliate/me`

```js
async function handleAffiliateMe(request, env) {
  const token = request.headers.get("X-Account-Token");
  const session = await verifyAccountAuth(token, env);
  if (!session) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!env.DB) return jsonResponse({ ok: false, error: "Database not configured" }, 500);
  const aff = await env.DB.prepare("SELECT id FROM affiliates WHERE email = ?").bind(session.email).first();
  if (aff) return jsonResponse({ ok: true, registered: true, affiliate_id: aff.id });
  return jsonResponse({ ok: true, registered: false });
}
```

Routing: `if (path === "/affiliate/me") return withCors(handleAffiliateMe(request, env));`

## Extension client changes

### `app/src/options.js` — Tab "Invita Amici"

Quando l'utente apre la sezione referral (`activateSection("invita")` o `loadReferral()`):

1. Se ha un account token (`adoffAccountToken` in storage o equivalente), chiama `POST /referral/register-code` con `body.code = adoffReferralCode`. Idempotente — chiamare ogni volta non fa danni.
   - Se l'utente NON è loggato all'account, la registrazione è impossibile → mostra avviso "Per attivare i referral, accedi al tuo account su adoff.app".
2. Chiama `GET /referral/stats?code=ADO-XXXXX` (sempre, anche senza auth).
3. Aggiorna `chrome.storage.local`: `adoffReferralCount`, `adoffReferralDays`, `adoffReferralHistory` con i dati ricevuti.
4. Re-render UI.

NB: il token account si salva con chiave `adoffAccountToken` (o legge da `localStorage` del sito? — NO, l'estensione non può leggere localStorage del sito. Quindi serve un meccanismo per propagare il token. Per ora **usa solo l'endpoint pubblico `/referral/stats`**, e per la registrazione fai apparire un bottone "Collega al tuo account" che apre `https://adoff.app/account/?link_referral=ADO-XXXXX`).

**Semplificazione approvata**: l'estensione fa SOLO `/referral/stats` (no register-code). La registrazione del codice avviene quando l'utente apre `https://adoff.app/account/?link_referral=ADO-XXXXX` da Options. Sull'account page, JS legge il param e chiama POST `/referral/register-code` (autenticato, l'account ha già `_token`).

Quindi:
- Bottone in Options "Collega al tuo account" → apre il link
- account/index.html legge `?link_referral=` da URL, se utente loggato chiama `/referral/register-code`, mostra success/error.

## File da modificare

| File | Owner agent |
|---|---|
| `sviluppo/license-system/worker.js` | Server worker |
| `site/_redirects` | Site |
| `site/account/index.html` | Site |
| `app/src/options.js` | Extension client |
| `app-firefox/src/options.js` | Extension client (sync) |

## Endpoint contract summary (cheat sheet)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | /referral/register-code | X-Account-Token | `{code}` | `{ok, code}` |
| GET | /referral/stats?code=X | none | — | `{ok, code, count, daysEarned, history}` |
| GET | /affiliate/me | X-Account-Token | — | `{ok, registered, affiliate_id?}` |

(Endpoint esistenti `/affiliate/register`, `/affiliate/stats?id=X` invariati.)

## KV schema

| Key | Value |
|---|---|
| `referral:{code}` | `{email, createdAt}` |
| `user_referral:{email}` | `{code}` (inverse lookup) |
| `referral_stats:{code}` | `{count, daysEarned, history, paidEmails}` |
| `user:{email}` | esistente (no change) |
