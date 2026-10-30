# API Contract — AdOff VPN Endpoints

> **Sorgente**: `sviluppo/license-system/vpn-module.js` (FASE 0, 2026-07-14)
> **Gating**: tutti gli endpoint `/vpn/*` richiedono autenticazione Premium ECDSA P-256
> tranne `/vpn/servers` e `/vpn/profile` (info pubblica, accessibili anche a tier=pro).
> **Anti-abuso**: rate-limit 2 create/ora per IP, deviceId lock, audit log D1.

---

## Autenticazione

### Bearer Token (Premium)

Tutti gli endpoint protetti richiedono:

```
Authorization: Bearer <payloadB64.sigB64>
```

- **Firma**: ECDSA P-256 (stessa chiave di `TRIAL_MOBILE_PUBKEY_JWK` embeddata nel modulo)
- **Payload**: `{"deviceId":"<uuid>","tier":"premium","expiresAt":<ms>,"iat":<ms>,"v":1}`
- **Anti-replay**: `iat` non più vecchio di ±5 minuti
- **Anti-sharing**: `deviceId` nel token DEVE coincidere con quello richiesto dall'endpoint
- **Scadenza**: `expiresAt` > `Date.now()`

Se il token è assente o invalido → `403 {"error":"Premium subscription required"}`

---

## Endpoints

### `GET /vpn/servers`

Lista dei server VPN disponibili (VPNresellers.com).

**Autenticazione**: opzionale (accessibile anche a tier=pro|pro_mixed per upsell)

**Response `200`**:
```json
{
  "ok": true,
  "servers": [
    {
      "id": 42,
      "name": "Switzerland #1",
      "country": "CH",
      "city": "Zurich",
      "ip": "185.x.x.x"
    }
  ]
}
```

**Errori**:
- `502` — VPNresellers API irraggiungibile

---

### `GET /vpn/profile`

Balance e stato account reseller (interno AdOff).

**Autenticazione**: opzionale (accessibile anche a tier=pro|pro_mixed)

**Response `200`**:
```json
{
  "ok": true,
  "balance": "125.00"
}
```

---

### `GET /vpn/config`

Ritorna la config WireGuard per un account/server.

**Autenticazione**: **Bearer token, tier=premium** (obbligatorio)

**Query params**:
| Param | Tipo | Descrizione |
|---|---|---|
| `accountId` | string | ID account VPNresellers |
| `serverId` | string | ID server target |
| `deviceId` | string | Device ID (deve coincidere col token) |

**Response `200`**:
```json
{
  "ok": true,
  "config": "[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ...\nEndpoint = 185.x.x.x:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25",
  "name": "Switzerland #1"
}
```

**Errori**:
- `400` — `accountId` o `serverId` mancanti
- `403` — token mancante / tier non premium / deviceId mismatch

---

### `POST /vpn/create`

Crea un nuovo account VPN su VPNresellers.com.

**Autenticazione**: **Bearer token, tier=premium** (obbligatorio)

**Body** (tutti i campi opzionali tranne deviceId che viene dal token):
```json
{
  "email": "user@example.com",
  "firstName": "Mario",
  "lastName": "Rossi"
}
```

**Nota**: `username` e `password` vengono generati lato server (formato sicuro). Il client NON li invia.

**Response `201`**:
```json
{
  "ok": true,
  "accountId": "acc_abc123",
  "username": "adXk9Qm2pLrT",
  "status": "active",
  "wgIp": "10.0.0.2"
}
```

**Errori**:
- `400` — errore VPNresellers (es. email già usata)
- `403` — token mancante / tier non premium
- `429` — rate-limit superato (max 2 create/ora per IP)

  ```json
  { "error": "Too many account creation requests. Try again later.", "retryAfterMs": 1800000 }
  ```

**Audit**: create logged in `vpn_audit` (D1) con timestamp, account_id, device_id, ip.

---

### `POST /vpn/delete`

Elimina un account VPN.

**Autenticazione**: **Bearer token, tier=premium** (obbligatorio)

**Body**:
```json
{ "accountId": "acc_abc123" }
```

**Response `200`**:
```json
{ "ok": true }
```

