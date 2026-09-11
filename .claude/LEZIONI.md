# LEZIONI — AdOff (estratte dai checkpoint)

> Sapere durevole da `.claude/checkpoints/` (168 file, mag–set 2026). Una lezione = una riga densa: il fatto, il perché, e fra parentesi il checkpoint di provenienza. Ripetuta in dieci checkpoint = scritta una volta sola. No date, no versioni come stati, no elenchi file.

---

## Muri delle piattaforme video

- L'auto-click su "Salta" sbatte contro il muro del trusted-event: un click sintetico ha `isTrusted=false` e viene rifiutato; solo il click reale skippa e l'estensione non può forgiare eventi fidati (CP_20260613_0211).
- `playbackRate > 16` ha un cap duro: Chrome risponde NotSupportedError (ad 2min = 7.5s a 16x) (CP_20260613_0000).
- La clean-fetch in-page dello streaming data dà UNPLAYABLE per PoToken, e il worker-proxy sbatte sullo stesso muro: il backoff del cold-load non è battibile client-side nel 2026, il server trattiene i byte (CP_20260613_0211).
- I client InnerTube alternativi (ANDROID/IOS/TVHTML5/WEB_EMBEDDED) per ottenere URL diretti sono chiusi da Google con attestation e PoToken (CP_20260802_1645).
- `seek-to-end` (`currentTime=duration`) su YouTube corrompe lo stato MSE (ad e contenuto condividono lo stesso `<video>`): il freeze 3.5.10 nasceva lì, e l'opacity-hide era il colpevole dello schermo nero (CP_20260507_2330, CP_20260613_0211).
- Il seek `video.currentTime =` nel runtime killer è la causa di nove versioni di bug di posizione: YouTube marca `ad-showing` PRIMA di scambiare la sorgente MSE, quindi `video.duration` a quel punto è ancora quella del contenuto; seek lecito SOLO con guardia su `videoDetails.lengthSeconds` (CP_20260730_1645, CP_20260819_1048).
- La guardia sul cambio di durata da sola non distingue annuncio da contenuto: serve il riferimento esterno `ytInitialPlayerResponse.videoDetails.lengthSeconds`, non lo stato precedente osservato (CP_20260730_1645).
- Dedurre "è SSAI" da una differenza di durata è sbagliato: con vero SSAI il player non marca nemmeno `ad-showing` (guardia invertita di 3.5.83, saltava dentro il contenuto) (CP_20260819_1048).
- Il fast-forward 16x non salta l'annuncio, lo scarica più in fretta: l'attesa è di rete, non di riproduzione; resta valido solo come ripiego quando non c'è riferimento di durata sul contenuto (CP_20260819_1048).
- `setPlaybackQualityRange(max, max)` congela la qualità e manda in stallo il player se l'annuncio non ha quella risoluzione: range sempre aperto verso il basso (`"tiny"`, max) (CP_20260802_1645, CP_20260819_1048).
- Alzare la qualità una sola volta per video è vanificito: YouTube riapplica la propria preferenza subito dopo; serve controllo continuo con throttle (CP_20260819_1048).
- Rimuovere `serverAbrStreamingUrl` per forzare formati progressivi è escluso con prova: 38 formati adattivi, zero con URL diretto — non esiste più una via non-SABR (CP_20260730_0225).
- Intercettare la costruzione di `window.Request` per iniettare il flag anti-SABR non serve: zero intercettazioni misurate, YouTube non passa da lì (CP_20260819_1230).
- Il cold-load non deve restituire `undefined` (come fa uBO): rompe chiunque legga `ytInitialPlayerResponse.videoDetails` senza guardia, player incluso; restituire un oggetto minimale coi soli metadati (CP_20260802_1645).
- Il cold-load disattivato va lasciato disattivato: riattivarlo causava 403 su googlevideo e degrado a 144p (CP_20260819_1230).
- I 403 su googlevideo.com sono rumore normale: sono su `itag=18` (formato progressivo 360p deprecato), YouTube lo rifiuta e il player passa al DASH; non è un bug dell'estensione (CP_20260730_1645).
- Ripristinare la qualità con `"auto"` non è un valore valido per `setPlaybackQualityRange` e lasciava il video a 144p permanenti (CP_20260802_1645).
- `JSON.parse+stringify` per modificare il body delle richieste InnerTube è bloccato da YouTube (locka stringify) (CP_20260508_0035).
- Il bypass SABR-backoff funziona solo su navigazione SPA, mai su cold load con URL diretto (CP_20260508_0035).
- YouTube non serve pre-roll a profilo anonimo pulito né in automazione: riprodurre un ad reale in Playwright non è utilizzabile per validare fix end-to-end; servono test isolati che simulano la sequenza `ad-showing` (CP_20260609_0754, CP_20260823_2202).
- Il video YouTube in Playwright headless non parte mai (autoplay policy, currentTime fermo): il test diag che forza Pro via nonce non prova né invalida il layer stealth (CP_20260811_0717).
- Il muro anti-adblock cambia spesso: il DOM killer usa l'euristica `*enforcement*` proprio per resistere ai rinomini del tag renderer (CP_20260619_1510, CP_20260620_1020).
- La soppressione del muro deve essere UNGATED (Free+Pro): il network-block è sempre attivo quindi il muro colpisce tutti; pro-gatarla la rompe quando trial/licenza è off (CP_20260619_1510).
- Rimuovere la regola 178 fu la scelta giusta: `ctier=L` non è più discriminante ad-vs-contenuto, la prevenzione resta via strip di `adPlacements` (CP_20260609_0754).
- Il gate Pro su YouTube va deciso a RESPONSE-time, non request-time: content.js conferma il Pro async spesso dopo il primo fetch `/player`, e al request-time si aveva passthrough silenzioso (CP_20260609_0754).
- `video.currentTime = target` su un player MSE che condivide l'elemento tra annuncio e contenuto produce: contenuto che parte da punto a caso, stall sul buffer, salti nel contenuto; sei versioni di guardie non hanno risolto perché la causa era il seek stesso (CP_20260730_1645).
- L'hardcoded `playbackRate = 1` in `onAdEnd` scartava la velocità scelta dall'utente: salvare `savedRate` prima dell'ad (CP_20260731_1812).
- SSAI è cucito nello stream server-side, non strippabile dal JSON: nessun adblocker MV3 può bloccarlo senza seek; l'overlay (nascondere all'utente) + fast-forward 16x è la massima difesa client-side (CP_20260731_1812).
- "Zero ads" non è raggiungibile al 100% sui link aperti direttamente: limite documentato, condiviso con uBlock Origin (CP_20260819_1230).
- Prime Video va in `PREMIUM_STREAMING` (stub IMA può rompere la SPA), non con hook fetch/XHR globali in stealth.js: quelli globali intercettano solo i pattern di detection (CP_20260802_1840).
- Lo stub IMA redirect dinamico senza `excludedInitiatorDomains` rompe player a pagamento: Paramount+ non partiva perché `requestStream()` non risolveva; ogni nuovo vettore di blocco IMA (statico o dinamico) deve replicare l'esclusione (CP_20260621_1248).
- Netflix richiede neutralità totale (zero ads in player): `NEUTRAL_SITES` in content.js con early-return PRIMA dello storage read + `netflix.com` in `STEALTH_EXCLUDED` su tutte e tre le varianti stealth (CP_20260624_1130).
- Il counter ads cosmetic deve includere le video ad skippate; il contatore network esclude tracking/analytics — non trattare le lamentele "ads_visible" degli utenti Free come bug (video-block era Pro-only) (CP_20260710_1610).
- I match `urlFilter` ancorati con `^...$` non matchano nulla (i pattern DNR usano `||` dominio): un test scritto così è vuoto e passa comunque (CP_20260730_0225).
- `|` dentro un `urlFilter` viene interpretato come anchor DNR (OR), non come separatore: 85 errori di validazione; usare array `domains[]` (CP_20260710_2025).
- Estrarre il dominio con `slice -2` produce `||co.uk^` e blocca TLD interi: serve `registrableDomain()` con allowlist di TLD multi-parte (CP_20260710_2025).
- `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` (5000) è il cap sbagliato per il feed remoto: `updateDynamicRules()` è atomica e fallisce in blocco con errore nascosto dal callback; il cap giusto è `MAX_NUMBER_OF_DYNAMIC_RULES` (30000) letto a runtime, batch da 2000 (CP_20260802_1840).
- Un feed arrivato non è un fetch riuscito: il feed con regex dentro `urlFilter` (che accetta solo sintassi ABP) è inerte e `adoffRemoteRulesCount` resta 0 senza che nessun errore emerga; l'unico indicatore affidabile è quel contatore in storage (CP_20260802_1840).
- Per testare un feed candidato serve isolare la rete: il service worker scarica il feed live e i match arrivano da quello; mappare `adoff.app` su `127.0.0.1` con `host-resolver-rules` (CP_20260802_2215).
- Attribuire un blocco a una regola leggendo `result.matchResults[0]` scambia le regole statiche per quelle del feed: leggere `matchedRules` filtrato per `rulesetId == "_dynamic"` (CP_20260802_2215).
- I regole-ID sono riservati a fasce: IMA redirect 50001/50002, whitelist 51000+, feed remoto 60000+; non collidere (CP_20260710_1610).
- La regola DNR `regexFilter` sulla sola forma del path su `main_frame` matcha anche profili utente legittimi (es. `github.com/SomeUser/12345`): è l'errore che causò lo schermo nero (CP_20260804_2210).
- Le regole block su `videoplayback` senza marcatore esplicito di annuncio (`oad=`, `adformat`, `/ad/`, `ad_break`) bloccano il contenuto: il test `test-rules-no-content-block` le respinge (CP_20260730_0225).
- Gli ad-key strip usano pattern `/^ad[A-Z]/` (`isAdKey()`), non lista statica: i nuovi campi YouTube vengono intercettati automaticamente (CP_20260730_1645).
- Il canale flag compatibilità e il verdetto Pro passano da `localStorage` (`__adoff_vc`, `__adoff_pro`), non da `chrome.storage`: stealth.js gira a `document_start` e una `storage.get` asincrona arriva troppo tardi (CP_20260730_0225, CP_20260730_1645).
- L'istinto "gate Pro lento, stealth parte tardi" era falso: il nonce era già presente al primo tick e a 170ms `googletag` aveva già 18 chiavi; una firma oggettiva misurata guida il fix anche quando il sintomo non è riproducibile (CP_20260728_2204, CP_20260729_1757).

