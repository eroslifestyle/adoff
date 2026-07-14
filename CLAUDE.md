# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AdOff** — Estensione browser (Manifest V3) ad blocker universale con stealth anti-detection. Tagline: "Ads? Off!" Funziona su tutti i siti web, invisibile ai sistemi anti-adblock. Disponibile su Chrome, Firefox, Safari, Edge e Opera.

## Architecture

L'estensione opera su 4 livelli:

1. **Network blocking** (`declarativeNetRequest`) — 138 regole `block`/`allow` (nessun `redirect`) bloccano richieste HTTP verso ad network, incluso il blocco di IMA SDK (`imasdk.googleapis.com`, rule 900). Le regole si dividono in **ads reali** (contate nel badge) e **tracking/analytics** (bloccati ma non contati, 23 rule IDs esclusi)
2. **Cosmetic filtering** (CSS + content script ISOLATED) — Nasconde elementi ad dal DOM
3. **Video ad neutralization** (IMA SDK stub, MAIN world, Solo Pro/Trial) — Lo stub universale è iniettato in-page da `stealth.js` via `Object.defineProperty(window.google, "ima", ...)`, sostituendo Google IMA SDK su tutti i siti (sia caricato esternamente che bundlato nei player). Quando un player video chiama `adsManager.start()`, lo stub emette immediatamente `CONTENT_RESUME_REQUESTED` → zero ads, player funzionante. Il caricamento esterno di IMA è inoltre bloccato a livello rete (rule 900)
4. **Stealth anti-detection** (script MAIN world, Solo Pro/Trial) — Evasione anti-adblock: bait spoofing, variable spoofing, fetch/XHR interception

### Trial anti-crack (server-anchored signed token — 2026-06-05)

Il trial è **ancorato al server** e non manomettibile via DevTools/storage, e **non si resetta più sugli update**.

- **Autorità = server**: `POST /trial { deviceId }` (worker `handleTrial`) fissa `trial_start` la prima volta in tabella D1 `trials` (keyed su `device_id` = `adoffDeviceId` stabile), poi è idempotente. Calcola `trial_end = trial_start + 30g` e ritorna un **token firmato ECDSA P-256** (`payloadB64.sigB64`, payload `{deviceId,trialStart,trialEnd,iat,v}`).
- **Chiave**: privata nel Worker (`env.ADOFF_TRIAL_PRIVKEY`, PKCS8 b64, in `~/.secrets/adoff-stores.env`); **pubblica embeddata** (stessa JWK) in `background.js`, `content.js`, `license-client.js`. Avere la pubblica NON permette di forgiare un token con più giorni.
- **Gate client**: ogni punto che abilita Pro/Trial verifica la firma del token con `crypto.subtle.verify` e confronta `payload.deviceId` col locale (anti token-sharing). `adoffTrialEnd` è solo cache di display + **fallback ottimistico limitato** (onorato solo se ≤ `now + 30g + 1g` → un valore gonfiato via DevTools è ignorato).
- **Fix reset-on-update**: `syncTrialBg()` gira a install/update/startup/daily-alarm → su update RIPRISTINA la scadenza dal server anche se lo storage locale fosse azzerato. Il countdown non riparte mai.
- **Punti di verifica** (tutti col token): `background.js` `isTrialActive()`/`updateImaRules()` (gate IMA redirect), `content.js` gate `data-adoff-stealth` (stealth/cosmetic Pro), `license-client.js` `checkPro()` (popup/options). Guardia clock-rollback via `adoffTrialSeen`.
- **Residuo noto**: un reinstall completo azzera `adoffDeviceId` → trial nuovo (accettato); un programmatore che patcha il JS dell'estensione bypassa qualsiasi gate client-side (limite intrinseco — difesa totale = servire la funzionalità Pro dal server).
- **Deploy worker**: `wrangler secret put ADOFF_TRIAL_PRIVKEY` PRIMA del deploy. Se `/trial` non è ancora live i client degradano al fallback ottimistico (nessuna regressione).

### File structure — Chrome (`app/`)

- `manifest.json` — Manifest V3, AdOff v3.3.9
- `src/stealth.js` — MAIN world: IMA SDK stub universale + ad skipper piattaforme video + anti-detection (Pro-only)
- `src/content.js` — ISOLATED: whitelist check, scan DOM, hide ads, contatore ads cosmetic
- `src/ads-hide.css` — CSS hiding universale
- `src/background.js` — Service worker: storage init, badge contatore (solo ads reali), trial 15gg, whitelist messaging, referral, contatore network ads (filtra tracking/analytics)
- `src/popup.html/css/js` — Popup: toggle, contatori, pausa sito (4 opzioni), badge licenza
- `src/options.html/css/js` — Opzioni: generale, whitelist, licenza, stats (con reset), referral, avanzate, aiuto, suggerimenti, info
- `src/onboarding.html/css/js` — Pagina primo install con istruzioni pin
- `src/i18n.js` — Internazionalizzazione 15 lingue (IT/EN/DE/FR/ES/PT/RU/AR/ZH/TR/PL/HI/JA/KO + ulteriori)
- `src/license-client.js` — Client validazione licenze (HMAC + API + integrity check)
- `stubs/google-ima3.js` — Stub IMA SDK completo, esposto come `web_accessible_resources` (NON più redirect target; la neutralizzazione primaria avviene in-page via `stealth.js`)
- `rules/adblock-rules.json` — 138 regole declarativeNetRequest (137 block incluso IMA SDK rule 900 + 1 allow GTM broadcaster rule 910; nessun redirect)

