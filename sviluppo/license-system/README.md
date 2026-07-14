# AdOff License System — Architettura

## Overview

Sistema proprietario di gestione licenze a 3 componenti:

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  Estensione  │────▶│  Cloudflare Worker  │────▶│ Cloudflare   │
│  (Chrome)    │◀────│  api.adoff.app      │◀────│ KV Database  │
└──────────────┘     └─────────────────────┘     └──────────────┘
                              ▲
                              │
                     ┌────────┴────────┐
                     │  Admin Panel    │
                     │  (locale/web)   │
                     └─────────────────┘
```

## Componenti

### 1. License Key Generator (`keygen.py`)
- Genera chiavi formato `ADOFF-XXXX-XXXX-XXXX`
- Firma con HMAC-SHA256
- Encode: piano, scadenza, device limit
- Puo' girare in locale o nel Worker

### 2. Cloudflare Worker (`worker.js`)
- API REST: /validate, /activate, /deactivate, /info
- Salva licenze in Cloudflare KV
- Rate limiting per IP
- Device fingerprinting (max 3 dispositivi)
- CORS per l'estensione
- Costo: ZERO (100K req/giorno free tier)

### 3. Client Validation (`license-client.js`)
- Validazione offline (HMAC signature check)
- Validazione online (API call ogni 7 giorni)
- Cache locale con fallback
- Fingerprint dispositivo

### 4. Admin Dashboard (`admin.html`)
- Genera nuove licenze
- Visualizza tutte le licenze attive
- Revoca licenze
- Statistiche

## Sicurezza

- HMAC-SHA256 per firma chiavi
- HTTPS obbligatorio (Cloudflare)
- Rate limiting: 10 req/min per IP
- Device limit: max 3 dispositivi per licenza
- Validazione doppia: offline (firma) + online (server)
- Revoca istantanea server-side
