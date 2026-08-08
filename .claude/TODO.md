# TODO GLOBALE — AdOff ChromePlugin

> **Consolidato 2026-08-04.** Merge di tutte le sessioni dal 2026-07-28 al 2026-08-04 (dai checkpoint `CP_20260728_2204` e `CP_20260731_1846`, sessione SEO del 02/08, sessione rule-feed `CP_20260802_1840`, sessione popunder `CP_20260804_0230`, sessione audit del 04/08 con checkpoint `CP_20260804_0451`), piu la sessione serale sulla difesa popunder universale.
> I check sono **cancellazioni**, non aggiunte. Le voci aperte sono ordinate per priorita reale.
> Stato prodotto: **3.5.64** — manifests alla 3.5.64, sito e Firefox alla 3.5.64, CWS fermo alla 3.5.63 in review (non accetta caricamenti mentre una versione e in revisione), Edge submission inviata, Safari mai sottomesso. Branch `feat/premium-vpn`, HEAD `08020bf` pushato.
> Esiste un gate di test obbligatorio: `node sviluppo/tests/test-security-invariants.js` deve dare 92 su 92 prima di ogni deploy.

---

## ✅ RISOLTO 04/08 sera — difesa popunder universale, validata dall'utente (v3.5.62 3.5.63 3.5.64)

Il problema: i siti di streaming cambiano indirizzo ogni poche settimane e ogni difesa appuntata a un nome muore al trasloco. Tre criteri universali adottati, in ordine di robustezza: famiglie di domini invece di singole istanze nelle regole di rete; marcatori di affiliazione nell'indirizzo di PARTENZA che identificano il circuito qualunque dominio lo serva, cioe pid=pprworker, cps_sk=, aff_short_key=, aff_plateform=; e il piu forte, la corrispondenza fra gesto e risultato, per cui verso un dominio terzo si passa solo se l'utente ha cliccato un link visibile che porta proprio li.
Chiuso anche il buco del player: le difese video erano dichiarate solo per il frame principale e non entravano nell'iframe di terze parti che ospita il lettore. Ora un content script leggero gira su tutti i frame e carica lo stub completo solo dove rileva davvero un player, chiedendo il verdetto a pagamento al service worker.

- [x] difesa universale e invarianti, commit 868904c e 6e454ae
- [x] difese dentro gli iframe dei player, commit f1f9fd4, senza aggiungere permessi al manifest
- [x] marcatori di affiliazione e criterio piu severo sui link sovrapposti al video, commit 5fafefa e 71838d0
- [x] suite invarianti da 58 a 92 asserzioni, tutte validate con mutation testing
- [x] fix critico intercettato prima di pubblicare: build.js copiava solo i file elencati nella sua mappa e player-probe.js non c'era, i primi pacchetti lo dichiaravano nel manifest senza contenerlo e l'estensione non si sarebbe caricata. Coperto ora dal TEST 10
- [x] tre versioni rilasciate, 3.5.62 3.5.63 3.5.64, con la 3.5.63 confermata funzionante dall'utente sul campo
- [x] a revisione conclusa su Chrome Web Store: la 3.5.63 approvata, poi 3.5.64 caricata e pubblicata (commit 63ce249)
- [x] annuncio Telegram della 3.5.64 pubblicato, messaggio 105 (commit 63ce249)
- [ ] ottenere un token Cloudflare con permesso di purge della cache: nessuna credenziale disponibile ce l'ha, l'API risponde Authentication error, e serve per invalidare gli ZIP del sito dopo un deploy (nella sessione dell'08/08 la cache si e' invalidata da sola, non ha bloccato)

## ✅ RISOLTO 08/08 sera — popunder via contesti figli + loader OpenX first-party (v3.5.66)

Segnalazione critica dell'utente: sul sito di streaming segnalato si aprivano continuamente pagine pubblicitarie e ogni comando richiedeva piu' clic, nonostante la 3.5.64.
- CAUSA VERA (misurata): lo script crea un iframe e usa la `open` di QUEL realm, mai sostituita. Ogni difesa su window.open del documento principale non veniva nemmeno interpellata. Scoperta censendo tutti i meccanismi di apertura: zero window.open, zero anchor.click, solo createElement('iframe') da script di terze parti dentro l'iframe del player.
- 3.5.65 (commit 1a7a73a): restituisce il gesto rubato — prima bloccavamo la finestra ma il clic restava consumato. Banco: 3/2 clic → 1 clic.
- 3.5.66 (commit 4dc0949): protezione estesa ai contesti figli via descrittore di contentWindow/contentDocument sul prototipo. Misure sul sito reale ripetute DUE volte con domini diversi: 2 popunder → 0.
- Corretto anche un criterio sui suffissi ad alto abuso che ignorava i sottodomini (commit 83e3bee): giusto ma da solo non bastava.
- TEST 11 (commit 256bdd6): invariante che presidia la protezione dei contesti figli. Suite 92 → 95, validato con mutation testing.
- Regola di rete 938: blocca il loader OpenX first-party (openx_async.js) per NOME FILE non per dominio. Su tre testate: 1 richiesta ad passante → 0. NON ANCORA RILASCIATA (vedi Attivo).
- Lezioni durissime: tre verifiche verdi senza provare nulla in questa sessione (grep nome prodotto che matchava il titolo della pagina di prova; file vuoto che passava node --check; browser di prova partito senza estensione perche' il percorso si troncava sullo spazio). Registra: prima di fidarti di un verde, chiediti cosa lo renderebbe rosso.

## 🔴 ATTIVO — regola 938 da rilasciare come 3.5.67

La regola 938 e' pronta nei tre file di regole (153 per target) ma NON committata e NON rilasciata. E' invisibile agli utenti finche' non esce la 3.5.67.
- [ ] validare localmente: node sviluppo/tests/test-security-invariants.js (atteso 95/95)
- [ ] costruire pacchetti, misurare sul PACCHETTO COSTRUITO (non sorgenti): zero richieste openx_async.js sulle testate
- [ ] prepare-release.js 3.5.66 → 3.5.67, build --store + build, deploy-site.sh
- [ ] risottomettere store principale, Firefox, Edge; annuncio canale
- [ ] chiedere conferma sul campo della 3.5.66 all'utente (gia' disponibile su Firefox)
## ✅ RISOLTO 02/08 — YouTube skip annunci (v3.5.58, confermato dall'utente)