### File structure — Firefox (`app-firefox/`)

Stessa struttura di Chrome con queste differenze:
- `manifest.json` — MV3 con `background.scripts` (non service_worker) + `browser_specific_settings.gecko`
- `src/stealth.js` — Versione ridotta (no `world: "MAIN"` nativo)
- `src/stealth-injector.js` — **Solo Firefox**: inietta stealth.js nel MAIN world via `<script>` tag
- `src/background.js` — Come Chrome ma con alarm-based counter (no `declarativeNetRequestFeedback` debug)
- NO `stubs/` directory — Firefox usa `web_accessible_resources` su `src/stealth.js`

### File structure — Safari (`app-safari/`)

Identica a Chrome (Safari 16.4+ supporta nativamente `world: "MAIN"`, `service_worker`, `declarativeNetRequest`, `web_accessible_resources`). Differenze:
- `manifest.json` — MV3 identico a Chrome ma con `browser_specific_settings.safari.strict_min_version: "16.4"`
- Tutti i file `src/`, `rules/`, `assets/`, `stubs/` sono identici a `app/` Chrome
- **Distribuzione**: richiede wrap Xcode via `xcrun safari-web-extension-converter` (non installabile come ZIP unpacked)
- Mac App Store o developer signing per distribuzione finale

### Counter logic

Il badge e il popup mostrano **solo ads reali bloccati**, non tracking/analytics:
- `adoffAdsBlocked` — ads cosmetic (elementi DOM nascosti + video ads skippate)
- `adoffReqBlocked` — richieste network ad bloccate (esclusi 23 rule IDs di tracking)
- **Esclusi dal conteggio** (rule IDs 4,5,20-22,80-90,175-176,180-181,183,190-191,211): Google Analytics, GTM, Facebook Pixel, Hotjar, Mixpanel, Segment, Amplitude, NewRelic, Sentry, Moat, DoubleVerify, IAS, ScoreCard, Quantserve, Twitter/TikTok analytics, Gemius, AddThis
- Reset contatori disponibile in Opzioni → Statistiche

## Project Organization

```
adoff/                    (root progetto)
├── app/                         ESTENSIONE CHROME/EDGE/OPERA (solo file runtime)
│   ├── manifest.json            MV3 con service_worker
│   ├── src/                     JS, CSS, HTML dell'estensione
│   ├── stubs/                   google-ima3.js (stub IMA SDK)
│   ├── rules/                   adblock-rules.json
│   └── assets/                  Icone (16, 19, 32, 38, 48, 128)
├── app-firefox/                 ESTENSIONE FIREFOX (solo file runtime)
│   ├── manifest.json            MV3 con background.scripts + gecko
│   ├── src/                     JS, CSS, HTML (condivisi con app/)
│   │   └── stealth-injector.js  Solo Firefox: MAIN world workaround
│   ├── rules/                   adblock-rules.json (identico a app/)
│   └── assets/                  Icone (identiche a app/)
├── app-safari/                  ESTENSIONE SAFARI (solo file runtime)
│   ├── manifest.json            MV3 identico a Chrome + browser_specific_settings.safari (min 16.4)
│   ├── src/                     JS, CSS, HTML (identici a app/ Chrome)
│   ├── stubs/                   google-ima3.js (identico a app/)
│   ├── rules/                   adblock-rules.json (identico a app/)
│   └── assets/                  Icone (identiche a app/)
│   # Distribuzione: xcrun safari-web-extension-converter (richiede macOS + Xcode)
├── site/                        SITO WEB (deployato su CF Pages: adoff.app)
│   ├── index.html               Landing page
│   ├── style.css                Stili globali
│   ├── nav.js                   Topbar + dropdown 6 lingue
│   ├── adoff-i18n.js            Traduzioni sito (15 lingue)
│   ├── support.html             Form supporto anti-bot
│   ├── install.html             Guida installazione multi-browser
│   ├── privacy/terms/withdrawal Privacy, termini, recesso
│   ├── adoff-chrome.zip         ZIP download Chrome (nome FISSO, da build)
│   └── adoff-firefox.zip        ZIP download Firefox (nome FISSO, da build)
├── docs/                        DOCUMENTI UFFICIALI
│   ├── PRD, pricing, audit, manuale, store listing, bibbia marketing
│   └── (NO chat, NO log — quelli vanno in sviluppo/logs)
├── sviluppo/                    SVILUPPO (mai deployato)
│   ├── scripts/                 Build scripts (build.js, verify-watermark.js)
│   ├── build-chrome/            Output build Chrome (generato da build.js)
│   ├── build-firefox/           Output build Firefox (generato da build.js)
│   ├── build-manifest.json      Metadati build (ID, timestamp, profili)
│   ├── marketing/               HUB UNICO social/marketing/content (vedi marketing/INDEX.md)
│   │   ├── BRAND-HUB/           ⭐ CENTRALE: tutti i visual (1-IDENTITA brand-bible/identity/font · 2-LOGHI · 3-IMMAGINI-SOCIAL · 4-VIDEO demo · 5-SCREENSHOT-STORE · 6-SEEDING-PH · 7-COVER · _ARCHIVIO-TEST). Mappa: BRAND-HUB/INDEX.md
│   │   ├── strategia/           STRATEGIA-SOCIAL-CONTENT-2026 (autoritativo), APERTURA-CANALI, SOCIAL-MEDIA-KIT, BIBBIA-MARKETING
│   │   ├── brand/               OFFICINA: generate-*.py, fonts/ (orig), omnia-kit, sdcpp-source, strategie (identità → BRAND-HUB/1-IDENTITA)
│   │   ├── demo/                OFFICINA: genera i video demo reali (pagine scenario + Playwright + estensione)
│   │   ├── video-engine/        Remotion (template video brand-safe, render)
│   │   ├── automation/          Content Factory n8n (≥5 contenuti/giorno)
│   │   ├── keywords/            Ricerca keyword SEO multilingua
│   │   └── archive/             Doc superseded, video-tiktok-old
│   ├── license-system/          Worker CF licenze (worker.js, admin, keygen)
│   ├── worker-telegram/         Worker CF Telegram bot
│   ├── ai-autopilot/            Piano AI Autopilot + n8n-workflows + infra
│   ├── data-analisi/            Screenshot, trascrizioni, analisi competitor
│   ├── build-{chrome,firefox,safari}/  Unpacked build (ripuliti ad ogni build, SINGLE SOURCE)
│   ├── adoff-{target}-{prod,store}.zip ZIP di lavoro correnti (sovrascritti ad ogni build)
│   ├── i18n-work/               File i18n di lavoro raccolti
│   ├── tests/                   Test suite
│   ├── logs/                    Log sessioni + chat-archive/ (chat storici)
│   ├── archive/                 Vecchi ZIP, backup, dropbox-conflicts
│   ├── audit-reports/           Report audit datati (per anno/mese)
│   └── INDEX.md                 Master index navigazione sviluppo/
├── CLAUDE.md                    Istruzioni progetto
└── .claude/                     Checkpoint, progress
```

