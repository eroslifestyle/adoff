---
name: youtube-cold-load-fix-v3-5-73
description: Fix definitivo bug cold-load YouTube v3.5.73 (stealth.js oggetto minimale senza streamingData → 403 SSAI/SABR → spot)
updated: 2026-08-14
metadata:
  type: project
---
# YouTube Cold-Load Bug Fix v3.5.73

## Problema
Utenti Premium/Pro/Lifetime vedevano spot YouTube nonostante il fix v3.5.72 (integrity hash).

## Sintomi
- Errori 403 su googlevideo.com/videoplayback
- Degrado qualità 144p/360p
- Spot server-side (SSAI/SABR) come fallback
- __adoff_pro = "1" presente → gate Pro OK
- doubleclick.net bloccato → network OK

## Root Cause
`coldLoad` in `stealth.js` restituiva un oggetto minimale **senza `streamingData`**, invalidando i parametri firmati SABR → 403 → degrado → spot come fallback.

## Soluzione v3.5.73
`coldLoadDisabilitato()` = `true` **SEMPRE**. Disabilitato permanentemente in tutti e 3 i target:
- `app/`
- `app-firefox/`
- `app-safari/`

## Perché Funziona
Le tre sole operazioni strettamente necessarie — strip `adPlacements` + mangle + inject `isInlinePlaybackNoAd` — bastano a rimuovere gli spot client-side **senza corrompere il player**.

## Implementazione
- Commit `62cc92a` su `main`
- Commit `374a10d` su `feat/premium-vpn`
- Bump versione 3.5.72 → 3.5.73
- Build + deploy + upload store

**Why:** il minimo indispensabile per bloccare i client-side ad slots senza rompere il player SABR-signed.
**How to apply:** mantenere `coldLoadDisabilitato() = true` come default globale finché YouTube non cambia l'algoritmo di firma; non riabilitare `coldLoad` senza aver verificato la preservazione di `streamingData`.

## Lezioni
- NON restituire oggetti minimali che rimuovono campi usati nelle firme SABR (`streamingData`).
- NON forzare il `player request` se non si controllano tutti i parametri firmati.
- Testare SEMPRE nel browser reale con licenza Premium attiva, prima del rilascio.

## Fallimenti Precedenti (cosa NON ha funzionato)
- **v3.5.72 (integrity hash):** risolveva integrity check ma non bastava a fermare i spot una volta innescato il flusso SSAI/SABR fallback.
- **v3.5.71 (premium gate):** confermava `__adoff_pro = "1"`, ma il problema era già oltre il gate, lato player/stream.

## Correlazioni
- Indipendente dal fix integrity v3.5.72 (resta valido, ma non sufficiente da solo).
- Indipendente dal fix premium gate v3.5.71.
- Colpiva **TUTTI** gli abbonati (Premium, Pro, Lifetime), non solo Premium.
- File coinvolto: `stealth.js`
- Branch: `main`, `feat/premium-vpn`