**Causa vera: SABR.** Provato con dati sul video reale: `serverAbrStreamingUrl` presente, `adaptiveFormats` 30 **con URL diretto 0**, `formats` 0. YouTube non serve piu' URL diretti: ogni segmento va chiesto al server, che decide cosa mandare — annunci inclusi. Nessun filtro sul JSON puo' impedirlo.
**Via del client alternativo VERIFICATA E CHIUSA**: ANDROID → HTTP 400 `FAILED_PRECONDITION` (attestation), WEB → `UNPLAYABLE "The page needs to be reloaded"` (PoToken), TVHTML5/embedded → ERROR.
**Cosa ha risolto** (4 versioni, 3.5.55→3.5.58):
1. Hook di **`JSON.stringify`** invece del solo wrapper `fetch`: il body del player request si costruisce li'. Misurato nel browser reale: `flagInjected 0` contro `flagInjectedStringify 1`.
2. **Cold-load**: al primo caricamento `ytInitialPlayerResponse` arriva inline nell'HTML e non c'e' nessuna richiesta da intercettare. Restituendo un oggetto senza `streamingData` il player e' costretto a richiederlo, e quella richiesta passa dai nostri hook. NON si restituisce `undefined` (rompe chi legge `.videoDetails`, dimostrato da un test).
3. **Qualita' forzata a 144p durante l'annuncio**: il 16x non salta l'annuncio, lo SCARICA — meno byte, attesa piu' breve. E' la leva che ha attaccato il sintomo.
4. **Ricarica di soccorso** (`loadVideoById`) se l'annuncio resiste oltre 1,5s, max 2 per videoId.

- [x] **DEPLOY 3.5.58** — pubblicata su CWS e AMO (commit `746cbb9`). Poi 3.5.59 su AMO e sito.
- [ ] *(opzionale)* Chiedere all'utente `window.__adoffYtDiag` ora che funziona, per sapere **quale** meccanismo ha agito (`coldLoads`, `adReloads`, `flagInjectedStringify`) e proteggerlo da regressioni future.

## ✅ RISOLTO 04/08 — audit riga per riga: due bypass del gate Pro chiusi (v3.5.61)

Analisi integrale dei quattro core su richiesta dell'utente (`background.js` 1143 righe, `content.js` 735, `stealth.js` 1614, `popup-blocker.js` 248). Sei bug trovati, tutti confermati sul sorgente prima di toccare qualsiasi cosa.

**I due critici erano entrambi bypass reali del gate Pro, sfruttabili a costo zero:**
1. `content.js` leggeva l'attributo DOM `data-adoff-loaded` accettando **qualsiasi** valore, mentre il commento prometteva di confrontare il nonce `LOAD_NONCE` (generato e mai usato). Un sito che scriveva `<html data-adoff-loaded="x">` spegneva cosmetic filtering e gate Pro. Ora il gate vive su `window.__adoffContentLoaded` dell'ISOLATED world, che la pagina non può leggere né scrivere.
2. `isTrialActive()` in `content.js` aveva un fallback su `adoffTrialEnd`, scrivibile da DevTools: bastava rinnovarlo per avere Pro a vita. Rimosso — l'autorità è solo il token firmato ECDSA, come già faceva `background.js`.

**Lezione strutturale**: la stessa funzione esisteva in tre copie con tre comportamenti diversi. `background.js` era corretto, `content.js` no. I bug 1-2-3 nascono tutti da quella duplicazione.