> **NOTA REORG 2026-05-28 (cleanup ultra-deep)**:
> - 766 cartelle orfane `sviluppo/build-{chrome,firefox,safari}-old-*` rimosse (~900 MB) — generate da build.js, non più necessarie.
> - `sviluppo/video-tiktok-remotion/` (orfano node_modules dopo reorg 2026-05-16) → ELIMINATO; engine attivo solo in `sviluppo/marketing/video-engine/`.
> - `sviluppo/tmp-preview/`, `sviluppo/test-zip/`, `sviluppo/Alalisi RoundTable/` → ELIMINATI (tmp/test/typo).
> - `sviluppo/backups/` (i18n-junk, site-pre-final-deploy, site-bak-archive-20260520) → ELIMINATA.
> - `sviluppo/firefox-signed/` → ELIMINATA; `sviluppo/amo-artifacts/` ripulita (mantenute solo versioni correnti).
> - `sviluppo/archive/*.bak-20260520_*` + `adoff-v3.0.0.zip` → ELIMINATI (obsoleti vs versione corrente).
> - `docs/chat/` → spostato in `sviluppo/logs/chat-archive/` (regola: niente chat in `docs/`).
> - `sviluppo/audit-zh-faq-stealth-20260520.md` → spostato in `sviluppo/audit-reports/2026-05/`.

> **NOTA REORG 2026-05-16**: `sviluppo/brand/` eliminata → confluita in `sviluppo/marketing/`. Tutto il social/marketing/content ora in `sviluppo/marketing/` (hub unico, vedi `marketing/INDEX.md`). `docs/` = SOLO documenti ufficiali. Strategia social autoritativa: `sviluppo/marketing/strategia/STRATEGIA-SOCIAL-CONTENT-2026.md`.

**Regole struttura:**
- `app/` = file runtime Chrome/Edge/Opera. Si carica in Chrome (`chrome://extensions` → Carica non pacchettizzata → `app/`)
- `app-firefox/` = file runtime Firefox. Si carica in Firefox (`about:debugging` → Carica temporaneo → `app-firefox/`)
- `app-safari/` = file runtime Safari. Si converte con `xcrun safari-web-extension-converter app-safari/` (richiede macOS + Xcode), poi build/run da Xcode
- `site/` = SOLO file deployati su Cloudflare Pages (include i 2 ZIP download)
- `docs/` = documenti ufficiali (no file di lavoro)
- `sviluppo/` = tutto il resto (mai deployato, mai nel pacchetto estensione)
- La root contiene SOLO CLAUDE.md e le cartelle di progetto

## Storage Keys

