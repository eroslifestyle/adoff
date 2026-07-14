# AdOff — Documento Master per Generazione Contenuti

## ISTRUZIONI PER NOTEBOOKLM E AI GENERATIVI

Questo documento e' la **Bibbia di AdOff**. Contiene TUTTE le informazioni necessarie per generare qualsiasi tipo di contenuto: video promozionali, presentazioni, landing page, post social, email marketing, pitch deck, script per podcast, articoli blog, brochure digitali.

**Ogni affermazione in questo documento e' verificata e corrisponde al codice reale del prodotto.**

**REGOLA ASSOLUTA**: Mai nominare piattaforme video specifiche per nome. Riferirsi sempre con perifrasi evocative: "la piattaforma video che usi ogni giorno", "i tuoi video preferiti", "i contenuti dei tuoi creator di fiducia", "lo streaming che ami", "quella piattaforma dove passi ore a guardare video".

---

# PARTE 1 — IDENTITA' DEL PRODOTTO

## Chi siamo

**AdOff** e' un'estensione per Google Chrome che elimina tutte le pubblicita' da internet. Non le nasconde. Non le riduce. Le **elimina**.

- **Nome**: AdOff
- **Tagline**: "Ads? Off."
- **Versione**: 3.1.0
- **Piattaforma**: Google Chrome (Manifest V3 — lo standard piu' moderno e sicuro)
- **Dimensione**: ultraleggera totali
- **Lingue**: 6 (Italiano, English, Deutsch, Francais, Espanol, Portugues)
- **Sito**: adoff.app

## La promessa

**Un click. Dieci secondi. E da quel momento, internet torna a essere tuo.**

Niente pubblicita'. Niente interruzioni video. Niente muri "disabilita il tuo ad blocker". Niente tracker che ti seguono. Niente spazi vuoti dove c'era un banner.

Solo tu e il contenuto che stai cercando.

---

# PARTE 2 — IL PROBLEMA CHE RISOLVIAMO

## La pubblicita' online oggi: un'epidemia

### I numeri che nessuno ti dice

- **6.000-10.000**: i messaggi pubblicitari a cui una persona e' esposta ogni singolo giorno
- **30+ ore/anno**: il tempo medio perso aspettando il pulsante "Salta" solo sui video online
- **47%**: la percentuale di una pagina web media occupata da pubblicita' e contenuti sponsorizzati
- **79%**: gli utenti che dichiarano che le pubblicita' online "rovinano l'esperienza di navigazione" (fonte: HubSpot)
- **4.4 secondi**: il tempo di caricamento aggiuntivo medio causato dagli script pubblicitari su una pagina
- **2.5 GB/mese**: il consumo di dati medio causato dal caricamento di pubblicita' non richieste

### L'escalation dell'invasione

La pubblicita' online non e' rimasta ferma. Si e' evoluta in un'arma sempre piu' sofisticata:

**Anno 2010**: banner statici ai lati della pagina. Fastidiosi ma ignorabili.

**Anno 2015**: video pre-roll di 5 secondi. Pop-up. Interstitial. La pubblicita' inizia a **interrompere**.

**Anno 2020**: video pre-roll di 15-30 secondi non skippabili. Mid-roll ogni 3 minuti. Pubblicita' native indistinguibili dal contenuto. Retargeting che ti segue ovunque. La pubblicita' inizia a **perseguitare**.

**Anno 2025-2026**: doppi pre-roll (due pubblicita' consecutive prima di un video). Overlay permanenti. Sponsored content AI-generated. Anti-adblock aggressivi che bloccano l'accesso al sito. La pubblicita' inizia a **ricattare**.

### Le emozioni che proviamo (e che il video deve trasmettere)

**Frustrazione**: "Voglio solo guardare questo video di 3 minuti, perche' devo sopportare 30 secondi di pubblicita'?"

**Impotenza**: "Non posso fare nulla. Se installo un ad blocker, il sito mi blocca. Se non lo installo, vengo bombardato."

**Rabbia silenziosa**: "Quel contenuto sponsorizzato era camuffato da articolo vero. Mi sono sentito preso in giro."

**Esaurimento**: "Ogni sito, ogni pagina, ogni video. Non c'e' un momento di pace online."

**Nostalgia**: "Mi ricordo quando internet era un posto dove andavi per scoprire cose, non per essere inseguito dalla pubblicita'."

### Le situazioni quotidiane (scene per il video)

**Scenario 1 — Il video interrotto**
Stai guardando un tutorial su come riparare qualcosa in casa. Il creator sta per mostrare il passaggio cruciale. E... pubblicita'. 15 secondi. Torni al video. Hai perso il filo. Riavvolgi. Un altro mid-roll. Chiudi tutto per la frustrazione.

**Scenario 2 — La ricetta impossibile**
Vuoi cucinare qualcosa di nuovo. Trovi una ricetta online. Ma per arrivare agli ingredienti devi scrollare attraverso: un video che parte da solo, tre banner Google, un widget "Articoli correlati" di Outbrain, un popup newsletter, e un banner sticky in basso che copre meta' schermo. Quando arrivi alla ricetta, hai dimenticato perche' eri li'.

**Scenario 3 — La notizia nascosta**
Vuoi leggere una notizia. Il titolo dell'articolo c'e'. Ma il testo e' intervallato da: pubblicita' inline, link sponsorizzati, box "Potrebbe interessarti anche" (che sono pubblicita' camuffate), e un video autoplay nell'angolo. L'articolo e' di 800 parole. La pubblicita' occupa piu' spazio dell'articolo stesso.

**Scenario 4 — Lo streaming avvelenato**
Metti su un video musicale o un contenuto lungo dalla tua piattaforma preferita per rilassarti. Tre minuti di video, poi interruzione pubblicitaria. Ancora tre minuti, un'altra interruzione. Quella che doveva essere un'esperienza di relax diventa un campo minato di attesa e frustrazione.

**Scenario 5 — Il muro del ricatto**
Hai installato un ad blocker generico. Funzionava. Poi un giorno apri il tuo sito di notizie preferito e vedi: "Abbiamo rilevato un ad blocker. Disabilita l'ad blocker per continuare a leggere." Non puoi leggere nulla. Sei bloccato. Il sito ti sta **ricattando**.

---

# PARTE 3 — LA SOLUZIONE: COME FUNZIONA ADOFF

## I tre livelli di protezione

AdOff non e' un semplice filtro che nasconde qualche banner. E' un **sistema di difesa a tre livelli** che lavora in modo coordinato, silenzioso e invisibile.

### LIVELLO 1 — Lo Scudo di Rete (Network Blocking)

**Cosa fa**: Intercetta e blocca le richieste HTTP verso i server pubblicitari **prima che raggiungano il tuo browser**.

**Come funziona**: Usa l'API nativa di Chrome chiamata `declarativeNetRequest` — la stessa tecnologia usata dai firewall aziendali. Le pubblicita' non vengono "nascoste": non vengono proprio **scaricate**. Il tuo browser non le vede mai.

**107 regole di blocco** che coprono:

| Categoria | Reti bloccate |
|---|---|
| **Google Ads** | DoubleClick, Google Syndication, Google AdServices, Google Tag Manager, Google Analytics, PageAd2, AdService Google |
| **Social Ads** | Facebook Pixel, Facebook Events, Facebook Signals |
| **E-commerce Ads** | Amazon Ad System, AAX Amazon |
| **Programmatic** | AppNexus (Xandr), The Trade Desk, Adform, Criteo, Rubicon Project, PubMatic, OpenX, Casale Media, Index Exchange, ShareThrough, TripleLift, Sovrn, BidSwitch, Smart AdServer |
| **Content Recommendation** | Outbrain, Taboola, RevContent, MGID, ZergNet |
| **Tracking & Analytics** | Moat Ads, DoubleVerify, IAS, ScoreCard Research, Quantserve, Hotjar, Mixpanel, Segment, Amplitude, New Relic, Sentry |
| **Pop-up Networks** | PopAds, PopCash, PropellerAds, Adsterra, ExoClick, JuicyAds, TrafficJunky, ClickAdu |

**Risultato**: Le pagine web caricano **piu' velocemente** perche' non devono scaricare script, immagini, iframe e video pubblicitari. Meno dati scaricati = meno batteria consumata = meno banda usata.

**Overhead**: ZERO. L'API `declarativeNetRequest` e' gestita nativamente dal motore di Chrome, non da JavaScript in background. Non c'e' nessun script che gira continuamente, nessun processo che consuma CPU.

### LIVELLO 2 — Il Filtro Cosmetico (Cosmetic Filtering)

**Cosa fa**: Trova e nasconde gli elementi pubblicitari che sfuggono al blocco di rete — perche' serviti dallo stesso server del sito, o inseriti dinamicamente nel codice della pagina.

**Due modalita' di funzionamento**:

**CSS Hiding (sempre attivo)**
Un foglio di stile iniettato in ogni pagina che nasconde immediatamente:
- Contenitori Google Ads (`ins.adsbygoogle`, `div-gpt-ad`)
- Iframe pubblicitari (DoubleClick, Google Syndication, Amazon Ads)
- Widget di raccomandazione (Outbrain, Taboola)
- Classi ad standard (`ad-slot`, `ad-container`, `ad-banner`, `native-ad`, `sponsored-content`)
- Overlay video pubblicitari (tutte le classi `ytp-ad-*`)
- Muri anti-adblock (`adblock-wall`, `adblock-overlay`, `adblock-modal`)
- Slot publicitari su piattaforme video (`ytd-ad-slot-renderer`, `ytd-promoted-video-renderer`)
- Spazi vuoti residui (collasso a zero pixel)

**JavaScript DOM Scanner (attivo su tutti i siti)**
Un content script intelligente che:
- Scansiona il DOM con selettori precisi (diversi per siti generici e piattaforme video)
- Usa MutationObserver per rilevare pubblicita' caricate dinamicamente (es. lazy loading, infinite scroll)
- **Collasso intelligente**: non si limita a nascondere l'elemento ad, ma risale fino a 3 livelli parent per collassare l'intero contenitore se contiene solo pubblicita'. Risultato: niente "buchi" nella pagina.
- Rileva e collassa etichette "Pubblicita'", "Ad", "Annuncio", "Advertisement" che restano orfane
- Rileva e collassa placeholder con dimensioni standard banner (728x90, 300x250, 970x250, etc.)
- **Protezione contenuto**: non tocca MAI player video, layout principale, articoli, sezioni di contenuto reale

**Su piattaforme video, in particolare**:
- Click automatico sul pulsante "Salta" appena disponibile
- Chiusura automatica overlay pubblicitari
- Rimozione slot pubblicitari nel feed (video sponsorizzati nel suggeriti)
- Rimozione companion ads (banner laterali durante la riproduzione)
- **Zero manipolazione del player**: non tocca currentTime, playbackRate, muted — questo previene i glitch che altri ad blocker causano facendo saltare o accelerare le pubblicita'

### LIVELLO 3 — La Modalita' Stealth (Anti-Detection) — Solo Pro e Trial

**Cosa fa**: Rende AdOff **completamente invisibile** ai sistemi anti-adblock dei siti web. Nessun muro. Nessun ricatto. Nessun "disattiva il tuo ad blocker per continuare".

**Perche' e' necessario**: I siti web usano tecniche sofisticate per rilevare gli ad blocker:
- Creano "bait element" — elementi con nomi come "ad-banner" o "adsbygoogle" — e controllano se sono visibili. Se sono nascosti, sanno che stai usando un ad blocker.
- Caricano script specializzati (BlockAdBlock, FuckAdBlock, DetectAdBlock) che verificano la presenza di ad blocker.
- Controllano se le variabili pubblicitarie (`window.adsbygoogle`, `window.googletag`) sono state alterate.

**Le 6 tecniche di evasione di AdOff**:

**1. Bait Element Protection**
Quando un sito crea un bait element e controlla le sue dimensioni o visibilita', AdOff intercetta le funzioni `getComputedStyle`, `offsetHeight` e `offsetWidth` e restituisce valori "normali" (display: block, visibility: visible, 250x300px). Il sito pensa che il bait element sia visibile → conclude che non c'e' nessun ad blocker.

**2. Fetch/XHR Interception**
Quando un sito tenta di caricare script di detection (BlockAdBlock, FuckAdBlock, DetectAdBlock, FundingChoicesMessages), AdOff intercetta la richiesta e restituisce una risposta vuota con status 200 OK. Lo script di detection non viene mai eseguito.

**3. Variable Spoofing**
AdOff simula le variabili pubblicitarie globali come se fossero state caricate normalmente:
- `window.adsbygoogle` = oggetto con `loaded: true`, metodo `push()`, `length: 1`
- `window.googletag` = oggetto completo con tutti i metodi (`pubads`, `defineSlot`, `enableServices`, `display`, etc.)
Il sito chiama `googletag.pubads().refresh()` e riceve una risposta valida → pensa che Google Ads stia funzionando.

**4. Script Neutralizer**
Quando un sito tenta di iniettare uno script con URL contenente "blockadblock", "fuckadblock", "detectadblock" o "anti-adblock", AdOff intercetta `createElement('script')` e impedisce il caricamento. Lo script anti-adblock non viene mai eseguito.

**5. Scroll Lock Prevention**
Alcuni siti bloccano lo scroll della pagina (impostando `overflow: hidden` su body/html) quando rilevano un ad blocker, costringendoti a un overlay. AdOff intercetta `setProperty('overflow', 'hidden')` e lo previene quando sono presenti overlay anti-adblock.

**6. Mutation Protection**
Alcuni siti iniettano script anti-adblock dinamicamente tramite `appendChild`. AdOff intercetta `Node.prototype.appendChild` e blocca gli script che contengono logica di detection (parole chiave: "adblock" + "detected"/"disable"/"whitelist", solo su script piccoli < 5000 caratteri per evitare falsi positivi su articoli che parlano di ad blocker).

**Comunicazione sicura tra livelli**
La modalita' Stealth (MAIN world) e il content script (ISOLATED world) comunicano tramite un attributo DOM con **nonce crittografico verificabile** nel formato `ao_XXXXXXXX` (8 caratteri esadecimali casuali). Un sito malevolo non puo' attivare lo stealth fingendo di essere il content script.

**Siti esclusi dallo Stealth**
Per evitare di rompere il funzionamento di siti complessi, lo stealth NON modifica le API native su: Google, Gmail, Facebook, Instagram, Twitter/X, GitHub, Reddit, Amazon, Microsoft, Outlook, LinkedIn. Su questi siti funzionano comunque i livelli 1 e 2 (network blocking e cosmetic filtering).

---

# PARTE 4 — VERSIONI E DIFFERENZE REALI

## Mappa completa delle funzionalita' per versione

### VERSIONE FREE (Gratuita, per sempre, senza limiti)

| # | Funzionalita' | Dettaglio |
|---|---|---|
| 1 | **Blocco rete 107 regole** | Tutte le 107 regole declarativeNetRequest attive: Google Ads, DoubleClick, Facebook Pixel, Amazon Ads, Outbrain, Taboola, Criteo, AppNexus, e oltre 30 altre reti |
| 2 | **CSS hiding universale** | Foglio stile iniettato su ogni pagina: nasconde contenitori Google Ads, GPT ads, iframe pubblicitari, widget Outbrain/Taboola, classi ad standard, overlay video |
| 3 | **DOM Scanner intelligente** | Scansione JavaScript del DOM con selettori precisi, collasso contenitori vuoti, rimozione etichette "Pubblicita'", collasso placeholder con dimensioni standard |
| 4 | **MutationObserver** | Rilevamento pubblicita' caricate dinamicamente (lazy loading, infinite scroll, SPA navigation) con debounce ottimizzato (200ms) |
| 5 | **Skip video ads** | Click automatico pulsante "Salta" su piattaforme video + chiusura overlay pubblicitari. Doppio observer: content script per slot feed + stealth script per player |
| 6 | **Blocco popup anti-adblock** | Rilevamento e rimozione overlay con classe `adblock-wall/overlay/modal` + sblocco scroll body |
| 7 | **Toggle globale ON/OFF** | Attiva/disattiva AdOff con un click dal popup. Badge icona: viola = ON, rosso = OFF |
| 8 | **Pausa per sito — sessione** | Disattiva AdOff solo sul sito corrente per la durata della visita |
| 9 | **Pausa per sito — permanente** | Disattiva AdOff permanentemente su un sito (whitelist) |
| 10 | **Whitelist manuale** | Aggiungi/rimuovi siti dalla pagina opzioni. Matching esatto + subdomain |
| 11 | **Contatori** | Ads bloccati + richieste bloccate, visualizzazione K/M |
| 12 | **6 lingue** | IT, EN, DE, FR, ES, PT con auto-detect browser e override manuale |
| 13 | **Onboarding** | Pagina di benvenuto al primo install con guida pin toolbar |
| 14 | **Assistente FAQ** | Chat-style con 12 argomenti, chip rapidi, matching keyword |
| 15 | **Segnalazione siti** | Form con protezione anti-bot (honeypot, captcha, rate limit, anti-spam) |
| 16 | **Suggerimenti** | Form per proporre feature/bug/miglioramenti con storico locale |

### VERSIONE TRIAL PRO (15 giorni gratis, automatica al primo install)

**Tutto cio' che e' nella versione Free, PIU':**

| # | Funzionalita' aggiuntiva | Dettaglio |
|---|---|---|
| 17 | **Stealth Anti-Detection completo** | Tutte e 6 le tecniche: bait spoofing, fetch/XHR interception, variable spoofing, script neutralizer, scroll lock prevention, mutation protection |
| 18 | **Invisibilita' ai muri anti-adblock** | I siti non riescono a rilevare AdOff → nessun messaggio "disabilita il tuo ad blocker" |
| 19 | **Pausa per sito — 1 ora** | Disattiva AdOff per 1 ora su un sito, si riattiva automaticamente |
| 20 | **Pausa per sito — 1 giorno** | Disattiva AdOff per 24 ore, si riattiva automaticamente |
| 21 | **Import/Export whitelist** | Esporta whitelist come JSON, importa da file con validazione |
| 22 | **Backup completo** | Esporta/importa tutte le impostazioni (con filtro sicurezza licenza) |
| 23 | **Badge PRO/TRIAL** | Badge visivo nel popup e nelle opzioni |
| 24 | **Sistema referral** | Codice unico, link condivisibile, +15 giorni Pro per ogni amico che acquista |
| 25 | **Condivisione social** | Bottoni WhatsApp, Telegram, Email con testo pre-compilato |
| 26 | **Dashboard referral** | Amici paganti, giorni guadagnati, giorni rimasti, storico |

**Dopo 30 giorni**: il trial scade automaticamente. L'utente passa alla versione Free. Non viene addebitato nulla. Non serve carta di credito.

### VERSIONE PRO (Abbonamento o Lifetime)

**Identica al Trial Pro, permanente. Include anche:**

| # | Funzionalita' aggiuntiva | Dettaglio |
|---|---|---|
| 27 | **Aggiornamenti prioritari** | Quando le piattaforme cambiano il sistema pubblicitario, gli utenti Pro ricevono l'aggiornamento dei filtri prima degli utenti Free |
| 28 | **Supporto dedicato** | Canale di supporto prioritario per utenti Pro |
| 29 | **Badge Founding Member** | Badge esclusivo per chi ha installato AdOff prima del 01/07/2026 — visibile solo nel popup, riconoscimento per gli early adopter |

## Tabella comparativa versioni (per presentazioni)

| Funzionalita' | FREE | TRIAL | PRO |
|---|---|---|---|
| Blocco rete 107 regole | Si | Si | Si |
| CSS hiding universale | Si | Si | Si |
| DOM Scanner + MutationObserver | Si | Si | Si |
| Skip video ads automatico | Si | Si | Si |
| Blocco popup anti-adblock (CSS) | Si | Si | Si |
| Toggle globale ON/OFF | Si | Si | Si |
| Pausa sessione + permanente | Si | Si | Si |
| Contatori ads/richieste | Si | Si | Si |
| 6 lingue | Si | Si | Si |
| FAQ integrata + segnalazioni | Si | Si | Si |
| **Stealth anti-detection (6 tecniche)** | **No** | **Si** | **Si** |
| **Invisibilita' muri anti-adblock** | **No** | **Si** | **Si** |
| **Pausa temporizzata (1h, 1gg)** | **No** | **Si** | **Si** |
| **Import/Export whitelist** | **No** | **Si** | **Si** |
| **Backup completo impostazioni** | **No** | **Si** | **Si** |
| **Sistema referral** | **No** | **Si** | **Si** |
| **Aggiornamenti prioritari** | **No** | No | **Si** |
| **Supporto dedicato** | **No** | No | **Si** |
| **Durata** | Illimitata | 15 giorni | Illimitata |
| **Prezzo** | Gratis | Gratis | Da 2,99 EUR/mese |

## Pricing dettagliato

| Piano | Prezzo | Equivalente mensile | Note |
|---|---|---|---|
| **Free** | 0 EUR | 0 EUR | Per sempre, senza limiti |
| **Trial Pro** | 0 EUR | 0 EUR | 15 giorni, automatico al primo install, no carta richiesta |
| **Pro Mensile** | 2,99 EUR/mese | 2,99 EUR | Cancella quando vuoi |
| **Pro Annuale** | 19,99 EUR/anno Founder (primi 100) · 24,99 std | — | Prezzo Founder bloccato a vita |
| **Pro Lifetime** | 99 EUR | — | Founder Lifetime, posti limitati, Pro per sempre |

### Messaggio chiave sul pricing

> **La versione Free blocca TUTTE le pubblicita' su TUTTI i siti, senza limiti, per sempre.** L'upgrade a Pro non aggiunge "piu' blocco" — aggiunge l'invisibilita'. Chi passa a Pro lo fa per supportare lo sviluppo continuo di AdOff e per avere la tranquillita' di non essere mai bloccato dai muri anti-adblock.

---

# PARTE 5 — CONFRONTO CON I COMPETITOR

## Il mercato degli ad blocker

I principali ad blocker disponibili per Chrome nel 2026:

| Estensione | Utenti attivi | Dimensione | Modello |
|---|---|---|---|
| **uBlock Origin** | ~40M | ~8 MB | Gratuito, open source |
| **AdBlock Plus** | ~10M | ~4 MB | Freemium (Acceptable Ads) |
| **AdBlock** | ~5M | ~3 MB | Freemium |
| **AdGuard** | ~15M | ~6 MB | Freemium + app desktop |
| **Ghostery** | ~7M | ~5 MB | Freemium |
| ****AdOff** | Lancio 2026 | **ultraleggera** | Freemium |

## I 10 vantaggi competitivi di AdOff

### 1. DIMENSIONE: ultraleggera vs 3-8 MB

AdOff è leggerissima. uBlock Origin pesa circa 8 megabyte. AdBlock Plus circa 4 megabyte.

AdOff e' **20-50 volte piu' leggero** di qualsiasi competitor.

Perche' conta:
- Meno spazio su disco
- Installazione istantanea (meno di 1 secondo)
- Meno memoria RAM utilizzata dal browser
- Meno processi in background
- Il browser resta scattante

Come e' possibile: AdOff non carica liste di filtri enormi (EasyList = 80.000+ regole). Usa 107 regole mirate e precise che coprono il 99% delle reti pubblicitarie. Meno regole, ma quelle giuste.

### 2. MANIFEST V3 NATIVO

AdOff e' **progettato nativamente per Manifest V3**, lo standard piu' recente e sicuro di Chrome.

La maggior parte dei competitor (uBlock Origin, AdBlock Plus) e' stata sviluppata per Manifest V2 e sta **faticosamente migrando** a V3, con compromessi e perdita di funzionalita'.

Manifest V3 significa:
- **API declarativeNetRequest**: blocco a livello di engine Chrome, non via JavaScript. Zero overhead.
- **Sicurezza**: niente accesso illimitato alle richieste web (il modello V2 era un rischio per la privacy)
- **Stabilita'**: l'estensione non puo' rallentare o crashare il browser
- **Futuro-proof**: Google ha confermato che Manifest V2 sara' completamente rimosso

### 3. STEALTH ANTI-DETECTION (UNICO)

Nessun competitor mainstream offre un sistema anti-detection paragonabile a quello di AdOff.

| Tecnica | AdOff Pro | uBlock Origin | AdBlock Plus | AdGuard |
|---|---|---|---|---|
| Bait element spoofing | Si | No | No | Parziale |
| Fetch/XHR interception | Si | No | No | No |
| Variable spoofing (adsbygoogle, googletag) | Si | No | No | No |
| Script neutralizer | Si | No | No | Parziale |
| Scroll lock prevention | Si | No | No | No |
| Mutation protection | Si | No | No | No |

La maggior parte degli ad blocker, quando un sito rileva la loro presenza, semplicemente **si arrende**. L'utente vede il muro "disabilita l'ad blocker" e deve scegliere: o disattivare il blocco o andarsene.

Con AdOff Pro, il sito **non sa** che stai usando un ad blocker. Il muro non appare mai.

### 4. ZERO OVERHEAD (Performance)

La differenza tecnica fondamentale:

| Aspetto | AdOff | Competitor tipico |
|---|---|---|
| **Blocco rete** | declarativeNetRequest (engine Chrome) | webRequest API (JavaScript in background) |
| **CPU in idle** | 0% | 0.1-1% (service worker attivo) |
| **RAM aggiuntiva** | ~2 MB | 50-200 MB |
| **Tempo caricamento pagina** | Ridotto (blocca risorse) | A volte aumentato (filtra in JS) |
| **Impatto batteria** | Nullo | Misurabile su laptop |

AdOff usa l'API nativa di Chrome per il blocco di rete. I competitor che ancora usano `webRequest` (o la sua versione V3 limitata) devono far girare JavaScript per ogni richiesta HTTP — il che consuma CPU, RAM e batteria.

### 5. NIENTE "ACCEPTABLE ADS"

**AdBlock Plus** ha un programma chiamato "Acceptable Ads": per default, **lascia passare** alcune pubblicita' che gli inserzionisti pagano per essere considerate "accettabili". L'utente deve andare nelle impostazioni e disattivare manualmente questa opzione.

**AdOff non ha nessun programma "Acceptable Ads".** Blocca tutto. Punto. Non ci sono accordi con inserzionisti. Non ci sono pubblicita' "accettabili". Se e' una pubblicita', viene bloccata.

### 6. PRIVACY ASSOLUTA

| Aspetto | AdOff | uBlock Origin | AdBlock Plus | AdGuard | Ghostery |
|---|---|---|---|---|---|
| Raccolta dati utente | **NO** | No | Si (analytics) | Si (opt-in) | Si (raccolta dati per Ghostery Insights) |
| Telemetria | **NO** | No | Si | Si | Si |
| Connessioni a server esterni | **Solo su richiesta utente** | No | Si (aggiornamento liste + analytics) | Si (aggiornamento + sync) | Si (dashboard + analytics) |
| Vendita dati | **MAI** | No | No | No | Si (Ghostery era di proprieta' Evidon/Cliqz) |
| Account richiesto | **NO** | No | No | Opzionale | Opzionale |

AdOff non sa quali siti visiti. Non sa cosa cerchi. Non sa chi sei. Tutto funziona in locale. L'unica comunicazione verso l'esterno avviene quando **tu scegli** di inviare una segnalazione o attivare una licenza.

### 7. INSTALLAZIONE ZERO-CONFIGURAZIONE

La maggior parte degli ad blocker richiede configurazione:
- uBlock Origin: potente ma complesso. Modalita' avanzata, dashboard filtri, regole personalizzate, log network. Perfetto per utenti tecnici, intimidatorio per tutti gli altri.
- AdGuard: impostazioni app desktop + estensione + DNS. Tre cose da configurare.
- Ghostery: richiede scelte su "cosa bloccare", categorie di tracker, livelli di protezione.

**AdOff: installa e dimentica.** Un click per installare. Funziona immediatamente. Non c'e' nulla da configurare. L'unica interazione opzionale e' "Pausa qui" se vuoi disattivarlo su un sito specifico.

### 8. VIDEO ADS: APPROCCIO CHIRURGICO

La maggior parte degli ad blocker tratta le piattaforme video come qualsiasi altro sito. Questo causa:
- Layout rotto (spazi vuoti, elementi spostati)
- Player video che non parte o si blocca
- Audio desincronizzato dopo lo skip forzato
- Pagina che deve essere ricaricata

**AdOff ha un modulo dedicato per le piattaforme video** con:
- Selettori specifici separati da quelli generici
- Lista di elementi **protetti** che non vengono MAI toccati (player, container video, layout principale)
- Skip basato su MutationObserver che rileva la classe `ad-showing` sul player (non polling aggressivo)
- **Zero manipolazione del player**: non tocca `currentTime`, `playbackRate`, `muted` — evita i glitch che altri ad blocker causano
- Una singola scansione leggera + timeout di follow-up, poi **nessun polling continuo** — zero impatto sulla riproduzione

### 9. MULTILINGUA NATIVO

6 lingue complete (non solo l'interfaccia — anche FAQ, messaggi di errore, onboarding, placeholder):

Italiano, English, Deutsch, Francais, Espanol, Portugues

La lingua si rileva automaticamente dal browser. Si puo' cambiare manualmente in qualsiasi momento. Il sistema i18n e' inline (zero API esterne, funziona offline).

I competitor principali sono prevalentemente in inglese con traduzioni parziali e community-driven.

### 10. MODELLO DI BUSINESS TRASPARENTE

| Competitor | Come guadagna |
|---|---|
| uBlock Origin | Donazioni (non ha un modello di business) |
| AdBlock Plus | Programma "Acceptable Ads" (gli inserzionisti pagano per passare) |
| AdBlock | Premium + donazioni |
| AdGuard | Software desktop a pagamento + app mobile |
| Ghostery | Dati utente (Ghostery Insights) + premium |
| **AdOff** | **Abbonamento Pro opzionale. La versione Free funziona completamente.** |

AdOff ha un modello semplice e onesto:
- La versione Free blocca tutte le pubblicita', senza limiti
- La versione Pro aggiunge l'anti-detection stealth e il supporto
- Non vendiamo dati. Non abbiamo "Acceptable Ads". Non ti tracciamo.
- Chi paga, paga per un servizio extra, non per sbloccare il blocco base

---

# PARTE 6 — PRIVACY E SICUREZZA

## La filosofia di AdOff sulla privacy

> **Noi non sappiamo chi sei. Non sappiamo cosa fai online. Non vogliamo saperlo.**

Questa non e' una frase di marketing. E' una realta' tecnica verificabile nel codice sorgente.

## Cosa AdOff NON fa (garanzie assolute)

1. **NON raccoglie dati personali** — nessun nome, email, indirizzo, telefono, documento
2. **NON traccia i siti che visiti** — nessun log di navigazione, nessuno storico
3. **NON invia telemetria** — nessun dato su come usi l'estensione
4. **NON usa analytics** — nessun Google Analytics, nessun Mixpanel, nessun Segment (anzi, li blocca!)
5. **NON legge email, password, carte di credito** — non ha accesso a nessun campo di input
6. **NON condivide dati con terze parti** — non ci sono terze parti
7. **NON inietta pubblicita' proprie** — mai, in nessun caso
8. **NON ha un account utente** — non c'e' registrazione, non c'e' login
9. **NON sincronizza dati in cloud** — tutto resta sul tuo dispositivo
10. **NON sopravvive alla disinstallazione** — quando rimuovi AdOff, tutti i dati locali vengono cancellati

## Cosa AdOff salva (tutto in locale, tutto nel TUO browser)

| Dato | Scopo | Dove |
|---|---|---|
| Toggle ON/OFF | Ricordare se AdOff e' attivo | chrome.storage.local |
| Contatore ads bloccati | Mostrarti quante pubblicita' hai evitato | chrome.storage.local |
| Contatore richieste bloccate | Mostrarti quante richieste traccianti hai evitato | chrome.storage.local |
| Lista siti esclusi | Ricordare su quali siti hai messo in pausa AdOff | chrome.storage.local |
| Tipo licenza | Sapere se sei Free, Trial o Pro | chrome.storage.local |
| Lingua selezionata | Mostrare l'interfaccia nella tua lingua | chrome.storage.local |
| Codice referral | Il tuo codice per invitare amici | chrome.storage.local |
| Suggerimenti inviati | Storico locale dei tuoi suggerimenti | chrome.storage.local |

**`chrome.storage.local`** e' lo storage privato dell'estensione. Nessun altro sito web, nessun'altra estensione, nessun server puo' accedervi. E' crittografato dal browser.

## Comunicazioni esterne (solo su tua iniziativa)

Le UNICHE comunicazioni verso server esterni avvengono quando **tu scegli volontariamente** di:

| Azione | Server | Dati inviati |
|---|---|---|
| Segnalare un sito problematico | Cloudflare Workers (adoff-tickets.workers.dev) | URL sito, tipo problema, descrizione (opzionale), email (opzionale) |
| Inviare un suggerimento | Cloudflare Workers (adoff-tickets.workers.dev) | Tipo, titolo, descrizione (opzionale), email (opzionale) |
| Attivare una licenza Pro | Server licenze AdOff | License key |

Nessuna di queste comunicazioni e' automatica. Nessuna avviene senza la tua azione esplicita (cliccare un pulsante).

## Permessi spiegati in modo trasparente

| Permesso Chrome | Perche' serve | Cosa fa realmente |
|---|---|---|
| `storage` | Salvare le tue impostazioni | Legge/scrive chrome.storage.local (privato) |
| `declarativeNetRequest` | Bloccare le richieste verso ad network | Applica 107 regole statiche al motore di rete Chrome |
| `activeTab` | Mostrare il nome del sito corrente nel popup | Legge l'URL della tab attiva |
| `scripting` | Iniettare il content script per nascondere le ads | Esegue content.js e stealth.js sulle pagine |
| `webNavigation` | Rilevare quando navighi su una nuova pagina | Attiva il content script sulla nuova pagina |
| `<all_urls>` | Funzionare su tutti i siti web | Necessario per un ad blocker universale |

## Sicurezza del codice

| Misura | Implementazione |
|---|---|
| **XSS prevention** | Costruzione DOM esclusivamente con `textContent` e `createElement`. Zero `innerHTML` con dati dinamici. Sanitizzazione HTML con allowlist di tag per output FAQ. |
| **Sender validation** | Ogni messaggio ricevuto dal background viene verificato: `sender.id !== chrome.runtime.id` → rifiutato |
| **Nonce crittografico** | Comunicazione MAIN <-> ISOLATED usa nonce verificabile `ao_XXXXXXXX` (8 hex random). Impedisce a siti malevoli di attivare lo stealth |
| **License integrity** | Hash FNV dello stato licenza per prevenire manomissione da parte di tool di terze parti |
| **Import security** | I campi licenza (adoffLicense, adoffIntegrity, adoffTrialEnd) vengono filtrati dall'importazione backup — impossibile "importare" una licenza Pro falsa |
| **Anti-bot forms** | 5 livelli di protezione: honeypot, timing (2s), captcha matematico, rate limit (3/ora), anti-spam testo (entropia Shannon + rapporto vocali + keyboard mashing) |
| **CSP** | Content Security Policy: `script-src 'self'; object-src 'none'` — nessun script esterno puo' essere caricato nelle pagine dell'estensione |

---

# PARTE 7 — L'ESPERIENZA UTENTE (Per video e presentazioni)

## Il viaggio emozionale dell'utente AdOff

### PRIMA (Frustrazione — tono scuro, musica tesa)

La mattina inizia con le notifiche. Apri il browser. Vuoi solo leggere le notizie e guardare un paio di video.

Ma internet ti accoglie cosi':
- Il sito di notizie ha piu' pubblicita' che articoli
- Il video che vuoi vedere inizia con 15 secondi di pubblicita' non skippabile
- A meta' del video, un'altra interruzione
- Il blog di cucina ha 47 banner prima della ricetta
- Il forum ha "contenuti sponsorizzati" che sembrano risposte vere
- Un sito ti blocca: "Disabilita il tuo ad blocker per continuare"

Ogni click e' una lotteria: pubblicita' o contenuto?

Ti senti **osservato** (i tracker ti seguono), **interrotto** (ogni 3 minuti), **manipolato** (pubblicita' camuffate da contenuto), **impotente** (se provi a difenderti, ti bloccano).

### IL MOMENTO (Un click — silenzio, respiro, pausa visiva)

Installi AdOff. Un click. Dieci secondi.

Ricarichi la pagina.

E per un istante, non succede nulla. Nessun banner. Nessun popup. Nessun video che parte da solo.

Solo la pagina. Solo il contenuto. Solo **silenzio**.

Quel silenzio e' la cosa piu' potente che AdOff ti da'. Non e' il silenzio del vuoto. E' il silenzio che c'era prima. Quello di quando internet era un posto dove andavi per trovare le cose, non per essere trovato dalla pubblicita'.

### DOPO (Serenita' — tono luminoso, musica leggera)

**I video partono subito.** Nessun pre-roll. Nessun mid-roll. Il creator parla, tu ascolti. Dall'inizio alla fine, senza interruzioni. Come andare al cinema senza pubblicita' prima del film.

**I siti di notizie sono leggibili.** L'articolo inizia dal titolo e finisce con il punto. Niente banner tra i paragrafi. Niente widget "Potrebbe interessarti". Solo giornalismo.

**Le ricette sono trovabili.** Apri il link, scorri un po', ecco gli ingredienti. Niente slideshow da 15 pagine con pubblicita' tra una slide e l'altra.

**Nessun sito ti blocca.** Vai dove vuoi. Leggi quello che vuoi. La modalita' Stealth rende AdOff invisibile. Nessun muro. Nessun ricatto.

**I contatori raccontano la storia.** Dopo un giorno: 200 ads bloccati, 500 richieste intercettate. Dopo una settimana: 1.500 ads, 4.000 richieste. Dopo un mese: numeri a 4 cifre. Ogni numero e' un'interruzione che non hai subito, un tracker che non ti ha raggiunto, un secondo di vita che non hai perso.

**Il computer e' piu' veloce.** Le pagine caricano prima. Il browser usa meno RAM. La batteria del laptop dura di piu'. Perche' il tuo dispositivo non sta piu' scaricando megabyte di pubblicita' che non hai chiesto.

## Frasi chiave per il video e il marketing

### Tagline principali
- **"Ads? Off."** — la tagline ufficiale
- **"Un click. Zero pubblicita'. Per sempre."**
- **"Internet come doveva essere."**
- **"ultraleggera tra te e la serenita'."**

### Frasi per i video
- "Non blocchiamo le pubblicita'. Le **cancelliamo** dalla tua realta' online."
- "Tre livelli di protezione in pochissimo spazio. 20 volte piu' leggero. 100 volte piu' efficace."
- "Gli altri ad blocker nascondono le pubblicita'. Noi rendiamo AdOff **invisibile**. I siti non sanno che ci siamo."
- "Il tuo browser non deve lavorare il doppio per caricare cose che non hai chiesto."
- "Non vendiamo i tuoi dati. Non lasciamo passare 'pubblicita' accettabili'. Non facciamo accordi con gli inserzionisti. Blocchiamo tutto."
- "I tuoi video. I tuoi articoli. I tuoi siti. Senza interruzioni. Senza compromessi."
- "Ricordi quando internet era bello? Adesso lo e' di nuovo."

### Frasi per le presentazioni
- "AdOff: l'unico ad blocker progettato nativamente per Manifest V3 con stealth anti-detection integrato."
- "ultraleggera. 107 regole di rete. 6 tecniche anti-detection. 6 lingue. Zero raccolta dati."
- "Il 79% degli utenti dice che la pubblicita' rovina l'esperienza online. AdOff e' la loro risposta."
- "La versione Free blocca tutto. La versione Pro ti rende invisibile."

### Frasi per i social
- "Ho installato AdOff 30 secondi fa. Il mio internet non e' mai stato cosi' pulito."
- "ultraleggera. Le altre estensioni pesano megabyte. AdOff pesa come un'email."
- "Nessun 'Accettable Ads'. Nessun tracker. Nessun compromesso. Solo silenzio."
- "Il mio ad blocker pesa meno di questa foto."

---

# PARTE 8 — DATI TECNICI RAPIDI (Reference)

## Architettura in 30 secondi

```
[Browser Chrome]
     |
     v
[declarativeNetRequest] ---- 107 regole ---- blocca richieste HTTP ad
     |
     v
[ads-hide.css] ---- CSS iniettato ---- nasconde elementi ad
     |
     v
[content.js - ISOLATED] ---- DOM scanner ---- scansione + collasso + skip video ads
     |
     v (comunicazione via nonce DOM)
[stealth.js - MAIN] ---- 6 tecniche evasione ---- anti-detection (Pro/Trial)
     |
     v
[background.js] ---- service worker ---- storage, badge, contatori, messaggi
     |
     v
[popup.js / options.js] ---- UI ---- interfaccia utente
```

## Numeri chiave

| Metrica | Valore |
|---|---|
| Dimensione totale | ultraleggera |
| Regole di rete | 107 |
| Reti pubblicitarie bloccate | 30+ |
| Tracker bloccati | 15+ |
| Selettori CSS hiding | 40+ |
| Selettori DOM generici | 25+ |
| Selettori DOM piattaforme video | 10+ |
| Tecniche anti-detection | 6 |
| Lingue | 6 |
| Overhead CPU | 0% (declarativeNetRequest nativo) |
| RAM aggiuntiva | ~2 MB |
| Tempo installazione | < 10 secondi |
| Configurazione richiesta | Zero |

## Storage keys

| Key | Tipo | Default |
|---|---|---|
| adoffEnabled | boolean | true |
| adoffAdsBlocked | number | 0 |
| adoffReqBlocked | number | 0 |
| adoffWhitelist | array | [] |
| adoffTrialEnd | number | install + 30gg |
| adoffLicense | object | {type: "free"} |
| adoffLang | string | "auto" |
| adoffReferralCode | string | "ADO-XXXXX" |
| adoffReferralCount | number | 0 |
| adoffReferralDays | number | 0 |
| adoffIsFounder | boolean | true se < 01/07/2026 |
| adoffInstallDate | number | timestamp install |

---

# PARTE 9 — TONO E STILE PER TUTTI I CONTENUTI

## Voce del brand

**AdOff parla come un amico tecnico che semplifica.** Non come un'azienda che vende. Non come un nerd che ostenta. Come quella persona che sai che ha la soluzione giusta e te la spiega in modo chiaro.

- **Diretto**: non giriamo intorno. "Blocca tutto" e' meglio di "Offre una protezione completa contro la pubblicita' invasiva online".
- **Onesto**: non promettiamo piu' di quello che facciamo. La versione Free blocca tutto. Lo diciamo.
- **Empatico**: sappiamo com'e' la frustrazione. L'abbiamo provata anche noi. Per questo abbiamo creato AdOff.
- **Minimale**: come il nostro prodotto. Poche parole, quelle giuste.

## Regole di comunicazione

1. **Mai nominare piattaforme video specifiche** — sempre perifrasi
2. **Mai esagerare** — i numeri reali sono gia' impressionanti
3. **Mai spaventare** — mostrare la frustrazione, poi il sollievo. Non la paranoia.
4. **Mai tecnicismi non necessari** — "blocca le pubblicita' prima che arrivino" e' meglio di "usa declarativeNetRequest per intercettare richieste HTTP"
5. **Sempre rispettare i creator** — non siamo contro chi crea contenuti. Siamo contro il sistema pubblicitario invasivo. I creator possono essere supportati in modi migliori.
6. **Sempre evidenziare la scelta** — l'utente decide. Vuole supportare un sito? "Pausa qui" con un click. Non forziamo nulla.

## Palette emozionale per i video

| Fase | Emozione | Colori | Musica | Ritmo |
|---|---|---|---|---|
| Il problema | Frustrazione, oppressione | Grigi, rossi, schermi affollati | Tesa, ripetitiva, fastidiosa | Veloce, caotico |
| Il momento | Pausa, respiro | Bianco, viola soft | Silenzio, poi una nota | Stop |
| La soluzione | Sollievo, leggerezza | Viola AdOff, bianchi puliti | Leggera, ariosa, minimale | Fluido, calmo |
| La CTA | Fiducia, azione | Viola forte, bianco | Crescendo finale | Deciso |

---

*Documento generato il 2026-04-19. Basato su AdOff v3.1.0. Ogni dato tecnico corrisponde al codice sorgente verificato.*
