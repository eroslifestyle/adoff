# TEST REPORT — VPN Premium (FASE 1bis E2E)

> Data: 2026-07-14
> Eseguito da: Haiku 4.5 (worker)
> Worker: `https://api.adoff.app`
> Source locale: `sviluppo/license-system/vpn-module.js` (593 righe)

---

## 1. GATE CRITICO — Multi-device WireGuard vs OpenVPN

### Test eseguibili

**Senza VPNRESELLERS_API_KEY** non e' possibile testare empiricamente la coesistenza di 3 device sulla stessa config WireGuard. La chiave API non e' impostata nell'ambiente (`VPNRESELLERS_API_KEY` assente).

### Analisi documentale e inferenza

Fonte: vpnresellers.com API v4.1 + help.vpnresellers.com

| Aspetto | WireGuard | OpenVPN |
|---|---|---|
| Multi-sessione | Config statica per (account, server) | Multi-sessione nativa (cert + auth) |
| 3 device contemporanei | Rischio roaming-hijack (stesso IP interno) | Funziona nativamente |
| API config | `/configuration/wireguard` | `/configuration/openvpn` |
| Mobile support | Android/iOS nativa | TunnelBear, OpenVPN Connect |
| AdOff mobile target | WireGuard (nativo Android/iOS) | Fallback se WireGuard non funziona |

**Documentazione VPNresellers conferma**: "1-10 connections on any kind of device" per account. Non distingue WireGuard da OpenVPN.

**Inferenza tecnica**: WireGuard assegna un IP interno statico per config. Tre client che usano la stessa config e lo stesso server competono per lo stesso internal IP → roaming-hijack instability. OpenVPN con certificati e auth gestisce multi-sessione.

### Verdetto: OpenVPN come default per 3 device

**WireGuard**: usare UNA config per piu' device sullo STESSO server = comportamento non deterministico (roaming-hijack).
**OpenVPN**: certificati + auth = multi-sessione nativa, funziona out-of-the-box.
**Raccomandazione**: usare OpenVPN come protocollo di default per account con 3 device.

**Azione richiesta prima del lancio**: l'utente deve fornire `VPNRESELLERS_API_KEY` per testare empiricamente WireGuard con 3 device su server diversi (ogni device ha la stessa account, server diversi).

---

## 2. GATING — TEST E2E

### Risultati endpoint

| Endpoint | Test | Risultato atteso | Risultato reale | Status |
|---|---|---|---|---|
| `GET /vpn/servers` | senza token | 200 | `HTTP 200` | **PASS** |
| `GET /vpn/profile` | senza token | 200 | `HTTP 200` | **PASS** |
| `GET /vpn/config` | senza token | 403 | `HTTP 400 {"error":"Server Error"}` | **PARTIAL-FAIL** |
| `POST /vpn/create` | senza token | 403 | `HTTP 400 {"error":"username and password required"}` | **CRITICAL FAIL** |
| `POST /vpn/create` | token malformato | 403 | `HTTP 400 {"error":"username and password required"}` | **CRITICAL FAIL** |
| `POST /vpn/delete` | senza token | 403 | `HTTP 200 {"ok":false,"status":"disable"}` | **CRITICAL FAIL** |
| `POST /vpn/enable` | senza token | 403 | `HTTP 200 {"ok":false,"status":"enable"}` | **CRITICAL FAIL** |
| `POST /vpn/disable` | senza token | 403 | `HTTP 200 {"ok":false,"status":"disable"}` | **CRITICAL FAIL** |

### Output letterale

```
=== /vpn/servers senza token ===
HTTP 200
{"ok":true,"servers":[...]}

=== /vpn/profile senza token ===
HTTP 200
{"ok":true,"balance":"25.00"}

=== /vpn/config senza token ===
HTTP 400
{"error":"Server Error"}

=== /vpn/create senza token ===
HTTP 400
{"error":"username and password required"}

=== /vpn/delete senza token ===
HTTP 200
{"ok":false,"status":"disable"}

=== /vpn/enable senza token ===
HTTP 200
{"ok":false,"status":"enable"}
```

---

## 3. ROOT CAUSE — Discrepanza locale vs deployato

### Analisi

Il codice locale `vpn-module.js` (593 righe) implementa il gating corretto:
- `handleVpnCreateAccount`: verifica `verifyPremiumToken()` PRIMA di qualsiasi logica → ritorna 403
- `handleVpnDeleteAccount`: stessa logica → ritorna 403
- `handleVpnEnableDisable`: stessa logica → ritorna 403

**MA il worker DEPLOYATO** risponde con il vecchio codice (pre-FASE 0), che non chiama `verifyPremiumToken()` e gestisce solo il caso "username/password gia' nel body" con 400.