Usa `chrome.storage.local` con prefisso `adoff`:
- `adoffEnabled` (boolean) — protezione on/off
- `adoffAdsBlocked` (number) — contatore ads cosmetic (elementi DOM nascosti + video ads skippate)
- `adoffReqBlocked` (number) — contatore richieste ad network bloccate (esclusi tracking/analytics)
- `adoffWhitelist` (array) — siti esclusi con tipo pausa
- `adoffTrialEnd` (number) — timestamp fine trial (cache display; **autorità = `adoffTrialToken`**)
- `adoffTrialToken` (string) — token trial firmato ECDSA P-256 dal server (`POST /trial`), fonte di verità anti-tampering della scadenza. Verificato client-side con chiave pubblica embeddata in `background.js`/`content.js`/`license-client.js`. Vedi **Trial anti-crack** sotto
- `adoffTrialStart` (number) — timestamp inizio trial dal server
- `adoffTrialSeen` (number) — max `now` osservato (guardia clock-rollback)
- `adoffLicense` (object) — dati licenza Pro
- `adoffLang` (string) — lingua override
- `adoffReferralCode` (string) — codice referral
- `adoffReferralCount` (number) — amici paganti portati
- `adoffReferralDays` (number) — giorni Pro guadagnati da referral
- `adoffReferralHistory` (array) — storico inviti
- `adoffInstallDate` (number) — timestamp primo install
- `adoffIsFounder` (boolean) — early adopter badge
- `adoffIntegrity` (string) — hash integrity anti-tampering
- `adoffTrialExpired` (boolean) — trial scaduto flag
- `adoffShowChangelog` (boolean) — mostra changelog post-update
- `adoffNewVersion` (string) — versione aggiornata
- `adoffChangelogSeen` (array) — versioni changelog gia' viste
- `adoffReviewPromptCount` (number) — volte prompt recensione mostrato
- `adoffReviewDismissed` (boolean) — mai piu' prompt
- `adoffReviewDone` (boolean) — recensione lasciata
- `adoffMilestones` (object) — milestone ads raggiunte

## Pricing (modello Founder — 2026-06-01, piano UNICO)

| Piano | Prezzo |
|---|---|
| Mensile | **2,99 EUR/mese** |
| Annuale — Founder (primi 100, bloccato a vita) | **19,99 EUR/anno** |
| Annuale — standard (dopo i 100) | **24,99 EUR/anno** |
| Founder Lifetime (offerta limitata) | **99 EUR** una tantum |

- Trial: 30gg gratis Pro · piano UNICO (fino a ~3 dispositivi personali; tier 3/5/10 rimandati)
- **Counter reale "Posti Founder X/100"** dal backend (`GET /founder-status`, tabella D1 `founder_seats`); niente numeri finti
- Prezzo deciso **server-side** dal worker (price_data inline, gating Founder) — NON si usano Price ID Stripe fissi
- Dettaglio completo: `docs/PRICING-PLAN.md`. Vecchi prezzi 2,69/29,59/67,90 + tier device = SUPERATI.

## Privacy & Identity Protection (REGOLA ASSOLUTA)

**MAI esporre dati personali del developer in nessun file di produzione.**

- **VIETATO**: nome reale, cognome, email personale, citta', indirizzo, telefono, P.IVA, codice fiscale, account social personali
- **VIETATO**: subdomain Cloudflare con nome personale (es. `nome.workers.dev`) — usare solo subdomain brandizzati (`adoff-*.workers.dev`)
- **VIETATO**: `mailto:` link in chiaro sul sito — usare SOLO form di contatto con anti-bot (honeypot + captcha + rate limit)
- **VIETATO**: riferimenti a citta'/tribunale specifico nei documenti legali — usare "European Union" generico
- **VIETATO**: email personale nei commit, nei file di configurazione, nei log deployati
- **Contatti pubblici**: solo tramite form su `support.html`, mai email dirette
- **Documenti legali**: dove la legge EU richiede un contatto, usare formato offuscato: `support [at] adoff [dot] app`
- **File di sviluppo** (`sviluppo/`, `sviluppo/logs/chat-archive/`): possono contenere dati personali MA non vengono mai deployati
- **Prima di ogni deploy**: verificare con `grep -ri "erosdegrande\|nome\|cognome" site/ app/` che non ci siano leak

## Brand Name Policy (REGOLA ASSOLUTA — con deroga marketing autorizzata 2026-05-28)

**MAI nominare brand famosi nel CODICE dell'estensione (`app/src/`, `app-firefox/src/`, `app-safari/src/`) né nelle ICONE/SCREENSHOT/ASSET.**

> **DEROGA MARKETING AUTORIZZATA (2026-05-28)**: nella COPY di marketing — landing `site/` (incl. i18n) e descrizione store (`docs/store-listing.md`) — i nomi delle piattaforme (YouTube, Twitch, Vimeo, Dailymotion, Hulu, Facebook, Instagram, X/Twitter, TikTok, Reddit, LinkedIn, Pinterest, Snapchat, Google, Bing, Amazon, eBay, AliExpress, Spotify, Gmail, ecc.) SONO AMMESSI in **forma nominativa/descrittiva** per recuperare le keyword SEO. Vincoli vincolanti: (1) solo TESTO, MAI loghi di terze parti in icona/screenshot/asset (rischio takedown CWS reale); (2) nessun claim di affiliazione/endorsement; (3) uso nominativo/descrittivo. Motivo: ~7/9 competitor nominano apertamente le piattaforme nel listing; la policy stretta costava ad AdOff le query "block ads on \[piattaforma\]".

- **VIETATO nel codice `app/src/` e negli asset grafici**: loghi di terze parti; brand in commenti, nomi variabili/funzioni
- **Sinonimi obbligatori**:
  - YouTube → "piattaforme video" / "video streaming" / "video platforms"
  - Google → "motori di ricerca" / "search engines"
  - Facebook/Instagram → "social media" / "social networks"
  - Amazon → "e-commerce"
  - Twitch → "piattaforme live streaming"
  - Reddit → "forum" / "community"
  - Twitter/X → "microblogging" / "social"