**Errori**:
- `400` — `accountId` mancante
- `403` — token mancante / tier non premium

**Audit**: delete logged in `vpn_audit`.

---

### `POST /vpn/enable`

Riattiva un account VPN disabilitato.

**Autenticazione**: **Bearer token, tier=premium** (obbligatorio)

**Body**:
```json
{ "accountId": "acc_abc123" }
```

**Response `200`**:
```json
{ "ok": true, "status": "enable" }
```

**Errori**:
- `400` — `accountId` mancante
- `403` — token mancante / tier non premium

**Audit**: enable logged in `vpn_audit`.

---

### `POST /vpn/disable`

Disattiva un account VPN (billing pausa, disdetta, auto-disable).

**Autenticazione**: **Bearer token, tier=premium** (obbligatorio)

**Body**:
```json
{ "accountId": "acc_abc123" }
```

**Response `200`**:
```json
{ "ok": true, "status": "disable" }
```

**Errori**:
- `400` — `accountId` mancante
- `403` — token mancante / tier non premium

**Audit**: disable logged in `vpn_audit`.

---

### `GET /vpn/auto-disable`

Endpoint interno per cron Cloudflare. Controlla e disattiva account VPN inattivi/abbonamenti scaduti.

**Autenticazione**: `X-Admin-Token` header (stesso di `/admin/*`)

**Response `200`**:
```json
{
  "ok": true,
  "disabled": [
    { "deviceId": "...", "accountId": "acc_abc123", "reason": "inactive_7d" }
  ],
  "errors": [],
  "checked": 15,
  "timestamp": 1752523200000
}
```

**Errori**:
- `401` — admin token mancante o errato

**Note**: chiamato dal cron CF alle 10:00 UTC (trigger `0 10 * * *` in wrangler.toml). Non è un endpoint pubblico.

---

## Codici errore comuni

| HTTP | `error` | Causa |
|---|---|---|
| `400` | `accountId and serverId required` | Parametri mancanti |
| `400` | `Failed to create account` | VPNresellers API error |
| `401` | `Invalid signature` | Firma ECDSA non valida |
| `401` | `Token expired or not yet valid` | iat fuori tolleranza ±5min |
| `403` | `Premium subscription required` | Nessun token / tier non premium / deviceId mismatch |
| `429` | `Too many account creation requests...` | Rate-limit 2/ora superato |
| `500` | `Signature verification failed` | Errore server chiave ECDSA |

---

## Rate Limiting

| Endpoint | Limite | Window |
|---|---|---|
| `POST /vpn/create` | 2 richieste | 1 ora per IP |

Chiave KV: `vpn_rl:<CF-Connecting-IP>`

---

## Schema D1 — `vpn_audit`

```sql
CREATE TABLE IF NOT EXISTS vpn_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,        -- create|delete|enable|disable|auto_disable_inactive
  account_id TEXT,
  device_id TEXT,
  ip TEXT,                     -- IP richiedente, MAI traffico/siti
  extra TEXT                   -- JSON: { reason, lastSeen } per auto_disable
);
```

## Schema D1 — `vpn_accounts` (mapping, creato dal cron)

```sql
CREATE TABLE IF NOT EXISTS vpn_accounts (
  device_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_enabled_at INTEGER NOT NULL,
  last_seen INTEGER            -- ultima connessione (per auto-disable >7gg)
);
```

---

## Note implementative

- **Chiave ECDSA**: `TRIAL_MOBILE_PUBKEY_JWK` embeddata in `vpn-module.js` (rievoca le stesse chiavi del trial). La privata è in `env.ADOFF_TRIAL_PRIVKEY` (secret Cloudflare). **Prossimo step**: migrare a chiavi dedicate `ADOFF_LICENSE_PRIVKEY` per separare i due token.
- **Segreti**: `VPNRESELLERS_API_KEY` in secret, MAI hardcoded.
- **Logging**: MAI loggare credenziali, IP utente (oltre l'IP richiedente per rate-limit), traffico, siti visitati.
- **Billing VPNresellers**: $1,99/account/mese. Billing giornaliero. Auto-disable dopo 7gg di inattività = controllo principale del margine.