## Popunder e difesa finestre

- Scaricare `watching.html` con curl restituisce HTML pulito: c'è cloaking su User-Agent e cookie, il tag pubblicitario lo ricevono solo i browser reali — quel metodo di verifica inganna (CP_20260804_0230).
- I popunder si riproducono SOLO sulla pagina `watching.html`, mai su home o pagina titolo: riprodurre nel posto sbagliato dà "non esiste" (CP_20260804_0203).
- Bloccare i domini di destinazione dei popunder è inutile: Monetag li ruota di continuo (tre suffissi diversi in una sessione); si blocca il tag alla fonte e il caricatore per NOME DEL FILE, non per dominio (il publisher lo serve dal suo stesso dominio) (CP_20260804_0203, CP_20260808_2027).
- La corrispondenza link-cliccato ↔ finestra-aperta è il criterio universale anti-popunder: non dipende da liste, domini o classi (CP_20260804_2210).
- Patchare solo `window.open` del documento principale è aggirato dal realm dell'iframe appena creato: la protezione va estesa ai contesti figli (è la sola cosa che ferma davvero le finestre, presidiata dal TEST 11) (CP_20260809_1840).
- La superficie da proteggere non è la funzione di apertura ma il punto in cui il contesto figlio viene consegnato: una funzione sostituita protegge un solo contesto, ogni iframe nuovo ne porta una intatta (CP_20260808_2027).
- `configurable:false` su `window.open` è stata valutata e RIGETTATA: TypeError a ogni ridefinizione altrui, possibile rottura del rendering, zero beneficio (CP_20260804_0230).
- `stopPropagation` nella difesa anti-overlay toglie il click ai listener del player; rendere no-op `stopPropagation` per tutti i click è troppo rischioso (modali/dropdown): il fallback `play/pause` mirato sul video è l'alternativa che funziona (CP_20260804_0203, CP_20260809_1840).
- I TLD "suspicious" (`.pro .store .shop .online .live .link .work .press`) in blacklist Layer 1 danno falsi positivi su popup legittimi: il Layer 1 gira anche sui siti sicuri, non aggiungerli (CP_20260804_0203).
- Le valvole `isSafeTargetHost` e `isSafeSite` (SAFE_SITES: autenticazione, pagamento) vanno tenute: senza, si rompono login federato e checkout (CP_20260804_2301).
- Restituire il gesto quando è arrivato in fondo alla propagazione produce doppia azione (video parte e si ripausa); il meccanismo di riemissione del gesto causava il 4° click sul sito reale, rimosso (CP_20260809_1840).
- `all_frames` sull'intero stealth.js fa girare IMA stub e logica video in ogni iframe con regressioni sui player: popup blocker in file separato, iniezione mirata (probe leggero ovunque, stub pesante solo dove c'è player) (CP_20260804_0203, CP_20260804_2301).
- Aggiungere permessi `scripting`/`webNavigation` al manifest disabilita l'estensione a TUTTI gli utenti installati finché non riaccettano: iniettare via risorsa accessibile invece (CP_20260804_2301).
- `try/catch` annidato attorno a `window.open = safeOpen` va tenuto: senza, il blocker si spegne sui player anti-adblock (CP_20260804_0230).
- Nessuna difesa è "provata" finché non è misurata sul PACCHETTO COSTRUITO: i sorgenti non bastano e i nomi nel pacchetto sono offuscati, cercarli come testo non prova nulla (CP_20260808_2027).
- Quando un intervento corretto non cambia l'esito sul campo, la domanda non è "come rafforzarlo" ma "viene invocato?": censire i meccanismi invece di ipotizzarli, il colpevole emerge per esclusione (CP_20260808_2027).
- I click multipli per avviare il video erano comportamento del SITO (3 con e senza estensione): cercare interferenze dell'estensione lì manda a caccia di un bug inesistente (CP_20260804_0203).
- Le regole di rete vanno appuntate a famiglie di domini, mai a istanze; esiste un test apposto (TEST 9) che fallisce se si riappuntano alla famiglia numerata (CP_20260804_2301).