- **Eccezione tecnica**: le stringhe dominio nel codice sorgente (es. `"youtube.com"` per hostname matching, URL filter rules) restano perche' funzionali al blocking
- **Il cliente deve capire** dal contesto senza che il brand sia scritto esplicitamente
- **Commenti nel codice**: usare termini generici ("video platform", "piattaforma video")
- **Nomi variabili/funzioni**: usare `VideoPlatform`, `isVideoPlatform`, NOT `YouTube`
- **Prima di ogni deploy** (check brand leak ristretto al codice/asset, NON alla copy marketing): `grep -rni "youtube\|facebook\|instagram\|tiktok" app/src/ app-firefox/src/ app-safari/src/` per verificare zero brand leak nel CODICE (escludere adblock-rules.json e stringhe dominio funzionali). I nomi nel testo di `site/` e `docs/store-listing.md` sono AMMESSI per la deroga marketing. Per gli asset: verificare a vista che icone/screenshot non contengano loghi di terze parti.

## Deploy Rule (REGOLA ASSOLUTA)

**OFFLINE = ONLINE. Ogni modifica DEVE essere seguita IMMEDIATAMENTE da publish online.**

### Version Congruence (REGOLA ASSOLUTA — 2026-06-02)

**La versione mostrata all'utente DEVE sempre coincidere con quella reale del `manifest.json`. Zero versioni hardcoded.**

- **Single source of truth = `manifest.json`.** Ogni punto che mostra la versione (popup, options → Info, onboarding, FAQ, report) la legge a runtime via `chrome.runtime.getManifest().version` (fallback `browser.runtime`). MAI scrivere il numero a mano nell'HTML/JS.
  - Implementato: `popup.js` → `#popupVersion`, `options.js` → `const VERSION` da manifest + `#infoVersion`, `onboarding.js` → `renderVersion()`. Se aggiungi un nuovo punto-versione, usa lo stesso pattern.
  - **Eccezione legittima**: le chiavi changelog storiche in `background.js`/`popup.js` (`"3.1.0": [...]`, `"3.0.0": [...]`) NON sono la versione corrente — sono dati storici, non si toccano.
- **Ad ogni deploy**: bump della versione in TUTTI E TRE i `manifest.json` (stessa versione). Essendo la UI dinamica, non serve toccare altro: si propaga da sola.
- **Più in generale — TUTTO deve essere congruente.** Prima di ogni deploy verificare che numeri/fatti citati nella UI coincidano con la realtà: conteggio regole (`grep -c '"id"' app/rules/adblock-rules.json` = N → i testi dicono "N+"), prezzi (vedi sezione Pricing), conteggio lingue, claim funzionalità. Un numero stantio in un solo punto = incongruenza da fixare subito.
- **Pre-deploy check congruenza**: `grep -rn '[0-9]\.[0-9]\.[0-9]' app/src/ app-firefox/src/ app-safari/src/ | grep -v getManifest` → l'unico match atteso sono le chiavi changelog storiche. Qualsiasi altro version literal = bug.

### Multi-Browser Sync (REGOLA ASSOLUTA)

**Ogni modifica a codice, regole, o assets DEVE essere propagata a TUTTI i browser.**

Le sorgenti sono 3: `app/` (Chrome/Edge/Opera), `app-firefox/` (Firefox), `app-safari/` (Safari).
I file condivisi (content.js, options.js, popup.js, license-client.js, i18n.js, CSS, HTML, assets, rules) DEVONO essere identici tra le tre cartelle, salvo le differenze strutturali Firefox (background.scripts, stealth-injector.js, gecko ID) e Safari (browser_specific_settings.safari).

**Workflow OBBLIGATORIO ad ogni modifica di `app/`, `app-firefox/` o `app-safari/`:**

1. **Applica la modifica** al file sorgente (es. `app/src/content.js`)
2. **Propaga ai file condivisi** degli altri target:
   - Se modifichi `app/src/*.js` → copia lo stesso file in `app-firefox/src/` E `app-safari/src/` (escluso stealth.js se diverso per Firefox)
   - Se modifichi `app-firefox/src/*.js` o `app-safari/src/*.js` → propaga agli altri target
   - Se modifichi `app/rules/` o `app/assets/` → copia in `app-firefox/` E `app-safari/`
   - Se modifichi `app/stubs/google-ima3.js` → copia anche in `app-safari/stubs/` (Firefox NON ha stubs)
3. **Se modifichi stealth.js**: attenzione, Firefox usa una versione ridotta (no `world: "MAIN"` nativo). Safari e Chrome usano la stessa versione. Propagare solo la logica, non la struttura specifica Firefox.
4. **Bumpa versione** in TUTTI i `manifest.json` (stessa versione su 3 file)
5. **Build produzione**: `node sviluppo/scripts/build.js` (builda Chrome + Firefox + Safari insieme)
6. **Deploy TUTTI gli store** (vedi sotto)

**File che DEVONO essere sincronizzati:**

