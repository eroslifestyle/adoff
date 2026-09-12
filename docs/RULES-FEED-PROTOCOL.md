# Rules Feed Protocol (v2, DISABILITATO)

> Stato attuale: il feed remoto è **spento**. `REMOTE_RULES_ENABLED = false` in
> `app/src/background.js` (e copie Firefox/Safari). La funzione `syncRemoteRules()`
> ritorna immediatamente: nessun fetch, nessuna modifica alle regole.
> Motivo: il backend non firma ancora i payload. Questo documento descrive cosa
> serve lato backend prima di riattivare l'interruttore.

## Novità v2 (revisione quota/allocazione)

- **Quota reale, non assunta**: prima di qualunque modifica il client conta le
  regole dinamiche effettivamente presenti (`getDynamicRules()`) e usa la quota
  reale del browser (costante runtime, vedi sotto). Non ci sono più numeri fissi.
- **Strategia a due rami** (sostituisce il vecchio "apply atomico"): vedi sotto.
- **Allocazione ID con guard**: mai un ID fuori da `[baseId, baseId+idSpan)`;
  range saturo → fallimento esplicito, zero modifiche.
- **Key rotation reale**: mappa `RULES_FEED_KEYS` con `active`/`deprecated`.
- **Validazione temporale completa**: clock skew su `issuedAt`, durata massima
  feed, `expiresAt > issuedAt`.

## Quota reale DNR (fonte)

Il limite applicato è la costante esposta a runtime dall'API:

- `chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` —
  30.000 su Chrome/Edge/Opera stable (saldo combinato dynamic+session).
  Fonte: developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
  (sezione "Property: MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES").
- Firefox: esposta via `browser.declarativeNetRequest` (WebExtension API
  mirror); il limite combinato è più basso di Chrome su versioni meno recenti.
  Fonte: developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest
- Safari ≥ 16.4: allinea il modello Chrome (dichiarativo MV3 nativo).
  Fonte: developer.apple.com/documentation/safariservices/safari-web-extensions

**Fallback conservativo dichiarato**: se un browser non espone la costante a
runtime (`realDynamicQuota()` ritorna `5000`), il client non rifiuta il feed per
questo motivo ma conta le regole REALI presenti per calcolare headroom. Il
numero 5000 è un limite minimo storico garantito; il conteggio reale previene
il superamento anche in questo caso. Documentare in `adoffRemoteRulesError`
qualsiasi apply rifiutato per quota.

## Strategia a due rami (apply)

Il vecchio "apply atomico" (tutte le aggiunte prima delle rimozioni) supera la
quota reale quando il feed è comparabile al ruleset esistente. Nuova strategia,
scelta in base al budget calcolato PRIMA di toccare qualunque regola:

**Calcolo iniziale** (identico per entrambi i rami):
- `existing` = tutte le regole dinamiche reali (`getDynamicRules()`)
- `inRange` = quelle in `[baseId, baseId+idSpan)` (gestite dal feed)
- `otherCount` = `existing.length - inRange.length` (whitelist IMA, ecc.)
- `headroom = realQuota - otherCount`
- delta: `toAdd` = regole nuove non identiche a quelle esistenti;
  `toRemoveIds` = vecchie non più nel feed; **regole identiche NON toccate**

**Ramo A — headroom sufficiente** (`inRange.length + toAdd.length <= headroom`):
1. aggiungi `toAdd` in chunk (ID assegnati solo dal range libero)
2. verifica successo di ogni chunk
3. SOLO dopo add completo: rimuovi `toRemoveIds`
4. fallback: add fallito → rollback dei chunk parziali; remove fallita dopo add
   riuscito → rollback COMPLETO (rimosse anche le aggiunte di questo apply).
   In nessun caso restano vecchie+nuove insieme come stato finale di errore.
5. solo a successo: `adoffRulesFeedVersion = payload.version`

**Ramo B — headroom insufficiente**: rifiuto esplicito PRIMA di toccare
qualunque regola. `adoffRemoteRulesError = "quota insufficiente per applicare
il feed senza gap di sicurezza"`. Il feed precedente resta intatto,
`adoffRulesFeedVersion` NON avanza. Non si tenta interleaving remove+add
parziale: troppo rischioso da verificare.

## Allocazione ID

- Gli ID assegnati vivono SEMPRE in `[baseId, baseId+idSpan)` (default
  `[60000, 100000)`): ultimo ID lecito = `baseId + idSpan - 1` = 99.999.
- Il set di ID realmente usati è letto da `getDynamicRules()` filtrata sul
  range, MAI assunto.
- Range saturo → fallimento esplicito, zero modifiche, nessun ID allocato
  fuori range. Nessun overflow silenzioso.

## Key rotation

Mappa client (`background.js`, tutti e 3 i target):

```js
const RULES_FEED_KEYS = {
  "rules-feed-2026-01": { jwk: { kty: "EC", crv: "P-256", x: "...", y: "..." }, status: "active" },
  // in rotazione:
  // "rules-feed-2025-12": { jwk: {...}, status: "deprecated" },
};
```

La verifica accetta una firma se il `keyId` del payload è presente nella mappa
con status `active` O `deprecated` (grace period). Un `keyId` assente dalla
mappa → rifiuto esplicito.

