# Rules Feed Protocol (v1, DISABILITATO)

> Stato attuale: il feed remoto è **spento**. `REMOTE_RULES_ENABLED = false` in
> `app/src/background.js` (e copie Firefox/Safari). La funzione `syncRemoteRules()`
> ritorna immediatamente: nessun fetch, nessuna modifica alle regole.
> Motivo: il backend non firma ancora i payload. Questo documento descrive cosa
> serve lato backend prima di riattivare l'interruttore.

## Perché disabilitato

Il feed scarica regole DNR da `https://adoff.app/rules-feed.json` e le applica a
runtime. Senza firma verificabile, chi compromette il server (o l'HTTPS) può
spingere regole arbitrarie a tutti gli utenti. Il client ha la verifica pronta
(ECDSA P-256, scadenza, monotonia, allowlist, apply atomico) ma la chiave
pubblica è un **placeholder**: `RULES_FEED_PUBLIC_KEY_JWK = null` in
`background.js`. Finché il backend non firma, il feed resta spento.

## Formato canonico del payload

```json
{
  "version":   12,                          // intero, strettamente crescente
  "issuedAt":  1700000000000,               // epoch ms
  "expiresAt": 1700086400000,               // epoch ms, DEVE essere > now
  "keyId":     "rules-feed-2026-01",        // id della chiave di firma
  "rules":     [ { "action": {...}, "condition": {...} } ],
  "signature": "base64(ECDSA-P256-SHA256)"  // sui SOLI 5 campi sopra, in quest'ordine
}
```

**Bytes firmati**: `JSON.stringify({ version, issuedAt, expiresAt, keyId, rules })`
— esattamente quest'ordine di chiavi, senza `signature`. Implementazione di
riferimento: `canonicalFeedJson()` in `app/src/rules-feed-verify.js`.

## Firma: ECDSA P-256 + SHA-256

Scelta per massima compatibilità: `crypto.subtle` nei service worker MV3
(Chrome/Safari/Firefox) supporta nativamente ECDSA P-256; Ed25519 non è
disponibile ovunque nei service worker. La firma si verifica con:

```js
crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sigBytes, canonicalBytes)
```

Riferimento client: `verifyRulesFeedSignature()` in `app/src/rules-feed-verify.js`
(modulo condiviso, testato da `sviluppo/tests/test-dnr-feed-signature.js`).

## Cosa deve implementare il backend (prima di riattivare)

1. **Generazione chiave**: coppia ECDSA P-256, tenere la privata sul backend
   (mai nel repo client), esportare la pubblica in formato JWK
   (`{ kty: "EC", crv: "P-256", x, y }`).
2. **Firma**: alla generazione del feed, serializzare i 5 campi canonici
   nell'ordine sopra e firmare con SHA-256; pubblicare la firma base64 nel
   campo `signature`.
3. **keyId**: identificare la chiave corrente (per future rotazioni). Il client
   oggi verifica solo con la chiave embeddata; il campo è comunque obbligatorio.
4. **Endpoint**: servire `rules-feed.json` con `Cache-Control: no-store` (o TTL
   breve) e il campo `expiresAt` ragionevole (24-48h consigliate).
5. **Distribuzione chiave pubblica**: aggiornare `RULES_FEED_PUBLIC_KEY_JWK`
   in `background.js` (tutti e 3 i target) con il JWK reale, poi mettere
   `REMOTE_RULES_ENABLED = true`.

## Protezioni già pronte lato client

| Protezione | Implementazione |
|---|---|
| **Firma obbligatoria** | `verifyRulesFeedSignature()` — ECDSA P-256/SHA-256, payload manomesso = rifiutato |
| **Expiry** | `expiresAt < Date.now()` → rifiutato |
| **Monotonia versione (anti-replay/rollback)** | `version <= adoffRulesFeedVersion` (storage) → rifiutato. La versione è salvata **solo dopo** apply riuscito |
| **Allowlist azioni** | solo `block`/`allow`; `redirect`, `modifyHeaders`, qualunque altra azione → rifiutato (feed intero, anche una sola regola cattiva) |
| **`main_frame` ristretto** | regole su navigazione intera ammesse solo con `requestDomains`/`initiatorDomains` espliciti |
| **Sanitize per-regola** | `sanitizeRemoteRule()` — condition ricostruita con soli campi safe, limiti di lunghezza, priority 1-100 |
| **Apply atomico** | `applyAtomic()` — tutte le regole nuove (ID nuovi, mai confliggenti) vengono aggiunte PRIMA; solo dopo la riuscita vengono rimosse le vecchie. Add fallito → rollback dei chunk parziali, nessuna remove, ruleset precedente intatto |
| **Fail-safe rete** | fetch fallito/malformato → warning loggato, ultimo ruleset valido mantenuto |
| **Kill-switch** | `REMOTE_RULES_ENABLED = false` → nessun fetch, nessun rischio |

## Check-list riattivazione

- [ ] Backend firma i payload (chiave P-256 generata, privata custodita)
- [ ] Endpoint serve payload con `expiresAt` futuro e `version` crescente
- [ ] `RULES_FEED_PUBLIC_KEY_JWK` aggiornato col JWK reale nei 3 target
- [ ] `REMOTE_RULES_ENABLED = true` nei 3 target
- [ ] `node sviluppo/tests/test-dnr-feed-signature.js` verde
- [ ] Sync check `app/`, `app-firefox/`, `app-safari/` + build