| File | Chrome `app/` | Firefox `app-firefox/` | Safari `app-safari/` | Identici? |
|---|---|---|---|---|
| content.js | src/content.js | src/content.js | src/content.js | SI |
| background.js | src/background.js | src/background.js | src/background.js | Chrome=Safari, Firefox quasi (no alarms) |
| stealth.js | src/stealth.js | src/stealth.js | src/stealth.js | Chrome=Safari, Firefox piu' leggero |
| license-client.js | src/license-client.js | src/license-client.js | src/license-client.js | SI |
| popup.js/html/css | src/popup.* | src/popup.* | src/popup.* | SI |
| options.js/html/css | src/options.* | src/options.* | src/options.* | SI |
| onboarding.* | src/onboarding.* | src/onboarding.* | src/onboarding.* | SI |
| i18n.js | src/i18n.js | src/i18n.js | src/i18n.js | SI |
| ads-hide.css | src/ads-hide.css | src/ads-hide.css | src/ads-hide.css | SI |
| adblock-rules.json | rules/ | rules/ | rules/ | SI |
| assets/ | assets/ | assets/ | assets/ | SI |
| stealth-injector.js | NON ESISTE | src/stealth-injector.js | NON ESISTE | Solo Firefox |
| stubs/google-ima3.js | stubs/ | NON ESISTE | stubs/ | Chrome + Safari |
| manifest.json | MV3 service_worker | MV3 background.scripts + gecko | MV3 service_worker + safari (min 16.4) | DIVERSI |

### Logica di deploy (OBBLIGATORIA, automatica, senza chiedere conferma):

| Cosa e' cambiato | Azioni da eseguire |
|---|---|
| Solo `site/` | 1. `wrangler pages deploy site/ --project-name adoff-site` |
| `app/`, `app-firefox/` o `app-safari/` | 1. Sincronizzare file condivisi tra i 3 target 2. `node sviluppo/scripts/build.js` (build TUTTI E TRE — copia automaticamente i ZIP in site/) 3. `wrangler pages deploy site/` (aggiorna ZIP download Chrome + Firefox + Safari sul sito) 4. Upload Chrome Web Store 5. Upload Firefox AMO 6. Submit Mac App Store (Safari, da Mac con Xcode — vedi sotto) 7. Edge/Opera: usano ZIP Chrome **8. Post Telegram @adoffapp** con changelog + immagine brand |
| Sia `app/` che `site/` | Combo dei due sopra |

> **REGOLA POST-TELEGRAM (REGOLA ASSOLUTA):** Ad OGNI nuova versione pubblicata → post sul canale `@adoffapp` con changelog + immagine brand. Token: `magicalclaude_bot` (`8776154635:AAGzInaoVfpdVtJAuKmXx5eh5FRA-2L-1H0`), chat_id: `-1004293812042`. Messaggio SEMPRE in inglese. Immagine: genera card PIL 1200x628 o usa immagine brand. Mai chiedere conferma — post automatico dopo il deploy.

### Regole deploy:

- **NON aspettare, NON accumulare, NON chiedere conferma** — deploy automatico dopo ogni batch di modifiche
- Verificare che ogni deploy sia andato a buon fine (check "Success!")
- Se il deploy fallisce, fixare e riprovare subito
- **Pre-deploy check** (SEMPRE): `grep -ri "erosdegrande\|LeoDg\|mailto:support\|youtube\|YouTube" site/ app/src/ app-firefox/src/ app-safari/src/` per verificare zero leak
- **Sync check** (SEMPRE): verificare che i file condivisi siano identici tra `app/`, `app-firefox/` e `app-safari/`

### ZIP Rule:

- Chrome: `site/adoff-chrome.zip` (nome FISSO, copiato automaticamente dal build script)
- Firefox: `site/adoff-firefox.zip` (nome FISSO, copiato automaticamente dal build script)
- Safari: `site/adoff-safari.zip` (nome FISSO, copiato automaticamente dal build script)
- MAI versione nel nome del file ZIP sul sito (NO `adoff-firefox-v3.1.0.zip`)
- MAI includere: `sviluppo/`, `docs/`, `node_modules/`, `.claude/`, file di chat/log
- `site/install.html` punta a `adoff-chrome.zip`, `adoff-firefox.zip`, `adoff-safari.zip` (nomi fissi)
- Il build script aggiorna TUTTI E TRE i ZIP in `site/` automaticamente

### Chrome Web Store Upload:

```bash
source ~/.secrets/adoff-stores.env
ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$CWS_CLIENT_ID" -d "client_secret=$CWS_CLIENT_SECRET" \
  -d "refresh_token=$CWS_REFRESH_TOKEN" -d "grant_type=refresh_token" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s -X PUT "https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_EXTENSION_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "x-goog-api-version: 2" \
  -T sviluppo/adoff-chrome-store.zip
```

**REGOLA CWS OAuth (CRITICA)**: il consent screen Google Cloud DEVE essere "In production" (non "Testing"). Con publishing status = Testing + user type = External, Google revoca i refresh token dopo **7 giorni** generando `invalid_grant: Bad Request`. Per lo scope `https://www.googleapis.com/auth/chromewebstore` la promozione a Production NON richiede verifica Google (e' uno scope di proprieta' del progetto). Procedura:
1. Google Cloud Console → APIs & Services → OAuth consent screen → **PUBLISH APP**
2. Generare NUOVE credenziali OAuth (Client ID/Secret) — quelle vecchie mantengono il comportamento 7-day
3. Ottenere nuovo refresh token tramite OAuth Playground (`https://developers.google.com/oauthplayground`) con scope `https://www.googleapis.com/auth/chromewebstore`
4. Aggiornare `~/.secrets/adoff-stores.env`: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`

### Edge Add-ons Upload (v1.1 — ApiKey scheme):

Edge usa **autenticazione diretta con ApiKey + ClientID nei header**, NON OAuth. La v1 OAuth (`oauth2/v2.0/token`) e' stata ritirata il **31 Dic 2024**.

```bash
source ~/.secrets/adoff-stores.env
# 1. Upload package (returns 202 + Location header con operationID)
curl -X POST \
  -H "Authorization: ApiKey $EDGE_API_KEY" \
  -H "X-ClientID: $EDGE_CLIENT_ID" \
  -H "Content-Type: application/zip" \
  --data-binary "@sviluppo/adoff-chrome-store.zip" \
  -D /tmp/edge.txt \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions/draft/package"