- [x] Altri quattro fix: matching domini da `hostname.includes(d)` (rendeva `youtube.com.malware.tk` un sito "sicuro") a match esatto/suffisso con regex dedicata per `google.co`; `.bak` esclusi dal pacchetto (`adblock-rules.json.bak` era il 26% dello ZIP pubblicato, 41 KB su 156); `stop()` ripristinava 3 delle 6 proprietà scritte da `collapseElement`; changelog fermo alla 3.1.0 da 22 versioni.
- [x] Test anti-regressione `sviluppo/tests/test-security-invariants.js` (commit `b1c7842`): 58 asserzioni, Node puro, exit 1 se fallisce. Legge i **sorgenti reali** invece di duplicare la logica; per `matchDominio` estrae la funzione e la valuta con `new Function`. Validato con **mutation testing**: reintrodotti a mano i quattro bug, il test li ha colti tutti.
- [x] Pulizia `app/`: da **158 MB a 784 KB** (157 MB di `graphify-out` orfano — il canonico resta in `sviluppo/license-system/` — più `docs/chat` e i `.bak`).
- [x] `CLAUDE.md` allineato: il trial è **15 giorni** (`worker.js:641`), diceva 30 in due punti.
- [x] Release 3.5.61 su tutti i canali: CWS `publish OK` in review, Edge submission `202`, AMO `adoff-3.5.61.xpi` firmato, sito live con ZIP verificato in produzione (md5 identico al locale), Telegram `@adoffapp` msg 101 con card nuova. **Safari no**: serve Mac con Xcode.
- [ ] **Estrazione `src/shared/`** per deduplicare `isTrialActive`, `matchDominio`, `computeIntegrity` — oggi tre copie divergenti per tre target. È la cura vera, non l'ennesimo cerotto. *Expected outcome:* un solo punto di verità per funzione, test ancora 58/58. **Decisione dell'utente**, non ancora presa.
- [ ] Agganciare il test agli hook di pre-deploy, così che 58/58 rosso **impedisca** la pubblicazione invece di essere una buona intenzione.

## ✅ RISOLTO 03-04/08 — popunder su streaming-community.red (v3.5.60, chiuso a zero)

Root cause: il popup blocker viveva dentro stealth.js senza all_frames, quindi girava solo nel frame principale, mentre i popunder partono dall'iframe del player. Misurato con Playwright: top frame patchedOpen true, iframe patchedOpen false. Fix in tre mosse: estrazione in app/src/popup-blocker.js con all_frames true in MAIN world (commit e0df48e), regole DNR sul tag Monetag alla fonte llvpn.com rtmark.net ay267.com, numeri 929-931 (commit 82051ec), difese aggressive solo dentro gli iframe non fidati (commit 49c51f8).

- [x] Rilasciata la 3.5.60 su tutti i canali: CWS, Edge, AMO con adoff-3.5.60.xpi firmato, Cloudflare Pages, Telegram @adoffapp message_id 100.
- [x] Risolto il crash `TypeError Cannot redefine property ima` nello stub IMA, con try/catch e fallback (commit 2c733b1). Confermato sparito dalla console dell'utente.
- [x] Chiuso il buco per cui il fallback `window.open` uguale `safeOpen` dentro il catch non era protetto: i player anti-adblock rendono `window.open` read-only, l'eccezione risaliva e spegneva tutto il blocker (commit c7df18d).
- [x] Il presunto popunder residuo NON esisteva. La scheda che il banco di prova contava come pubblicitaria era `chrome-extension://.../src/onboarding.html`, cioè la pagina che l'estensione apre da sé all'installazione (background.js riga 637). La prova: senza estensione il contatore saliva 1, 2, 3 a ogni click, con estensione era già fermo a 1 dal primo click. Metrica corretta con commit c9b6973.
- [x] Misura finale ripetuta due volte con la metrica corretta: con estensione zero schede pubblicitarie e video che parte al terzo click, senza estensione tre schede (crn77.com, ke.ducatflapper.com). Suite test-popup-blocker.js dieci su dieci.

*Nessun bump di versione e nessun deploy sono seguiti alla chiusura del 04/08, perché il codice di produzione della 3.5.60 non è cambiato: l'unico file toccato è un test sotto sviluppo/.*

## ✅ RISOLTO 02/08 — il rule-feed remoto non arrivava a nessuno (v3.5.59)

Due difetti indipendenti e silenziosi. **Client**: `syncRemoteRules()` passava 35.143 regole a una sola `updateDynamicRules()`; la chiamata è atomica, sfondava il limite, falliva in blocco e `chrome.runtime.lastError` veniva ingoiato — misurato `adoffRemoteRulesCount` = 0 dopo 120 s, dynamic rules = 2. **Feed**: 35.000 regole su 35.143 avevano pattern regex dentro `urlFilter`, che vuole sintassi ABP → inerti. Fix: cap letto a runtime da `MAX_NUMBER_OF_DYNAMIC_RULES` (30.000, non i 5.000 di `..._DYNAMIC_AND_SESSION_RULES`), blocchi da 2.000, `lastError` loggato, throttle 6 h + `sviluppo/scripts/normalize-rules-feed.js` (29.000 regole valide, 7,3 → 5,1 MB, v`2026.08.02.1`). Misurato dopo: 29.900 regole in 3 s; `0019x.com` bloccato end-to-end da regola remota id 60143. Dettaglio: `CP_20260802_1840`.

