# TODO — AdOff ChromePlugin

> Consolidato 2026-07-19. I check sono cancellazioni, non aggiunte.

## Sessione 2026-07-31 — overlay invisibile SSAI + playbackRate (v3.5.54)

- [x] **Diagnosi SSAI definitiva**: logging utente prova che i residual ~20% ad YouTube sono Server-Side (cuciti nello stream DASH). `adPlacements` strippato ✓, zero chiavi `ad[A-Z]` residue, gate Pro attivo, fast-forward 16x attivo, ad dura ~1s. Non strippabili dal JSON — solo fast-forward.
- [x] **Overlay invisibile `setSkipOverlay()`** (v3.5.54, `8914ab8`): `<div id="adoff-skip-ov">` opaco nero brand "skipping ad" sopra `#movie_player` durante `ad-showing` (z-index 999999, pointer-events none). L'utente non vede il contenuto SSAI, solo ~1s nero. Zero seek.
- [x] **Ripristino playbackRate**: `savedRate = video.playbackRate` in onAdStart, restore `savedRate || 1` in onAdEnd (non più hardcoded 1 → 1.5x/2x preservati). Mirrora `wasMuted`.
- [x] **Sync 3 browser**: Chrome+Firefox+Safari (killer region byte-identica). `test-ad-skip.js` 6/6. Manifest bumped 3.5.54.
- [x] **Commit + push**: `8914ab8` su `feat/premium-vpn` (+81/-6, 6 file).
- [x] **Deploy v3.5.54** — CWS published (status OK), AMO public 3.5.54 (reviewed 16:41Z), site production live (chrome+firefox 3.5.54, `--branch main`), Telegram msg 93. Residui: Edge 404 (Partner Center), safari zip edge-cache stale (self-heal ≤4h). Dettagli: checkpoint `CP_20260731_1846.md`.
- [ ] **Edge**: 404 (non 401 — chiave valida, product ID non accessibile). Upload manuale Partner Center OPPURE credenziali rigenerate dall'account proprietario.

## Sessione 2026-07-30 — annunci sempre attivi su piattaforma video (v3.5.45)