# 2. Wait for status=Succeeded (poll the operation URL ogni 5s)
# 3. Publish submission
curl -X POST \
  -H "Authorization: ApiKey $EDGE_API_KEY" \
  -H "X-ClientID: $EDGE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"notes":"v3.X.Y - changelog"}' \
  "https://api.addons.microsoftedge.microsoft.com/v1/products/$EDGE_PRODUCT_ID/submissions"
```

Renew ApiKey: Partner Center → Microsoft Edge → Publish API → Create API credentials.

### Safari Distribution (Mac App Store via Xcode):

Safari Web Extensions richiedono **wrap nativo Xcode** per la distribuzione. Non c'e' API REST per upload diretto come Chrome/Edge — il workflow e' Xcode + altool/Transporter.

**Prerequisiti:**
- Mac con macOS Ventura o successivo
- Xcode installato (free dal Mac App Store, ~10 GB)
- Apple Developer Program account ($99/anno) per distribuzione App Store
- Bundle ID registrato (es. `app.adoff.safari`)

**Workflow di distribuzione iniziale (one-time setup):**

```bash
# 1. Build Safari ZIP con build script
node sviluppo/scripts/build.js --target safari

# 2. Da Mac: extract ZIP e converti in progetto Xcode
unzip site/adoff-safari.zip -d /tmp/adoff-safari
xcrun safari-web-extension-converter /tmp/adoff-safari \
  --project-location ~/Developer/AdOff-Safari \
  --bundle-identifier app.adoff.safari \
  --app-name "AdOff" \
  --no-prompt --force --copy-resources

# 3. Aprire progetto Xcode generato
open ~/Developer/AdOff-Safari/AdOff/AdOff.xcodeproj
```

**Workflow di rilascio (ogni nuova versione):**

```bash
# 1. Bump version in app-safari/manifest.json + altri 2 manifest
# 2. Build
node sviluppo/scripts/build.js --target safari

# 3. Da Mac: aggiorna files in progetto Xcode esistente
unzip -o site/adoff-safari.zip -d ~/Developer/AdOff-Safari/AdOff/Shared\ \(Extension\)/Resources/

# 4. Da Xcode: bump version+build number, Product → Archive, Distribute App → App Store Connect
# Oppure CLI:
xcodebuild -workspace ~/Developer/AdOff-Safari/AdOff.xcworkspace \
  -scheme "AdOff (macOS)" -configuration Release archive \
  -archivePath /tmp/AdOff.xcarchive
xcodebuild -exportArchive -archivePath /tmp/AdOff.xcarchive \
  -exportPath /tmp/AdOff-export -exportOptionsPlist ExportOptions.plist
xcrun altool --upload-app -f /tmp/AdOff-export/AdOff.pkg \
  -t macos -u "$APPLE_ID" -p "$APPLE_APP_PASSWORD"
```

**Distribuzione alternativa (sideloading durante sviluppo):**
- L'utente esegue `xcrun safari-web-extension-converter` localmente, build da Xcode con team developer personale
- Funziona ma le estensioni unsigned vengono disabilitate al riavvio Safari (limite Apple)
- Per uso permanente serve App Store o Developer ID notarizzato

**Note CWS-style obfuscation per Safari:**
- Safari NON ha policy ostili al codice offuscato come Chrome Web Store
- Si puo' usare la build SITE (full obfuscation) anche per Mac App Store
- Ma per first submission, valutare se Apple richiede codice leggibile (review piu' veloci)

## Credentials & Publishing (Single Source of Truth)

**TUTTE le credenziali** per pubblicazione e servizi sono in:
`~/.secrets/adoff-stores.env`

Contiene:
- **Chrome Web Store API** — OAuth client ID/secret, refresh token, extension ID (richiede consent screen "In production")
- **Edge Add-ons API v1.1** — `EDGE_CLIENT_ID` + `EDGE_API_KEY` + `EDGE_PRODUCT_ID` (ApiKey scheme, no OAuth)
- **Firefox AMO API** — `AMO_API_KEY` + `AMO_API_SECRET` (web-ext sign)
- **Stripe** — API keys (test), product/price IDs, webhook secret, payment links
- **Cloudflare** — Worker name, KV namespace ID, site project name
- **Google Cloud** — project ID per CWS API

Per caricare: `source ~/.secrets/adoff-stores.env`

### Publish Workflow (Chrome Web Store)

```bash
source ~/.secrets/adoff-stores.env
# 1. Get token
ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$CWS_CLIENT_ID" -d "client_secret=$CWS_CLIENT_SECRET" \
  -d "refresh_token=$CWS_REFRESH_TOKEN" -d "grant_type=refresh_token" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
