---
title: "AdOff — Documentazione Completa"
version: "3.1.0"
last_updated: "2026-04-19"
language: "it"
tags: ["adoff", "chrome-extension", "ad-blocker", "manifest-v3", "documentazione"]
---

# AdOff — Documentazione Completa v3.1.0

**Data:** 2026-04-18
**Versione:** 3.0.0
**Stato:** Pre-lancio (pronto per Chrome Web Store)
**Autore:** Documentazione generata da audit completo del codebase

---

## Indice

1. [Panoramica Progetto](#1-panoramica-progetto)
2. [Cronologia Sviluppo Completa](#2-cronologia-sviluppo-completa)
3. [Architettura Tecnica](#3-architettura-tecnica)
4. [Funzionalita' Implementate](#4-funzionalita-implementate)
5. [Sistema Whitelist e Pausa](#5-sistema-whitelist-e-pausa)
6. [Sistema Licensing Proprietario](#6-sistema-licensing-proprietario)
7. [Sistema Pagamenti](#7-sistema-pagamenti)
8. [Internazionalizzazione](#8-internazionalizzazione-i18n)
9. [Brand Identity](#9-brand-identity)
10. [Analisi Competitor](#10-analisi-competitor)
11. [Strategia Commerciale](#11-strategia-commerciale)
12. [Infrastruttura e Deploy](#12-infrastruttura-e-deploy)
13. [Sicurezza](#13-sicurezza)
14. [Bug Risolti](#14-bug-risolti-cronologia)
15. [Test Effettuati](#15-test-effettuati)
16. [File del Progetto](#16-file-del-progetto)
17. [Prossimi Passi](#17-prossimi-passi)
18. [Appendice: Comandi Utili](#18-appendice-comandi-utili)

---

## 1. Panoramica Progetto

### Identita'

| Campo | Valore |
|---|---|
| **Nome** | AdOff (ex Shadow Shield) |
| **Tagline** | "Ads? Off." |
| **Tipo** | Estensione Chrome (Manifest V3) |
| **Versione attuale** | 3.0.0 |
| **Stato** | Pre-lancio |
| **Dimensione** | ~149 KB (estensione completa) |
| **Licenza** | Proprietaria (Freemium) |

### Cosa fa

AdOff e' un ad blocker per Chrome che blocca le pubblicita' a tre livelli:

1. **Rete** — Blocca richieste HTTP verso server pubblicitari (declarativeNetRequest, 107 regole)
2. **DOM** — Nasconde elementi pubblicitari nel HTML della pagina (CSS + JS)
3. **Stealth** (solo Pro/Trial) — Inganna i sistemi anti-adblock dei siti per rendersi invisibile

### Perche' esiste

Il 25 maggio 2023 Google ha imposto Manifest V3 su Chrome, eliminando le API `webRequest` su cui si basava uBlock Origin. La versione Lite di uBlock ha perso il 90% delle funzionalita'. Milioni di utenti Chrome sono rimasti senza un ad blocker efficace. AdOff e' nato per colmare questo vuoto con un'estensione MV3-nativa, leggera e con stealth anti-detection.

### Target utenti

- Utenti Chrome che usavano uBlock Origin e cercano un'alternativa efficace
- Professionisti che vogliono navigazione pulita e veloce
- Utenti italiani (prima estensione ad blocker pensata per il mercato IT)
- Eta' 25-55, comfort medio con la tecnologia

---

## 2. Cronologia Sviluppo Completa

### v1.0 — YouTube-Only (fase iniziale)

**Obiettivo:** Bloccare le pubblicita' su YouTube.

Funzionalita':
- Skip automatico dei bottoni "Salta annuncio" tramite polling ogni 300ms
- Hiding CSS degli elementi ad di YouTube (`ytd-ad-slot-renderer`, `.ytp-ad-module`, etc.)
- Solo YouTube — nessun supporto per altri siti

Problema identificato: il polling ogni 300ms consumava CPU anche quando non c'erano ads.

---

### v2.0 — Universale + Stealth + Network Blocking

**Obiettivo:** Estendere il blocco a tutti i siti e aggiungere protezione stealth.

Funzionalita' aggiunte:
- Blocco network via `declarativeNetRequest` con 107 regole (Google Ads, DoubleClick, Taboola, Outbrain, Facebook Pixel, Amazon Ads, etc.)
- CSS hiding universale per siti non-YouTube
- Stealth mode nel MAIN world: override di `fetch`, `XMLHttpRequest`, `getComputedStyle`, `offsetHeight`, `offsetWidth`, `googletag`, `adsbygoogle`
- MutationObserver con debounce (200ms) per scan DOM continuo
- Background service worker per badge ON/OFF
- Manifest V3 completo con `declarativeNetRequest` e `host_permissions: ["<all_urls>"]`

Architettura introdotta: separazione MAIN world (stealth.js) e ISOLATED world (content.js).

---

### v2.1 — Cookie Auto-Accept + Collasso Aree Vuote

**Obiettivo:** Aggiungere gestione automatica dei cookie banner e pulizia degli spazi vuoti.

Funzionalita' aggiunte:
- `cookie-handler.js` — cliccava automaticamente i bottoni "Accetta" dei cookie banner (selettori per Cookiebot, OneTrust, iubenda, e siti italiani specifici)
- Logica di collasso aree vuote in `content.js`: dopo che il network blocking rimuove l'annuncio, il contenitore HTML rimane vuoto; il codice rileva le dimensioni standard dei banner pubblicitari (728x90, 300x250, 970x250, etc.) e collassa il div
- Rilevamento label "Pubblicita'" / "Ad" nel testo dei contenitori orfani

Problema identificato: il cookie-handler aveva side effect su siti bancari e moduli di login, causando click accidentali su elementi di accettazione non correlati alle pubblicita'.

---

### v2.2 — YouTube Download (aggiunto e rimosso)

**Obiettivo:** Feature sperimentale di download video YouTube.

Funzionalita' aggiunte (poi rimosse):
- `yt-downloader.js` — pannello UI iniettato nella pagina YouTube con pulsanti per scaricare video in diverse qualita', audio MP3 e sottotitoli SRT
- Chiamata a API esterna (`cobalt.tools` o simile) per la conversione

Motivo della rimozione:
- Conflitto con i Termini di Servizio di YouTube
- Rischio rifiuto dal Chrome Web Store
- Complessita' elevata (API esterna, gestione formati video)
- Non allineato con la mission core dell'estensione (blocco ads)

Il file `yt-downloader.js` e' ancora fisicamente in `src/` ma non e' incluso nel `manifest.json`. E' codice morto da eliminare.

---

### v2.3 — Fix YouTube, Pulizia

**Obiettivo:** Stabilizzare il funzionamento su YouTube e rimuovere codice problematico.

Modifiche:
- Rimosso il polling ogni 300ms su YouTube, sostituito con MutationObserver sui cambi di classe del player (attributo `ad-showing`, `ad-interrupting`)
- Aggiunta lista `STEALTH_EXCLUDED` in stealth.js: Google, YouTube, Facebook, Amazon, GitHub, Reddit, LinkedIn vengono esclusi dalle API override per evitare rotture
- Rimosso il controllo `currentTime` e `playbackRate` per forzare skip ads — rompeva l'avvio del video reale
- Rimossi permessi `scripting` e `webNavigation` dal manifest (non usati)
- `cookie-handler.js` rimosso dal manifest (lasciato fisicamente in src/ come codice morto)
- Pulizia selettori CSS: rimossi selettori YouTube aggressivi che rompevano il layout delle pagine canale

Bug risolto: video YouTube che non partivano dopo lo skip dell'ad (il codice modificava `currentTime` del video interrompendo il normale flusso di avvio).

---

### v3.0 — Rebrand AdOff + Whitelist + Opzioni + Licensing + i18n + Onboarding [VERSIONE ATTUALE]

**Obiettivo:** Preparare l'estensione per la commercializzazione.

Cambiamenti brand:
- Rebrand completo da "Shadow Shield" a "AdOff"
- Nuovo nome scelto tra 40 candidati con scoring: AdOff (27/30) vince per SEO nativo, chiarezza, unicita'
- Tagline definitiva: "Ads? Off."
- Nuove icone generate programmaticamente in Python

Funzionalita' aggiunte:
- **Sistema Whitelist completo** — 4 tipi di pausa (sessione, 1 ora, 1 giorno, permanente) con UI nel popup
- **Pagina Opzioni** (`options.html` + `options.js`) — gestione whitelist, licenza, statistiche, impostazioni
- **Sistema Licensing** (`license-client.js`) — validazione HMAC offline + API Cloudflare Worker ogni 7 giorni
- **Trial 15 giorni** — attivato automaticamente alla prima installazione, tutte le feature Pro incluse
- **i18n** (`i18n.js`) — 6 lingue (IT, EN, DE, FR, ES, PT), auto-detect browser, override manuale
- **Pagina Onboarding** (`onboarding.html`) — si apre al primo install con istruzioni per pinnare l'estensione
- **Stealth condizionato alla licenza** — stealth.js attiva le override solo se content.js setta `data-adoff-stealth="1"` (solo Pro/Trial)
- **Badge licenza** nel popup (FREE / TRIAL Xgg / PRO)
- **Banner upsell** nel popup per utenti Free/Trial in scadenza
- Sistema di messaggistica background ↔ popup per gestione whitelist

Infrastruttura creata:
- `sviluppo/license-system/keygen.py` — generatore chiavi HMAC Python
- `sviluppo/license-system/worker.js` — Cloudflare Worker API licenze
- `sviluppo/license-system/admin.html` — dashboard admin licenze
- `sviluppo/license-system/wrangler.toml` — configurazione deploy Cloudflare

---

## 3. Architettura Tecnica

### Manifest V3 — Struttura

```json
{
  "manifest_version": 3,
  "name": "AdOff",
  "version": "3.0.0",
  "permissions": ["storage", "declarativeNetRequest", "declarativeNetRequestFeedback", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "src/background.js" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/stealth.js"],
      "css": ["src/ads-hide.css"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.js"],
      "run_at": "document_start",
      "world": "ISOLATED"
    }
  ],
  "declarative_net_request": {
    "rule_resources": [{ "id": "adblock_rules", "enabled": true, "path": "rules/adblock-rules.json" }]
  },
  "options_page": "src/options.html",
  "action": { "default_popup": "src/popup.html" }
}
```

### I 3 Livelli di Blocco

```
LIVELLO 1 — NETWORK (declarativeNetRequest)
  ├─ Blocca richieste HTTP prima che raggiungano il browser
  ├─ 107 regole in rules/adblock-rules.json
  ├─ Zero codice eseguito per ogni richiesta bloccata (pura dichiarazione)
  └─ Copertura: Google Ads, DoubleClick, GTM, Facebook Pixel, Amazon Ads,
                AppNexus, Criteo, Outbrain, Taboola, Rubicon, OpenX, PubMatic,
                Sizmek, Moat, IAS, DoubleVerify, anti-adblock scripts

LIVELLO 2 — DOM/CSS (content.js + ads-hide.css)
  ├─ ads-hide.css iniettato a document_start (zero latency)
  ├─ 136 righe CSS nascondono: ins.adsbygoogle, div[id^="div-gpt-ad"],
  │                             ytd-ad-slot-renderer, .ad-slot, .taboola, etc.
  ├─ content.js scansiona DOM ogni 500ms + MutationObserver (debounce 200ms)
  ├─ Collassa contenitori ad vuoti rimasti dopo il blocco di rete
  ├─ Gestisce iframe ad (src che contiene doubleclick, googlesyndication, etc.)
  └─ Blocca overlay anti-adblock (.adblock-wall, .adblock-overlay)

LIVELLO 3 — STEALTH (stealth.js, solo Pro/Trial)
  ├─ Gira nel MAIN world (accesso diretto alle variabili JS della pagina)
  ├─ Attivato solo se content.js setta data-adoff-stealth="1" sul <html>
  ├─ Override getComputedStyle: restituisce dimensioni "normali" per elementi bait
  ├─ Override offsetHeight/offsetWidth: restituisce 250/300 per elementi bait
  ├─ Override fetch: intercetta URL anti-adblock, restituisce risposta vuota 200
  ├─ Override XMLHttpRequest.open/send: stessa logica di fetch
  ├─ Spoof googletag e adsbygoogle: oggetti finti sempre presenti
  ├─ Override document.createElement: blocca caricamento script anti-adblock
  ├─ Override Node.prototype.appendChild: blocca injection di script anti-adblock
  └─ Override CSSStyleDeclaration.setProperty: previene overflow:hidden su body
```

### File e Ruolo di Ognuno

| File | Dimensione | World | Ruolo |
|---|---|---|---|
| `manifest.json` | 1.2 KB | — | Configurazione estensione, permessi, entry point |
| `src/background.js` | 1.8 KB | Service Worker | Init storage, badge ON/OFF, toggle regole DNR, gestione messaggi whitelist |
| `src/stealth.js` | 9.1 KB | MAIN | Anti-detection: override API native, YouTube ad skip via MutationObserver |
| `src/content.js` | 16.3 KB | ISOLATED | Scan DOM, hiding ads, gestione whitelist dinamica, contatore ads |
| `src/ads-hide.css` | 2.9 KB | — | CSS hiding universale iniettato a document_start |
| `src/popup.html` | 1.7 KB | — | UI popup: toggle, contatori, pausa per sito, badge licenza |
| `src/popup.css` | 3.2 KB | — | Stile dark mode del popup |
| `src/popup.js` | ~8 KB | — | Logica popup: stato, pausa, whitelist, render |
| `src/options.html` | — | — | Pagina opzioni completa |
| `src/options.css` | — | — | Stile pagina opzioni |
| `src/options.js` | — | — | Logica opzioni: whitelist, licenza, statistiche, import/export |
| `src/i18n.js` | ~12 KB | — | Sistema i18n con 6 lingue inline |
| `src/license-client.js` | ~5 KB | — | Validazione licenze: offline HMAC + online API ogni 7gg |
| `src/onboarding.html` | — | — | Pagina benvenuto al primo install |
| `rules/adblock-rules.json` | 17.8 KB | — | 107 regole declarativeNetRequest |
| `assets/icon*.png` | 3.0 KB tot | — | Icone 16, 48, 128px |

### Flusso di Esecuzione Dettagliato

```
[Navigazione a un URL]
       │
       ▼
[declarativeNetRequest — PRIMA del browser]
  107 regole bloccano richieste verso server ads
  → risorse bloccate non vengono mai scaricate
       │
       ▼
[document_start — stealth.js nel MAIN world]
  1. Controlla hostname: YouTube? → avvia MutationObserver per skip ads
  2. Controlla hostname: in STEALTH_EXCLUDED? → return (non tocca niente)
  3. Attende che content.js (ISOLATED) setti data-adoff-stealth="1"
  4. Se Pro/Trial: chiama activateStealth() → override 6 API native
  5. Timeout 2s: se nessun segnale Pro → skip (Free, no stealth)
       │
       ▼
[document_start — content.js nel ISOLATED world]
  1. Controlla: dominio in whitelist? → return (nessuna modifica DOM)
  2. Legge licenza da chrome.storage.local
  3. Se Pro/Trial: setta data-adoff-stealth="1" sull'elemento <html>
  4. Avvia scanAndRemove() + MutationObserver
  5. Su YouTube: solo 1 scan + 1 scan dopo 3s (no observer, no polling)
  6. Su altri siti: observer continuo + polling ogni 500ms
       │
       ▼
[Pagina caricata]
  - ads-hide.css ha gia' nascosto via CSS tutti gli elementi noti
  - content.js nasconde gli elementi non coperti dal CSS
  - stealth.js (se Pro) tiene spento il rilevamento anti-adblock
  - Contatore ads incrementato in background (batching 1s)
       │
       ▼
[Utente apre popup]
  1. popup.js legge state da chrome.storage.local
  2. Mostra: toggle globale, contatori, sito corrente, stato pausa, badge licenza
  3. Mostra banner: TRIAL Xgg rimasti | FREE → link Pro
```

### Storage Keys e Formato Dati

```javascript
// chrome.storage.local — tutti i dati persistenti
{
  // Stato globale
  "adoffEnabled": true,              // boolean — blocco attivo/disattivo

  // Statistiche
  "adoffAdsBlocked": 12593,          // number — contatore ads nascosti nel DOM
  "adoffReqBlocked": 45821,          // number — contatore richieste bloccate (solo dev mode)

  // Trial
  "adoffTrialEnd": 1715270400000,    // number — timestamp ms fine trial (15gg da install)

  // Whitelist e pause (struttura v3.0)
  "whitelist": [
    { "domain": "youtube.com",   "type": "permanent", "addedAt": 1713398400000, "until": null },
    { "domain": "news.it",       "type": "1hour",     "addedAt": 1713402000000, "until": 1713405600000 },
    { "domain": "blog.com",      "type": "1day",      "addedAt": 1713402000000, "until": 1713488400000 },
    { "domain": "example.com",   "type": "session",   "addedAt": 1713402000000, "until": null }
  ],

  // Licenza (salvata da license-client.js)
  "adoffLicense": {
    "valid": true,
    "rawKey": "base64payload...hmac16chars",  // per validazione online
    "plan": "pro",                             // "pro" | "lifetime"
    "expires": 1743350400,                     // unix timestamp (0 = lifetime)
    "expiresHuman": "2025-03-30",
    "devices": 1,
    "maxDevices": 3,
    "lastValidated": 1713398400000,            // quando e' stata verificata l'ultima volta
    "activatedAt": 1713398400000
  },

  // Lingua (i18n)
  "adoffLang": "it",                 // "auto" | "it" | "en" | "de" | "fr" | "es" | "pt"
}
```

---

## 4. Funzionalita' Implementate

### Stato Completo v3.0

| Funzionalita' | Tier | Stato | Note |
|---|---|---|---|
| Blocco ads network (107 regole DNR) | Free | **FUNZIONANTE** | Google Ads, DoubleClick, GTM, FB Pixel, Amazon Ads, Taboola, Outbrain, Criteo, AppNexus, Rubicon, OpenX, etc. |
| CSS hiding universale | Free | **FUNZIONANTE** | 136 righe CSS, iniettate a document_start |
| YouTube ad slot hiding | Free | **FUNZIONANTE** | Selettori precisi ytd-ad-slot-renderer, etc. |
| YouTube skip ad button | Free | **FUNZIONANTE** | MutationObserver su player.class (ad-showing) |
| Toggle ON/OFF globale | Free | **FUNZIONANTE** | Persiste in storage, badge aggiornato |
| Badge ON/OFF sull'icona | Free | **FUNZIONANTE** | Verde "ON" / Rosso "OFF" nella toolbar |
| Contatore ads bloccati | Free | **FUNZIONANTE** | Aggregato con debounce 1s |
| Pausa per sito — sessione | Free | **FUNZIONANTE** | Whitelist in-memory |
| Pausa per sito — 1 ora | Free | **FUNZIONANTE** | Timestamp expiry in storage |
| Pausa per sito — 1 giorno | Free | **FUNZIONANTE** | Timestamp expiry in storage |
| Pausa per sito — permanente | Free | **FUNZIONANTE** | Whitelist permanente in storage |
| Lista siti esclusi (whitelist) | Free | **FUNZIONANTE** | UI nella pagina Opzioni |
| Import/Export whitelist | Free | **FUNZIONANTE** | Download JSON |
| Pagina Opzioni completa | Free | **FUNZIONANTE** | 5 sezioni: Generale, Whitelist, Licenza, Stats, Avanzate |
| Onboarding primo install | Free | **FUNZIONANTE** | Tab automatica su install |
| Dark mode UI | Free | **FUNZIONANTE** | Palette Deep Space / Shield Purple |
| i18n 6 lingue | Free | **FUNZIONANTE** | IT, EN, DE, FR, ES, PT |
| Trial 15 giorni | Free→Pro | **FUNZIONANTE** | Avvio automatico a install |
| Badge TRIAL Xgg nel popup | Trial | **FUNZIONANTE** | Countdown giorni rimasti |
| Stealth anti-detection | Pro/Trial | **FUNZIONANTE** | Condizionato a licenza, 6 override API |
| Licenza HMAC offline | Pro | **FUNZIONANTE** | Verifica firma senza server |
| Validazione online API | Pro | **FUNZIONANTE** | Ogni 7 giorni, fallback su cache |
| Attivazione key nel popup/opzioni | Pro | **FUNZIONANTE** | Via license-client.js |
| Deattivazione dispositivo | Pro | **FUNZIONANTE** | Libera slot device nel KV |
| Cookie banner auto-reject | Pro | **DA IMPLEMENTARE** | Codice morto in src/ (cookie-handler.js) |
| Statistiche con grafici | Pro | **DA IMPLEMENTARE** | Solo contatore numerico al momento |
| Filtri aggiuntivi (EasyList, EasyPrivacy) | Pro | **DA IMPLEMENTARE** | Solo 107 regole base |
| Element picker | Pro | **DA IMPLEMENTARE** | Futuro |
| Filtri personalizzati | Pro | **DA IMPLEMENTARE** | Futuro |
| Contatore richieste bloccate (visibile) | Free | **PARZIALE** | Funziona solo in developer mode (onRuleMatchedDebug) |
| YouTube pre-roll video block | Free | **NON FUNZIONA** | Solo skip button — l'ad si vede per 5-15s prima dello skip |
| Collasso aree vuote (Corriere.it, etc.) | Free | **PARZIALE** | Logica in content.js, funziona su siti generici |

---

## 5. Sistema Whitelist e Pausa

### I 4 Tipi di Pausa

| Tipo | Etichetta UI | Comportamento | Storage |
|---|---|---|---|
| `session` | "Solo questa visita" | Disabilita fino a chiusura tab o refresh. Non persiste tra sessioni. | `chrome.storage.session` (logico — in pratica filtrato a runtime da content.js) |
| `1hour` | "1 ora" | Disabilita per 60 minuti, poi riattiva automaticamente. | `chrome.storage.local` con `until: Date.now() + 3600000` |
| `1day` | "1 giorno" | Disabilita per 24 ore. | `chrome.storage.local` con `until: Date.now() + 86400000` |
| `permanent` | "Sempre (whitelist)" | Disabilita permanentemente per quel dominio. | `chrome.storage.local` array permanente |

### Come Funziona Tecnicamente

**Aggiunta pausa (popup.js):**

```javascript
// Quando l'utente seleziona un tipo di pausa dal dropdown
const entry = {
  domain: currentHost,       // "youtube.com"
  type: "1hour",             // tipo pausa
  until: Date.now() + 3600000, // timestamp scadenza
  addedAt: Date.now(),
};
whitelist = whitelist.filter((e) => e.domain !== currentHost); // rimuovi pausa precedente
whitelist.push(entry);
chrome.storage.local.set({ whitelist });
```

**Controllo in content.js (ISOLATED world):**

```javascript
chrome.storage.local.get(["adoffEnabled", "adoffWhitelist", ...], (result) => {
  const whitelist = result.adoffWhitelist || [];
  const isPaused = whitelist.some((d) => hostname.includes(d) || d.includes(hostname));
  if (isPaused) return; // exit subito — zero modifiche al DOM
  // ... avvia il blocco ads
});
```

**Rimozione pause scadute (popup.js):**

```javascript
function cleanExpiredPauses(list) {
  const now = Date.now();
  return list.filter((entry) => {
    if (entry.type === "permanent" || entry.type === "session") return true;
    return entry.until && entry.until > now; // rimuovi se scaduta
  });
}
```

**Nota importante:** Il controllo della whitelist in `stealth.js` (MAIN world) non ha accesso a `chrome.storage`, quindi la lista e' hardcoded (`STEALTH_EXCLUDED`) e contiene solo i siti grandi sempre esclusi. La whitelist dinamica dell'utente e' gestita unicamente da `content.js` (ISOLATED world).

### Storage Format Dettagliato

```javascript
"whitelist": [
  {
    "domain": "youtube.com",
    "type": "permanent",
    "addedAt": 1713398400000,
    "until": null
  },
  {
    "domain": "corriere.it",
    "type": "1hour",
    "addedAt": 1713402000000,
    "until": 1713405600000   // addedAt + 3600000
  },
  {
    "domain": "repubblica.it",
    "type": "session",
    "addedAt": 1713402000000,
    "until": null             // null = scade alla chiusura (gestito in memory)
  }
]
```

---

## 6. Sistema Licensing Proprietario

### Architettura Generale

```
┌──────────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│  Estensione Chrome   │────▶│  Cloudflare Worker    │────▶│  Cloudflare KV   │
│  (license-client.js) │◀────│  api.adoff.app        │◀────│  (ADOFF_LICENSES)│
└──────────────────────┘     └───────────────────────┘     └──────────────────┘
         │                              ▲
         │                              │
         │                   ┌──────────┴──────────┐
         │                   │  Admin Dashboard    │
         │                   │  (admin.html)       │
         │                   └─────────────────────┘
         │
         ▼
┌──────────────────────┐
│  keygen.py           │
│  (generazione key)   │
└──────────────────────┘
```

### Formato License Key

```
ADOFF-XXXX-XXXX-XXXX
        │
        └── 12 hex chars uppercase derivati da SHA-256(raw + SECRET)

Esempio: ADOFF-A3F8-B2C1-D4E5

La key leggibile e' il "display format".
La validazione usa il campo "raw" (payload_b64 + hmac_signature).
```

**Struttura del campo `raw`:**

```
raw = payload_b64 + hmac16

dove:
  payload_b64 = base64url( JSON({ e, p, x, d, c, v }) )
  hmac16      = hmac_sha256(payload_b64, SECRET)[:16]

Payload JSON:
  e = email acquirente
  p = piano ("pro" | "lifetime")
  x = scadenza unix timestamp (0 = lifetime)
  d = max dispositivi (default 3)
  c = created at unix timestamp
  v = versione formato (1)
```

### HMAC-SHA256 Signing

**keygen.py (Python):**

```python
import hashlib, hmac, json, base64

payload_json = json.dumps(payload, separators=(",",":"), sort_keys=True)
payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")

# HMAC-SHA256, primi 16 chars hex
signature = hmac.new(
    SECRET_KEY.encode(),
    payload_b64.encode(),
    hashlib.sha256
).hexdigest()[:16]

raw = payload_b64 + signature
key = f"ADOFF-{key_hash[:4]}-{key_hash[4:8]}-{key_hash[8:12]}"
```

**worker.js (JavaScript / Web Crypto API):**

```javascript
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
);
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
const hmac16 = Array.from(new Uint8Array(sig))
  .map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16);
```

### Validazione Doppia (Offline + Online)

**Fase 1 — Offline (firma HMAC):**

```
Input: raw key (payload_b64 + hmac16)
1. Separa payload_b64 (tutto tranne gli ultimi 16 chars) e signature (ultimi 16)
2. Ricalcola hmac_sha256(payload_b64, SECRET)[:16]
3. hmac.compare_digest(signature, expected) — timing-safe
4. Se corrispondono: decodifica payload_b64 → JSON
5. Controlla x (scadenza): se x > 0 e x < now → licenza scaduta
6. Ritorna { valid: true, payload }
```

**Fase 2 — Online (Cloudflare Worker, ogni 7 giorni):**

```
POST api.adoff.app/validate
  Body: { key: rawKey }

Il Worker:
  1. Verifica firma HMAC (stessa logica offline)
  2. Cerca lic:{rawKey} nel KV → controlla se revocata
  3. Controlla scadenza
  4. Controlla device limit: fingerprint IP+UA, max 3 dispositivi
  5. Registra nuovo dispositivo nel KV se non presente
  6. Aggiorna lastValidated nel KV
  7. Ritorna { valid, plan, expires, devices, maxDevices }

In caso di errore rete → l'estensione usa la cache locale (non penalizza l'utente)
```

**Frequenza validazione:**

```javascript
const REVALIDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 giorni

if (now - lastCheck > REVALIDATE_INTERVAL) {
  validateOnline(lic.rawKey).catch(() => {}); // background, non blocca
}
```

### Device Fingerprinting

Il Worker genera un fingerprint del dispositivo dalla request HTTP:

```javascript
function generateDeviceId(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  let hash = 0;
  const str = ip + "|" + ua;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
```

Se il fingerprint non e' nella lista `devices` del KV per quella licenza, viene aggiunto. Se la lista ha gia' `d` (device limit, default 3) device diversi, ritorna errore `Device limit reached`.

### Rate Limiting

```javascript
const RATE_LIMIT_MAX = 20;     // max 20 richieste
const RATE_LIMIT_WINDOW = 60;  // per 60 secondi

// Chiave KV: "rl:{ip}"
// TTL automatico: 60 secondi
```

### Trial 15 Giorni

**Avvio automatico in background.js:**

```javascript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    const trialEnd = Date.now() + 15 * 24 * 60 * 60 * 1000; // +15 giorni
    chrome.storage.local.set({ adoffTrialEnd: trialEnd });
  }
});
```

**Controllo in content.js:**

```javascript
const trialEnd = result.adoffTrialEnd || 0;
const isPro = lic.type === "pro" || lic.type === "lifetime" || (trialEnd > Date.now());
if (isPro) {
  document.documentElement.setAttribute("data-adoff-stealth", "1");
}
```

### Stealth Condizionato alla Licenza

Questo e' il differenziatore anti-hacking principale: anche se qualcuno modifica lo storage per settare `license.type = "pro"`, il meccanismo di stealth ha una dipendenza da `content.js` (ISOLATED world) che legge il vero valore dal storage e decide se segnalare a `stealth.js` (MAIN world) di attivarsi.

```
content.js (ISOLATED) legge chrome.storage → isPro = true?
    └─ SI: document.documentElement.setAttribute("data-adoff-stealth", "1")

stealth.js (MAIN) — polling ogni 100ms per max 2s
    └─ isStealthEnabled() = getAttribute("data-adoff-stealth") === "1"?
        └─ SI: activateStealth() → override API
        └─ NO dopo 2s: stop polling → stealth non attivo
```

### Endpoint API del Worker

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/validate` | No | Valida license key, registra device |
| POST | `/activate` | No | Sinonimo di validate (prima attivazione) |
| POST | `/deactivate` | No | Rimuove device dalla lista |
| POST | `/revoke` | Admin Token | Revoca licenza (marca come `revoked: true`) |
| POST | `/stripe-webhook` | Stripe Sig | Processa pagamento e genera licenza |
| GET | `/success` | No | Success page post-pagamento |

---

## 7. Sistema Pagamenti

### Architettura Pagamenti

```
┌──────────┐    ┌──────────────┐    ┌──────────────────────┐    ┌──────────┐
│ Utente   │───▶│ Stripe       │───▶│ Cloudflare Worker    │───▶│ KV Store │
│ (browser)│    │ Checkout     │    │ /stripe-webhook      │    │ licenze  │
└──────────┘    │ (hosted)     │    └──────────┬───────────┘    └──────────┘
     ▲          └──────────────┘               │
     │                                         │ genera license key
     └─────── /success?key=ADOFF-XXXX ◀────────┘
```

### Flusso Completo Pagamento

```
1. Utente clicca "Acquista Pro Mensile" su adoff.app/pricing o nelle Opzioni
2. Redirect a Stripe Checkout (hosted page)
3. Utente paga (carta, Apple Pay, Google Pay, SEPA Direct Debit)
4. Stripe manda webhook POST a api.adoff.app/stripe-webhook
5. Il Worker:
   a. Riceve evento "checkout.session.completed"
   b. Estrae email e amount_total dalla session Stripe
   c. Determina piano dal prezzo (tabella importi EUR)
   d. Genera license key via HMAC (stessa logica di keygen.py)
   e. Salva nel KV: lic:{raw}, key:{key}, email:{email}
   f. Risponde con { ok: true, key, plan }
6. Stripe redirige a adoff.app/success?key=ADOFF-XXXX-XXXX-XXXX
7. La success page mostra la key con bottone "Copia"
8. L'utente apre Opzioni AdOff → sezione Licenza → incolla key → "Attiva"
9. license-client.js chiama POST /activate → valida → salva in storage
10. Pro attivato. Badge nel popup diventa "PRO"
```

### Determinazione Piano dal Prezzo (Worker)

```javascript
// Il Worker determina il piano dall'importo in EUR
const amountEur = session.amount_total / 100;

if (amountEur >= 14 && amountEur <= 16) { plan = "lifetime"; months = 0; }
else if (amountEur >= 24 && amountEur <= 26) { plan = "pro"; months = 12; }
else if (amountEur >= 14 && amountEur < 15) { plan = "pro"; months = 6; }
else if (amountEur >= 8 && amountEur < 9)   { plan = "pro"; months = 3; }
else                                         { plan = "pro"; months = 1; }
```

### Costi per Transazione Stripe

| Transazione | Importo | Commissione Stripe | Incasso netto |
|---|---|---|---|
| Pro Mensile | 2.99 EUR | 0.34 EUR (2.9% + 0.25) | 2.65 EUR |
| Pro Trimestrale | 8.07 EUR | 0.48 EUR | 7.59 EUR |
| Pro Semestrale | 14.35 EUR | 0.67 EUR | 13.68 EUR |
| Pro Annuale | 25.12 EUR | 0.98 EUR | 24.14 EUR |
| Lifetime | 14.99 EUR | 0.68 EUR | 14.31 EUR |

### Gestione Rinnovi e Cancellazioni

**Rinnovo automatico (abbonamenti):**
Stripe gestisce in autonomia. Se il pagamento mensile/trimestrale/etc. va a buon fine, nessuna azione richiesta. La licenza nell'estensione viene ri-validata online ogni 7 giorni: se la scadenza nel KV e' stata aggiornata da Stripe, la licenza rimane attiva.

**Cancellazione:**
L'utente cancella dal Stripe Customer Portal. Stripe manda webhook `customer.subscription.deleted` → il Worker marca la licenza come scaduta nel KV. Alla prossima validazione online (max 7 giorni), l'estensione scala a Free.

**Rimborso:**
Rimborso manuale dal dashboard Stripe → webhook `charge.refunded` → Worker revoca la licenza (imposta `revoked: true` nel KV).

---

## 8. Internazionalizzazione (i18n)

### Come Funziona

Il sistema i18n e' completamente custom, senza dipendenze esterne. Tutte le traduzioni sono inline nel file `src/i18n.js` (un unico file caricato da tutte le pagine).

**Utilizzo HTML:**
```html
<span data-i18n="popup.toggle">Blocco ads</span>
```

**Utilizzo JS:**
```javascript
i18n.t("popup.toggle") // → "Blocco ads" (in italiano)
```

**Inizializzazione:**
```javascript
i18n.init(() => {
  i18n.applyToDOM(); // sostituisce tutti i data-i18n nel DOM
  loadState();
});
```

### Lingue Supportate

| Codice | Lingua | Completezza |
|---|---|---|
| `it` | Italiano | Completa (linguaggio default, tutti i testi) |
| `en` | English | Completa (tutti i testi) |
| `de` | Deutsch | Parziale (popup e opzioni base) |
| `fr` | Francais | Parziale (popup e opzioni base) |
| `es` | Espanol | Parziale (popup e opzioni base) |
| `pt` | Portugues | Parziale (popup e opzioni base) |

### Auto-Detect + Override Manuale

**Detection automatica:**
```javascript
function detectBrowserLang() {
  const nav = (navigator.language || "en").toLowerCase();
  const short = nav.split("-")[0]; // "it-IT" → "it"
  return TRANSLATIONS[short] ? short : "en"; // fallback a EN se non supportata
}
```

**Override manuale:**
```javascript
i18n.setLang("de"); // salva "de" in chrome.storage.local come "adoffLang"
```

**Priorita' di risoluzione:**
1. `chrome.storage.local.adoffLang` (lingua selezionata manualmente dall'utente)
2. `navigator.language` (lingua del browser)
3. Fallback: Inglese

**Fallback traduzione:**
```javascript
function t(key) {
  return TRANSLATIONS[currentLang][key]  // lingua corrente
      || TRANSLATIONS.en[key]            // inglese
      || TRANSLATIONS.it[key]            // italiano
      || key;                            // key stessa se non trovata
}
```

### Come Aggiungere una Lingua

In `src/i18n.js`, aggiungere un nuovo oggetto a `TRANSLATIONS`:

```javascript
const TRANSLATIONS = {
  // ... lingue esistenti ...
  nl: {
    "popup.toggle": "Advertentieblokker",
    "popup.active": "Actief",
    "popup.adsBlocked": "advertenties geblokkeerd",
    // ... altri testi ...
  }
};
```

Aggiungere alla lista `LANGUAGES`:
```javascript
const LANGUAGES = {
  auto: "", it: "Italiano", en: "English", /* ... */ nl: "Nederlands"
};
```

Idealmente completare tutti i ~60 testi. Se mancanti, il sistema fa fallback automatico all'inglese.

---

## 9. Brand Identity

### Nome e Perche' AdOff

Il nome e' stato scelto dopo un brainstorming di 40+ candidati con scoring sistematico.

**Perche' AdOff ha vinto (score 27/30):**
1. Contiene "Ad" — keyword SEO primaria del settore (550K-900K ricerche/mese)
2. "Off" = azione immediata, chiarissima (le ads sono spente)
3. Solo 5 lettere, 2 sillabe, memorabile
4. Funziona in tutte le lingue (EN, IT, DE, FR, ES, PT)
5. Nessun prodotto esistente con questo nome (verificato su Chrome Web Store)
6. Tagline naturale: "Ads? Off." — 3 parole, impatto immediato

**Nomi eliminati:**
- Veil, Cloak, Aegis, NoAds, Purify, Warden — tutti gia' presi su Chrome Web Store
- Shadow Shield (nome precedente) — generico, non ricercabile, non riconoscibile

### Tagline

**Principale:** "Ads? Off."

Varianti approvate:
- "Ads? Off. Naviga in pace." (versione estesa)
- "Blocca tutto. Invisibilmente." (per materiali marketing)

### Logo e Icone

**Concept del logo:** Lettera "A" stilizzata con una sbarra diagonale (il simbolo "off" / spento), in Shield Purple su sfondo Deep Space.

**Dimensioni disponibili:**
| File | Dimensione | Uso |
|---|---|---|
| `assets/icon16.png` | 16×16 px | Chrome toolbar (normale) |
| `assets/icon48.png` | 48×48 px | Chrome extension page |
| `assets/icon128.png` | 128×128 px | Chrome Web Store |
| `sviluppo/brand/assets/icon19.png` | 19×19 px | Toolbar HiDPI |
| `sviluppo/brand/assets/icon32.png` | 32×32 px | Toolbar HiDPI |
| `sviluppo/brand/assets/icon38.png` | 38×38 px | Toolbar 2x |
| `sviluppo/brand/assets/logo-512.png` | 512×512 px | Store tile, marketing |
| `sviluppo/brand/store-assets/store-tile-440x280.png` | 440×280 px | Chrome Web Store tile |
| `sviluppo/brand/store-assets/screenshot-1280x800.png` | 1280×800 px | Store screenshot |
| `sviluppo/brand/store-assets/promo-large-920x680.png` | 920×680 px | Store promo |
| `sviluppo/brand/store-assets/marquee-1400x560.png` | 1400×560 px | Store marquee |

### Color Palette

| Nome | Hex | Uso |
|---|---|---|
| Deep Space | `#0a0a1a` | Background principale popup/opzioni |
| Shield Purple | `#7c5cfc` | Accento primario, CTA, badge PRO, bottoni |
| Pure White | `#ffffff` | Testo principale su dark |
| Midnight Blue | `#12122a` | Card background, sezioni |
| Steel Gray | `#8a8aaa` | Testo secondario, label |
| Soft Purple | `#b8a9ff` | Hover, link, accenti leggeri |
| Success Green | `#4ade80` | Stato attivo, badge ON, conferme |
| Alert Red | `#f43f5e` | Stato disattivo, badge OFF, errori |

**Gradiente primario:** `linear-gradient(135deg, #7c5cfc 0%, #4c3ad4 100%)`
**Gradiente background:** `radial-gradient(circle at 50% 0%, #1a1a3e 0%, #0a0a1a 70%)`

### Tone of Voice

- **Sicuro** — comunica competenza senza essere tecnico
- **Minimale** — poche parole, messaggi diretti
- **Diretto** — l'utente capisce subito cosa fa il prodotto
- **NO** gergo tecnico, promesse esagerate, toni aggressivi
- **SI** frasi corte, dati concreti ("149 KB", "107 regole", "15 giorni gratis")

---

## 10. Analisi Competitor

### Tabella Comparativa Completa

| Tool | Utenti | Prezzo Free/Pro | Stealth | Vende Whitelist | Vende Dati | Dimensione | Rating |
|---|---|---|---|---|---|---|---|
| **uBlock Origin** | 29M+16M Lite | Free | No | No | No | 1.5 MB (Lite) | 4.3/5 |
| **AdBlock Plus** | 400M eco | Free / $4/mese | No | SI (Acceptable Ads) | No | 2.8 MB | Medio |
| **AdBlock** | 63M | Free / donazione | No | SI (Acceptable Ads) | No | 2.5 MB | 4.48/5 |
| **AdGuard** | 17M | Free ext / $3.3/mese | Solo app | No | No | 3.2 MB | 4.66/5 |
| **Ghostery** | 100M+ | Free / $2-12/mese | No | No | Passato controverso | ? | 4.6/5 |
| **Total Adblock** | N/D | $1.6→$8.25/mese | No | No | ? | ? | Misto |
| **Stands** | N/D | Free | No | No | **SI — data broker** | ? | 58/100 |
| **Privacy Badger** | 1M+ | Free | No | No | No (EFF no-profit) | ? | N/A |
| **Brave** | 100M MAU | Browser gratuito | SI (built-in) | No | No | Browser intero | 96/100 |
| **AdOff** | 0 (pre-lancio) | Free / 2.99/mese | **SI (unico)** | No | **No** | **149 KB** | — |

### Gap di Mercato Identificati

| Gap | Descrizione | AdOff risponde |
|---|---|---|
| Vuoto uBlock Origin | MV3 ha eliminato uBlock su Chrome — milioni di utenti orfani | MV3-nativo, funziona su Chrome 2026 |
| Zero stealth estensioni Chrome | Nessun competitor ha anti-detection come estensione Chrome | Stealth mode completo (6 override API) |
| Pricing predatorio | Total Adblock $19 primo anno poi $99; ABP ha conflitto interessi | Pricing trasparente, lifetime $14.99 |
| UI vecchia 2015 | Tutti i competitor hanno UI datata | Dark mode premium, design moderno |
| Mercato italiano | Nessun ad blocker pensato per IT | Copy italiano, supporto siti italiani |
| Leggerezza | uBlock Lite 1.5MB, AdGuard 3.2MB | 149 KB — 20x piu' leggero |

### I Nostri Differenziatori Unici

1. **L'unico ad blocker Chrome con stealth anti-detection** — nessun competitor ha questa feature come estensione
2. **20x piu' leggero** di tutti i competitor (149 KB vs 1.5-3.2 MB)
3. **Nessun conflitto etico** — no Acceptable Ads whitelist, no vendita dati
4. **Prezzo piu' basso** del mercato — 2.99/mese vs ABP 4, AdGuard 3.3, Total 8.25
5. **Lifetime accessibile** — 14.99 EUR vs AdGuard 100 EUR
6. **Trial 15 giorni senza carta** — nessun competitor lo offre

---

## 11. Strategia Commerciale

### Modello Freemium 3 Tier

#### FREE (per sempre)

Contenuto: blocco ads network (107 regole), CSS hiding, YouTube skip, toggle ON/OFF, whitelist siti, tutte le pause, onboarding, i18n, badge, opzioni base.

Valore: competitivo con uBlock Origin Lite. Genera download, recensioni positive, awareness.

#### PRO

Contenuto: tutto Free + stealth anti-detection, filtri avanzati (EasyList, EasyPrivacy), cookie banner auto-reject, statistiche con grafici, element picker, filtri personalizzati, supporto prioritario.

Differenziatore principale: stealth mode — l'unica feature che nessun competitor offre.

#### BUSINESS (futuro v4.0+)

Deploy centralizzato, policy aziendale whitelist, dashboard admin, fatturazione aziendale.

### Pricing PRO

| Piano | Prezzo | Sconto | Prezzo/mese effettivo |
|---|---|---|---|
| Mensile | 2.99 EUR/mese | — | 2.99 EUR |
| Trimestrale | 8.07 EUR | -10% | 2.69 EUR |
| Semestrale | 14.35 EUR | -20% | 2.39 EUR |
| Annuale | 25.12 EUR | -30% | 2.09 EUR |
| **Lifetime** | **14.99 EUR** | **-60%** | — (una tantum) |

**Dinamica Lifetime:**
- Primi 1,000 acquisti: 14.99 EUR
- 1,001-5,000 acquisti: 29.99 EUR
- Oltre 5,000: 49.99 EUR
- Urgenza comunicata con contatore "X posti rimasti" + countdown timer

### Revenue Projection

**Scenario conservativo (Anno 1):**

| Metrica | Valore |
|---|---|
| Download totali | 50,000 |
| Trial attivati (80%) | 40,000 |
| Conversione trial→paid (5%) | 2,000 |
| ARPU medio | ~3.50 EUR/mese |
| Lifetime (20% dei paganti) | 400 @ 14.99 EUR = 5,996 EUR |
| MRR | ~5,600 EUR |
| Revenue annuale totale | ~73,000 EUR |

**Scenario ottimista (Anno 1):**

| Metrica | Valore |
|---|---|
| Download totali | 100,000 |
| Conversione trial→paid (7%) | 5,600 |
| MRR | ~15,680 EUR |
| Revenue annuale | ~194,000 EUR |

### Go-To-Market Zero Budget

**Settimana 1-2 (pre-lancio):**
- Pubblicare su Chrome Web Store (versione Free, listing ottimizzato)
- Creare landing page adoff.app (Astro/Next.js su Cloudflare Pages)
- Preparare 5 screenshot reali dal browser + video demo 60s

**Settimana 3 (lancio):**
- Post Product Hunt (martedi' mattina — massima visibilita')
- Post su Reddit: r/privacy, r/chrome, r/uBlockOrigin (focus sul gap MV3)
- Post su Hacker News: "Ask HN: I built an ad blocker that works on Chrome MV3"
- 3 articoli blog SEO: "Best ad blocker Chrome 2026", "uBlock Origin alternative", "Come bloccare ads YouTube"

**Mese 2-6 (crescita):**
- SEO organico (target: "ad blocker chrome", "bloccare pubblicita' YouTube")
- Referral program: utente invita amico → 1 mese Pro gratis
- Contattare 5-10 YouTuber tech italiani per review
- Partnership VPN (Surfshark, NordVPN, ProtonVPN) per bundle
- Localizzazione: tedesco, francese, spagnolo (traduzione completa i18n)

---

## 12. Infrastruttura e Deploy

### Architettura Zero-Cost

```
TUTTO SU CLOUDFLARE:

┌─ Cloudflare Pages (GRATIS) ────────────────────────────┐
│  adoff.app          → Landing page + pagine sito       │
│  adoff.app/admin    → Admin dashboard licenze          │
└────────────────────────────────────────────────────────┘

┌─ Cloudflare Workers (GRATIS) ──────────────────────────┐
│  api.adoff.app      → API licenze (serverless)          │
│  Limite: 100,000 richieste/giorno incluse              │
└────────────────────────────────────────────────────────┘

┌─ Cloudflare KV (GRATIS) ───────────────────────────────┐
│  ADOFF_LICENSES     → Database licenze                  │
│  Limite: 100K letture/giorno, 1K scritture/giorno      │
└────────────────────────────────────────────────────────┘

┌─ Stripe ───────────────────────────────────────────────┐
│  Pagamenti (2.9% + 0.25 EUR per transazione)           │
│  Account gratuito, paghi solo quando vendi             │
└────────────────────────────────────────────────────────┘

┌─ Chrome Web Store ─────────────────────────────────────┐
│  Estensione AdOff ($5 una tantum)                      │
└────────────────────────────────────────────────────────┘
```

### Costi Totali Anno 1

| Cosa | Costo | Frequenza |
|---|---|---|
| Cloudflare Account | GRATIS | — |
| Cloudflare Workers (API licenze) | GRATIS | 100K req/giorno |
| Cloudflare KV (database) | GRATIS | 100K read, 1K write/giorno |
| Cloudflare Pages (sito) | GRATIS | Illimitato |
| Dominio adoff.app | ~$12 | /anno |
| Chrome Web Store | $5 | Una tantum |
| Edge Add-ons | GRATIS | — |
| Firefox AMO | GRATIS | — |
| Stripe (pagamenti) | 0 fisso | % sulle vendite |
| **TOTALE FISSO ANNO 1** | **~$17** | |

### Guida Deploy Step-by-Step

**Prerequisiti:**
```bash
npm install -g wrangler
wrangler login   # apre browser per autenticazione Cloudflare
```

**Step 1 — KV Database:**
```bash
cd sviluppo/license-system
wrangler kv:namespace create ADOFF_LICENSES
# Copia l'ID output e mettilo in wrangler.toml
```

**Step 2 — Secret HMAC:**
```bash
# Genera secret sicuro
python -c "import secrets; print(secrets.token_hex(32))"

# Setta nel Worker (NON nel codice)
wrangler secret put ADOFF_SECRET
wrangler secret put ADMIN_TOKEN
```

**Step 3 — Deploy Worker API:**
```bash
wrangler deploy
# Testa: curl https://adoff-license-api.workers.dev/health
```

**Step 4 — Custom Domain (opzionale):**
```
Cloudflare Dashboard → Workers → adoff-license-api → Settings → Triggers → Custom Domain
Inserisci: api.adoff.app
```

**Step 5 — Deploy Sito:**
```bash
wrangler pages deploy site --project-name=adoff-site
```

**Step 6 — Stripe Setup:**
```
1. Crea account su dashboard.stripe.com
2. Products → Add Product: crea i 5 piani (mensile, trimestrale, semestrale, annuale, lifetime)
3. Actions → Create Payment Link per ogni prodotto
4. Developers → Webhooks → Add endpoint:
   URL: https://api.adoff.app/stripe-webhook
   Eventi: checkout.session.completed, customer.subscription.deleted, charge.refunded
```

**Step 7 — Aggiorna URL nel codice:**
```javascript
// src/license-client.js
const API_URL = "https://api.adoff.app"; // cambia da workers.dev a custom domain
```

**Step 8 — Pubblica su Chrome Web Store:**
```
1. chrome.google.com/webstore/devconsole
2. Paga $5 (una tantum)
3. Carica ZIP della root del progetto
4. Compila listing: nome, descrizione, screenshot, privacy policy
5. Invia per revisione (1-3 giorni lavorativi)
```

### Multi-Browser

| Browser | Store | Modifiche necessarie |
|---|---|---|
| Chrome | Chrome Web Store | Nessuna — baseline |
| Edge | Microsoft Edge Add-ons | Nessuna — stesso ZIP |
| Firefox | Firefox Add-ons (AMO) | Adattare manifest (MV2 per Firefox < 120, o MV3 per Firefox 120+) |
| Safari | App Store (Mac/iOS) | Richiede Xcode + conversione con safari-web-extension-converter |

---

## 13. Sicurezza

### Protezione Licenze — 3 Livelli

**Livello 1 — Firma HMAC (offline):**
- Ogni license key contiene una firma HMAC-SHA256 verificabile offline
- Un hacker che modifica manualmente lo storage non crea una firma valida
- Il secret HMAC e' settato come secret nel Worker (non nel codice sorgente pubblico)
- Difficolta' bypass: Media (il secret potrebbe essere estratto dall'estensione con reverse engineering)

**Livello 2 — Validazione Server (Cloudflare Worker):**
- Ogni 7 giorni l'estensione re-valida la key contro il KV
- Il server conosce le licenze revocate, scadute, o con device limit superato
- Impossibile generare key valide senza accesso al secret del Worker
- Difficolta' bypass: Alta

**Livello 3 — Stealth come Feature Esclusiva:**
- Lo stealth anti-detection e' il differenziatore principale della versione Pro
- Chi usa la versione Free non ottiene lo stealth anche hackando lo storage
- Perche': il segnale di attivazione stealth (`data-adoff-stealth="1"`) viene settato da `content.js` SOLO dopo aver verificato la licenza nel storage in modo genuino
- Un hacker avanzato potrebbe iniettare il JavaScript nella pagina, ma questo richiede effort significativo
- Difficolta' bypass: Alta per utenti normali, Media per sviluppatori

### Anti-Hacking Checklist

| Attacco | Protezione | Stato |
|---|---|---|
| Modifica manuale storage DevTools | Verifica firma HMAC | ATTIVO (L1) |
| Modifica storage DevTools + firma | Validazione server-side ogni 7gg | ATTIVO (L2) |
| Generazione key false | HMAC signature verificata dal server | ATTIVO (L1+L2) |
| Condivisione key tra utenti | Device limit max 3 per licenza | ATTIVO (L2) |
| Reverse engineering JS del secret | Obfuscation + secret nel Worker (non nel client) | PARZIALE |
| Usare versione craccata | Aggiornamenti automatici Chrome Web Store | AUTOMATICO |
| Intercettare risposta API | HTTPS obbligatorio su Cloudflare | ATTIVO |
| Disabilitare check licenza | Stealth legato alla licenza (no licenza = no stealth) | ATTIVO (L3) |
| Rate limiting richieste API | 20 req/min per IP nel Worker | ATTIVO (L2) |
| Revoca licenza abusata | Admin endpoint /revoke con token | ATTIVO (L2) |

### HMAC Signing Flow

```
keygen.py genera:
  SECRET = os.environ["ADOFF_SECRET"]
  payload_b64 = base64url(JSON({ e, p, x, d, c, v }))
  signature = hmac_sha256(payload_b64, SECRET)[:16]
  raw = payload_b64 + signature
  key = "ADOFF-" + sha256(raw + SECRET)[:12].upper().split in 3x4

Worker valida:
  payloadB64 = raw[:-16]
  signature = raw[-16:]
  expected = hmac_sha256(payloadB64, SECRET)[:16]
  assert constant_time_equal(signature, expected)  // timing-safe
  payload = json_parse(base64_decode(payloadB64))
  assert payload.x == 0 || payload.x > now        // non scaduta
```

---

## 14. Bug Risolti (Cronologia)

### Bug 1 — Video YouTube non partiva dopo skip ad

**Versione:** v2.0 → risolto in v2.3
**Sintomo:** Dopo lo skip dell'ad, il video YouTube non partiva o mostrava schermo nero.
**Causa:** Il codice modificava `video.currentTime = 0` e `video.playbackRate = 1` nel tentativo di resettare il player. Questo interferiva con il normale flusso di avvio del video reale.
**Soluzione:** Rimosso qualsiasi manipolazione di `currentTime`, `playbackRate`, `muted`. Il codice ora fa SOLO `click()` sui bottoni skip visibili.
**Lezione:** Su YouTube, l'approccio meno invasivo e' sempre il migliore. Non toccare mai il player direttamente — usare solo le interazioni UI native.

---

### Bug 2 — CPU alta su YouTube (polling ogni 300ms)

**Versione:** v1.0 → risolto in v2.3
**Sintomo:** La CPU del browser era costantemente alta su YouTube anche senza ads in riproduzione.
**Causa:** `setInterval(() => trySkipAd(), 300)` eseguiva codice ogni 300ms sempre, anche quando non c'era nessun ad.
**Soluzione:** Sostituito con `MutationObserver` che osserva solo i cambi di classe sul player (`ad-showing`, `ad-interrupting`). Zero CPU quando non ci sono ads.
**Lezione:** Observer pattern vs polling — usare sempre observer se la variabile da monitorare ha un evento associato.

---

### Bug 3 — Cookie handler cliccava elementi non-cookie

**Versione:** v2.1 → rimosso in v2.3
**Sintomo:** Su alcuni siti bancari e form di registrazione, elementi venivano cliccati automaticamente quando non dovevano.
**Causa:** I selettori del cookie-handler erano troppo generici (cercavano bottoni con testo "Accetto", "OK", "Acconsento" — che esistono anche in form di login e modali non-cookie).
**Soluzione:** Rimosso il cookie-handler dal manifest. Il file `cookie-handler.js` e' rimasto in src/ come codice morto.
**Azione richiesta:** Eliminare fisicamente `cookie-handler.js` da `src/` prima della pubblicazione.
**Lezione:** I selettori per click automatici devono essere altamente specifici (attributi data- del fornitore cookie, non testo generico).

---

### Bug 4 — stealth.js rompeva script di Google/YouTube

**Versione:** v2.0 → risolto in v2.3
**Sintomo:** Su google.com, youtube.com e altri siti grandi, alcune funzionalita' smettevano di funzionare (ricerca, login, menu).
**Causa:** Le override di `fetch`, `XHR`, `createElement`, `appendChild` nel MAIN world interferivano con gli script legittimi dei siti grandi.
**Soluzione:** Aggiunta lista `STEALTH_EXCLUDED` hardcoded in stealth.js con i siti da escludere sempre. Il codice ora fa `return` immediatamente se il hostname e' nella lista.
**Lezione:** Le API override nel MAIN world sono chirurgiche — devono avere esclusioni esplicite per siti noti.

---

### Bug 5 — Pagina YouTube carica piu' lenta con content.js attivo

**Versione:** v2.0 → risolto in v2.3
**Sintomo:** Il tempo di caricamento delle pagine YouTube aumentava di 200-400ms con l'estensione attiva.
**Causa:** `MutationObserver` + `setInterval(500ms)` su YouTube causavano scansioni DOM frequenti sulla struttura React pesante di YouTube.
**Soluzione:** Su YouTube, `content.js` esegue solo 2 scan (1 a DOMContentLoaded + 1 dopo 3s) e poi si ferma. Nessun observer, nessun polling su YouTube. Il lavoro continuo e' delegato a `stealth.js` (MutationObserver solo sul player, non su tutto il DOM).
**Lezione:** YouTube ha una struttura DOM enorme che si aggiorna costantemente. Observer su document.documentElement su YouTube e' costoso — limitare al player.

---

### Bug 6 — Permessi inutili nel manifest

**Versione:** v2.0 → risolto in v3.0
**Problema:** manifest.json dichiarava `scripting` e `webNavigation` che non erano usati nel codice.
**Rischio:** Google potrebbe rifiutare l'estensione per permessi non giustificati.
**Soluzione:** Rimossi entrambi dal manifest v3.0.
**Lezione:** Dichiarare solo i permessi strettamente necessari. Ogni permesso extra e' un motivo in piu' per il rifiuto e un rischio per la privacy degli utenti.

---

### Bug 7 — content.js eseguito piu' volte sulla stessa pagina

**Versione:** v2.0 → risolto in v3.0
**Sintomo:** In rari casi (SPA navigation su YouTube), `content.js` si re-eseguiva e creava istanze multiple del MutationObserver.
**Causa:** Chrome re-inietta i content script dopo alcune navigazioni SPA.
**Soluzione:** Guard all'inizio di `content.js`:
```javascript
if (document.documentElement.hasAttribute("data-adoff-loaded")) return;
document.documentElement.setAttribute("data-adoff-loaded", "1");
```
**Lezione:** I content script devono sempre avere un guard di inizializzazione unica.

---

### Bug 8 — Popup/dialog legittimi nascosti dall'ad blocker (CRITICO)

**Versione:** v3.0 → risolto in v3.1.0
**Sintomo:** Su siti istituzionali, popup/dialog legittimi (consenso GDPR, conferme, selezioni) perdevano i pulsanti di interazione. L'utente non poteva cliccare "OK", "Accetta", "Conferma".
**Causa:** La funzione `collapseEmptyAdContainers()` in `content.js` usava euristiche troppo aggressive:
- Sezione 5: nascondeva qualsiasi `p, span, div, small, label` con testo "ad" — colpiva label legittimi
- Sezione 6: nascondeva div con dimensioni standard banner (300x250, ecc.) se avevano poco testo (`text.length < 20` catturava pulsanti come "OK", "Accetta")
- `collapseAdParent()`: risaliva ai parent senza fermarsi su dialog/modal
- Stealth `setProperty` override: bloccava `overflow: hidden` anche quando serviva per popup legittimi

**Soluzione (5 fix):**
1. `collapseAdParent()` — stop risalita su `role="dialog"`, `aria-modal="true"`, classi `.modal/.popup/.dialog/.consent`, elementi interattivi (`button`, `input`, `select`)
2. Sezione 4 (div vuoti con iframe ad) — skip se dentro popup/dialog o contiene pulsanti
3. Sezione 5 (label "Ad") — rimosso `<label>` dai candidati; nasconde SOLO se ha sibling ad noto (ins.adsbygoogle, google_ads, ecc.)
4. Sezione 6 (dimensioni banner) — skip se: dentro dialog, contiene interattivi, z-index > 100; rimosso `text.length < 20`; richiede indicatore positivo di ad container
5. Stealth `setProperty` (stealth.js) — verifica wall visibile (`getBoundingClientRect`) + assenza popup legittimi (`.modal.show`, `.swal2-shown`, `[role="dialog"]`, `.fancybox-is-open`)

**Selettori protetti (MAI nascondere/collassare):**
```css
[role="dialog"], [role="alertdialog"], [role="modal"], [aria-modal="true"],
.modal, .popup, .dialog, .overlay, .cookie, .consent
```

**Elementi interattivi protetti:**
```css
button, input, select, textarea, a[href], [role="button"], [onclick]
```

**Lezione:** Le euristiche di ad-hiding basate su dimensioni e testo corto sono pericolose — devono sempre verificare l'assenza di elementi interattivi e la presenza di indicatori positivi di ad container. Mai nascondere un elemento solo perche' "sembra vuoto".

---

### Bug 9 — Tabella comparativa illeggibile su mobile

**Versione:** v3.0 → risolto in v3.1.0
**Sintomo:** La tabella "AdOff vs gli altri" nella sezione Confronto del sito era troncata su smartphone con scrollbar orizzontale, rendendo le colonne dei competitor invisibili.
**Causa:** La tabella a 5 colonne aveva `min-width: 540px` e il wrapper usava `overflow-x: auto`, creando una barra di scorrimento laterale.
**Soluzione:** Layout responsive card-based con CSS puro (zero JS):
- Su desktop (>768px): tabella classica invariata
- Su mobile (<=768px): ogni riga diventa una mini-card con griglia 2x2
  - Feature name full-width come header con sfondo viola
  - 4 celle competitor in griglia 2x2 con label (`data-label` + CSS `::before`)
  - AdOff evidenziato con sfondo viola leggero
  - `thead` nascosto, `tbody tr` trasformato in `display: grid`
- Aggiunto `data-label="AdOff"/"uBlock Lite"/"ABP"/"AdGuard"` ai `<td>` dell'HTML
- File modificati: `site/index.html` (data-label), `site/style.css` (media query 768px)
- Deploy: `wrangler pages deploy site/ --project-name adoff-site`

**Lezione:** Le tabelle comparative multi-colonna richiedono un layout alternativo su mobile fin dall'inizio. Il pattern `data-label` + CSS `::before` e' il modo piu' leggero (zero JS) per trasformare tabelle in card.

---

## 15. Test Effettuati

### Suite di Test Playwright

Localita': `sviluppo/tests/`

| File | Target | Cosa testa |
|---|---|---|
| `test-extension.js` | Generici | Caricamento estensione, popup, toggle ON/OFF |
| `test-youtube-layout.js` | YouTube | Layout pagina video non rotto, player visibile, video avvia |
| `test-aranzulla.js` | Aranzulla.it | Ads nascosti, contenuto pagina visibile, no layout broken |
| `test-downloader.js` | YouTube (storico) | Pannello download (obsoleto, rimuovere) |
| `test-live.js` | Vari siti | Test live su siti reali |

### Screenshot di Riferimento (sviluppo/data-analisi/screenshots/)

**Test YouTube:**
- `yt-homepage.png` — Homepage YouTube con estensione
- `yt-watch-layout.png` — Pagina video con layout corretto
- `yt-channel-layout.png` — Pagina canale con layout corretto
- `yt-video-playing.png` — Video in riproduzione (no layout rotto)
- `FINAL-yt.png`, `FINAL2-yt.png`, `FINAL3-yt.png` — Versioni finali del test

**Test siti italiani:**
- `aranzulla-adspaces.png` — Aree ads su Aranzulla.it
- `aranzulla-final.png` — Aranzulla con ads nascosti
- `corriere-loaded.png`, `corriere-adspaces.png` — Test Corriere.it
- `ilfatto-adspaces.png` — Test IlFatto Quotidiano
- `repubblica-loaded.png` — Test Repubblica.it
- `siracusanews-cookie.png` — Cookie banner su siracusanews.it
- `siracusanews-after.png`, `siracusanews-clicked.png` — Cookie banner rimosso

**Test siti internazionali:**
- `cnn-loaded.png` — Test CNN.com
- `FINAL2-google.png` — Test Google Search
- `FINAL2-aranzulla.png` — Test Aranzulla

**Test stealth:**
- `bf-yt-home.png`, `bf-yt-watch.png` — Before/after YouTube stealth
- `bf-siracusa-ext.png`, `bf-siracusa-noext.png` — Before/after con/senza estensione
- `FINAL3-inject-test.png` — Test injection stealth

### Risultati Test Noti

| Test | Risultato | Note |
|---|---|---|
| YouTube homepage | PASS | Ads nascosti, layout corretto |
| YouTube video play | PASS | Video avvia regolarmente |
| YouTube skip ad button | PASS | Skip automatico quando appare |
| YouTube pre-roll block | FAIL | L'ad si vede 5-15s prima dello skip |
| Aranzulla.it | PASS | Ads nascosti |
| Corriere.it | PASS | Ads nascosti |
| Google Search | PASS | Non tocca Google (STEALTH_EXCLUDED) |
| Siti bancari | PASS | Non tocca siti in STEALTH_EXCLUDED |

---

## 16. File del Progetto

### Root (149 KB totali — estensione runtime)

| File | Dimensione | Descrizione |
|---|---|---|
| `manifest.json` | 1.2 KB | Configurazione estensione Manifest V3 |
| `src/background.js` | 1.8 KB | Service worker: badge, storage init, whitelist, toggle DNR |
| `src/stealth.js` | 9.1 KB | MAIN world: anti-detection, YouTube skip via Observer |
| `src/content.js` | 16.3 KB | ISOLATED world: scan DOM, hiding ads, whitelist check |
| `src/ads-hide.css` | 2.9 KB | CSS hiding universale |
| `src/popup.html` | 1.7 KB | UI popup |
| `src/popup.css` | 3.2 KB | Stile popup dark mode |
| `src/popup.js` | ~8 KB | Logica popup: toggle, pausa, licenza, render |
| `src/options.html` | — | Pagina opzioni |
| `src/options.css` | — | Stile pagina opzioni |
| `src/options.js` | — | Logica opzioni: whitelist, licenza, stats, import/export |
| `src/i18n.js` | ~12 KB | Sistema i18n: 6 lingue inline, auto-detect, override |
| `src/license-client.js` | ~5 KB | Client licenze: checkPro, activate, deactivate, validateOnline |
| `src/onboarding.html` | — | Pagina benvenuto primo install |
| `rules/adblock-rules.json` | 17.8 KB | 107 regole declarativeNetRequest |
| `assets/icon16.png` | — | Icona 16×16 |
| `assets/icon48.png` | — | Icona 48×48 |
| `assets/icon128.png` | — | Icona 128×128 |

**File da eliminare prima della pubblicazione:**
- `src/cookie-handler.js` (codice morto, non nel manifest)
- `src/yt-downloader.js` (codice morto, non nel manifest)

### sviluppo/ (materiale di sviluppo — non incluso nell'estensione)

```
sviluppo/
  brand/
    BRAND-IDENTITY.md          — Linee guida brand (vecchio nome Shadow Shield)
    STRATEGIA-COMMERCIALE.md   — Analisi competitor, modello business, pitch
    AUDIT-COMPLETO.md          — Audit completo codice, funzionale, business
    BRAINSTORMING-NOMI.md      — Analisi 40+ nomi, scelta AdOff
    generate-brand-assets.py   — Script Python generazione icone
    generate-adoff-icons.py    — Script Python generazione icone AdOff
    generate-pdf-report.py     — Script generazione PDF report
    assets/                    — Icone e logo in varie dimensioni
    store-assets/              — Asset per Chrome Web Store

  docs/
    PROGETTO-COMPLETO.md       — Documento progetto (versione precedente)
    ANALISI-FUNZIONALITA.md    — Analisi competitor funzionalita', design whitelist
    PRICING-PLAN.md            — Piano pricing definitivo, revenue projection
    SICUREZZA-LICENZE.md       — Strategia protezione licenze 3 livelli
    DOCUMENTAZIONE-COMPLETA.md — Questo file

  license-system/
    README.md                  — Architettura sistema licenze
    DEPLOY-GUIDE.md            — Guida deploy step-by-step
    PAGAMENTI.md               — Sistema pagamenti Stripe
    keygen.py                  — Generatore chiavi HMAC Python (CLI)
    worker.js                  — Cloudflare Worker API licenze
    admin.html                 — Dashboard admin licenze (web UI)
    wrangler.toml              — Configurazione deploy Wrangler/Cloudflare
    (chat log spostati in `sviluppo/logs/chat-archive/` — regola: niente chat in docs/)

  tests/
    test-extension.js          — Test Playwright generici
    test-youtube-layout.js     — Test layout YouTube
    test-aranzulla.js          — Test Aranzulla.it
    test-downloader.js         — Test downloader (obsoleto)
    test-live.js               — Test live multi-sito

  data-analisi/
    screenshots/               — 40+ screenshot di test su vari siti
    6MC1XqZSltw.webm           — Video test
    6MC1XqZSltw.txt/.md        — Trascrizioni/analisi
```

### Regole adblock-rules.json — Copertura

107 regole che coprono i seguenti network pubblicitari:

| Categoria | ID Regole | Network coperti |
|---|---|---|
| Google Ads | 1-9 | doubleclick.net, googlesyndication.com, googleadservices.com, google-analytics.com, googletagmanager.com, adservice.google.com |
| Facebook | 20-22 | facebook.com/tr, connect.facebook.net/fbevents, facebook.net/signals |
| Amazon Ads | 30-31 | amazon-adsystem.com, aax.amazon |
| Ad Networks | 40-49 | adnxs.com, adsrvr.org, adform.net, criteo.com, outbrain.com, taboola.com, revcontent.com, mgid.com, zergnet.com |
| SSP/DSP | 60+ | rubiconproject.com, openx.net, pubmatic.com, appnexus.com, sovrn.com, triplelift.com, sharethrough.com, indexexchange.com |
| Anti-Adblock | 90+ | blockadblock.com, fuckadblock.com, detectadblock.com |
| Varie | 100+ | Sizmek, Moat, IAS, DoubleVerify, e altri |

---

## 17. Prossimi Passi

### Priorita' CRITICA (prima della pubblicazione)

| # | Azione | Sforzo stimato | Bloccante per store |
|---|---|---|---|
| 1 | Eliminare `src/cookie-handler.js` e `src/yt-downloader.js` | 5 minuti | SI |
| 2 | Creare privacy policy page (zero data collection) | 1 ora | SI |
| 3 | Creare 5 screenshot reali dal browser Chrome | 1 ora | SI |
| 4 | Registrare account Chrome Web Store ($5) | 10 minuti | SI |
| 5 | Deploy Cloudflare Worker + KV con secret reale | 30 minuti | Per Pro |
| 6 | Aggiornare API_URL in license-client.js | 5 minuti | Per Pro |

### Priorita' ALTA (settimana 1)

| # | Azione | Sforzo stimato |
|---|---|---|
| 7 | Comprare dominio adoff.app (o adoff.io) | 10 minuti |
| 8 | Creare landing page adoff.app con pricing | 2-3 giorni |
| 9 | Setup Stripe (5 prodotti + payment links + webhook) | 2 ore |
| 10 | Testare flusso completo: acquisto → licenza → attivazione | 2 ore |
| 11 | Pubblicare su Chrome Web Store (versione Free) | 2 ore |

### Priorita' MEDIA (mese 1)

| # | Azione | Sforzo stimato |
|---|---|---|
| 12 | Reimplementare cookie banner auto-reject (solo Pro) | 1 giorno |
| 13 | Ampliare regole network (107 → 500+ con EasyList subset) | 1 giorno |
| 14 | Aggiungere statistiche con grafici nella pagina Opzioni | 2 giorni |
| 15 | Completare traduzioni DE, FR, ES, PT (80+ testi) | 1 giorno |
| 16 | Lanciare su Product Hunt | Preparazione 3 giorni |
| 17 | 3 post Reddit (r/privacy, r/chrome, r/uBlockOrigin) | 2 ore |
| 18 | 3 articoli blog SEO | 3 giorni |

### Priorita' BASSA (mese 2-3)

| # | Azione |
|---|---|
| 19 | Element picker (blocca elemento specifico con click) |
| 20 | Filtri personalizzati (custom URL filter lists) |
| 21 | Supporto Firefox (adattare manifest per MV3 Firefox) |
| 22 | Supporto Edge (stesso ZIP Chrome, zero modifiche) |
| 23 | Referral program (1 mese Pro gratis per referral) |
| 24 | Dashboard statistiche per admin (quanti utenti, conversioni) |
| 25 | Obfuscation build step (javascript-obfuscator) |

### Roadmap v4.0 (futuro)

- Protezione fingerprinting (canvas, WebGL, AudioContext)
- Whitelist wildcard/pattern (`*.google.*`)
- Sync impostazioni tra dispositivi (Chrome sync API)
- Context menu "Blocca questo elemento"
- Log richieste bloccate in tempo reale (Pro)
- Protezione anti-mining (crypto)
- Piano Business (team/aziende)

---

## 18. Appendice: Comandi Utili

### Generazione License Key

```bash
# Singola key Pro 1 mese
cd sviluppo/license-system
export ADOFF_SECRET="il_tuo_secret_qui"
python keygen.py --plan pro --months 1 --email user@example.com

# Singola key Lifetime
python keygen.py --plan lifetime --email user@example.com

# Batch 10 key Pro annuali
python keygen.py --plan pro --months 12 --batch 10 --output keys-batch.json

# Key con dispositivi custom
python keygen.py --plan pro --months 6 --email user@example.com --devices 5

# Genera nuovo secret
python -c "import secrets; print(secrets.token_hex(32))"
```

### Cloudflare Worker — Deploy e Gestione

```bash
# Installa Wrangler CLI
npm install -g wrangler
wrangler login

# Crea KV namespace
cd sviluppo/license-system
wrangler kv:namespace create ADOFF_LICENSES

# Setta secret (non nel codice)
wrangler secret put ADOFF_SECRET
wrangler secret put ADMIN_TOKEN

# Deploy Worker
wrangler deploy

# Aggiorna Worker (dopo modifiche a worker.js)
wrangler deploy

# Deploy sito/admin
wrangler pages deploy site --project-name=adoff-site
```

### Test API

```bash
# Health check
curl https://api.adoff.app/health

# Valida una key
curl -X POST https://api.adoff.app/validate \
  -H "Content-Type: application/json" \
  -d '{"key":"RAW_KEY_HERE"}'

# Attiva una key
curl -X POST https://api.adoff.app/activate \
  -H "Content-Type: application/json" \
  -d '{"key":"RAW_KEY_HERE"}'

# Deattiva un dispositivo
curl -X POST https://api.adoff.app/deactivate \
  -H "Content-Type: application/json" \
  -d '{"key":"RAW_KEY_HERE"}'

# Revoca una licenza (richiede admin token)
curl -X POST https://api.adoff.app/revoke \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{"key":"RAW_KEY_HERE"}'
```

### Preparare ZIP per Chrome Web Store

```bash
# Dalla root del progetto
# Escludi sviluppo/, .git, file inutili
zip -r adoff-chrome-store.zip . \
  -x "sviluppo/*" \
  -x ".git/*" \
  -x "*.DS_Store" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "src/cookie-handler.js" \
  -x "src/yt-downloader.js"
```

### Struttura Pagine Sito (da creare)

```
adoff.app/
  /           — Landing page con hero, features, pricing, FAQ
  /pricing    — Tabella pricing 3 tier con payment links Stripe
  /download   — Link al Chrome Web Store
  /success    — Pagina post-pagamento (mostra license key)
  /privacy    — Privacy policy (zero data collection)
  /blog/      — Articoli SEO
    /best-ad-blocker-chrome-2026
    /ublock-origin-alternative
    /come-bloccare-ads-youtube
  /admin      — Dashboard admin licenze (protetta da password)
```

### Siti da Testare Dopo Ogni Release

```
# Siti target italiani
- corriere.it     (ads + cookie banner)
- repubblica.it   (ads)
- gazzetta.it     (ads)
- aranzulla.it    (ads densi)
- ilfattoquotidiano.it (ads + anti-adblock)
- siracusanews.it (cookie banner)

# YouTube (funzionalita' speciali)
- youtube.com/watch?v=... (skip ad, layout video)
- youtube.com             (homepage, feed)
- youtube.com/@channel    (pagina canale)

# Siti internazionali
- cnn.com         (ads)
- bbc.com         (ads)
- forbes.com      (anti-adblock)
- businessinsider.com (anti-adblock)

# Siti da NON toccare (STEALTH_EXCLUDED)
- google.com     (ricerca funzionante)
- gmail.com      (email funzionante)
- facebook.com   (feed funzionante)
- amazon.com     (acquisti funzionanti)
- github.com     (code funzionante)
```

---

*Documentazione generata il 2026-04-18 da audit completo del codebase AdOff v3.0.0.*
*Per aggiornamenti: modificare questo file mantenendo il formato e la sezione appropriata.*
