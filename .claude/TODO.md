# TODO — AdOff ChromePlugin

## Attivo
- [ ] **Edge publish v3.5.36**: InProgressSubmission (Microsoft in review), riprovare tra 1-2h. Poll path: submissions/draft/package/operations/$OP.
- [ ] **AMO Firefox v3.5.36**: web-ext sign timeout a 120s, riprovare timeout più lungo.
- [x] **Post Telegram** changelog v3.5.36 (message_id: 78 su @adoffapp).
- [ ] **Mockup hero localizzato** (opzionale): l'immagine hero (assets/mockup.webp) mostra popup con testo IT "Ads bloccati oggi 15" + changelog v3.1.0. Rigenerare versione aggiornata/neutra se serve.
- [ ] **Premium VPN — Balance refill**: integrare ricarica auto quando utenti crescono (API no endpoint refill, solo manuale; $25 = ~12 mesi con 0 utenti).
- [ ] **GATE lancio VPN**: test empirico multi-device.
- [ ] **Premium FASE 2**: VPN reale mobile (VpnService tunnel) + Kill-switch + DNS Guard freemium.
- [ ] **Premium FASE 3**: SEO /guide, FAQ AEO, analytics funnel, anti-churn, CHECKLIST GO-LIVE.

## Completati
- [x] **Redesign sito light+dark** (2026-07-14): homepage v3 stile AdBlock/ABP (light default + toggle dark [data-theme]); critical-CSS inline + 10 pagine palette-custom rese tema-aware; before/after reale + wall-killer; congruenza trial 15/prezzo 29,99/no-Lifetime; rimossi fake social-proof salesletter (2.847/4.9→claim reali); homepage i18n 15 lingue (MiniMax, 88 stringhe); deploy branch **main** + purge cache (Global API Key) → **LIVE su adoff.app**. Commit 8962ecd/ed91544/35a0cc5.
- [x] **Purge cache CF adoff.app**: RISOLTO — funziona con Global API Key (X-Auth-Email + X-Auth-Key), NON col token Bearer. Zone adoff.app = d4b235aa2d6040416513de5094c22e0d.
- [x] **Git commit + push** modifiche redesign (branch feat/premium-vpn).
- [x] **v3.5.36 release tecnica** (2026-07-14): trial 30→15gg (3 browser + worker), pricing Lifetime rimosso, pricing VPN in constants, version bump. CWS published ✅.
- [x] **Sprint 2 Premium VPN** (2026-07-14): checkout Stripe + provisioning webhook + handleGetVpnToken bridge + auto-disable. Deploy 91a72e3d.
- [x] **v3.5.35 release**: CWS published, AMO review, Edge pending, Telegram msg_id=73.
- [x] VPNresellers API: balance $25, 82 server, Bearer auth (NON X-API-Key), /profile /servers /accounts endpoint.
- [x] Trial anti-crack ECDSA P-256.
- [x] v3.5.0 — v3.5.35 rilasciati.