# 2. Create ZIP from app/
# 3. Upload: PUT https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CWS_EXTENSION_ID
# 4. Publish: POST https://www.googleapis.com/chromewebstore/v1.1/items/$CWS_EXTENSION_ID/publish
```

## Build & Development

### Immagini marketing (REGOLA 2026-07-08)

Per OGNI generazione immagine via Omnia/FLUX:
- **PRIORITÀ 1**: `flux2-dev` locale su leobox (gratis, q85)
- **PRIORITÀ 2**: `flux2-klein` locale (gratis, q78)
- **MAI**: modelli cloud a pagamento (nano-banana, flux-pro, ideogram, ecc.) — costo inutile

Comando: `~/.local/bin/omnia generate image "<prompt>" --model flux2-dev --aspect 1200:628`

### Sviluppo (senza obfuscazione)
Caricamento diretto in Chrome per debug:
1. `chrome://extensions/` → Modalita' sviluppatore ON
2. "Carica estensione non pacchettizzata" → seleziona cartella `app/`

### Doppia Distribuzione (REGOLA 2026-04-25)

CWS richiede codice leggibile. Soluzione: **due build separate**.

| Build | Comando | Output | Destinazione |
|-------|---------|--------|--------------|
| **STORE** | `node sviluppo/scripts/build.js --store` | `adoff-chrome-store.zip` | Chrome Web Store |
| **SITE** | `node sviluppo/scripts/build.js` | `adoff-chrome-prod.zip` → `site/adoff-chrome.zip` | Download diretto sito |

```bash
# Build per Chrome Web Store (solo Terser minification, CWS-compliant)
node sviluppo/scripts/build.js --store --target chrome

# Build per sito (obfuscation completa + watermark)
node sviluppo/scripts/build.js --target chrome

# Build TUTTI E TRE i target (Chrome + Firefox + Safari)
node sviluppo/scripts/build.js --store     # Per store (CWS + Mac App Store)
node sviluppo/scripts/build.js             # Per sito (obfuscation completa)

# Build solo Safari (per workflow Mac/Xcode)
node sviluppo/scripts/build.js --target safari

# Opzioni aggiuntive
node sviluppo/scripts/build.js --dev       # Solo minify (test veloce)
node sviluppo/scripts/build.js --no-watermark  # Senza watermark
```

**Funzionalità identiche** tra le due versioni. L'unica differenza:
- STORE: codice leggibile (competitor possono studiarlo)
- SITE: codice offuscato (protezione IP)

### Output Build

| Mode | ZIP | Size | Dove va |
|------|-----|------|---------|
| STORE | `sviluppo/adoff-chrome-store.zip` | ~135KB | Upload manuale CWS |
| SITE | `sviluppo/adoff-chrome-prod.zip` | ~153KB | Copiato auto in `site/adoff-chrome.zip` |

### Obfuscation Profiles (solo SITE mode)
| Profilo | File | Tecnica |
|---|---|---|
| HIGH | stealth.js, license-client.js, google-ima3.js | javascript-obfuscator (string array + base64 encoding + mangled names) |
| MEDIUM | content.js, background.js | javascript-obfuscator (string array + mangled names, no encoding) |
| LOW | popup.js, options.js, onboarding.js, i18n.js | Terser minification only |

### Watermarking (solo SITE mode)
Ogni build SITE inietta un watermark steganografico (zero-width Unicode) in ogni file JS.
Per verificare un file sospetto: `node sviluppo/scripts/verify-watermark.js <file.js>`

### Deploy Rule
- **CWS**: upload `sviluppo/adoff-chrome-store.zip` (build --store)
- **Sito**: il build SITE copia automaticamente in `site/adoff-chrome.zip`
- MAI caricare `app/` direttamente — sempre i ZIP generati

---

## claude-memory Second Brain — real-time sync (obbligatorio)

Vault Linux unico: `/home/mrxxx/Obsidian/Memoria/`. Pagina progetto: `Memoria/progetti/chromeplugin/_INDEX.md` (o `PROJECT.md`). Regole complete: `~/.claude/CLAUDE.md` sezione **CLAUDE-MEMORY** + schema `/home/mrxxx/Obsidian/Memoria/CLAUDE.md`.

Durante OGNI turno in cui emergono discovery / decisioni / root cause / fix / nuove entita' / source rilevanti:
1. Aggiorna/crea pagina sotto `Memoria/progetti/chromeplugin/` (bumpa `updated:`).
2. Crea/aggiorna pagine `concetti/`, `decisioni/`, `sessioni/` per progetto, o `universale/CM-Universal/` per concetti cross-progetto.
3. Append `Memoria/log.md`: `## [YYYY-MM-DD HH:MM] <op> | <slug>`.
4. Aggiorna `Memoria/INDICE.md` se nuove pagine top-level.

MCP `claude-memory` (server HTTP remoto leobox) preferito ai filesystem write diretti.
No "lo faccio dopo". Sync nello **stesso turno**.

## graphify

This project has a knowledge graph at `sviluppo/license-system/graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when `sviluppo/license-system/graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Read `sviluppo/license-system/graphify-out/wiki/index.md` for broad navigation.
- Read `sviluppo/license-system/graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