## Stealth e anti-detection

- Il nonce `data-adoff-stealth` in MAIN world e lo stealth ISOLATED early-return: i due mondi hanno gate separati; la guardia anti-doppia-istanza sta su `window` dell'ISOLATED world, non su un attributo del DOM (la pagina lo controlla) (CP_20260804_0451).
- Un fallback su `adoffTrialEnd` dentro `isTrialActive` è forgiabile da DevTools: rimosso dai gate di content.js e background.js; resta solo in license-client.js dove governa display, non abilitazione (CP_20260804_0451).
- `hostname.includes(d)` per confrontare domini accetta `google.co.evil.tk`: usare `host === d || host.endsWith('.' + d)`; e `google.co` con endsWith puro romperebbe i domini nazionali — regex dedicata (CP_20260804_0451).
- Scrivere `adoffLicense` a mano per forzare Pro nei test non funziona più dopo il fix integrity: senza `adoffIntegrity` coerente il gate declassa a Free (CP_20260804_2210).
- Il toggle pausa non fermava stealth.js: il nonce veniva scritto prima di leggere `adoffEnabled`, quindi i test "in pausa" non erano validi (CP_20260730_1645).
- Non duplicare a mano la lista dei nomi di piano: `adoffPlanTier()` è la funzione canonica (duplicata identica nei 3 target, presidiata da test di consistenza con centinaia di asserzioni); è anche l'unico punto da toccare per reintrodurre un paywall (CP_20260819_1048, CP_20260903_2352).
- Il sistema Trial/Licenza/Stripe vecchio resta nel codice DORMIENTE di proposito (token ECDSA, `/checkout`, `adoffLicense`): toccare solo i testi, mai la logica del gate — reverting `adoffPlanTier()` riattiverebbe il paywall silenziosamente (CP_20260903_2352).
- Il controllo d'integrità non governa più l'accesso: fingersi Pro non dà nulla se è tutto gratis, mentre spegnere le difese colpiva l'utente legittimo con storage corrotto (CP_20260820_2015).
- Il test di sicurezza `test-security-invariants.js` va eseguito PRIMA di ogni deploy, non dopo (CP_20260804_0451, CP_20260822_0009).
- Gli ID CWS installati da ZIP differiscono da quelli dello store (i manifest non hanno campo `key`): il review-url usa `CWS_ITEM_ID` hardcoded, non `chrome.runtime.id` (CP_20260822_0009).
- La cache-buster `?v=` sugli script non basta se un service worker è cache-first sull'HTML: pinnava gli script vecchi; bumpare `VERSION` in sw.js (CP_20260607_1456).
- Lo stealth su Firefox è versione ridotta (no `world: "MAIN"` nativo, iniezione via `<script>` tag): non copiare stealth.js Chrome/Safari sopra Firefox pensandolo identico (CP_20260624_1130).

## i18n e traduzioni

