# AUDIT COMPLETO — Shadow Shield v2.3.0

**Data:** 2026-04-18
**Stato:** Pre-lancio

---

## 1. AUDIT CODICE

### Struttura file

```
adoff/ (ultraleggera totali — estensione leggera)
  manifest.json        1.2 KB   Manifest V3
  src/
    stealth.js         9.1 KB   MAIN world — anti-detection + YouTube ad skipper
    content.js        16.3 KB   ISOLATED — scan DOM, hide ads
    background.js      1.8 KB   Service worker — badge, DNR toggle
    ads-hide.css       2.9 KB   CSS hiding universale
    popup.html         1.7 KB   UI popup
    popup.css          3.2 KB   Stile popup
    popup.js           1.9 KB   Logica popup
    cookie-handler.js  9.7 KB   MORTO — non nel manifest
    yt-downloader.js  10.0 KB   MORTO — non nel manifest
  rules/
    adblock-rules.json 17.8 KB  107 regole declarativeNetRequest
  assets/
    icon16-128.png     3.0 KB   Icone (6 dimensioni)
```

### Qualita' codice

| File | Righe | LOC | Issues |
|---|---|---|---|
| stealth.js | 273 | 219 | Override 7 API native (rischio store) |
| content.js | 505 | 377 | File grande (505 righe) — andrebbe spezzato |
| background.js | 59 | 47 | Pulito |
| popup.js | 53 | 43 | Pulito |
| ads-hide.css | 136 | 122 | Pulito |

### Problemi trovati

| # | Severita' | Problema | File |
|---|---|---|---|
| 1 | CRITICO | **2 file morti** nel progetto: `cookie-handler.js` e `yt-downloader.js` non sono nel manifest ma occupano 20KB | src/ |
| 2 | CRITICO | **2 permessi inutili** nel manifest: `scripting` e `webNavigation` non sono usati nel codice | manifest.json |
| 3 | ALTO | **7 override API native** nel MAIN world: fetch, XHR, getComputedStyle, HTMLElement, createElement, appendChild, setProperty — rischio rifiuto Chrome Web Store | stealth.js |
| 4 | MEDIO | content.js ha 505 righe — andrebbe spezzato in moduli | content.js |
| 5 | BASSO | `package.json` e `package-lock.json` nella root (Playwright test dep) — non servono all'estensione | root |

---

## 2. AUDIT FUNZIONALE

### Cosa FUNZIONA

| Funzionalita' | Stato | Note |
|---|---|---|
| Blocco ads rete (declarativeNetRequest) | OK | 107 regole, blocca Google Ads, DoubleClick, Taboola, Outbrain, etc. |
| Hiding CSS ads | OK | 136 righe CSS, selettori precisi |
| YouTube video play | OK | Video parte, dimensioni corrette |
| YouTube ad skip (click bottone) | OK | Clicca "Salta annuncio" ogni 300ms |
| Stealth anti-detection (non-YouTube) | OK | Variable spoofing, bait element protection |
| Popup toggle ON/OFF | OK | Badge aggiornato |
| Siti grandi esclusi da stealth | OK | Google, YouTube, Facebook, Amazon, etc. |
| Siti grandi esclusi da content scan | OK | Stessa lista |

### Cosa NON FUNZIONA