- [x] **Generatore del feed corretto alla fonte** (commit `5da1a0a`). `convertPattern()` in `sviluppo/filter-lists/parse-adblock-to-dnr.js` costruiva regex e usava la chiave `trigger` invece di `condition`. Riscritto su `abp-urlfilter.js` (conversione + validazione in un punto solo): 132.300 regole, 97,1% ancorate con `||`. `build-rules-feed.js` rifiuta di scrivere se oltre il 5% degli `urlFilter` non è valido. Verificato in Chrome: 29.000/29.000 applicate, `0019x.com` bloccato dalla regola 177, **senza** `normalize-rules-feed.js` (che resta come difesa di riserva).
- [x] **Criterio di priorità per le regole tagliate dal cap** (`rule-priority.js`). Il taglio reale non era 6.111 ma 103.300 su 132.300. Selezione a quote decisa dall'utente: `allow` sempre dentro, 60% del budget alle liste curate, 40% alla continuità col feed live. Risultato: ALLOW 2/2, CURATED 17.399/25.737, LIVE 11.599/28.957, BULK 0/77.604.
- [x] **3.5.59 pubblicata su CWS** — la review di 3.5.58 si è chiusa: upload HTTP 200 `uploadState: SUCCESS`, publish HTTP 200 `status: OK`. Ora in review.
- [x] **Gate i18n sanato: da 774 hard failures a 0** (commit `cd6e011`, `68dd62b`). Bloccava *ogni* deploy del sito. 29 chiavi usate nell'HTML ma assenti dalla matrice + 1.139 celle mancanti in 14 lingue, tradotte a blocchi di 25 con validazione e retry (a 85 per volta il modello restituiva JSON malformato). Rimosse 7 chiavi `about.*` morte con valori corrotti (`">About me"`, zero riferimenti in `site/`). Audit post-traduzione: 5 anomalie su 1.139 celle, 2 corrette a mano (`ja premium.plus_vpn` era `.plus real VPN`, `hi vs.index.title` era rimasto in inglese), 3 sono termini che restano in inglese di proposito (GDPR, No-Log Commitment, P2P & Torrent Policy).
- [x] **Feed `2026.08.02.2` ONLINE.** Servito da adoff.app e verificato end-to-end sul percorso reale, senza isolamento di rete: `adoffRemoteRulesCount=29000` in 3,0 s, `0019x.com` bloccato. Backup del precedente: `sviluppo/archive/rules-feed-pre-generatore-20260802.json`.
- [ ] *(nota, non bloccante)* Restano 1.561 celle `untranslated` (warning soft), di cui 616 in `it`: preesistenti, il gate non le blocca.
- [x] **Edge: 3.5.59 pubblicata.** La causa del fallimento era l'autenticazione, non il product ID: HTTP 401 `API Key is Invalid` (un product ID errato darebbe 404, e infatti due chiavi diverse dai backup davano entrambe 401 con endpoint e header conformi alla doc Microsoft). Chiave rigenerata dall'utente da Partner Center e aggiornata in `~/.secrets/adoff-stores.env` (backup datato a fianco). Flusso completo: upload → `202` op `994c8219`, validazione `Succeeded`, publish → `202` op `2c313651`, esito `Succeeded`, submission `1152921505701564400`. **Nota igiene:** la vecchia chiave era in chiaro nel file di memoria `adoff-edge-api-credentials-2026-07-13.md`, rimossa.

## 🔴 BLOCCANTI (soldi / produzione)

- [ ] **Refill wallet VPNresellers: ~24,74 USD → 100+ USD.** A ~1,99 USD/account il saldo copre ~12 attivazioni (meno se i test ne hanno già consumate). Oltre soglia: **il cliente paga e il provisioning VPN fallisce** → incasso senza consegna. **Da fare PRIMA di aprire le vendite Premium, non dopo.** Non è più un blocco ai test (E2E Premium VPN già eseguiti e funzionanti, conferma utente 2026-07-28). Azione di pagamento dell'utente. Saldo verificabile via API (`VPNRESELLERS_API_KEY` già impostato sul worker `adoff-license-api`).
  - refs: `CP_20260729_1757` §To-Do 1, `PROGRESS-vpn-premium.md`

- [x] **Sessione SEO 02/08: commit `9fb1791` pushato e sito deployato** (verificato: HEAD `2b077c4` è a valle, ZIP 3.5.59 e feed `2026.08.02.1` live). Testo storico della voce:
  ~~Sessione SEO 02/08 in sospeso: commit `9fb1791` NON pushato e NON deployato.~~ Il lavoro è committato ma il sito live non ha nessuna delle 6 correzioni (canonical, robots.txt, meta description, FAQPage, title, llms.txt). Fino al deploy, i segnali di ranking restano divisi tra `/about` e `/about.html`. *Expected outcome:* `git push` + `bash sviluppo/scripts/deploy-site.sh` (MAI `wrangler pages deploy site/` diretto — bypassa il gate i18n), poi verifica canonical su 2-3 URL live.
  - refs: `sviluppo/seo-tools/.state/report_20260802.md`

---

## 🟠 RELEASE 3.5.54 — code residua