- [x] **ROOT CAUSE: lo strip perdeva la corsa contro la pagina** (v3.5.45, `1a750b4`). L'hook A1 su `ytInitialPlayerResponse` decideva strip vs passthrough **dentro il setter**, che scatta pochi ms dopo `document_start`; il verdetto Pro arriva pero' da `content.js` solo dopo `storage.get` + `crypto.subtle.verify` (asincrone). Corsa persa quasi sempre → `adPlacements` intatti → il player schedula ogni annuncio. **Non e' una regressione: e' una race che il codice ha sempre corso**, da cui l'intermittenza storica e il fatto che Playwright non riproducesse. Fix: (a) strip **pigro** valutato al `get`, (b) canale **sincrono** `localStorage.__adoff_pro` scritto da content.js, stesso pattern di `__adoff_vc`. `isProSync` usata SOLO dal Layer A; stub IMA e anti-detection restano sul nonce.
- [x] **Test anti-regressione** `test-yt-initial-response-race.js` 7/7, validato per mutazione (rimettendo il bug falliscono T1, T5, T6). T6 e' la guardia strutturale: il setter non deve consultare il gate.
- [x] **Falso allarme diagnosticato**: l'interruttore "Compatibilita' piattaforme video" era rimasto **acceso** dopo il debug degli schermi neri. In quella modalita' Layer A e regole di rete YT sono disattivati e i ping annuncio **sbloccati**: gli annunci passano *by design*. La sua causa originale (regola 178) era gia' stata rimossa in 3.5.41.
- [x] **Secondo difetto: l'annuncio lungo si bloccava** (v3.5.46, `8bc8731`). `instantSkip` seekava a `duration - 0.15` **senza guardare il buffer**. Il player clampa un seek oltre i dati scaricati e resta ad aspettare i segmenti mancanti → spinner. **Misura dal browser utente**: annuncio 10s con `bufEnd=10.02` su `dur=10.021` → saltato in **0,5s**; annuncio 40s con buffer corto → **bloccato a 38s**. Fix: il salto non supera mai il bordo del buffer, il polling a 50ms lo insegue mentre `playbackRate=16` lo fa crescere. `test-ad-skip.js` 11/11 (T10/T11 nuovi, validati per mutazione). **Regola generale: su MSE un seek e' utile solo dentro `buffered.end`.**
- [x] **REGRESSIONE 3.5.46 e fix** (v3.5.47, `aa6b1b7`): il salto ripetuto cadeva **dentro al contenuto**, spostandolo in punti a caso. Annuncio e contenuto condividono lo stesso elemento video e allo scambio di sorgente il player tiene `ad-showing` addosso ancora per decine di ms. Col salto singolo la finestra era stretta; rendendolo ripetuto si e' allargata. Fix: la **durata** separa le sorgenti — se cambia ed e' > 180s e' il contenuto (`playbackRate` a 1, mani ferme fino al blocco successivo), se resta plausibile e' il secondo spot del pod (riarma dopo 2 tick di conferma). `test-ad-skip.js` 13/13, T12/T13 validati per mutazione. **Regola: su un player che riusa lo stesso elemento video, la classe CSS di stato non basta a sapere quale sorgente sta suonando.**
- [x] **Terzo giro: il salto colpiva il contenuto anche in INGRESSO** (v3.5.48, `9528e09`). La guardia della 3.5.47 copriva solo l'uscita dall'annuncio. Il player marca `ad-showing` **prima** di scambiare la sorgente: al primo tick il media montato e' ancora il contenuto, la sua durata veniva presa per quella dell'annuncio e il salto finiva nel video vero. **Prova numerica dai ping `atr`**: preroll con `adunit cmt=14.891/len=15.041` (annuncio terminato bene) ma `detailpage cmt=152.708/len=1080.121` — contenuto partito da 152,708s, cioe' `bufEnd - AD_SEEK_SAFETY_SEC`. Fix: il controllo non e' piu' sul **cambio** di durata ma sulla **durata in se'** — nessun annuncio supera i 180s, quindi un media piu' lungo e' contenuto e non si tocca, a ogni tick; in piu' la durata deve restare ferma 2 tick prima di agire. `test-ad-skip.js` 15/15 (T14/T15 nuovi); la mutazione riproduce `152.708` al centesimo. **Regola: `ad-showing` non dice QUALE sorgente sta suonando, solo che il player e' in modalita' annuncio.**
- [ ] **Validazione utente v3.5.48** — ricaricare l'estensione e verificare su un annuncio **lungo** (30-40s) che scorra accelerato fino in fondo senza spinner. Serve **una ricarica di pagina in piu'** al primo giro se `__adoff_pro` non e' ancora popolato.
- [ ] **403 su `googlevideo.com/videoplayback` (itag=18) NON spiegato** — due richieste consecutive, la seconda senza `ctier`, entrambe `403 Forbidden` dal server. Verificato che `stealth.js` **non tocca** quegli URL (le righe 334/374 nello stack sono il wrapper fetch/XHR in passthrough). Sospetto VPN: URL con `ip=60.73.55.47` mentre la pagina e' `cr=IT`. Da indagare separatamente.
- [ ] **Valutare se l'interruttore compatibilita' debba sopravvivere** — oggi il suo unico effetto pratico e' disarmare la protezione sulla piattaforma video; la causa per cui era nato non esiste piu'.

## Sessione 2026-07-29/30 — schermo nero YouTube + bug critico licenze (v3.5.39→3.5.44)

Checkpoint completo: `.claude/checkpoints/CP_20260730_0225.md`

