# TODO — AdOff ChromePlugin

> Consolidato 2026-07-19. I check sono cancellazioni, non aggiunte.

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