- [x] **Edge store.** Il 04/08 la 3.5.61 è passata dall'API senza errori, package operation Succeeded e submission accettata HTTP 202 con operation 671c3f94-2937-400b-bb21-599bdb132af4, usando la chiave rigenerata dall'utente. ~~Era fermo alla 3.5.54.~~ Storico: `POST /submissions/draft/package` dava **404** (product ID non accessibile → stantio o credenziali di un altro account Partner Center). Il 02/08, stesso endpoint e stesse credenziali, ha risposto **401** — quindi ora era l'autenticazione a cadere, non solo il product ID. Diagnosi: 404 e 401 su quell'endpoint puntano a cause diverse, il 404 è product ID non accessibile mentre il 401 è chiave scaduta da rigenerare da Partner Center, quindi prima di rigenerare qualcosa va annotato quale codice si è ottenuto.
- [ ] **Safari: build + submit Mac App Store.** Non eseguibile da Linux: serve Mac con Xcode (`xcrun safari-web-extension-converter`). Ferma da 3.5.38.
- [ ] **Monitorare review CWS/AMO della 3.5.54** (finestra 24-48h dal 31/07 16:41Z). In caso di rifiuto: leggere i log e rollback a 3.5.53.
- [ ] **Purge cache edge Cloudflare** (dashboard → Caching → Purge Cache, i token API sono scoped Pages/D1 e danno `10000 Authentication error`):
  - `adoff.app/adoff-safari.zip` — origine 3.5.54, cache serve 3.5.53 (self-heal ≤4h, probabilmente già rientrato)
  - `/CLAUDE.md`, `/.claude/settings.json`, `/graphify-out` — artefatti interni rimossi dall'origine ma ancora serviti dalla CDN con HTTP 200
- [ ] **Appendere la sezione Deploy** al vault `Memoria/progetti/chromeplugin/sessioni/sessione-20260731-overlay-ssa-v354.md` (riferimenti `[[amo-listed-sign-api-2026-07-31]]` + `CP_20260731_1846`).

---

## 🟡 TECNICI — decisioni e verifiche aperte

- [ ] **Decidere il destino dell'interruttore "Compatibilità piattaforme video".** Oggi il suo unico effetto pratico è **disarmare** la protezione su YouTube (Layer A + regole di rete off, ping annuncio sbloccati). La causa per cui era nato — regola 178 che bloccava lo stream del contenuto — **non esiste più** (rimossa in 3.5.41). Due opzioni sul tavolo: rimuoverlo, oppure promuoverlo a default (ipotesi **mai verificata**: con lo strip attivo il player potrebbe non marcare `ad-showing`, rendendo inerte il Layer B). Rischio concreto se resta com'è: l'utente lo lascia acceso dopo un debug e crede che AdOff sia rotto (già successo il 30/07).
- [ ] **Hash integrità licenza fragile (debito di design).** `adoffIntegrity` è calcolato su TUTTO l'oggetto licenza serializzato: qualunque campo aggiunto o aggiornato lo invalida. È la classe di bug che ha declassato tutti i paganti a Free (v3.5.44). Valutare un hash su sottoinsieme stabile (`rawKey`, `plan`, `expires`) escludendo i volatili (`lastValidated`, `devices`). **Decidere prima del prossimo cambio schema licenza.**
- [ ] **Regola 179** (`videoplayback*oad=`, Pro-only) mai verificata: stessa famiglia della 178 rimossa. Se lo schermo nero ricomparisse in Pro, è il sospetto numero uno.
- [ ] **`validate_site.py:46` ha un falso positivo su 233 file**: segnala "trial 15gg (ora 30)" mentre il prodotto reale fa **15** giorni (`app/src/background.js:13`, `constants.json`, `llms.txt`). È la regola del validatore a essere sbagliata, non il sito. Finché resta, inquina ogni run.
- [ ] **Il cron SEO gira nella directory sbagliata**: `~/Dropbox/…/ChromePlugin` (quasi vuota) invece di `/mnt/backup/…`. Conseguenze già misurate: keyword research fallita da **5 settimane** e `site_backup_20260802.tar.gz` generato **vuoto** (0 file). Backup reale ricreato a mano: `site_backup_20260802_real.tar.gz` (681 file).
- [ ] **`constants.json` è fermo a `version: 3.5.53`** mentre il manifest è 3.5.54. Non toccato di proposito: cambiarlo rigenera le 15 homepage per-lingua. Da allineare nel prossimo giro di build sito.

---

## 🟢 SITO / SEO / CONTENUTI

- [ ] **Cluster keyword gap: YouTube / Chrome / Android / Twitch / "gratis"** — 581 keyword raccolte, **80 gap** (query cercate dove il sito non appare). Dominante il cluster video. Da coprire con contenuto nuovo, non con tweak di title.
  - Da spingere (già in pos. 5-20): `adoff` (8,2 · 66 impr), `add off` (11), `ad off` (13,9), `adguard` (14,9), `ublock` (12,4)
  - refs: `sviluppo/seo-tools/.state/keyword_report.md`
- [ ] **4 pagine con testo italiano non tradotto nel markup**: `fr/license-guide`, `ru/license-guide`, `tr/license-guide`, `tr/adblock-detector`.
- [ ] **`mockup.webp` ha "v3.1.0" stampato dentro l'immagine** — da rigenerare.
- [ ] **GA4 historical data** — crescono col tempo, nessuna azione possibile.

---

## 🔒 CONGELATI (bloccati da dipendenze)

- **Premium FASE 2**: VPN mobile + Kill-switch + DNS Guard freemium — bloccato dal refill wallet.
- **Premium FASE 3**: SEO guide / FAQ AEO / analytics / anti-churn / GO-LIVE checklist — bloccato da FASE 2.
- **Premium FASE 3**: canali Telegram EN / email Pro / social / in-app — bloccato da FASE 2.