- [x] **REGOLA 178 RIMOSSA — causa del nero 10-15s** (v3.5.41, `46f64c2`). `googlevideo.com/videoplayback*ctier=L`, SEMPRE ATTIVA (non era tra `YT_AD_RULE_IDS`, quindi né Free né compatibilità la disattivavano): bloccava lo **stream del contenuto**, non la pubblicità. `ctier` = content tier. Log utente: `ERR_BLOCKED_BY_CLIENT` + retry `rn=37→38→39`. Regole 144→143. **Verificato dai dati utente: 1573ms contro 36488ms.** Segnale storico ignorato: `79bd308` aveva messo una toppa `excludedInitiatorDomains:[paramountplus.com]` su quella stessa regola.
- [x] **BUG CRITICO LICENZE — ogni pagante declassato a Free a ogni avvio** (v3.5.44, `7ad602f`). `revalidateLicense()` riscriveva `adoffLicense` aggiornando `lastValidated` senza ricalcolare `adoffIntegrity` → `content.js` la considerava manomessa e negava Pro. Gira a ogni avvio browser + daily alarm. Il pannello mostrava "PRO Lifetime" comunque perché legge la licenza senza passare dal gate. **È la causa di tutti i `gate Pro NON attivo` nei test video.** Recupero per utenti già colpiti: riavviare l'estensione.
- [x] **Instant-skip ripristinato** (v3.5.43, `ec4c06e`): `instantSkip` termina l'annuncio al primo tick con `readyState>=1`. Prima terminava solo gli annunci *impiantati*, quindi un annuncio che scorre non veniva fermato (pulsante skip spesso assente, `playbackRate=16` rimesso a 1 dal player). Dirette escluse.
- [x] **TypeError ogni 50ms** (v3.5.40, `12ec3d6`): `skip?.offsetParent !== null` è vero anche con `skip===null` → eccezione che impediva la chiusura degli overlay.
- [x] **Campo Account vuoto** (v3.5.42, `40896a6`): il server non inviava mai `email`, il client non la salvava (2 rami: `/activate` e `/validate`). Ora mascherata (`er***@gmail.com`).
- [x] **Worker licenze deployato** — versione `ac8cd555`, su autorizzazione esplicita. **LIVE: trial 15 giorni (era 30)**, email mascherata, pricing rework `b822897`.
- [x] **4 suite di test anti-regressione**, tutte estraggono il blocco reale dal sorgente e validate con mutazione: `test-license-integrity.js` 4/4 (T3 è il test che avrebbe intercettato il bug critico), `test-ad-skip.js` 9/9, `test-layer-d-watchdog.js` 7/7, `test-rules-no-content-block.js` 4/4.
- [ ] **PROSSIMO PASSO — validare il gate Pro**: ricaricare l'estensione a 3.5.44, incollare `sviluppo/tests/diag-console-blackscreen.js` nella console su una pagina video. **Expected outcome: il report dice "gate Pro attivo"** (prima diceva sempre il contrario). Solo allora `playbackRate max` misura il Layer B in funzione: 16 = skip agisce, 1 = non parte.
- [ ] **Decidere se promuovere la modalità compatibilità a DEFAULT** — ipotesi ancora NON verificata: con lo strip attivo il player potrebbe non marcare `ad-showing`, rendendo inerte il Layer B.
- [ ] **Pubblicazione store v3.5.44** — sospesa su decisione utente. Argomento a favore: il bug licenze colpisce **tutti i clienti paganti adesso**.
- [ ] **Regola 179** (`videoplayback*oad=`, Pro-only) non toccata: stessa famiglia della 178. Se il nero ricomparisse in Pro, è il sospetto numero uno.
- [ ] **Hash integrità licenza fragile** (design): calcolato su TUTTO l'oggetto serializzato, quindi qualunque campo aggiunto/aggiornato la invalida. Valutare un hash su sottoinsieme stabile (`rawKey`, `plan`, `expires`) escludendo i volatili (`lastValidated`, `devices`).

## Release 3.5.38 — anti-detection fix (2026-07-28)

- [x] **Fix spoof googletag/adsbygoogle** — commit b251624. I siti riassegnavano `window.googletag` cancellando lo spoof (1 chiave, `apiReady:false` = firma adblock). Ora merge-accessor: 18 chiavi stabili.
- [x] **Sito** — LIVE 3.5.38 (ZIP + 51 file HTML/JSON-LD)
- [x] **CWS** — 3.5.38 pubblicata (`uploadState: SUCCESS` → publish `status: OK`, `crxVersion: 3.5.38`). La 3.5.37 intermedia conteneva già il fix.
- [x] **AMO** — 3.5.38 canale **listed** (versions/6380919), riallinea il listing pubblico fermo a 3.5.35
- [x] **Telegram** — annuncio EN + card (message_id 89)
- [x] **CWS: 3.5.38 caricata e pubblicata** — review 3.5.37 chiusa, upload `SUCCESS`, publish `OK`, `crxVersion: 3.5.38` verificata.
- [x] **Edge: 3.5.38 pubblicata** — review 3.5.36 chiusa, operazione publish `Succeeded`. Edge ora serve il fix (non più la 3.5.36 senza).

**Release 3.5.38 allineata su tutti i canali automatizzabili**: sito, CWS, AMO, Edge, Telegram. Resta solo Safari (richiede Mac con Xcode).
- [x] **Wall investing.com SPARITO** — confermato dall'utente 2026-07-28 sulla build col fix. Il merge-accessor su `googletag` era effettivamente la causa del rilevamento: root cause chiusa, non serve cercare altri vettori.

