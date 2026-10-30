# AdOff — Brief operativo per Claude Code

> **Scopo di questo file:** istruzioni eseguibili per sistemare le 3 criticità di fondazione del sito/prodotto **prima** di qualsiasi attività di marketing/virality.
> **Repo target:** il progetto del sito `adoff.app` (almeno `index.html`, `install.html`, `support.html`, asset, e i file dell'estensione: `manifest.json` + file delle regole).
> **Regola d'oro:** non inventare mai numeri, recensioni o feature. **Il codice dell'estensione è la fonte di verità; il marketing deve adeguarsi alla realtà, mai il contrario.**

---

## Contesto (stato reale, maggio 2026)

- L'estensione è pubblicata su **Firefox AMO** (v3.4.4) ma ha **1 utente e 0 recensioni** → siamo di fatto al lancio zero, non in fase "scaling".
- La homepage comunica maturità (design curato, 6 testimonianze 5 stelle, "store ufficiali") che **non corrisponde** allo stato reale.
- La distribuzione fuori da Firefox è in gran parte **sideload** (Modalità sviluppatore / ZIP), con aggiornamento manuale → letale per un adblocker.
- Esistono **incoerenze di dati** tra homepage, pagina install e scheda store (numero regole, lingue, durata trial).

L'obiettivo di questo brief è eliminare questi tre rischi: **(A) social proof**, **(B) distribuzione store**, **(C) coerenza dei contenuti**.

---

## TASK A — Rifare la social proof in modo credibile

### A.1 Rimuovere le testimonianze non verificabili
- **Azione:** elimina dalla homepage (`index.html`) l'intera sezione "Recensioni verificate / Chi l'ha installata non torna indietro" con i 6 box testimonial (Marco R., Sara M., Luca T., Elena V., Thomas K., Andrea P.).
- **Motivo:** con 1 utente reale e 0 recensioni sugli store, sono palesemente costruite. Il pubblico target (Reddit r/privacy, Hacker News, utenti tech) le smaschera e brucia la reputazione; inoltre violano molte policy pubblicitarie/store.

### A.2 Sostituirla con prove oneste e a prova di scettico
Implementa **una sola** di queste sezioni al posto delle recensioni finte (scelta del founder; default = opzione 1 finché non ci sono recensioni reali):

**Opzione 1 — "Founder / Early access" (consigliata ora):**
> ## Costruita da chi odiava la pubblicità più di te
> AdOff è un progetto appena lanciato. Niente recensioni gonfiate, niente numeri inventati.
> Stiamo cercando i primi utenti reali: prova la versione gratuita, e se funziona lascia una recensione vera sullo store.
> [Badge Founder per i primi utenti] · [Codice ispezionabile] · [Zero log policy]

**Opzione 2 — "Prova tecnica invece che testimonianze":**
- Mostra metriche verificabili e dimostrabili, NON opinioni: peso dell'estensione (KB reali dal manifest), n. di regole reali, risultato su un test pubblico tipo AdBlock Tester (con screenshot/replica), tempo di caricamento pagina con/senza.

### A.3 Quando arriveranno recensioni vere
- Inserisci un widget/blocco che **linka alle recensioni reali sugli store** (Chrome/Firefox/Edge) invece di testo hard-coded.
- Regola: si pubblica solo ciò che è verificabile sullo store, con link diretto. Mai testimonianze inventate.

### A.4 Acceptance criteria (A)
- [ ] Nessuna testimonianza fittizia o data/recensione non verificabile nel sito.
- [ ] La nuova sezione non afferma numeri di utenti/recensioni non reali.
- [ ] Eventuali rating mostrati linkano alla pagina recensioni dello store corrispondente.

---

## TASK B — Pubblicazione nativa su tutti gli store (con auto-update)

> **Principio:** il percorso d'installazione principale deve essere **1-click dallo store con auto-update**. Il sideload/ZIP resta solo come fallback per utenti developer, **non** come via primaria. Un adblocker che non si auto-aggiorna smette di funzionare in poche settimane.

### B.0 Stato link store (verificato 31 mag 2026)
- ✅ **Edge** ora punta a un vero listing Edge Add-ons (`microsoftedge.microsoft.com/addons/...`) — risolto.
- ✅ **Chrome Web Store** e **Firefox AMO**: link reali e attivi.
- [ ] Verifica che ogni pulsante "Installa" porti a un listing **pubblicato** (non bozza) e che Opera/Safari restino "In arrivo" finché non sono live.

### B.1 Checklist per store (da completare uno per uno)

**Chrome Web Store (Chromium: Chrome/Brave/Opera/Vivaldi/Arc)**
- [ ] Verifica che il listing all'ID `fcjfpfhdcpbjmihiikbblcokmjnhedhp` sia **pubblicato e pubblico** (non in review/bozza).
- [ ] Account sviluppatore pagato (one-time 5 USD) attivo.
- [ ] Privacy policy URL + giustificazione di ogni permesso (vedi B.2).
- [ ] Screenshot 1280×800, descrizione, categoria, lingue.
- [ ] Nota: rischio rimozione per adblocker aggressivi su YouTube → tieni pronto un piano B (vedi B.3).

**Microsoft Edge Add-ons**
- [ ] Crea il listing **dedicato** su Partner Center (non riusare l'URL Chrome).
- [ ] Stesso pacchetto Chromium, manifest MV3.
- [ ] Aggiorna i pulsanti del sito al vero URL Edge una volta live.

**Firefox AMO** — già pubblicato (v3.4.4)
- [ ] Allinea la scheda alle correzioni del Task C (trial, regole, lingue).
- [ ] Rimuovi dalla pagina install le istruzioni di sideload **temporaneo** come percorso primario: punta al listing AMO ufficiale (installazione permanente + auto-update).

**Opera Add-ons**
- [ ] In alternativa, Opera installa estensioni dal Chrome Web Store → puoi indirizzare lì invece dello ZIP.
- [ ] Se vuoi listing nativo, sottometti su Opera Add-ons.

**Safari (Mac App Store)**
- [ ] Pubblica come app Safari Web Extension sul Mac App Store (richiede Apple Developer Program, 99 USD/anno).
- [ ] Finché non è live: marca Safari come "In arrivo". **Non** proporre il flusso Xcode/Terminal come percorso consumer (è un kill-switch di conversione).

**Mobile**
- [ ] Android: percorso realistico = Firefox Android (estensione AMO) invece di Kiwi/sideload, se compatibile.
- [ ] iOS: marca chiaramente come non supportato / roadmap.

### B.2 Permessi (impatta sia store sia fiducia)
- [ ] Per ogni permesso (`read browsing history`, `access data on all websites`) aggiungi nel sito e nelle schede store una **spiegazione chiara del perché serve** e del fatto che i dati **non lasciano il dispositivo**.
- [ ] Verifica che i permessi richiesti nel `manifest.json` siano il **minimo necessario**; rimuovi quelli non usati.

### B.3 De-risking della dipendenza dallo store
- [ ] Implementa cattura email all'attivazione trial/licenza (canale di contatto indipendente dallo store).
- [ ] Mantieni il download diretto firmato come fallback documentato in caso di delisting.
- [ ] Valuta Firefox come "porto sicuro" di lungo periodo (MV2/funzionalità piene) nella comunicazione.

### B.4 Acceptance criteria (B)
- [ ] Nessun pulsante "store" punta a uno store diverso da quello dichiarato.
- [ ] Ogni browser è in uno di due stati onesti: **"Installa dallo store" (live, auto-update)** oppure **"In arrivo"**.
- [ ] Il sideload non è più presentato come percorso principale.
- [ ] Ogni permesso ha una giustificazione visibile.

---

## TASK C — Coerenza dei contenuti (single source of truth)

> **Approccio:** crea un unico file di costanti e propaga ovunque. I valori "veri" si ricavano dal codice dell'estensione, non dal copy.

### C.1 Valori canonici (dal sito, indicati dal founder come aggiornati — 31 mag 2026)
**Fonte ufficiale = sito adoff.app.** Da propagare ovunque. ⚠️ Le schede store NON coincidono ancora: vanno allineate a questi valori (vedi note).

| Dato | Valore canonico (sito) | ⚠️ Discrepanza da riconciliare |
|---|---|---|
| Regole di rete | **138** | La scheda **Firefox AMO** (note sviluppatore) dichiara **107 regole statiche** → verifica il conteggio reale nel package e allinea store ↔ sito. Inoltre il box-statistiche della home dice **"130+"**: uniformare a 138. |
| Lingue | **15** | AMO/screenshot indicano **6** → aggiorna la scheda store e rigenera gli screenshot. |
| Trial Pro | **30 giorni** | AMO dice **"15-day"** → correggi la scheda Firefox. |
| Versione | (sito non la mostra più in modo fisso) | AMO è a **v3.4.4** → non hard-codare versioni nel sito, oppure tienile sincronizzate. |
| Browser supportati | **5** (box) ma il testo ne elenca **6** (Chrome, Firefox, Edge, Opera, Brave + Safari) | Decidi il numero reale e uniforma box ↔ testo. |
| Prezzi | **NUOVI (decisi):** Mensile **€2,99** · Annuale **Founder €19,99 (primi 100) → €24,99** standard · Founder Lifetime **€99** (limitato) · **piano unico** · counter reale X/100 | Sul sito ci sono ancora i **vecchi** (2,69 / 29,59 / 67,90 / tier 3-5-10): sostituirli ovunque + Stripe + store (vedi Task G.3). |

> **Principio di onestà:** se il package reale ha 107 regole/6 lingue, il numero "vero" è quello — aggiorna il **sito verso il package**, non gonfiare. Se invece il sito è avanti e gli store sono vecchi, aggiorna **gli store verso il sito**. In ogni caso: **un solo numero ovunque**, coincidente con ciò che la build effettivamente contiene.

### C.2 Implementazione
- [ ] Crea `data/constants.json` con: `network_rules=138`, `cosmetic_filters`, `languages=15`, `trial_days=30`, `version`, `pricing`, `supported_browsers`. (Correggi se il package reale dice altro.)
- [ ] Sostituisci tutti i valori hard-coded nelle pagine con riferimenti a questo file.
- [ ] Uniforma i box-statistiche della home ("130+" → 138; "5 browser" → numero reale).
- [ ] **Aggiorna le schede store** (Firefox AMO in primis: 107→138 regole, 6→15 lingue, 15→30 giorni trial) così sito e store dicono lo stesso.
- [ ] Grep finale dei valori vecchi (`130+`, `107`, `6 lingue`, `15-day`, `v3.4.0`).

### C.3 Acceptance criteria (C)
- [ ] Un solo numero per regole, lingue, trial in **sito + tutte le schede store + package**.
- [ ] Box-statistiche della home coerenti col resto del sito.
- [ ] I numeri coincidono con ciò che la build effettivamente contiene (verificato nel package).
- [ ] Nessuna occorrenza residua dei valori vecchi.

---

## TASK D — Strategia codice sorgente, fiducia e licenza

> **Premessa tecnica (importante):** un'estensione browser è JavaScript che gira sul dispositivo dell'utente. Chiunque può scaricare il pacchetto (`.crx`/`.xpi`), scompattarlo e leggere tutto il codice — **incluso lo Stealth anti-detection**. Quindi "closed source" **non** protegge dai cloni: il codice è già esposto. Il vero fossato non è la segretezza, ma manutenzione + brand + distribuzione + server licenze.
>
> **Conseguenza:** tenere il codice chiuso non ferma i cloni (impossibile per un'estensione) ma fa perdere fiducia e conversioni, perché in questo mercato i prodotti credibili (es. uBlock Origin) sono open-source proprio perché chiedono permessi invasivi.

### D.1 Modello consigliato: "open core / source-available"
- **Apri (ispezionabile)** il **core gratuito**: blocco di rete (`declarativeNetRequest` + rules JSON) e filtri cosmetici. È già leggibile comunque → trasformalo in leva di fiducia e marketing.
- **Tieni come asset/fossato** (non perché segreti nel client, ma perché sono ciò che un clone non può replicare a costo zero):
  - **Server di validazione licenze Pro** (logica lato server: questo sì resta privato e non è nel pacchetto).
  - **Ritmo di aggiornamento delle regole** (la cura settimanale contro YouTube/anti-adblock = il vero valore ricorrente).
  - **Brand, listing store con utenti/recensioni reali, email list, supporto.**
- **Pro/Stealth/video neutralization:** restano feature a pagamento. Possono essere nel repo o in un layer separato, ma la **monetizzazione** è protetta dal server licenze + dalla licenza legale, non dall'offuscamento del codice.

### D.2 Licenza (qui sta la vera protezione anti-clone)
- Per ottenere la fiducia dell'ispezionabilità **senza** regalare il diritto di rivendita, valuta una licenza **source-available non commerciale** (es. PolyForm Noncommercial, BSL): codice visibile, **uso commerciale/rivendita vietati**.
- Evita licenze permissive (MIT/Apache) se non vuoi cloni commerciali legali.
- ⚠️ **Decisione legale, non solo tecnica:** prima di adottare una licenza, far validare la scelta da un avvocato. Inserire nel repo: `LICENSE`, `README` con spiegazione del modello, e una `PRIVACY.md`.

### D.3 Azioni per Claude Code
- [ ] Predisporre la struttura repo per separare **core (apribile)** da **server licenze (privato)**.
- [ ] Aggiungere file `LICENSE` (placeholder con la licenza scelta dal founder), `README.md`, `PRIVACY.md`.
- [ ] Sul sito: aggiungere una sezione **"Codice ispezionabile"** con link al repo/al pacchetto, e collegarla alla riga permessi del Task B.2 ("ecco perché chiediamo questi permessi, ecco il codice che lo dimostra").
- [ ] **Non** pubblicare nel repo né nel client segreti operativi: chiavi, endpoint privati, logica di firma licenze.

### D.4 Acceptance criteria (D)
- [ ] Nessun segreto (chiavi/endpoint privati) nel codice client o nel repo pubblico.
- [ ] Presenza di `LICENSE`, `README`, `PRIVACY.md` coerenti col modello scelto.
- [ ] Il sito comunica l'ispezionabilità del core e la collega alla giustificazione dei permessi.
- [ ] La monetizzazione Pro dipende dal server licenze, non dall'offuscamento.

---

## TASK E — Distribuzione "ovunque" senza diventare malware

> **Vincolo non negoziabile:** **vietato l'auto-install silenzioso** di estensioni in più browser. I browser lo bloccano apposta (Chrome dalla v25 disabilita le estensioni installate offline finché l'utente non approva; Firefox ha dismesso il sideload; la policy `ExtensionInstallForcelist` genera l'avviso "browser gestito" ed è la tecnica usata dai PUP → flag antivirus, delisting, danno reputazionale per un prodotto privacy). Niente registry hack, niente policy enterprise su macchine consumer, niente file di estensione iniettati di nascosto.

L'obiettivo "su qualsiasi browser e OS" si raggiunge con **tre canali leciti**, non con un installer magico.

### E.1 Installer "companion" guidato (breve termine)
- App desktop nativa per **Windows (MSI/EXE), macOS (PKG/DMG/MAS), Linux (DEB/RPM/AppImage)** che:
  - [ ] **Rileva** i browser installati.
  - [ ] Per ciascuno apre la **pagina store corretta** con deep-link ("Aggiungi a Chrome / Firefox / Edge..."), dove l'utente conferma **una volta per browser** (consenso esplicito, auto-update garantito dallo store).
  - [ ] Non installa nulla di nascosto; nessuna estensione abilitata senza click dell'utente.
- È l'UX usata da AdGuard e dai password manager: riduce l'attrito restando 100% pulita.
- **Acceptance:** ogni abilitazione passa da un'azione utente nel browser; nessun avviso "browser gestito"; nessun rilevamento PUP/antivirus.

### E.2 Deploy enterprise (canale B2B, solo con consenso dell'organizzazione)
- Le policy ufficiali (`ExtensionInstallForcelist` per Chromium, `policies.json`/distribution dir per Firefox) sono **legittime su dispositivi gestiti** di aziende/scuole che lo decidono.
- [ ] Predisporre documentazione + pacchetti di deploy MDM/GPO per i clienti business.
- [ ] **Mai** usare questi meccanismi su utenti privati. Canale separato, listino separato (licenze per postazione/sito).

### E.3 App desktop di filtraggio a livello di sistema (medio termine — il vero "ovunque")
> Questa è la risposta reale a "funziona su ogni browser e OS": **non un'estensione, ma un'app che filtra gli ads a livello di rete** sul dispositivo, per **tutti i browser e tutte le app insieme**. È il modello AdGuard Desktop. Risolve anche Manifest V3 e la dipendenza dagli store.

Roadmap tecnica (prodotto separato, non bloccante per A–D):
- [ ] **Core di filtraggio**: proxy locale / DNS locale che intercetta le richieste e applica le regole (riuso delle stesse liste dell'estensione → unica fonte regole).
- [ ] **Filtraggio HTTPS**: generazione e installazione di un **certificato radice locale** con consenso esplicito dell'utente (passaggio sensibile: spiegare chiaramente cosa fa e perché; è il punto che la community giudica di più).
- [ ] **App per OS**: Windows (servizio + tray), macOS (app firmata + notarizzata, Network Extension), Linux (daemon).
- [ ] **Stessa licenza Pro / stesso server licenze** dell'estensione (un solo account, più dispositivi).
- [ ] **Privacy**: filtraggio in locale, zero log, nessun dato fuori dal dispositivo — coerente col posizionamento.
- **Nota fiducia:** un'app che installa un certificato radice e filtra il traffico richiede ancora più trasparenza del modello estensione → qui il core open/source-available (Task D) diventa quasi obbligatorio per essere creduti.

### E.4 Cosa deve fare Claude Code ora (E)
- [ ] Sul sito: sostituire qualsiasi promessa/idea di "installazione automatica su tutti i browser" con il flusso **companion guidato** (E.1) e una pagina "Per le aziende" (E.2).
- [ ] Aggiungere alla roadmap pubblica la **app desktop di sistema** (E.3) come "in arrivo", senza prometterne tempi.
- [ ] Verificare che **nessun** punto del sito/installer suggerisca sideload forzato o aggiramento del consenso del browser.

---

## TASK F — Mobile (iOS e Android) mantenendo identità ed etica

> **Contesto:** sia Apple sia Google hanno reso difficile/bandito i veri ad blocker dai loro store. Le due piattaforme richiedono soluzioni diverse. L'obiettivo è entrare **senza tradire** il posizionamento privacy-first/zero-log e **senza promettere ciò che la piattaforma non consente**.

### F.1 iOS — Safari Content Blocker + DNS on-device
- [ ] **Prodotto d'ingresso:** app **Safari Content Blocker** (App Store-safe). Per design Apple, l'app **non vede la navigazione** → coerente con la Zero-Log Policy. Riusa le stesse liste di regole dell'estensione.
- [ ] **System-wide:** filtraggio **DNS (DoH/DoT) on-device** per ridurre ads/tracker fuori da Safari.
- [ ] **Limiti da dichiarare nel marketing (obbligatorio):** su iOS non si possono bloccare gli ads **dentro app come YouTube/Facebook**; il DNS non cattura tutto. Comunicarlo chiaramente.
- [ ] Tenere d'occhio **iOS 26 NEURLFilter** come evoluzione futura (non ancora ampiamente disponibile per ad blocker consumer).

### F.2 Android — app di filtraggio locale completa, distribuita FUORI dal Play
- [ ] **Prodotto pieno:** **VPN locale di filtraggio on-device** (VpnService), blocca ads in app + browser, **senza root**. Il traffico **non lascia il dispositivo**.
- [ ] **Vincolo Play:** Google vieta gli ad blocker che interferiscono con la pubblicità di altre app → distribuire la **versione completa off-Play** (APK firmato dal sito, F-Droid, store alternativi).
- [ ] **Presenza su Play (opzionale, per scoperta):** versione **lite DNS-only** o **browser** conforme alle policy.

### F.3 Paletti identità/etica (acceptance criteria, F)
- [ ] **Tutto on-device:** la "VPN" è **locale**, nessun traffico instradato verso i server AdOff. Zero-log verificabile.
- [ ] **Core open / source-available** anche su mobile (un'app che filtra DNS/traffico vede potenzialmente tutto → serve ispezionabilità per essere creduti).
- [ ] **Niente "acceptable ads"** a pagamento: blocco totale di default.
- [ ] **Trasparenza sui limiti**: nessuna promessa di bloccare ciò che iOS/Android non consentono.
- [ ] **Licenza Pro unica** su desktop + estensione + mobile; prezzi trasparenti, disdetta libera, nessun dark pattern.
- [ ] Se in futuro offri un **resolver DNS ospitato**: no-log stretto o opzione self-host; preferire comunque on-device.

### F.4 Cosa deve fare Claude Code ora (F)
- [ ] Aggiungere al sito una sezione/roadmap **Mobile** onesta: iOS (Safari + DNS, con i limiti dichiarati) e Android (app completa off-Play + eventuale lite su Play).
- [ ] Non annunciare blocco di ads in-app su iOS (YouTube/Facebook): è impossibile e brucerebbe la credibilità.
- [ ] Predisporre il riuso delle **stesse liste di regole** e dello **stesso account/licenza** cross-platform.

---

## TASK G — Pricing e architettura piani

> **Diagnosi:** competi in una categoria dove il "buono abbastanza" è gratis (uBlock Origin open-source, Brave). Il leader premium (AdGuard) offre **l'intero sistema** (desktop/mobile/DNS) a prezzo di listino simile al tuo ma **scontato di routine a ~$16 lifetime**. Oggi AdOff vende **solo un'estensione** a prezzo pari o superiore → l'utente paga di più per avere meno. Il prezzo va giustificato dal **wedge** (funziona dove gli altri falliscono: Chrome MV3 + anti-adblock + video) e dall'**aggiornamento continuo come servizio**, non dallo scope.

### G.1 Tabella comparativa di riferimento (da tenere aggiornata internamente)
| Prodotto | Modello | Prezzo indicativo 2026 | Ambito | Open source |
|---|---|---|---|---|
| uBlock Origin | Gratis | €0 | Browser (pieno Firefox, ridotto Chrome MV3) | Sì |
| Brave | Gratis | €0 | Solo dentro Brave | Sì |
| AdGuard | Abb./Lifetime | Annuale Personal ≈ $2,49/mese (3 dev), Lifetime Personal ~$79,99; Family ~$169,99 listino, **spesso ~$16 in offerta** | Sistema intero + estensione | Parziale |
| Total Adblock | Abbonamento | ≈ $1,59/mese (bundle antivirus; disdetta ostica) | Browser + app | No |
| NextDNS/Control D | Freemium DNS | ~€0–20/anno | System-wide (DNS) | Parziale |
| **AdOff (oggi)** | Free + Abb./Lifetime | €2,69/mese · €29,59/anno · €67,90 lifetime | **Solo estensione** | No |

### G.2 Problemi dell'attuale listino
- **Lifetime = trappola:** incassi una volta ma manutieni per sempre (cat-and-mouse), e uccidi il ricavo ricorrente (l'asset che rende il business valutabile). €67,90 è anche **sopra** il lifetime reale di AdGuard.
- **Annuale debole:** €29,59 (€2,47/mese) vs €2,69 mensile = ~8% di sconto → non incentiva l'impegno annuale.
- **Troppi SKU** (Mensile/Annuale/Lifetime × 3/5/10 device) per un prodotto a trazione zero → paralisi da scelta.
- **Claim fuorviante:** "~30% in meno di AdGuard Family" confronta il **listino**, non il prezzo reale di mercato (~$16). Da rimuovere (coerente col Task A).

### G.3 Architettura piani — DECISA dal founder (Eros, 31 mag 2026)
- [x] **Free** generoso (blocco rete + cosmetico): resta l'imbuto d'ingresso.
- [x] **Pro Mensile = €2,99/mese.**
- [x] **Pro Annuale — prezzo Founder a scaglioni:**
  - **Primi 100 iscritti: €19,99/anno, bloccato a vita** finché restano abbonati ("Founder price").
  - **Dopo i primi 100: €24,99/anno** (prezzo standard, piano "eroe").
  - Trasparenza sul blocco prezzo: se disdici e rientri, vale il prezzo corrente.
- [x] **Counter REALE dei posti Founder sul sito:** mostra "Posti Founder rimasti: X/100", alimentato dal **numero reale di abbonati Founder** (conteggio da Stripe/backend), non da un valore finto. Quando arriva a 0, il prezzo passa **automaticamente** a €24,99 e l'offerta sparisce. **Vietati countdown finti o che si resettano** (è l'opposto del posizionamento onesto).
- [x] **Lifetime: RIMOSSO dal listino standard.** Tenuto **solo** come offerta di lancio **"Founder" a tiratura/tempo limitato** a **€99 una tantum**, poi ritirato.
- [x] **Tier per device: rimandati.** Per ora **un solo piano Pro** (uso su più dispositivi personali, es. fino a 3). I tier 3/5/10 torneranno con desktop (E.3) e mobile (F).
- [x] **Igiene fiducia:** "no acceptable ads", disdetta in 1 clic, rimborso 30 giorni; nessun confronto prezzi fuorviante; **nessuna scarsità finta**.

> **Da cambiare sul sito (oggi è: €2,69 mensile / €29,59 annuale / €67,90 lifetime / tier 3-5-10):** sostituire con €2,99 mensile · €24,99 annuale · Founder Lifetime €99 (limitato) · piano unico. Aggiornare anche **Stripe** e le schede store.
> *(Knob opzionale da A/B test in seguito: annuale €19,99 vs €24,99. Default deciso: €24,99.)*

### G.4 Da A/B testare in seguito (non blocca il lancio)
- [ ] Prezzo del piano **Annuale**: €24,99 (default) vs €19,99.
- [ ] Durata/prezzo dell'offerta **Founder Lifetime** (€99, quanti posti / quanti giorni).
- [ ] Tasso di conversione Free→Pro per variante.

### G.5 Cosa deve fare Claude Code ora (G)
- [ ] Aggiornare la sezione pricing del sito: Free / Mensile €2,99 / Annuale **Founder €19,99 (primi 100) → standard €24,99** / Founder Lifetime €99 (limitato).
- [ ] **Costruire il counter REALE dei posti Founder:** "Posti Founder rimasti: X/100" letto dal **conteggio reale di abbonati Founder** lato server (Stripe/DB). Quando X=0: passa in automatico a €24,99 e nasconde l'offerta Founder. **Niente numeri hard-coded, niente timer finti/resettabili, niente localStorage fasullo.**
- [ ] Rimuovere il claim comparativo "~30% in meno di AdGuard".
- [ ] Predisporre il pricing come dato configurabile (`constants.json` del Task C).
- [ ] Allineare i prezzi mostrati sul sito con quelli reali su **Stripe** e sulle schede store.

---

## TASK H — Calendario dei primi 30 giorni (solo, senza budget, alle prime armi)

> **Principi:** (1) la viralità non si forza, si prepara → obiettivo reale = **primi 100 utenti veri + 20 recensioni**, non "diventare virale"; (2) **non portare traffico su un secchio bucato** → prima il minimo di fondazione, poi distribuzione; (3) **costanza > colpo di fortuna**: 1 azione utile al giorno; (4) carico realistico **5–15 ore/settimana**. L'AI scrive le bozze, tu rifinisci e pubblichi.

### Settimana 1 — Fondamenta (NON fare ancora marketing)
- [ ] Rimuovere le recensioni non verificabili (Task A) e il claim "~30% in meno di AdGuard" (Task G).
- [ ] Allineare i numeri (Task C: regole, lingue, trial) — anche solo a mano per ora.
- [ ] Semplificare il pricing visibile (Task G): Free / Mensile / Annuale eroe; Lifetime nascosto o "Founder" limitato.
- [ ] Attivare **cattura email** all'installazione/trial (canale indipendente dagli store).
- [ ] Rendere onesti i pulsanti store (Task B.0): "Installa" solo dove è davvero 1-click; il resto "In arrivo".
- [ ] Aprire i canali **build-in-public**: un account X + profilo Indie Hackers. Scrivere la frase-pitch in 1 riga.
- [ ] Definire come raccoglierai le **prime recensioni vere** (link diretto alla pagina recensioni dello store).

### Settimana 2 — Motore di contenuti + primi semi organici
- [ ] Pubblicare **3–4 articoli SEO ad alta intenzione**: "adblock youtube non funziona 2026", "alternativa uBlock Origin su Chrome", "come superare il muro "disattiva adblock"", "miglior adblocker leggero 2026". (AI per le bozze, tu rifinisci.)
- [ ] Girare **2–3 video brevi "mostra non dire"** (telefono): "guarda YouTube senza pubblicità nel 2026".
- [ ] Iniziare a postare in build-in-public **3 volte/settimana**: la storia ("ho costruito un adblocker da zero, da solo, per gioco").
- [ ] Entrare in **1–2 community** (subreddit/Discord sul tema): solo essere utile, **niente promo** ancora (costruire reputazione/karma).

### Settimana 3 — Primi utenti veri + recensioni
- [ ] Chiedere a conoscenti/primi utenti una **recensione onesta** sugli store (target: 10–20).
- [ ] Pubblicare **altri 2–3 articoli** e ricondividere i video.
- [ ] Nelle community: ora rispondere ai thread di chi ha l'adblock rotto, **citando AdOff solo quando pertinente**.
- [ ] Contattare **3–5 piccoli creator** tech/anti-ads: chiedere semplicemente di provarlo (gratis, nessun pagamento).

### Settimana 4 — Il lancio (una volta sola, preparato bene)
- [ ] **Product Hunt** + **"Show HN" su Hacker News** lo stesso giorno: storia da solo-builder + angolo open-core (Task D) = ciò che HN premia.
- [ ] Preparare gli asset: descrizione, GIF/demo, FAQ, link store puliti.
- [ ] Il giorno del lancio: postare ovunque (X, Indie Hackers, community pertinenti) e **rispondere a ogni commento**.
- [ ] Misurare: installazioni, recensioni, **quale canale ha convertito**.
- [ ] Pianificare i 30 giorni successivi raddoppiando su ciò che ha funzionato.

### Abitudini trasversali
- [ ] **1 azione utile al giorno** (un articolo, un video, 5 risposte utili, 10 inviti a recensire).
- [ ] **Revisione settimanale** di 30 minuti: cosa ha portato utenti, cosa no.
- [ ] Tenere il **tono onesto** ovunque: niente hype, niente numeri gonfiati (è il tuo vantaggio competitivo).

### Acceptance criteria (H)
- [ ] Nessuna attività di marketing parte prima che A + C (minimo) + G (claim) siano sistemati.
- [ ] Almeno 6–7 contenuti SEO pubblicati entro fine mese.
- [ ] Lancio Product Hunt/HN eseguito con asset pronti e store puliti.
- [ ] Primi 10–20 recensioni reali raccolte; canale migliore identificato.

---

## TASK I — Allocazione budget €1000 (paid solo dopo segnale organico)

> **Regola madre:** gli ads sono un **acceleratore, non un accendino**. Niente spesa paid finché il Task H non mostra un funnel che funziona (Free→Pro che converte + prime recensioni reali). I soldi amplificano un sistema che funziona; non ne creano uno.

### I.1 Vincolo di canale
- **Google e Meta sono canali ostili/inaffidabili** per un ad blocker (sono ad-funded → rifiuti frequenti, rischio account). Non costruire la strategia su di essi.
- I canali che funzionano per un adblocker sono **creator di nicchia + newsletter tematiche + (test) Reddit**, dove il pubblico ha già il problema.

### I.2 Allocazione consigliata
| Voce | Importo | Perché |
|---|---|---|
| Apple Developer Program (99$/anno) | ~€100 | Sblocca iOS/Safari (Task F): distribuzione vera, meno attrito |
| Micro-sponsor creator tech/privacy/anti-ads | ~€500 | €50–150 a testa → 4–8 collocazioni; **unico paid che converte** per adblocker |
| Sponsor 1–2 newsletter di nicchia | ~€150 | Lettori ad alta intenzione |
| Stack strumenti AI/SEO (qualche mese) | ~€100 | Alimenta la macchina di contenuti (Task H) |
| Budget TEST 1 canale (es. Reddit ads) | ~€150 | Solo **dopo** segnale organico; trattare come apprendimento, non crescita |

### I.3 Condizioni per sbloccare il paid
- [ ] Funnel Free→Pro che converte in modo misurabile (organico).
- [ ] Almeno 10–20 recensioni reali + social proof sistemata (Task A).
- [ ] Pricing riallineato (Task G) e store puliti (Task B).
- [ ] Tracciamento in piedi per misurare CAC per canale.

### I.4 Cosa deve fare Claude Code ora (I)
- [ ] Predisporre tracciamento delle conversioni per **canale/UTM** (per misurare quale sponsor porta installazioni/Pro).
- [ ] Creare landing/UTM dedicate per le sponsorizzazioni creator/newsletter.
- [ ] Non integrare pixel/SDK di Google/Meta in modo invasivo: sarebbe incoerente col posizionamento privacy.

---

## TASK J — Automazione (cosa automatizzare, cosa semi, cosa tenere umano)

> **Modello di riferimento:** *"tu orchestri, l'AI esegue"*. Gli agenti autonomi falliscono spesso sui task reali → niente pilota automatico totale. Target realistico: **automatizzare/assistere con AI ~60–75% del carico operativo**; il restante 25–40% (engine, decisioni, fiducia, voce) resta umano.
> **Trappola AdOff:** il tuo asset virale è la **storia umana del solo-builder**. Automatizzare via la voce = uccidere la leva di crescita. La faccia ce la metti tu.

### J.1 Automazione piena (~90%, AI/script/tool)
- [ ] **Pipeline contenuti** (Task H): keyword research, bozze SEO, riadattamento in post/video, programmazione.
- [ ] **Email transazionali**: trial, scadenze, rinnovi, recupero (via provider email).
- [ ] **Billing + licenze**: Stripe + server di validazione (backend privato).
- [ ] **Monitoraggio**: uptime, health-check, verifica link store, alert automatici.
- [ ] **Analytics/report**: conversioni per UTM, CAC per canale, riepilogo settimanale automatico.
- [ ] **Supporto Tier-1**: chatbot/FAQ per le domande ripetitive d'installazione.

### J.2 Semi-automazione (AI assiste, umano decide/approva)
- [ ] **Aggiornamento regole** anti-YouTube/anti-adblock: rilevamento e generazione assistiti, ma **QA e merge umani** (è il cuore del prodotto).
- [ ] **Risposte community**: AI prepara, tu rifinisci il tono (un tono "da bot" su HN/r/privacy brucia).
- [ ] **Pubblicazione store**: confezionamento assistito, ma review/policy/screenshot semi-manuali.
- [ ] **Outreach creator/newsletter** (Task I): bozze AI, invio e relazione curati da te.
- [ ] **Contenuti**: pubblicazione **solo dopo revisione umana** (mai auto-publish grezzo).

### J.3 Solo umano (non automatizzare)
- [ ] **Decisioni strategiche**: prezzo, Lifetime sì/no, open-source, licenza (legale), quali store, quando/come spendere il budget.
- [ ] **Fiducia e trasparenza**: comunicazione su privacy/permessi.
- [ ] **Voce e storia** (build-in-public): è il founder, non un agente.
- [ ] **QA finale del motore di blocco**.

### J.4 Robustezza (single point of failure = tu)
- [ ] **Kill switch** per agenti/automazioni che sbagliano.
- [ ] **Runbook** documentati dei processi critici + **backup automatici**.
- [ ] Monitoraggio con **escalation** (alert a te quando qualcosa si rompe).

### J.5 Stack consigliato (snello)
- AI generale (Claude/ChatGPT) per bozze, supporto, analisi regole.
- Automation glue (Zapier/Make/n8n) per collegare i pezzi.
- Stripe (billing) + backend licenze.
- Provider email (transazionali + lista).
- Analytics + tracciamento UTM.
- Uptime monitoring + chatbot supporto.

### J.6 Acceptance criteria (J)
- [ ] Nessuna pubblicazione **autonoma** su community/store senza revisione umana.
- [ ] Human-in-the-loop obbligatorio su **QA del motore** e **contenuti pubblicati**.
- [ ] Kill switch + runbook + backup presenti.
- [ ] La voce build-in-public resta umana (Task H).

---

## TASK K — Pagina "Chi sono" / Umanizzazione del sito

> **Logica:** per un prodotto privacy che chiede permessi invasivi e un pagamento, un **fondatore reale + trasparenza** convertono più di qualsiasi badge. La storia (vedi file `adoff-story-brand.md` e `adoff-chi-sono.md`) è un **asset di fiducia**, non decorazione. Ma dosata: home = prodotto, pagina dedicata = storia.

### K.1 Pagina dedicata "Chi sono / About"
- [ ] Creare route `/chi-sono` (IT) e `/about` (EN) con la storia d'origine completa (copy pronto in `adoff-chi-sono.md`).
- [ ] Linkare la pagina da **header e footer**.
- [ ] Includere la sezione **"Ma è uno solo?"** che trasforma il solo-founder in forza ("progetto vivo, costruito in pubblico, aggiornato di continuo") — gestisce il dubbio "e se sparisce?".

### K.2 Umanizzazione leggera della homepage (NON trasformarla in autobiografia)
- [ ] **Founder note** (2–3 frasi + link alla storia) **al posto delle recensioni finte** (collega a Task A): risolve credibilità e umanizzazione insieme.
- [ ] Firmare la sezione **valori/privacy in prima persona** ("Io non vendo i tuoi dati" invece del "noi" aziendale).
- [ ] Vicino a **permessi/zero-log**: nome del fondatore + foto (opzionale) per ridurre il sospetto "scatola nera".
- [ ] La home resta **focalizzata sul prodotto** (cosa fa, funziona, è sicuro): niente racconto lungo qui.

### K.3 Coerenza
- [ ] Tono pagina "Chi sono": informale ma curato, del **tu**, voce "uno di noi" (vedi `adoff-story-brand.md` §5). Niente corporatese.
- [ ] Versioni **IT + EN**.
- [ ] Sostituire i `[nome]` quando il founder lo fornisce.

### K.4 Acceptance criteria (K)
- [ ] Pagina "Chi sono" online (IT+EN), linkata da header/footer.
- [ ] Recensioni finte sostituite dal Founder note in home.
- [ ] Sezione valori in prima persona.
- [ ] Homepage ancora product-first (la storia lunga sta solo nella pagina dedicata).

---

## TASK L — Richiesta recensioni (non invasiva, on-brand)

> **Obiettivo:** raccogliere recensioni **vere** sugli store (oggi 0) senza infastidire. Regola: chiedi nel **momento di valore**, **una volta**, in modo **discreto** e **onesto**.

### L.1 Trigger (DECISO dal founder)
- **Dopo 7–15 giorni di uso attivo** (default **10 giorni**). "Uso attivo" = giorni in cui l'estensione ha effettivamente bloccato qualcosa. Logica **locale** (riusa il contatore già esistente), nessun dato inviato.
- In alternativa/aggiunta: trigger su traguardo tangibile (es. "500 ads bloccate"). Sceglierne **uno** primario.

### L.2 Dove e con che frequenza
- **Solo nel popup dell'estensione**, riga piccola e **chiudibile**. **Mai** modal a tutto schermo. **Mai** iniezione nelle pagine web (un adblocker che mostra pop-up = autogol).
- Mostra **una volta**; se "Magari dopo", **un solo** promemoria dopo ~7 giorni, poi **mai più** (stato in `chrome.storage.local`).
- **Email** solo se opt-in (trial/licenza): un singolo messaggio da Eros.

### L.3 Flusso (un tap, con check di sentiment etico)
1. **Sentiment:** "Ti trovi bene con AdOff?" → 😊 Sì / 😕 Non proprio.
2. **Se Sì:** ringrazia + ask onesto + **deep-link diretto alla pagina recensioni dello store giusto** (Chrome/Firefox/Edge in base al browser).
3. **Se No:** offri aiuto/feedback ("posso sistemarlo?") → modulo supporto.
   - ⚠️ **Vincolo etico/policy:** il ramo "No" **non deve impedire** all'utente di recensire sullo store (Apple/Google lo scoraggiano). È un *"prima di andare, posso aiutarti?"*, non un muro.

### L.4 Microcopy pronto (IT + EN)

**Sentiment iniziale**
- 🇮🇹 "Ti trovi bene con AdOff?" → `[😊 Sì]` `[😕 Non proprio]`
- 🌍 "Enjoying AdOff?" → `[😊 Yes]` `[😕 Not really]`

**Ramo 😊 Sì**
- 🇮🇹 "Fantastico! Sono Eros e porto avanti AdOff da solo. Una recensione onesta mi aiuta più di mille euro di pubblicità — bastano 20 secondi. 🙏" → `[Lascia una recensione]` `[Magari dopo]`
- 🌍 "Awesome! I'm Eros, and I run AdOff solo. An honest review helps me more than €1,000 of ads — it takes 20 seconds. 🙏" → `[Leave a review]` `[Maybe later]`

**Ramo 😕 Non proprio**
- 🇮🇹 "Mi dispiace — voglio sistemarlo. Cosa non va? Scrivimi, leggo tutto io." → `[Scrivimi]` `[No grazie]`
- 🌍 "Sorry to hear that — I want to fix it. What's wrong? Write me, I read everything myself." → `[Write me]` `[No thanks]`

**Email (opt-in), da Eros**
- Oggetto: *una cosa veloce 🙏*
- "Ciao, sono Eros. Hai usato AdOff per qualche giorno: funziona come speravi? Se sì, una recensione onesta sullo store mi dà una mano enorme (sono solo io dietro). Se qualcosa non va, rispondi a questa mail: la sistemo."

### L.5 Cosa deve fare Claude Code (L)
- [ ] Implementare il prompt nel popup, attivato dopo 7–15 gg di uso attivo (default 10), basato su contatore **locale**.
- [ ] Deep-link recensioni per browser rilevato (Chrome Web Store / Firefox AMO / Edge Add-ons).
- [ ] Stato "già chiesto / mai più" in `chrome.storage.local`; max 1 prompt + 1 reminder.
- [ ] Ramo "No" → supporto, **senza** bloccare la via store.
- [ ] Zero invio dati / zero tracking (coerente con zero-log).

### L.6 Acceptance criteria (L)
- [ ] Il prompt appare al massimo 1 volta + 1 reminder, poi mai.
- [ ] Nessun modal a schermo intero, nessuna iniezione in pagina.
- [ ] Il ramo "scontento" offre aiuto ma **non** impedisce la recensione.
- [ ] Link recensione corretto per ciascun browser.
- [ ] Logica locale, nessun dato inviato.

---

## Decisioni richieste al founder (da confermare prima del run)
1. ✅ **Valori dal sito (founder):** 138 regole, 15 lingue, trial 30 giorni, prezzi confermati. **Da fare:** verificare che il package reale dica lo stesso (AMO indica 107/6/15) e **allineare le schede store al sito**.
2. ✅ Lingue: **15** (sito). Aggiornare la scheda store da 6 a 15 e rigenerare gli screenshot.
3. ✅ Trial: **30 giorni** (sito). Correggere la scheda Firefox (dice 15).
4. Strategia codice (vedi **Task D**): adottare il modello **open core / source-available** (core gratuito ispezionabile + licenza che vieta la rivendita; Pro e server licenze come asset). Confermare la **licenza** scelta con un avvocato.
5. Quali store si pubblicano in questa iterazione (priorità: Chrome → Edge → Firefox allineato → Opera/Safari "in arrivo").
6. Distribuzione (vedi **Task E**): si parte dall'**installer companion guidato**? Si apre il canale **enterprise** B2B? Si mette in roadmap l'**app desktop di sistema** (E.3)?
7. Mobile (vedi **Task F**): si parte da **iOS (Safari content blocker + DNS)**, da **Android (app locale off-Play)**, o entrambi?
8. ✅ **Pricing — DECISO (Task G.3):** Mensile €2,99 · Annuale **Founder €19,99 primi 100 (bloccato a vita) → €24,99 standard** · Lifetime rimosso (solo "Founder" €99 limitato) · piano unico · **counter reale X/100** sul sito. Da implementare su sito + Stripe + store.
9. Budget (vedi **Task I**): se/quando arrivano ~€1000, confermare l'allocazione (creator + distribuzione, non Google/Meta) e la regola "paid solo dopo segnale organico".
10. Automazione (vedi **Task J**): confermare il modello "tu orchestri, AI esegue" — cosa va in piena auto, cosa semi, cosa resta umano (engine, decisioni, voce).

---

## Ordine di esecuzione consigliato
1. **C** (coerenza) — veloce, sblocca tutto il resto.
2. **A** (social proof) — rimuove il rischio reputazionale.
3. **K** (Chi sono / umanizzazione) — il Founder note sostituisce le recensioni finte; alto impatto su fiducia.
4. **G** (pricing) — riallinea listino e claim; veloce e ad alto impatto su conversione.
5. **D** (strategia codice/licenza) — decisione del founder; abilita la sezione "codice ispezionabile" e la giustificazione permessi.
6. **B** (store) — il lavoro più lungo; abilita conversione + auto-update.
7. **L** (richiesta recensioni in-app) — una volta che gli store sono linkabili; raccoglie le prime recensioni vere.
8. **E.1–E.2** (distribuzione companion + enterprise) — dopo che gli store sono a posto.
9. **F.1** (iOS Safari content blocker + DNS) — ingresso mobile rapido e store-safe.
10. **E.3** (app desktop di sistema) e **F.2** (Android app locale off-Play) — prodotti separati, medio termine.
11. Marketing organico seguendo il **Task H** (calendario 30 giorni) + storia/voce dal **Task K** e dai file story brand.
12. **Solo dopo segnale organico**, eventuale spesa paid seguendo il **Task I** (creator/newsletter, mai Google/Meta come canale principale).

## Cosa NON fare
- Non reintrodurre recensioni/numeri non verificabili.
- Non presentare il sideload come percorso primario.
- Non gonfiare i numeri nel marketing per farli sembrare migliori del codice.
- Non affidare la protezione anti-clone alla segretezza del codice client (è già esposto): usa licenza + server licenze + ritmo di aggiornamento.
- Non inserire chiavi o endpoint privati nel codice client o in un repo pubblico.
- **Mai auto-install silenzioso di estensioni** su più browser (registry/policy enterprise su consumer, file iniettati, aggiramento del consenso del browser): è comportamento da malware/PUP → flag antivirus, delisting, fine della reputazione.
- Non promettere su iOS il blocco di ads in-app (YouTube/Facebook) né instradare il traffico mobile verso server propri spacciandolo per privacy: filtraggio solo on-device.
- Non usare **countdown finti o scarsità falsa** (timer che si resettano, "posti rimasti" inventati): il counter Founder deve riflettere il **numero reale** di abbonati. La scarsità finta è l'opposto del tuo marchio.
- Non confrontare i prezzi coi **listini** dei concorrenti ignorando il loro prezzo reale di mercato (es. AdGuard lifetime ~$16 in offerta): è fuorviante.
- Non puntare il modello sul **Lifetime**: incassa una volta ma impegna ad aggiornamenti perpetui e azzera il ricavo ricorrente.
- Non spendere in **ads a freddo prima del segnale organico** (funnel + recensioni): è denaro bruciato su un secchio bucato.
- Non costruire l'acquisizione su **Google/Meta**: canali ad-funded ostili all'adblocker (rifiuti, rischio account). Preferire creator e newsletter di nicchia.
- Non **automatizzare la voce del founder** né pubblicare contenuti/risposte in autonomia senza revisione: uccide la fiducia e la leva build-in-public.
- Non lasciare il motore di blocco o le decisioni strategiche al pilota automatico: human-in-the-loop obbligatorio.