---

## ⛔ DO NOT — vincoli permanenti (consolidati da tutti i checkpoint)

- **MAI reintrodurre `video.currentTime =` in `activateYoutubeRuntimeKiller`.** Regola d'oro: 9 versioni di bug (3.5.46→3.5.51) nate dal seek. Rimosso in 3.5.52, approccio definitivo = solo `playbackRate=16` + click sul pulsante skip. Qualsiasi riga `currentTime =` che ricompaia in `stealth.js` è una regressione critica → revert immediato.
- **MAI merge di `feat/premium-vpn` su `main`.** `main` è il repo pubblico open-core (`github.com/eroslifestyle/adoff`), fermo a 3.5.36.
- **NON riattivare lo stall watchdog (Layer D)** — faceva seek.
- **NON rimuovere l'instant-skip (`playbackRate=16`)** — è l'unico fallback per gli annunci che superano il Layer A.
- **NON usare `wrangler pages deploy site/` diretto** — bypassa il gate i18n di `deploy-site.sh` e porta online artefatti interni. E quando si deploya, **serve `--branch main` esplicito**: senza, wrangler auto-rileva `feat/premium-vpn` e fa un deploy di preview, non production.
- **NON deployare senza OK esplicito dell'utente.**
- **MAI passare l'intero feed a una sola `updateDynamicRules()`** e **mai usare `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` (5.000) come cap**: la chiamata è atomica, fallisce in blocco e l'errore non emerge. Il valore giusto per regole safe block/allow è `MAX_NUMBER_OF_DYNAMIC_RULES` (30.000), letto a runtime. L'unico indicatore affidabile che il feed sia arrivato è `adoffRemoteRulesCount` in storage, non il fetch riuscito.
- **NON pubblicare `site/rules-feed.json` senza passarlo per `sviluppo/scripts/normalize-rules-feed.js`**: il generatore a monte emette pattern regex dentro `urlFilter`, che accetta solo sintassi ABP — regole inerti, zero errori visibili.
- **NON rimuovere Safari dalle pagine del sito**: `constants.json → browsers_coming_soon` non significa "non esiste", `adoff-safari.zip` c'è ed è scaricabile (guard `guard_safari.py`).
- **NON toccare `app/src/graphify-out/`** (84 MB nel posto sbagliato, fuori scope).
- **NON forzare il commit di `.claude/checkpoints/` con `-f`**: è in `.gitignore` per scelta del progetto.
- **NON rilassare le guardie di `translate_batch.py`** senza verifica dei tag HTML.
- **NON aprire le vendite Premium prima del refill wallet.**
- **MAI rimuovere il try/catch annidato attorno a `window.open = safeOpen` in `popup-blocker.js`**: i player anti-adblock rendono `window.open` read-only, senza quel try/catch l'eccezione risale e spegne TUTTO il blocker, proprio sui siti che si difendono.
- **NON applicare `configurable: false` su `window.open`**: valutata e rigettata il 04/08. Una volta corretta la misura i popunder erano già zero, quindi il rischio (TypeError a ogni redefinizione altrui, possibile rottura del rendering) non aveva alcun beneficio a fronte.
- **MAI aggiungere alla blacklist del Layer 1 i TLD usati anche da siti legittimi (.pro .store .shop .online .live .link .work .press)**: il Layer 1 è attivo anche sui siti sicuri, quindi un falso positivo rompe popup veri come login e pagamenti.
- **NON mettere `all_frames` su `stealth.js`**: farebbe girare IMA stub e logica video in ogni iframe, con regressioni sui player. Il popup blocker sta apposta in un file separato.
- **NON bloccare `v.vidxgo.co` con una regola di rete**: è il player, si romperebbe il video.

---

## ❌ FAILED APPROACHES — non riprovare

**Video / YouTube**
- **Seek su player MSE YouTube** (6 versioni di guardie: buffer-aware, source-detection, stable-ticks, preroll-reset). La causa era il seek stesso. Su MSE un seek è utile solo dentro `buffered.end`, ma la vera risposta è non seekare.
- **Guardia sul *cambio* di durata** per distinguere annuncio da contenuto: `ad-showing` viene marcato **prima** dello scambio di sorgente, quindi al primo tick il media montato è ancora il contenuto. `ad-showing` dice solo che il player è in modalità annuncio, **non quale sorgente sta suonando**.
- **Hardcoded `playbackRate = 1` in `onAdEnd`**: scartava la velocità scelta dall'utente (1,5x/2x). Fix in 3.5.54 con `savedRate`.
- **403 su `googlevideo.com`**: NON è un bug di AdOff. Sono su `itag=18` (formato progressivo 360p deprecato), YouTube lo rifiuta e il player passa al DASH. Chiuso come rumore — non investigare oltre.
- **Toggle pausa come test di isolamento** prima della 3.5.49: non fermava stealth.js, quindi tutti i test "in pausa" precedenti sono invalidi.