- La matrice `_matrix.json` client-side per le prose è un SEO-killer: il contenuto (es. 4561 parole) iniettato via JS sparisce dall'HTML statico ed è invisibile a Google e alle AI; le prose devono restare baked (CP_20260621_1035).
- L'i18n del sito è a due binari centralizzati: matrice (pagine i18n-driven) + master gap-landings/prose (prose baked); i `<lang>.json` di `site/i18n/` sono GENERATI da `_matrix.json` e non vanno editati a mano (CP_20260621_1035, CP_20260820_2015).
- L'HTML delle pagine prose si rigenera dai master in `sviluppo/seo-tools/.state/prose/`: editare l'HTML a mano in `site/` viene sovrascritto al prossimo apply; e i master sono FUORI da git (gitignore) — l'unica rete di sicurezza è il backup (CP_20260621_1056, CP_20260821_1730).
- Centralizzare le prose con round-trip bs4 produce 142 righe di diff (riscrive meta/self-closing/formatting): la via è la sostituzione di stringa esatta con template byte-fedele e verifica round-trip EN byte-identico (CP_20260621_1035).
- Classificare una lingua come "shared template" sul conteggio-nodi dà falsi positivi: solo il round-trip byte-identico reale decide; dove le lingue divergono strutturalmente (de/ar/zh) restano template per-lingua (CP_20260621_1056).
- Le lingue driftano anche oltre la traduzione (cache-buster `?v=` diversi tra EN e le altre): le versioni erano generate in momenti diversi (CP_20260621_1035).
- Le traduzioni di massa in una sola chiamata restituiscono JSON malformato o vuoto: blocchi da ~25 con validazione e retry (CP_20260802_2215).
- LLM locale (gemma) per traduzione di massa: 16s/batch, wrappa in ```json, timeout — scartato; Claude Haiku con metodo text-node (tag verbatim) è il motore (CP_20260608_0821).
- I modelli locali gen_local inventano cifre: le prose sono dense di numeri/prezzi, ogni ritraduzione di massa va verificata contro `site/data/constants.json` (CP_20260621_1035).
- I claim pubblici vivono su TRE strati (dizionari per-lingua, template `_template*.html` con testo scritto a mano FUORI dall'i18n, pagine scritte a mano): pulirne uno solo non serve a niente — il paragrafo prezzi riscritto a mano nei template ricompariva a ogni rigenerazione (CP_20260821_1730).
- Un find&replace cieco sui sorgenti riscrive i nomi delle chiavi `data-i18n` (identificatori, non testo) e corrompe stringhe ("1 orao", "Free for frees"): mai sostituzioni testuali cieche (CP_20260820_2015).
- Riscrivere interi JSON di traduzione con un subagente ha perso 1033 chiavi: usare sostituzioni per chiave, MAI riscritture integrali (CP_20260821_1730).
- Cancellare chiavi i18n "inutilizzate nella loro cartella" è fatale: ogni dizionario serve OGNI pagina via `?lang=xx` (un subagente ne cancellò 524, 132 erano in uso); verificare l'uso su TUTTO il sito, HTML e JS (CP_20260906_2115).
- Rinominare una chiave i18n mentre se ne corregge il valore (`features.144_*`→`features.180_*`) rompe il binding in 15 lingue: non rinominare mai (CP_20260906_2115).
- In italiano il runtime i18n NON sostituisce il testo — l'HTML è la sorgente italiana: ogni testo italiano aggiornato in matrice va aggiornato ANCHE nell'HTML (CP_20260820_2320).
- La fonte di verità visibile di un sito i18n è il DIZIONARIO, non gli HTML: 72 conteggi stantii erano lì, invisibili a un controllo solo-HTML (CP_20260906_2115).
- `data-i18n` su `<title>` non funziona da document.body: `<title>` sta in `<head>`, serve gestione esplicita (CP_20260730_2330).
- Gli elementi con HTML interno vanno su `data-i18n-html`; e convertire `data-i18n` in `data-i18n-html` senza mettere il markup nel valore del dizionario fa passare il check ma il contenuto sparisce (`innerHTML` prende dal dizionario) (CP_20260719_2130, CP_20260911_1200).
- Non inserire `<a>` dentro elementi con `data-i18n` (durante una riparazione produssero anchor annidati): il markup passa dal dizionario (CP_20260906_2115).
- La whitelist `?v=` delle versioni di adoff-nav/footer/i18n.js va standardizzata su valori GIÀ verificati live, non generati nuovi: cache-fredda = nuovo problema (CP_20260822_1900).
- L'i18n dell'estensione (`app/src/i18n.js`) e l'i18n del sito (`site/i18n/_matrix.json`) sono sistemi SEPARATI: non confonderli (CP_20260709_1805).
- `detectLang`: il browser/localStorage deve vincere sull'attributo `<html lang>` della pagina, altrimenti un utente IT su root EN resta bloccato (CP_20260607_1456).
- Il validatore i18n deve scansionare anche `adoff-nav.js`+`adoff-footer.js`, o le chiavi usate solo in JS mostrano il default hardcoded in tutte le lingue (CP_20260607_1456).
- sed/globbing sui JSON di 15 lingue non cattura le varianti localizzate ("30 jours/Tage/días"): serve traduzione per lingua, non regex globale; e "30 giorni" referral (+15gg) e "30 giorni" garanzia rimborso sono legittimi e distinti dal trial (CP_20260718_1720, CP_20260720_2015).

## SEO e contenuto

- `_redirects` di Cloudflare Pages matcha solo il PATH, non l'hostname: il 301 www→apex scritto lì non funziona (deployato, www dava ancora 200); serve Redirect Rule di zona — i redirect per path invece funzionano (leak GitHub risolto con indirezione `/r/*`) (CP_20260906_2115, CP_20260911_1200).
- L'apex adoff.app non si aggiorna con `wrangler pages deploy`: far fetchare al worker da `master.adoff-site.pages.dev` (alias production sempre aggiornato) — e la console admin va deployata con `--branch master` (CP_20260712_1851, CP_20260906_1140).
- `wrangler pages deploy` senza `--branch main` dopo un worktree su feature branch produce un deploy di PREVIEW, non production: il production branch è `main` (CP_20260715_0030, CP_20260731_1846).
- Deployare SEMPRE via `sviluppo/scripts/deploy-site.sh`: gira i gate i18n (apply-all/check-all, validate), il critical CSS e il leak-check prima di pubblicare; `wrangler pages deploy` diretto li bypassa (CP_20260730_2330, CP_20260804_0451).
- La crescita SEO = autorità off-page + consolidamento, NON nuove pagine: la creazione settimanale di landing era thin-content, ora bloccata da sprawl_guard; l'AEO gap era autorità (retrieval_hit 0/6), non contenuto (CP_20260614_1519, CP_20260617_1310).
- Gli audit con regex order-sensitive sui meta tag producono falsi "mancanti" (attributi riordinati): parsing order-agnostic; e il grep per-riga su JSON-LD multiriga dà falsi negativi — match line-agnostic (CP_20260621_1233, CP_20260621_1348).
- Il generatore aggiunge " | AdOff" (9 char) al `<title>`: il budget reale del campo master è 51, non 60 (CP_20260621_1233).
- `render()` usa replace-first: non riutilizzare lo stesso placeholder per nuovi blocchi schema (CP_20260621_1233).
- dateModified si bumpa SOLO sulle pagine realmente cambiate: anti fake-freshness (CP_20260621_1233).
- Il preview `*.pages.dev` è noindex: un Lighthouse SEO basso sul preview è artefatto (CP_20260621_1330).
- Preload font da solo non è il fix di LCP: il render-blocking era style.css; e `@font-face` con URL relativi nel critical inline dà 404 su pagine in sottocartella — URL assoluti (CP_20260621_1330).
- CSS specificity: `.compare-yes` (0,1,0) perdeva contro `.compare-table td` (0,1,2) — serviva `.compare-table .compare-yes` (CP_20260608_1540).
- `.reveal` con opacity:0 senza guard nascondeva il contenuto se JS non partiva: serve body-class + safety-net (CP_20260715_0030).
- Fake testimonials e numeri finti sono bannati (honesty pivot): solo dati reali verificabili; anche il grafico stats mostra solo i contatori veri, non curve demo (CP_20260713_1900, CP_20260714_2145).
- Non toccare i prezzi dei CONCORRENTI nelle pagine di confronto: sono reali e verificabili, il confronto è legittimo (CP_20260820_2015).
- Le chiavi `about.*` con valori corrotti sono state rimosse invece che tradotte: zero riferimenti nel sito (CP_20260802_2215).
- L'identità stabile di un finding SEO non è il suo id (`sha1(area|title|primo_file)` — cambia se il fix tocca il file) ma la coppia (area, title) (CP_20260911_1200).
- Riscrivere la prosa per far tacere una regex dell'audit è la cura peggiore del male: si corregge il check e si aggiunge il test di regressione (CP_20260911_1200).
- Content-Type iniettato via JS = invisibile ai motori: vale anche per `llms.txt` — le Q&A testuali sono ciò che gli LLM citano, non accorciarlo (CP_20260621_1348).
- robots.txt: replicare i Disallow di `*` in ogni blocco bot (AI/search) perché i blocchi per-bot li ignorano; gli "Allow per-bot duplicati" erano falso positivo del grep che filtrava le righe User-agent intermedie (CP_20260621_1233).
- llms.txt e AEO: il primo paragrafo answer-box va bene ma le FAQ vanno <80 parole con prima frase <30 — pattern per LLM extraction (CP_20260703_0136).

## Store e distribuzione (CWS, AMO, Edge, Safari)

- CWS `ITEM_NOT_UPDATABLE` finché la versione precedente è in review: non c'è workaround, si aspetta la chiusura (CP_20260620_1020, CP_20260729_1757).
- `PKG_INVALID_VERSION_NUMBER` = la versione non è superiore all'ultima pubblicata: verificare sempre la dashboard CWS prima del bump (CP_20260624_1130, CP_20260714_2145).
- Il bump va fatto nel manifest PRIMA del build: upload con manifest vecchio = PKG_INVALID_VERSION_NUMBER e build da rifare (CP_20260714_2145).
- Edge API v1.1 (ApiKey scheme): la v1 OAuth è ritirata dal 31 Dic 2024; e l'API NON espone GET di stato submission — `GET /submissions` e `GET .../draft/package` rispondono sempre 404; l'unico modo di sondare il canale è tentare upload/publish e leggere l'errorCode (CP_20260729_1757, CP_20260731_1846).
- Edge 404 ≠ 401: se fosse la key scaduta si avrebbe 401; il 404 sul product indica product ID stantio o credenziali generate sotto altro account Partner Center — non rinnovare la chiave per un 404 (CP_20260731_1846).
- Edge: upload 202 non conferma il publish — l'operazione è async, va pollata (e il path corretto dell'operazione package è `.../submissions/draft/package/operations/$OP`) (CP_20260527_1250, CP_20260714_2145).
- Edge: non pubblicare una nuova versione mentre la precedente è in review (`InProgressSubmission`) — serve annullare l'invio dal Partner Center, azione solo manuale (CP_20260601_2059, CP_20260703_0555).
- Il retry automatico Edge ogni 2h è deliberato: "tentare È il check" dato che l'API non è interrogabile; non ridurre la cadenza né spammare retry manuali (CP_20260728_2245).
- AMO: "This upload has already been submitted" dopo un errore di rete NON significa fallimento — la submission è valida, NON ri-buildare/ri-bumpare (CP_20260621_1248).
- AMO consuma il numero di versione anche sul canale unlisted/listed già caricato: "Version already exists" — serve sempre un numero nuovo (CP_20260728_2204).
- `web-ext sign --channel listed` va in timeout infinito (polla una firma che non arriva): usare l'API REST AMO diretta (upload + poll auto-crea e auto-approva la versione); `web-ext sign --timeout 200` è comunque troppo corto (CP_20260620_1020, CP_20260731_1846).
- AMO write API ha throttle duro per-account (attese da 800s a 3400s): max ~3 chiamate prima del 429, rispettare l'attesa riportata (CP_20260601_2059).
- AMO JWT: `exp - iat` deve essere ≤ 300s, altrimenti "JWT exp is too long" (CP_20260611_1215).
- AMO upload senza `channel` → 400: specificare sempre `channel=listed`; e il version create usa slug `adoff` o numeric id nel path, non il guid (405) (CP_20260731_1846).
- Le rotte `/en/*` del sito non esistono per premium/pricing/vpn-policy: esistono solo come pagine root (CP_20260718_1720).
- Safari: distribuzione solo via Mac + Xcode (`safari-web-extension-converter`); nessun ambiente = canale sospeso; e non buildare `.app` Safari da Windows/Linux (binari macOS solo su Mac) (CP_20260509_0020, CP_20260823_1529).
- Dichiararsi "non-trader" su CWS vendendo via Stripe è misdeclaration con rischio takedown: NON riproporre senza decisione esplicita dell'utente (CP_20260613_0451).
- Il CWS OAuth consent screen DEVE stare in "Production": in "Testing"+External Google revoca i refresh token dopo 7 giorni (invalid_grant) (CP_20260507_2330).
- Loghi di terze parti MAI in icone/screenshot/asset dello store (rischio takedown CWS); ammessi in testo marketing e (deroga) negli asset social/Telegram (CP_20260617_1024, CP_20260714_2145).
- Log di review store: non ri-pubblicare per lo stesso fix già live/in review — il nuovo upload duplica la submission (CP_20260811_0717).
- Le review CWS mostrate dagli scraper includono i competitor con star ratings ("You might also like"): scope stretto su `[aria-label*="Reviews"]` + filtro NOISE_NAMES, mai fallback su body (CP_20260528_0621).
- Il Google consent wall blocca lo scraping CWS senza gestione: cliccare "Reject all" (con varianti i18n) prima di contare le recensioni (CP_20260528_0621).

## Infrastruttura Cloudflare (Pages, Worker, KV, D1, token e permessi)

- I token CF in `~/.secrets/adoff-stores.env` sono scoped (D1/Pages/tunnel a seconda dell'epoca): MAI usarli per il worker deploy — serve OAuth `wrangler login` con `workers(write)`, e prima del deploy fare `unset` delle var CF conflittuali (CP_20260620_1020, CP_20260712_2015).
- `source adoff-stores.env` prima di wrangler è auto-sabotaggio: reintroduce `CLOUDFLARE_API_TOKEN` che rompe l'OAuth; il deploy Pages invece vuole il token + `CLOUDFLARE_ACCOUNT_ID` esplicito (e `set -a; source; set +a`, non source secco) (CP_20260528_0621, CP_20260624_1130).
- `wrangler kv key put/get/delete` senza `--remote` scrive nel KV LOCALE (miniflare): sembra no-op sul vero; e in wrangler v4 `kv key put` non supporta nemmeno `--remote` — workaround: endpoint sync nel worker o REST PUT diretta (CP_20260610_1422, CP_20260713_0535).
- `wrangler kv key put` a quota read KV satura scrive GARBAGE mentendo "Uploaded" (fa una read prima del put): usare REST PUT diretta con oauth_token (CP_20260712_1851).
- `wrangler kv key list` mostra poche chiavi per paginazione CLI: il KV non è vuoto, `KV.list()` dal worker vede tutto (CP_20260713_0535).
- KV ha consistenza eventuale (~60s): le letture subito dopo una scrittura possono essere stale — routing refund su KV fallback leggeva il topic sbagliato (CP_20260602_0947).
- `checkRateLimit` deve restare in-memory: era il write/read-hog che saturava la quota KV; sessioni su D1 (durevole) + cache edge (path caldo zero-read) (CP_20260712_2015).
- D1 è la fonte di verità, KV snapshot per lettura veloce (CP_20260712_0605).
- `wrangler pages deploy --skip-caching` è obbligatorio: senza, "0 files uploaded" perché l'hash cached dice unchanged (CP_20260710_1610).
- `wrangler d1 execute` con comando inline+quoting JSON si rompe: usare `--file <sql>`; e su DB locale senza `--remote` colpisce il DB locale, non la remota (CP_20260712_2015, CP_20260712_0926).
- `wrangler tail` vuole il nome POSIZIONALE (`wrangler tail adoff-license-api`), il flag `--name` non esiste; output JSON multiriga da parsare con `raw_decode` in loop (CP_20260906_1105).
- `CF_API_TOKEN` non ha permesso Zone.Cache Purge: il purge cache va fatto dal dashboard (CP_20260714_2145, CP_20260731_1846).
- Cache edge `immutable` POISONING: curlare `?v=NEW` subito dopo deploy, prima che l'origine propaghi, cacha il contenuto VECCHIO sotto la chiave nuova per sempre; bumpare a versione fresca e attendere ~30s (CP_20260608_1540).
- Le early-route del fetch handler devono fare `return handler(...)` diretto, non `withCors(handler(...))`: `withCors` è definita dopo → TDZ → Cloudflare error 1101 (CP_20260602_0947).
- `printf "$VAR" | env ... bash -c 'wrangler secret put'` carica un secret VUOTO (le var del file secrets non sono export-ate, `$VAR` non sopravvive al child): fare source nella shell padre e pipe diretta (CP_20260605_1452).
- Le route admin-OAuth NON devono stare sotto `/admin/...`: il gate `isAdminEndpoint` (path-prefix) le bloccherebbe (CP_20260605_2154).
- Un deploy worker va prima provato con `npx wrangler dev --local` + curl sulle rotte: `node --check` passa anche con errori di inizializzazione che rompono TUTTE le rotte in produzione; rollback con `npx wrangler rollback <version-id> --yes` (CP_20260820_2015, CP_20260820_2320).
- `CF Pages serve lo static file PRIMA di `_redirects`: i redirect di path singoli vanno dentro il file HTML (JS in testa) (CP_20260610_2032).
- Il deploy del sito pubblica l'INTERA cartella: controllare `git status`/`git diff` sul working tree prima, o si pubblicano modifiche preesistenti non intenzionali di altre sessioni (CP_20260822_1900).
- Il worker è condiviso: non deployarlo senza verificare cosa altro è in coda (accumula commit non rilasciati di sessioni parallele); prima di ogni deploy confrontare il locale col comportamento live su un valore osservabile (CP_20260730_0225).
- Il deploy worker via API REST/d1-token dà auth 10000: `wrangler deploy` bypassa la REST e usa l'endpoint interno con OAuth (CP_20260712_0926).
- La console admin è servita da Pages fetchata dal worker con cache 300s: dopo deploy, aspettare o sapere che `/admin/seo-agent` mostra stato vecchio per ~60s — non è un bug (CP_20260911_1200).
- `GET /admin/seo-reply` CONSUMA la risposta alla lettura: un controllo diagnostico ha "mangiato" l'OK dell'utente prima che il watcher lo vedesse (CP_20260906_2115).
- Il bypass `turnstileToken="extension"` sul `/ticket` è BY-DESIGN (l'estensione non può renderizzare widget, protetta da rate-limit IP): non confonderlo con una vulnerabilità (CP_20260528_0621).
- Il widget Turnstile soft-fail (error-callback + timeout → send senza token) non funziona: CDN cache immutabile + race; soluzione vera era rimuovere Turnstile dalla chat (il rate-limit basta) (CP_20260602_0932).
- Ogni pagine admin legacy è un file di produzione: `site/panel.html` (54KB admin standalone) quasi sovrascritto — MAI usare nomi di file esistenti per file nuovi (CP_20260712_1851).
- `admin.html` in license-system e `admin-console.html` in site vanno modificati IN COPPIA (CP_20260823_2202).

## Fornitori, pricing e pagamento (storico in parte)

- VPNresellers: fattura $1,99/UTENTE (fino a 10 connessioni), non $1,99 × device; l'API non espone GB/account (solo balance) quindi cap banda = solo clausola ToS; auth via Bearer, non basic; endpoint `/servers`, `/profile`, `/accounts` (`/account/list` non esiste) (CP_20260714_0700, CP_20260714_VPN_SPRINT2).
- La VPN non può essere un'estensione browser instradante: chrome.proxy vuole proxy HTTP/SOCKS e VPNresellers dà solo WireGuard/OpenVPN/VLESS (CP_20260714_0700).
- No lifetime con VPN: una tantum contro costo ricorrente = perdita garantita (CP_20260714_0700).
- La VPN non va nel trial/referral/Free/Pro: solo tier Premium pagante; aprire vendite prima del refill wallet = incasso senza consegna (il provisioning fallisce col saldo sotto il costo di attivazione) (CP_20260714_0700, CP_20260729_1757).
- Stripe webhook endpoint DEVE esistere per qualunque flusso billing; `stripeCustomerId` nella licenza KV viene impostato da `checkout.session.completed` — se manca, il customer non è linkato (CP_20260704_0615).
- Price ID Stripe fissi incompatibili con prezzi dinamici: il worker usa `price_data` inline (CP_20260601_2023).
- Non re-inviare un evento Stripe charge.refunded già stornato a mano: doppio conteggio (CP_20260528_0335).
- Le licenze sono HMAC-signed verificate server-side: il KV `lic:` è la cache di validazione, non un lookup — "KV vuoto" era falso (CP_20260713_0535).
- Token licenza server-firmato ECDSA asimmetrico (client ha solo la pubblica): HMAC simmetrico scartato in design perché il client avrebbe il secret → forgiabile (CP_20260605_1452).
- deviceId in storage.local come identificatore anti-abuse è morto alla prima reinstall: `storage.sync` non sopravvive a uninstall per estensioni unpacked; l'àncora stabile è il cookie `adoff_did` sul dominio worker (Max-Age 10 anni, Secure, HttpOnly, SameSite=None, fetch con `credentials:"include"`); limite accettato: clear-cookie/incognito lo battono (CP_20260620_1020).
- Testare POST /trial con deviceId non-UUID fa cadere il server sul fallback legacy che restituisce un hash costante: SEMBRA trial rotto, non lo è — il client manda sempre `crypto.randomUUID()` (CP_20260730_0225).
- Installare unpacked per testare Pro non funziona: ID diverso → storage separato → server nega il secondo trial per anti-abuse sul fingerprint (CP_20260730_0225).
- Il cap Founder nel webhook NON è stato aggiunto di proposito: dopo il pagamento si onora il prezzo mostrato, rifiutare è UX disastrosa (CP_20260613_1600).
- Telegram: 3 bot distinti — magicalclaude_bot (dispatcher + canale @adoffapp), AdOff_Support_bot (ticket, NON è admin del canale → 403 se lo usi per postare) (CP_20260706_2136, CP_20260617_1025).
- Il `TELEGRAM_CHAT_ID` del vault è il canale PUBBLICO @adoffapp: gli alert operativi passano dal gruppo admin del worker (`POST /admin/notify`), stesso nome, valore diverso (CP_20260906_1105).
- Post canale: `sendPhoto` con logo sfera, non `sendMessage` con preview link (pescava l'og-image wordmark); e `curl -F` multipart è rotto nel sandbox → multipart urllib stdlib (CP_20260608_1800, CP_20260611_1031).
- `editMessageText`/`editMessageMedia` non convertono un messaggio testo in foto (CP_20260608_1800).
- Non postare su Telegram prima che lo store risulti effettivamente pubblicato (CP_20260823_2202).
- Reddit/AlternativeTo: no automazione posting (ban); Reddit richiede account che matura, no PH upvote-chiedere (regole piattaforma) (CP_20260528_0335, CP_20260713_2120_trial-p0-ph-launch).
- I form dietro Cloudflare Turnstile (SaaSHub/AlternativeTo) sono impermeabili a CDP/curl: loop Turnstile infinito, TLS di curl flaggato 403 — si guida l'utente con valori in code-block copiabili (CP_20260621_1601).
- n8n: import solo via CLI dentro il container (REST 401 senza Personal API Key); il JSON richiede top-level `id`; ogni cambio workflow richiede restart (runtime-cache bug noto); la CLI `execute` richiede Execute Workflow Trigger, non Schedule (CP_20260528_0621).
- n8n Postgres: INSERT in workflow_history PRIMA di UPDATE workflow_entity (FK activeVersionId); patch DB → sempre restart (CP_20260515_1255).
- Resend/email: `ok:true` di sendEmail NON prova la consegna (try/catch ingoia) (CP_20260906_1140).
- LiteLLM: aggiungere modelli via `POST /model/new` dà 500 (STORE_MODEL_IN_DB non abilitato) — si edita config.yaml + docker restart; mai mettere la master key sul worker: virtual key limitata per modello e budget (CP_20260906_1105).
- Fallback LLM: non testarlo con un modello-esca (si dichiara "funziona" ed è rotto) — si rompe il primario vero col budget vero; e un modello thinking come fallback brucia i token nel reasoning restituendo content vuoto (CP_20260906_1105).
- Chiamare adoff.app da script senza User-Agent esplicito: il WAF Cloudflare risponde 403 error 1010 (CP_20260906_1105).
- WAF/403 dal sito: curl su clean-urls senza `-L` legge il 308 come body vuoto (falso allarme); e i file `.html` redirigono a extensionless perdendo la query string — testare in forma extensionless (CP_20260613_1430, CP_20260720_2015).
- Il CDN cache-buster richiede path assoluti nel deploy: dopo un `cd` altrove, `wrangler pages deploy site/` relativo fallisce ENOENT (la cwd persiste tra i comandi) (CP_20260911_1200).

## Metodo di lavoro e trappole di misura

- Il report di un subagente NON è prova: casi documentati — "fatto" senza modifiche su disco, i18n.js troncato dichiarato completo, un sed non applicato dichiarato "il banco non fallisce", 524 chiavi cancellate, un intero file riscritto per un edit di 5 righe. Verificare SEMPRE con `git diff`/grep/riesecuzione, e non leggere il diff mentre il subagente sta ancora scrivendo (CP_20260820_2015, CP_20260820_2320, CP_20260903_2352).
- Incarichi aperti ai subagenti ("trova e correggi") falliscono (5 su 13 falsi o fermi): funzionano gli incarichi ENUMERATI (file/chiave/testo nuovo espliciti); e non far eseguire ai subagenti build/deploy/wrangler (uno ha ricostruito gli ZIP senza che fosse richiesto) (CP_20260821_1730).
- `/wiki all` delegata a subagent haiku ha ALLUCINATO (tool_uses:0, successo falso): fare inline (CP_20260619_1510).
- I test che si autoassolvono sono il pattern ricorrente: leggere `data.rules` su un file che è un array; `window.frames` (API Playwright) dentro `page.evaluate`; gruppo che chiama solo `fail`; test su contesto già chiuso. Un test che esamina zero casi deve fallire, non passare (CP_20260804_2210).
- `node --check` su file generati da delega non basta: un file vuoto lo supera e i fence markdown passano il check ma esplodono a runtime — grep dei backtick + rilettura (CP_20260804_0230, CP_20260804_0451).
- Le deleghe m3-code/m3x con regex nella spec producono backslash letterali raddoppiati: scrivere il punto come classe `[.]` invece di insistere con l'escape; e `m3x patch` su regioni ampie con graffe annidate ha rotto la sintassi tre volte — regioni piccole o file intero rigenerato, sempre `node --check` dopo (CP_20260802_1645, CP_20260804_2301).
- m3-code può restituire due versioni concatenate separate da prosa: controllare quante volte il file ricomincia (CP_20260804_2301).
- L'esecutore che traduce i nomi dei campi tecnici in italiano (`valido/tipo/piano` per `valid/type/plan`) ha reso sempre vera una negazione del controllo integrità: rileggere i nomi dei campi dopo ogni delega (CP_20260804_2301).
- I commenti generati da MiniMax contengono U+202F (narrow no-break space) invisibile che fa fallire l'Edit: diagnosticare con `cat -A` (CP_20260728_2204).
- Playwright MV3: headless Chromium NON carica i content script — sempre xvfb-run + headless=False + persistent_context; e `channel:"chrome"` (Chrome di sistema) non inietta i `world:MAIN` con --load-extension: usare il chromium bundled (CP_20260706_2136, CP_20260728_2204).
- Lanciare il browser reale con `--load-extension` da CLI per "provare l'estensione": il path con spazi tronca, un'istanza esistente si becca gli indirizzi, e l'opzione è disabilitata per sicurezza — si crede di testare e invece gira senza (CP_20260808_2027).
- Verificare che l'estensione sia caricata cercando il nome del prodotto tra le finestre: lo trova nel titolo della pagina di prova, falso positivo (CP_20260808_2027).
- Contare le schede aperte senza filtrare quelle interne dell'estensione manda a caccia di popunder inesistenti (la pagina onboarding conta come scheda) (CP_20260804_0230).
- Content-Length della CDN NON prova l'identità di un file: scaricare e confrontare md5 (CP_20260804_0451).
- `pkill -f` con pattern presente nel proprio argv uccide la propria shell (exit 144); e un terminatore che matcha il motivo nella propria riga di comando idem (CP_20260809_1840, CP_20260808_2027).
- `pgrep -f` matcha il proprio comando di check (processo "RUNNING" che è finito): verificare dal log di fine (CP_20260617_1310).
- `docker ps`/`systemctl` nel sandbox danno output VUOTO senza errore: non concludere "servizio assente" da un grep vuoto sandboxed (CP_20260613_0312).
- Una regola ufw inserita a `insert 13` dopo il blanket in posizione 11 è no-op: rileggere `ufw status numbered` PER INTERO; e una `deny in on tailscale0` con allow solo IPv4 blocca tutti su IPv6 (CP_20260906_1105).
- Il traffico locale non attraversa ufw: `curl` dalla stessa macchina risponde 200 anche col firewall che blocca — servire prova da un altro host (CP_20260906_1105).
- Marcatori cercati con sottostringa/`in` passano a vuoto dopo un rename (`_pageLoadedAtXX` contiene `_pageLoadedAt`): usare confini di parola (CP_20260906_1105).
- Un guasto vicino nel tempo a una tua modifica non è causato da quella: il primo indizio è che rimuovere la modifica NON risolve (CP_20260906_1105).
- `wrangler kv` su rate-limit multipli: servono delete multiple per `rl:reg`/`rl:auth`/`crl:d`; dopo ~10 login falliti l'IP resta bloccato finché non si cancella `rl:auth:<IP>` (CP_20260711_0905, CP_20260711_1125).
- Swarm/agenti in parallelo oltre il limite di sessione: 24 su 26 killati — per fix meccanici ripetitivi gli script Python deterministici sono più affidabili e veloci (CP_20260718_0721).
- Il WAF/redirect: "Pages deploy bloccato" era diagnosi errata — `wrangler whoami` fallisce solo perché il token non elenca gli account, il deploy funziona con account_id esplicito; non generalizzare un fallimento di un comando (CP_20260602_0949).
- Non testare il fallback con un modello-esca né fidarsi di un ok:true: testare rompendo il primario vero (CP_20260906_1105, CP_20260906_1140).
- Sul repo duale: MAI merge `feat/premium-vpn` → `main` (main è il repo pubblico open-core github.com/eroslifestyle/adoff, il feature branch resta privato); le release partono dal branch privato (CP_20260721_0800, CP_20260728_2204).
- Non forzare il commit di `.claude/checkpoints/` con `-f`: è gitignored di proposito (CP_20260728_2245).
- Non rinominare la cartella `ChromePlugin` → `adoff`: decisione utente, il brand pubblico è AdOff e il nome locale è irrilevante (CP_20260515_0104, CP_20260911_1200).
- Non delegare `git add` a un subagente: ingloba file non correlati; git sempre manuale nel main (CP_20260903_2352).
- Nel packaging: ogni nuovo script sotto `src/` va aggiunto alla mappa dei profili di build.js (il TEST 10 lo impedisce) — senza, il file non entra nel pacchetto; e mai deployare `app/` diretto, sempre gli ZIP da build.js (CP_20260804_2301, CP_20260624_1130).
- I tre target (Chrome/Firefox/Safari) condividono i file: ogni modifica si propaga a tutti e tre, verificando con diff/md5 prima di copiare "alla cieca" (CP_20260624_1130, CP_20260610_2032).
- Font Lexend-Bold/ExtraBold.ttf da 14 byte = stub corrotti (download rotti): rigenerarli da `Lexend-var.ttf` con `set_variation_by_name`, non usarli mai da capo (CP_20260616_0735, CP_20260802_1840).
- Il sito Astro Wave: conversione a componenti generici perse il 71% del contenuto (solo ~30% della copy era in data-i18n): conversione meccanica 1:1, e fallback lingua IT (non EN) per non creare loop redirect su pagine IT-only (CP_20260529_1408).
- Le traduzioni agent in un solo turno su pagine >1700 righe collassano per token budget (output "shortened"): prompt con size mandatory 75-115% del sorgente, e per le pagine enormi traduzione a chunk (CP_20260529_1408).
- 66 file di traduzione fake (copy-paste con cambio `<html lang>`): riconoscerli dal delta size <200 byte e H1 con parole italiane (CP_20260529_1408).
- Il bulk-replace brand→sinonimo è la radice di bug ("Search engines Card" al posto di "Twitter Card"): serve allow-list contestuale che esclude URL, ID HTML, nomi protocol meta e contesti OAuth dove "Google" è funzionale (CP_20260529_0650).
- Gli em dash russi copulari (`X — это Y`) sono grammatica corretta, non AI-tell: non sostituirli (CP_20260613_1430).

## Storico — non più applicabile

Lezioni legate a cose eliminate o dormienti; restano valide come spiegazione di perché quelle strade non vanno riprese:

- Il prodotto VPN è stato ELIMINATO per decisione esplicita dell'utente ("non ci sarà più") — tier "Premium" (mai "Pro+"), pool D1 `founder_premium_seats` separato, bridge HMAC↔ECDSA per il token VPN, pricing €4,99/29,99/49,99: tutta quella filatura è storia; non confondere con la "local VPN" dell'app Android, che è viva (CP_20260911_1200, CP_20260714_VPN_FASE1, CP_20260714_VPN_SPRINT2).
- Il modello a pagamento è dormiente da agosto 2026: AdOff è gratis al 100%, versione unica — trial 15gg, Pro €2,99/€29,99, Founder Lifetime €99, counter posti founder e checkout Stripe non governano più nulla (restano nel codice dietro `adoffPlanTier()`); mai promettere "per sempre/lifetime" nei claim: la formula è "gratis, senza account e senza limiti" dopo i 30 giorni (CP_20260820_2015, CP_20260718_0721, CP_20260601_2023).
- Il piano Lifetime €99 fu rimosso per decisione utente e non va reintrodutto; le clausole storiche su Lifetime/Pro nei testi legali vanno invece tenute (chi ha pagato le tiene valide) (CP_20260714_2145, CP_20260903_2352).
- Il trial da 30gg è passato a 15gg e poi al modello free+account: ogni testo "30 giorni" residuo riferito al trial era un bug di congruenza (quelli su garanzia rimborso e referral +15gg restano legittimi) (CP_20260714_2145, CP_20260718_0721).
- L'app Android VPN con VpnService Kotlin + metodo DNS (AdGuard DNS, no video ads perché DNS non copre SSAI — mai prometterlo), APK su GitHub Releases perché CF Pages limita a 25MB: pivot legato al prodotto VPN, oggi senza oggetto (CP_20260714_0245, CP_20260714_0500).
- L'hop di distribuzione browser-estensione via VPNresellers/proxy non fu mai possibile (chrome.proxy ≠ VPN): la lezione tecnica sopravvive al prodotto (CP_20260714_0700).
- Il "non-trader su CWS" e i contatti business (MBE + SIM dedicata) riguardavano il modello a pagamento con listing store: con tutto gratis e listing esistente la pressione è calata, ma la raccomandazione anti-misdeclaration resta (CP_20260613_0451).
- Le testimonianze finte e le foto AI di persone furono rimosse/scartate nella fase salesletter: la regola honesty che ne è nata è permanente, il contesto vendita no (CP_20260601_2023, CP_20260602_1556).
