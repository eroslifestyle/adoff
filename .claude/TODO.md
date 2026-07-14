# TODO — AdOff ChromePlugin

## Attivo
- [ ] **RIFARE SITO con /hulk-design**: l'utente ha giudicato il restyling scadente ("il sito fa schifo"). Redesign professionale homepage + pricing + vs/ + blog. Mantenere decisioni congelate (no Lifetime, pricing Pro €2.99/€29.99 + VPN €4.99/€29.99/€49.99, trial 15gg solo Pro).
- [ ] **Purge cache CF adoff.app**: dominio mostra vecchio sito (cache 300s). Token .env NON ha permesso purge (err 10000) → dashboard manuale.
- [ ] **Edge publish v3.5.36**: InProgressSubmission (Microsoft in review), riprovare tra 1-2h. Poll path: submissions/draft/package/operations/$OP.
- [ ] **AMO Firefox v3.5.36**: web-ext sign timeout a 120s, riprovare timeout più lungo.
- [ ] **Git commit + push** modifiche v3.5.36 (branch feat/premium-vpn).
- [ ] **Post Telegram** changelog v3.5.36 (dopo redesign sito).
- [ ] **Premium VPN — Balance refill**: integrare ricarica auto quando utenti crescono (API no endpoint refill, solo manuale; $25 = ~12 mesi con 0 utenti).
- [ ] **GATE lancio VPN**: test empirico multi-device.
- [ ] **Premium FASE 2**: VPN reale mobile (VpnService tunnel) + Kill-switch + DNS Guard freemium.
- [ ] **Premium FASE 3**: SEO /guide, FAQ AEO, analytics funnel, anti-churn, CHECKLIST GO-LIVE.

## Completati
- [x] **v3.5.36 release tecnica** (2026-07-14): trial 30→15gg (3 browser + worker), pricing Lifetime rimosso, pricing VPN in constants, version bump. CWS published ✅.
- [x] **Sito restyling 54 AQ** (2026-07-14): homepage 13 sezioni + pricing.html + 10 vs/ pages + blog system + nav/footer. ⚠️ DESIGN DA RIFARE (utente insoddisfatto).
- [x] **Sprint 2 Premium VPN** (2026-07-14): checkout Stripe + provisioning webhook + handleGetVpnToken bridge + auto-disable. Deploy 91a72e3d.
- [x] **v3.5.35 release**: CWS published, AMO review, Edge pending, Telegram msg_id=73.
- [x] VPNresellers API: balance $25, 82 server, Bearer auth (NON X-API-Key), /profile /servers /accounts endpoint.
- [x] Trial anti-crack ECDSA P-256.
- [x] v3.5.0 — v3.5.35 rilasciati.