**Store / deploy**
- **`web-ext sign --channel listed`** → timeout infinito. Usare l'API REST diretta AMO (`POST /api/v5/addons/upload/` multipart con `channel=listed` + poll `GET /addons/upload/{uuid}/`).
- **AMO version create con `guid` nel path** → HTTP 405. Usare slug `adoff` o numeric id `3003287`. **AMO upload senza `channel`** → HTTP 400.
- **Upload CWS mentre la review precedente è aperta** → `ITEM_NOT_UPDATABLE`. Attendere la chiusura.
- **`GET /submissions/draft/package` su Edge** → 404: l'endpoint di stato **non esiste**. L'unico modo di sapere se il canale è libero è tentare l'upload.
- **Cache purge Cloudflare via `CLOUDFLARE_API_TOKEN` / `CF_API_KEY`** → `10000 Authentication error` (scope Pages/D1, non Zone.Cache Purge). Usare la dashboard.
- **Inventare env var/host per il deploy** (`CWS_CLIENT_ID` come extension id, host `site-server`, `AMO_GUID`): i nomi reali stanno in `~/.secrets/adoff-stores.env`, i comandi in `CLAUDE.md` §Deploy Rule.

**Sito / i18n**
- **Filtro `not_translatable` troppo aggressivo**: escludeva "Overview" → "Panoramica". Serve l'eccezione sui prefissi di pagina.
- **`data-i18n` su `<title>` gestito da `document.body`**: `<title>` sta in `<head>`, serve gestione esplicita in `applyTranslations`.

**Test**
- **Playwright con `channel:"chrome"` + `--load-extension`**: il Chrome di sistema non inietta content script in `world:MAIN`. Usare `chromium` bundled + `xvfb`.
- **Contare le schede aperte in Playwright senza escludere gli URL chrome-extension**: la pagina di onboarding che l'estensione apre da se' all'installazione viene scambiata per un popunder; e' costato un'intera indagine su window.open per un bug inesistente. Se il contatore e' gia' a N prima del primo click, quelle schede non le hanno aperte i click: guardare sempre l'URL.
- **Verificare i file generati solo con `node --check`**: i delimitatori markdown lasciati dal generatore passano il check di sintassi e poi falliscono a runtime con TypeError stringa vuota non e' una funzione. Serve anche un grep dei tre backtick.
- **Riprodurre i popunder di streaming-community.red su home o pagina del titolo**: non succede nulla, partono solo su /titles/<id>-<slug>/watching.html; e scaricare quella pagina con curl e' inutile, l'HTML servito e' pulito per cloaking su UA e cookie.

---

## ✅ FATTO — storico per release

### v3.5.54 — overlay SSAI + playbackRate (31/07)
- Diagnosi SSAI definitiva: il residuo ~20% di ad YouTube è **Server-Side Ad Insertion**, cucito nello stream DASH. `adPlacements` strippato, zero chiavi `ad[A-Z]` residue, gate Pro attivo. **Non strippabile dal JSON** — nessun adblocker MV3 può bloccarlo senza seek.
- `setSkipOverlay()`: `<div id="adoff-skip-ov">` nero brandizzato sopra `#movie_player` durante `ad-showing` (z-index 999999, pointer-events none). L'utente vede ~1s di nero invece dello spot. Zero seek.
- `savedRate`: cattura in `onAdStart`, restore in `onAdEnd` → 1,5x/2x preservati.
- Sync Chrome+Firefox+Safari (regione killer byte-identica), `test-ad-skip.js` 6/6, commit `8914ab8`.
- **Deploy**: CWS published · AMO public (reviewed 31/07 16:41Z, version 6386843) · sito production (`--branch main`) · Telegram msg 93.

### v3.5.45→3.5.53 — la saga YouTube (30/07)
- **Race condition Layer A** (3.5.45): lo strip di `ytInitialPlayerResponse` decideva **dentro il setter** (pochi ms dopo `document_start`) mentre il verdetto Pro arriva dopo `storage.get` + verify ECDSA (asincroni). Corsa persa quasi sempre → `adPlacements` intatti. **Non era una regressione: è una race che il codice ha sempre corso** — da qui l'intermittenza storica e il fatto che Playwright non la riproducesse. Fix: strip **pigro** al getter + canale sincrono `localStorage.__adoff_pro`. Test 7/7 validati per mutazione.
- **Toggle pausa non fermava stealth** (3.5.49): `content.js` scriveva il nonce prima di leggere `adoffEnabled`.
- **Uninstall URL mostrava JSON grezzo** (3.5.50): puntava all'API invece che a `adoff.app/uninstall.html`.
- **RIMOSSO IL SEEK** (3.5.52): da ~250 righe di logica a ~60, forma FadBlock pura.
- **Layer A strip ricorsivo** (3.5.53): pattern `ad[A-Z]` + `playerAds` + `midroll*`, profondità 6, `adaptiveFormats` preservato. La lista statica di 5 campi lasciava passare `adBreaks`/`adConfig`. **Utente conferma: funziona** — midroll -80%, preroll eliminati.

