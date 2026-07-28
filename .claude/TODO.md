# TODO — AdOff ChromePlugin

> Consolidato 2026-07-19. I check sono cancellazioni, non aggiunte.

## Release 3.5.38 — anti-detection fix (2026-07-28)

- [x] **Fix spoof googletag/adsbygoogle** — commit b251624. I siti riassegnavano `window.googletag` cancellando lo spoof (1 chiave, `apiReady:false` = firma adblock). Ora merge-accessor: 18 chiavi stabili.
- [x] **Sito** — LIVE 3.5.38 (ZIP + 51 file HTML/JSON-LD)
- [x] **CWS** — 3.5.37 pubblicata, in review (CONTIENE il fix)
- [x] **AMO** — 3.5.38 canale **listed** (versions/6380919), riallinea il listing pubblico fermo a 3.5.35
- [x] **Telegram** — annuncio EN + card (message_id 89)
- [ ] **CWS: caricare 3.5.38** quando la 3.5.37 esce da review — retentato 2026-07-28 sera: ancora `ITEM_NOT_UPDATABLE`, review 3.5.37 tuttora aperta (`uploadState: NOT_FOUND`, `crxVersion: 3.5.37`). Riprovare con lo stesso comando PUT.
- [ ] **Edge: publish 3.5.38** — package 3.5.38 **ricaricato e validato nel draft** 2026-07-28 sera (upload op `Succeeded`, quindi il draft NON è più il 3.5.36). Publish ancora `InProgressSubmission`: review 3.5.36 aperta. Riprovare col solo publish: `bash sviluppo/scripts/edge-publish-retry.sh` (ora legge la versione dal manifest, non più hardcoded).
- [x] **Wall investing.com SPARITO** — confermato dall'utente 2026-07-28 sulla build col fix. Il merge-accessor su `googletag` era effettivamente la causa del rilevamento: root cause chiusa, non serve cercare altri vettori.

## 🔴 Alta priorità (bloccanti revenue)

- [x ~~] **Premium VPN — VPN provisioning nel webhook** — `VPNRESELLERS_API_KEY` secret impostato, provisioning gia' implementato
  - Secret: `wrangler secret put VPNRESELLERS_API_KEY --name adoff-license-api` ✅
  - refs: PROGRESS-vpn-premium.md §FASE 1bis
- [x ~~] **Premium VPN — Multi-device test empirico** — balance insufficiente ($24.74)
  - refs: PROGRESS-vpn-premium.md §FASE 1bis
  - Prereq: ricaricare VPNresellers $100+
- [ ] **Balance VPNresellers refill** — $25 attuale → $100+ per test reali + lancio

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
