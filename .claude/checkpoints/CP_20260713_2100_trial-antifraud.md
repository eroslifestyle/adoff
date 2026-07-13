# CP_20260713_2100_trial-antifraud

## Goal
Implementare sistema anti-fraud per trial AdOff che previene abuse tramite disinstallazione/reinstallazione.

## Progress/TODO Board

- [x] Analisi sistema trial attuale (background.js + worker.js)
- [x] Ricerca competitor (uBlock Origin, AdGuard, Total AdBlock, NordVPN)
- [x] Identificare vulnerabilità: deviceId cancellabile a ogni reinstall
- [x] Proporre soluzione multi-livello
- [x] Sessione AQ: 6 domande, risposte raccolte
- [ ] Implementare Fase 1: generateResilientFingerprint() in background.js
- [ ] Implementare Fase 2: trial_fingerprints table + anti-abuse logic in worker.js
- [ ] Implementare Fase 3: account via di fuga per falsi positivi

## Failed Approaches

- **Sistema attuale (deviceId in storage.local)**: CANCELLATO a ogni reinstall Chrome/estensione. Aggirabile con semplice disinstalla/reinstalla.

## Do NOT

- Non usare deviceId da chrome.storage.local come identificatore primario
- Non richiedere account obbligatorio (friction = 0 per l'utente)
- Non bloccare per IP (famiglia/ufficio stesso WiFi = trial separati)
- Non implementare senza test su edge case (PC identici, VM)

## Key Decisions

- **Zero friction**: trial invisibile, utente non fa nulla
- **Fingerprint hardware**: identifica persona/PC, non storage
- **Trial per persona**: ogni PC = suo trial (stessa rete OK)
- **Account via di fuga**: se fingerprint collide, utente crea account per sbloccare
- **Bilanciamento**: protezione ragionevole, non estrema

## Strategia Scelta (dettaglio)

### Identificazione resiliente
```
generateResilientFingerprint() combina:
- Canvas fingerprint (hardware)
- AudioContext fingerprint  
- Screen resolution + color depth
- Timezone + language
- Platform + hardwareConcurrency
- WebGL renderer
→ hash → fingerprint stabile
```

### Server-side anti-abuse
```
POST /trial { fingerprint, deviceId_legacy }
  → Check fingerprint in trial_fingerprints table
  → If exists: { allowed: false, fallback: "create_account" }
  → If new: generate trial token, save fingerprint
```

### Via di fuga
```
Utente bloccato → mostra "Crea account per trial"
→ Account sblocca automaticamente il trial
```

## Resume Instructions

1. **Fase 1** (background.js):
   - Creare `generateResilientFingerprint()` che legge Canvas + Audio + Screen + WebGL
   - Inviare fingerprint al server in `syncTrialBg()` e `/trial`
   - Mantenere deviceId legacy per backward compatibility

2. **Fase 2** (worker.js):
   - Aggiungere tabella `trial_fingerprints (fingerprint TEXT PRIMARY KEY, created_at, trial_start)`
   - Modificare `handleTrial()` per rifiutare fingerprint duplicati
   - Rispondere con `{ allowed: false, fallback: "account" }` se fingerprint esiste

3. **Fase 3** (extension + worker):
   - Se server risponde con `fallback: "account"`, mostrare UI "Sblocca trial"
   - L'account opzionale sblocca il trial per quel fingerprint

## File da Modificare

| File | Cosa |
|------|------|
| `app/src/background.js` | Aggiungere generateResilientFingerprint() |
| `sviluppo/license-system/worker.js` | Tabella trial_fingerprints + logic in handleTrial() |
| `app/src/popup.js` / `options.js` | UI via di fuga per account |

## Risposte AQ Complete

| # | Domanda | Risposta |
|---|---------|----------|
| 1 | Gravità abusi | B) Forse succede, non sicuro |
| 2 | Friction accettabile | A) Zero friction |
| 3 | Identificazione | A) Fingerprint hardware |
| 4 | Famiglia/ufficio | A) Ogni persona trial separato |
| 5 | Falsi positivi | C) Account via di fuga |
| 6 | Tempo sviluppo | C) Farò bene, senza fretta |