### v3.5.39→3.5.44 — schermo nero + bug critico licenze (29-30/07)
- **REGOLA 178 RIMOSSA** (3.5.41) — causa del nero 10-15s. `googlevideo.com/videoplayback*ctier=L`, **sempre attiva** (non era in `YT_AD_RULE_IDS`, quindi né Free né compatibilità la disattivavano): bloccava lo **stream del contenuto**, non la pubblicità (`ctier` = content tier). Misurato dai dati utente: **1573ms contro 36488ms**. Segnale storico ignorato: `79bd308` aveva messo una toppa `excludedInitiatorDomains:[paramountplus.com]` sulla stessa regola. Regole 144→143.
- **BUG CRITICO LICENZE** (3.5.44) — **ogni pagante declassato a Free a ogni avvio**. `revalidateLicense()` riscriveva `adoffLicense` aggiornando `lastValidated` **senza ricalcolare `adoffIntegrity`** → `content.js` la considerava manomessa. Girava a ogni avvio browser + daily alarm. Il pannello mostrava "PRO Lifetime" comunque perché legge la licenza senza passare dal gate. **È la causa di tutti i "gate Pro NON attivo" nei test video.**
- Instant-skip ripristinato (3.5.43), TypeError ogni 50ms su `skip?.offsetParent` (3.5.40), campo Account vuoto → email mascherata (3.5.42).
- Worker licenze deployato (`ac8cd555`): **trial 15 giorni LIVE** (era 30), pricing rework.
- **4 suite anti-regressione**, tutte estraggono il blocco reale dal sorgente e validate per mutazione: `test-license-integrity.js` 4/4 (T3 avrebbe intercettato il bug critico), `test-ad-skip.js`, `test-layer-d-watchdog.js` 7/7, `test-rules-no-content-block.js` 4/4.

### Audit forense sito (29-30/07)
33 bug catalogati (6 P0) — report `sviluppo/audit-reports/2026-07/REPORT-AUDIT-SITO-20260729.md`. Nav che routava a pagine runtime parziali → statiche `/{lang}/`; 48 pagine con CSS relativo (rendering Times New Roman); 3 bug in `adoff-i18n.js`; 7700+ traduzioni in 13 lingue (copertura 100%); `deploy-site.sh` `cmd_build` reso additivo (era una mina: -2000 chiavi/lingua); artefatti interni rimossi; sitemap rigenerato (547 URL, 0 morti); 417 pagine agganciate a `adoff-i18n.js`. Toolchain riutilizzabile in `sviluppo/scripts/audit/`.

### v3.5.38 — anti-detection (28-29/07)
Merge-accessor su `googletag`/`adsbygoogle`: i siti riassegnavano `window.googletag` cancellando lo spoof (1 chiave, `apiReady:false` = firma adblock riconoscibile). Ora 18 chiavi stabili. **Wall investing.com sparito** (confermato dall'utente) → root cause chiusa. Pubblicata su sito, CWS, AMO listed, Edge, Telegram (msg 89).

### SEO/AEO (02/08) — committato, non deployato
Canonical `.html` → extensionless su 38 pagine (GSC mostrava `/about` e `/about.html` indicizzati separatamente, ranking diviso); `ja/license-guide` canonical puntava alla root italiana; `robots.txt` `Disallow /*?lang=*` rimosso (impediva ai crawler di leggere il canonical già corretto); meta description duplicata rimossa su 24 pagine (`how-it-works` serviva IT ed EN insieme); +3 Q&A FAQPage su `block-video-ads` EN+IT; `llms.txt`/`llms-full.txt` allineati (143 regole, 3.5.54). 714 JSON-LD parsati, 0 rotti.

### Precedenti (consolidati)
Premium VPN provisioning nel webhook · checkout Stripe Premium + gating · badge Premium 3 livelli · VPN Policy page · sezione Premium in options · trial anti-crack ECDSA P-256 · `syncRemoteRules` riattivato · i18n 31/31 pagine, 2652 chiavi × 15 lingue · redesign sito light+dark · site restyle cleanup (20/07).

---

## 📎 Riferimenti

| Cosa | Dove |
|---|---|
| Checkpoint piu' recente (popunder chiuso 04/08) | `.claude/checkpoints/CP_20260804_0230.md` |
| Pagina vault popunder | `~/Obsidian/Memoria/progetti/chromeplugin/popunder-iframe-window-open.md` |
| Checkpoint rule-feed 3.5.59 | `.claude/checkpoints/CP_20260802_1840.md` |
| Sessione vault rule-feed | `~/Obsidian/Memoria/progetti/chromeplugin/sessioni/sessione-20260802-rulefeed-mai-applicato.md` |
| Checkpoint deploy 3.5.54 | `.claude/checkpoints/CP_20260731_1846.md` |
| Checkpoint saga YouTube | `.claude/checkpoints/CP_20260730_1645.md`, `CP_20260730_0225.md` |
| Checkpoint audit sito | `.claude/checkpoints/CP_20260730_2330.md` |
| Checkpoint publish 3.5.38 | `.claude/checkpoints/CP_20260729_1757.md` |
| Report audit sito | `sviluppo/audit-reports/2026-07/REPORT-AUDIT-SITO-20260729.md` |
| Report SEO settimanale | `sviluppo/seo-tools/.state/report_20260802.md` |
| Keyword gap | `sviluppo/seo-tools/.state/keyword_report.md` |
| Piano VPN Premium | `.claude/PROGRESS-vpn-premium.md`, `.claude/PLAN-vpn-dns-redesign.md` |
| Secrets store | `~/.secrets/adoff-stores.env` |
| Vault progetto | `~/Obsidian/Memoria/progetti/chromeplugin/` |