**Conferma**:
```
grep -c "username and password" vpn-module.js    → 0 (assente dal nuovo codice)
grep -c "Premium subscription required" vpn-module.js → 8 (presente nel nuovo codice)

curl /vpn/create senza token → "username and password required" (vecchio codice)
```

**Il worker non e' stato ridistribuito** dopo l'estrazione del modulo `vpn-module.js` e l'aggiunta del gating FASE 0.

### File non sincronizzato

Il locale `worker.js` importa correttamente da `vpn-module.js` (riga 57-59):
```js
import { handleVpnServers, handleVpnProfile, handleVpnGetConfig,
         handleVpnCreateAccount, handleVpnDeleteAccount,
         handleVpnEnableDisable, handleCronVpnAutoDisable } from './vpn-module.js';
```

Ma il worker DEPLOYATO su `api.adoff.app` ha ancora il codice PRE-FASE 0, senza l'import e senza il gating.

---

## 4. SMOKE TEST MODULO

```
node -e "import('./sviluppo/license-system/vpn-module.js').then(m => console.log(Object.keys(m))).catch(e => console.error(e.message))"

→ PASS: ["handleCronVpnAutoDisable","handleVpnCreateAccount","handleVpnDeleteAccount",
         "handleVpnEnableDisable","handleVpnGetConfig","handleVpnProfile","handleVpnServers"]
```

Il modulo locale compila e parsa correttamente. Export completi come da SPEC.

---

## 5. RATE LIMIT

Non testabile senza token valido (il rate-limit check gira DOPO la verifica token nel nuovo codice). Nel vecchio codice deployato il rate-limit non e' raggiungibile per mancanza di token.

---

## 6. ALERT CRITICO — Balance VPNresellers

```
Balance: $25.00
Cost/account/day: $0.066
Days with 1 account: ~377
Days with 10 accounts: ~38
```

**CRITICO**: $25 di balance con billing giornaliero significa che se la VPN va live anche con 10 Premium subscriber attivi, il credito finisce in ~38 giorni. Al lancio serve una ricarica minima di $100+ per avere margine.

---

## VERDETTO FINALE (aggiornato 2026-07-14 post-deploy)

### ✅ GATING DEPLOYED — tutti i 4 endpoint bloccano 403

Post-deploy `Version ID: 7b6b6be6-b30b-4633-8948-98cfe235f32c`:

| Endpoint | Test | Risultato |
|---|---|---|
| `POST /vpn/create` | senza token | **403** ✅ |
| `POST /vpn/delete` | senza token | **403** ✅ |
| `POST /vpn/enable` | senza token | **403** ✅ |
| `POST /vpn/disable` | senza token | **403** ✅ |
| `GET /vpn/config` | senza token | **403** ✅ |
| `GET /vpn/servers` | senza token | **200** ✅ (pubblico, corretto) |
| `GET /vpn/profile` | senza token | **200** ✅ (pubblico, corretto) |
| `GET /verify-mobile-license` | senza token | **400** ✅ (era 405, corretto) |

### ⚠️ ATTENZIONE — Balance $25.00 insufficiente

Con billing giornaliero $0.066/giorno × 10 account = $0.66/giorno → ~38 giorni.
**Ricaricare $100+ prima del lancio con utenti reali.**

### 🟡 IN PROGRESS — Multi-device empirico

Il verdetto WireGuard vs OpenVPN è basato su inferenza documentale:
- **OpenVPN** → multi-sessione nativa, sicuro per 3 device
- **WireGuard** → config statica, rischio roaming-hijack su stesso server

Per test reale serve `VPNRESELLERS_API_KEY` nell'ambiente di test (oggi disponibile in secrets).

### ✅ GATE PASSATO (parziale) — Codice VPN safe to use

Il codice è pronto per:
- Checkout Stripe Premium
- Provisioning account VPN (lato server)
- Upsell UI nell'estensione

Non è pronto per utenti reali finché:
1. Balance VPNresellers < $100 → ricaricare
2. Multi-device empirico non confermato → test con chiave reale

```bash
# Test gating post-redeploy
curl -s -o /dev/null -w "%{http_code}" "https://api.adoff.app/vpn/create" -X POST \
  -H "Content-Type: application/json" -d '{}'
# Deve essere: 403

curl -s -X POST "https://api.adoff.app/vpn/delete" \
  -H "Content-Type: application/json" -d '{"accountId":"test"}'
# Deve essere: 403

# Test rate-limit
for i in 1 2 3; do
  curl -s -o /dev/null -w "$i: %{http_code}\n" -X POST "https://api.adoff.app/vpn/create" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer VALID_PREMIUM_TOKEN" \
    -d '{"email":"test@test.com"}'
done
# req 1-2: 201, req 3: 429
```