**Processo di rotazione**:
1. Il backend genera una nuova coppia P-256 e pubblica il JWK (via canale
   sicuro, es. PR firmata dal maintainer).
2. Si aggiunge alla mappa come `status: "active"` (la vecchia resta `active`
   se non ancora sostituita, o passa a `deprecated` da subito).
3. Il backend firma i nuovi feed SOLO con la nuova chiave (il `keyId` nel
   payload cambia).
4. **Grace period consigliato: 48 ore** (= MAX_FEED_AGE_MS: tutti i feed
   vecchi scadono naturalmente) prima di marcare la vecchia come `deprecated`,
   e almeno 7 giorni prima di rimuoverla dalla mappa (copre utenti offline).
5. Rimozione dalla mappa = chiave irrevocabilmente rifiutata; farlo solo dopo
   la finestra massima di refresh del client (7-14 giorni).
6. MAI reinserire una chiave rimossa; in caso di compromissione, rimuovere
   immediatamente la chiave compromessa dalla mappa e ruotare su una nuova.

## Formato canonico del payload

```json
{
  "version":   12,                          // intero, strettamente crescente
  "issuedAt":  1700000000000,               // epoch ms, non oltre +5min nel futuro (MAX_CLOCK_SKEW_MS)
  "expiresAt": 1700086400000,               // epoch ms, DEVE essere > issuedAt e > now; durata max 48h (MAX_FEED_AGE_MS)
  "keyId":     "rules-feed-2026-01",        // deve essere una chiave nella mappa (active o deprecated)
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

## Requisiti backend (prima di riattivare)

1. **Generazione chiave**: coppia ECDSA P-256, privata sul backend (mai nel
   repo client), pubblica in JWK (`{ kty: "EC", crv: "P-256", x, y }`).
2. **Firma**: serializzare i 5 campi canonici nell'ordine sopra e firmare con
   SHA-256; pubblicare la firma base64 in `signature`.
3. **keyId**: il payload DEVE portare il `keyId` della chiave usata; il client
   rifiuta chiavi assenti da `RULES_FEED_KEYS`.
4. **Endpoint**: servire `rules-feed.json` con `Cache-Control: no-store` (o TTL
   breve), `expiresAt` entro 48h da `issuedAt`, `version` strettamente crescente.
5. **Distribuzione chiave pubblica**: aggiornare `RULES_FEED_KEYS` in
   `background.js` (tutti e 3 i target) col JWK reale, poi mettere
   `REMOTE_RULES_ENABLED = true`.

## Monotonia versione e reset di stato

- La versione è salvata in `adoffRulesFeedVersion` SOLO dopo apply riuscito.
- Storage vuoto/mai inizializzato = baseline `0`: il primo feed valido deve
  avere `version > 0` (`version: 0` non è mai accettato).
- Un reset dello storage riporta la baseline a 0 e un feed con `version: 1`
  verrebbe riaccettato: comportamento accettato e documentato — il reset è
  un'azione locale dell'utente, non un vettore remoto.

## Protezioni lato client

| Protezione | Implementazione |
|---|---|
| **Firma obbligatoria** | `verifyRulesFeedSignature()` — ECDSA P-256/SHA-256, payload manomesso = rifiutato |
| **Key rotation** | `RULES_FEED_KEYS` — keyId sconosciuto rifiutato; `active`+`deprecated` accettate |
| **Expiry** | `expiresAt < Date.now()` → rifiutato |
| **Clock skew** | `issuedAt > now + MAX_CLOCK_SKEW_MS (5min)` → rifiutato |
| **Durata massima feed** | `expiresAt - issuedAt > MAX_FEED_AGE_MS (48h)` → rifiutato |
| **Coerenza temporale** | `expiresAt <= issuedAt` → rifiutato (anche se expiresAt è nel futuro) |
| **Monotonia versione** | `version <= adoffRulesFeedVersion` → rifiutato (anti-replay/rollback); baseline 0 dopo reset |
| **Allowlist azioni** | solo `block`/`allow`; qualunque altra azione rifiuta il feed intero |
| **`main_frame` ristretto** | solo con `requestDomains`/`initiatorDomains` espliciti |
| **Quota reale** | Ramo B: rifiuto PRIMA di toccare le regole se headroom insufficiente |
| **Rollback** | add fallito → rollback parziali; remove fallita → rollback completo |
| **Range ID garantito** | mai ID fuori `[baseId, baseId+idSpan)`; range saturo → fallimento esplicito |
| **Fail-safe rete** | fetch fallito/malformato → warning loggato, ultimo ruleset valido mantenuto |
| **Kill-switch** | `REMOTE_RULES_ENABLED = false` → nessun fetch, nessun rischio |

## Check-list riattivazione

- [ ] Backend firma i payload (chiave P-256 generata, privata custodita)
- [ ] `RULES_FEED_KEYS` aggiornato col JWK reale (`active`) nei 3 target
- [ ] Endpoint serve payload con `expiresAt` futuro e `version` crescente
- [ ] `REMOTE_RULES_ENABLED = true` nei 3 target
- [ ] `node sviluppo/tests/test-dnr-feed-signature.js` verde
- [ ] Sync check `app/`, `app-firefox/`, `app-safari/` + build