| Funzionalita' | Problema |
|---|---|
| YouTube pre-roll video ads | Non vengono bloccati — solo click skip button (se appare). L'ad viene comunque riprodotto per 5-15 secondi prima che il bottone skip appaia |
| Cookie auto-accept | Rimosso dal manifest — `cookie-handler.js` e' morto |
| Download YouTube (video/audio/SRT) | Rimosso dal manifest — `yt-downloader.js` e' morto |
| Collasso aree ad vuote (Corriere etc.) | content.js ha la logica ma e' skippato su siti grandi |
| Contatore "Richieste bloccate" | Funziona solo con `onRuleMatchedDebug` (richiede estensione in modalita' sviluppatore) |

### Cosa MANCA per la commercializzazione

| # | Funzionalita' | Priorita' | Sforzo |
|---|---|---|---|
| 1 | Sistema licensing Free/Pro/Lifetime | CRITICO | 3-5 giorni |
| 2 | Privacy policy page | CRITICO | 1 ora |
| 3 | Sito web landing page | ALTO | 2-3 giorni |
| 4 | Onboarding utente (prima apertura) | ALTO | 1 giorno |
| 5 | Whitelist per sito (disabilita su X) | ALTO | 1 giorno |
| 6 | Statistiche dettagliate (Pro) | MEDIO | 2 giorni |
| 7 | Sync impostazioni (Pro) | BASSO | 2 giorni |
| 8 | Localizzazione multilingua | BASSO | 2 giorni |

---

## 3. AUDIT PERFORMANCE

| Metrica | Valore | Giudizio |
|---|---|---|
| Dimensione totale estensione | ultraleggera | ECCELLENTE (uBlock Lite = 1.5MB, AdGuard = 3MB) |
| File JS totali | 28 KB (attivi) | OK |
| Regole DNR | 107 | BUONO (limite Chrome = 30,000) |
| Intervallo scan DOM | 500ms | OK |
| Intervallo ad skip YouTube | 300ms | OK |
| MutationObserver | 1 (con debounce 200ms) | OK |
| Memory footprint stimato | ~5-10 MB | BUONO |
| Impatto caricamento pagina | Minimo (CSS iniettato a document_start) | OK |

### Benchmark vs competitor

| Estensione | Dimensione | Regole | Impatto RAM |
|---|---|---|---|
| **Shadow Shield** | ultraleggera | 107 | ~5-10 MB |
| uBlock Origin Lite | 1.5 MB | 5,000+ | ~30 MB |
| AdBlock Plus | 2.8 MB | 10,000+ | ~50 MB |
| AdGuard | 3.2 MB | 15,000+ | ~60 MB |

Siamo **20x piu' leggeri** del competitor piu' vicino.

---

## 4. AUDIT CHROME WEB STORE COMPLIANCE

### Bloccanti (da risolvere PRIMA della pubblicazione)

| # | Issue | Rischio | Soluzione |
|---|---|---|---|
| 1 | stealth.js override 7 API native nel MAIN world | RIFIUTO | Spostare le override in una versione "soft" o rimuovere quelle piu' aggressive (createElement, appendChild, setProperty). Tenere solo getComputedStyle e offsetHeight per bait detection |
| 2 | Permessi `scripting` e `webNavigation` non usati | RIFIUTO | Rimuovere dal manifest |
| 3 | Privacy policy mancante | RIFIUTO | Creare pagina privacy policy (zero data collection) |
| 4 | File morti nella cartella src/ | Non bloccante ma disordinato | Eliminare o spostare in sviluppo/ |

### Warning (da migliorare)

| # | Issue | Soluzione |
|---|---|---|
| 1 | `<all_urls>` richiede giustificazione | Scrivere spiegazione dettagliata nel listing |
| 2 | Nome "Shadow Shield" generico | Valutare rebrand (Veil?) |
| 3 | Descrizione corta ("Navigazione pulita e veloce") | Espandere con keyword SEO |
| 4 | Screenshot store sono mockup generati | Creare screenshot REALI dal browser |

### Checklist pubblicazione

- [ ] Rimuovere permessi inutili
- [ ] Rimuovere file morti
- [ ] Softare stealth.js per compliance
- [ ] Creare privacy policy
- [ ] Creare account sviluppatore ($5)
- [ ] Preparare 5 screenshot reali
- [ ] Scrivere descrizione estesa con keyword
- [ ] Testare su Chrome stabile prima di submit

---

## 5. AUDIT BUSINESS

### Posizionamento di mercato

**Noi vs tutti:**

| Aspetto | Shadow Shield | uBlock Lite | ABP | AdGuard | Total Adblock |
|---|---|---|---|---|---|
| Funziona su Chrome 2026 | SI | Limitato | SI | SI | SI |
| Stealth anti-detection | SI | NO | NO | Solo app | NO |
| Vende whitelist ad | NO | NO | SI | NO | NO |
| Vende dati utente | NO | NO | NO | NO | ? |
| Dimensione | ultraleggera | 1.5 MB | 2.8 MB | 3.2 MB | ? |
| Prezzo Pro | 1.50/mese | Free | 4/mese | 3.3/mese | 8.25/mese |
| Lifetime | 19.90 | N/A | N/A | 100 | N/A |

### Punti di forza unici

1. **Piu' leggero di tutti** — ultraleggera vs megabyte dei competitor
2. **Stealth mode** — nessun competitor Chrome lo ha
3. **Prezzo piu' basso** — 1.50/mese (ABP 4, AdGuard 3.3, Total 8.25)
4. **Lifetime accessibile** — 19.90 (AdGuard 100)
5. **Zero conflitti etica** — no whitelist, no data selling
6. **Italiano** — nessun competitor e' pensato per il mercato IT

### Rischi principali

1. Google potrebbe rifiutare l'estensione per le override API
2. YouTube cambia sistema ad frequentemente
3. Basso conversion rate free→Pro senza feature killer
4. 107 regole network vs 5,000+ di uBlock — copertura inferiore

---

## 6. PIANO D'AZIONE (priorita')

### Immediato (prima del lancio)

| # | Azione | Tempo | Priorita' |
|---|---|---|---|
| 1 | Eliminare `cookie-handler.js` e `yt-downloader.js` dalla cartella src/ | 5 min | CRITICO |
| 2 | Rimuovere `scripting` e `webNavigation` dal manifest | 5 min | CRITICO |
| 3 | Softare stealth.js — rimuovere override createElement, appendChild, setProperty | 30 min | CRITICO |
| 4 | Creare privacy policy | 1 ora | CRITICO |
| 5 | Decidere nome definitivo | — | ALTO |
| 6 | Comprare dominio | 10 min | ALTO |
| 7 | Creare screenshot reali | 1 ora | ALTO |
| 8 | Pubblicare su Chrome Web Store | 2 ore | ALTO |

### Breve termine (settimana 1-2)

| # | Azione | Tempo |
|---|---|---|
| 9 | Creare sito landing page | 2-3 giorni |
| 10 | Implementare sistema licensing Free/Pro | 3-5 giorni |
| 11 | Aggiungere whitelist per sito | 1 giorno |
| 12 | Aggiungere onboarding prima apertura | 1 giorno |
| 13 | Ampliare regole network (107→500+) | 1 giorno |

### Medio termine (mese 1-2)

| # | Azione |
|---|---|
| 14 | Lanciare su Product Hunt |
| 15 | Post Reddit/HN |
| 16 | SEO blog (3 articoli) |
| 17 | Contattare YouTuber per review |
| 18 | Referral program |
| 19 | Supporto Firefox/Edge |

---

## 7. VOTO FINALE

| Area | Voto | Note |
|---|---|---|
| Codice | 6/10 | Funziona ma ha file morti, permessi extra, file troppo grandi |
| Funzionalita' | 7/10 | Ad blocking buono, mancano feature Pro |
| Performance | 9/10 | Eccezionalmente leggero |
| Design/Brand | 7/10 | Popup carino, brand da definire |
| Store readiness | 4/10 | Override API bloccanti, privacy policy mancante |
| Business readiness | 3/10 | Nessun sistema pagamento, nessun sito, nessun licensing |

### Voto complessivo: **6/10 — Buon prototipo, non pronto per la commercializzazione**

Serve: pulizia codice, compliance store, sistema licensing, sito web, nome definitivo.