## 🔴 Alta priorità (bloccanti revenue)

- [x ~~] **Premium VPN — VPN provisioning nel webhook** — `VPNRESELLERS_API_KEY` secret impostato, provisioning gia' implementato
  - Secret: `wrangler secret put VPNRESELLERS_API_KEY --name adoff-license-api` ✅
  - refs: PROGRESS-vpn-premium.md §FASE 1bis
- [x ~~] **Premium VPN — Multi-device test empirico** — balance insufficiente ($24.74)
  - refs: PROGRESS-vpn-premium.md §FASE 1bis
  - Prereq: ricaricare VPNresellers $100+
- [ ] **Balance VPNresellers refill** — ~$24.74 → $100+. **Non è più un blocco ai test**: l'utente conferma 2026-07-28 che i test E2E Premium VPN sono stati eseguiti e funzionano. È ora un limite di **capienza in produzione**: a ~$1,99/account il saldo copre ~12 attivazioni (meno, se i test ne hanno già consumate). Oltre quella soglia il cliente paga e il provisioning VPN fallisce → incasso senza consegna. Da ricaricare PRIMA di aprire le vendite Premium, non dopo.

## 🟡 Media priorità (store publish)

- [x] **Edge publish v3.5.36** — pubblicata (senza fix). Superata: il draft ora contiene la 3.5.38, vedi la voce nella sezione Release 3.5.38.
  - Nota API v1.1: i GET di lettura stato NON esistono (404 su `submissions/draft/package`). L'unico modo di sondare il canale è tentare l'upload/publish e leggere l'errorCode.
- [x] **AMO Firefox** — RISOLTO 2026-07-28: canale listed riallineato con la 3.5.38.

## 🟢 Bassa priorità (nice-to-have)

- [x ~~] **i18n — 31 pagine** — TUTTE coperte (31/31), 2652 chiavi allineate su 15 lingue
  - refs: `c6c5bfc` commit
  - Script: `sviluppo/scripts/add_i18n_attrs.py` (batch 1/2)
- [ ] **GA4 historical data** — crescono col tempo, non c'è azione

## ✅ Completati (recenti)

- [x] **Site restyle cleanup + i18n IT residui** (2026-07-20): fix miscuglio vecchio/nuovo (nav doppia unique-tech topbarNav→site-nav, affiliati orfana, footer condivisi android/success/uninstall/account, versione→3.5.36, VPN Founder €29,99/Standard €49,99, trial→15gg, regole→144); +audit ~178 chiavi/lingua×14 con testo IT non tradotto→tradotte tutte via 2 workflow. commit e86586b/58b2bf8/f12941e, deploy live
- [x] **Site full audit + fix** (2026-07-18): 37 pagine senza i18n, nav versioni, CSP GTM — TUTTO RISOLTO
- [x] **Post Telegram** changelog v3.5.36 (message_id: 78)
- [x] **Redesign sito light+dark** (2026-07-14): stile AdBlock/ABP, 15 lingue
- [x] **v3.5.36 release**: CWS published, trial 15gg, pricing congruente
- [x] **VPN Sprint 2**: checkout Stripe Premium funzionante, gating deployed
- [x] **Premium badge 3 livelli** nel popup (Free/Pro/Premium)
- [x] **VPN Policy page** su adoff.app
- [x] **Sezione Premium in options.html**
- [x] **Trial anti-crack ECDSA P-256**
- [x] **syncRemoteRules** riattivato (autofix Fase 0)

## 🔒 Congelati (decisioni bloccanti)

- **Premium FASE 2**: VPN mobile + Kill-switch + DNS Guard freemium (bloccato da provisioning + test E2E)
- **Premium FASE 3**: SEO guide/FAQ AEO/analytics/anti-churn/GO-LIVE checklist (bloccato da FASE 2)
- **Premium FASE 3**: Canali Telegram EN / email Pro / social / in-app (bloccato da FASE 2)

---

## Merge info

Questo file sostituisce TODO.md frammentato. Checkpoints archiviati:
- CP_20260718_0721/0825/0915 — site audit ✅
- CP_20260718_1720 — site i18n + CSP ✅  
- CP_20260719_i18n.md — 31 pagine pendenti (da fare)
- CP_20260714_VPN_SPRINT2 — checkout ✅, provisioning pending
- CP_20260715_0030 — redesign site ✅
- RESTART-SESSION.md — Autopilot (vecchio progetto, non più attivo)
