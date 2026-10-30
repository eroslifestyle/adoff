# PROGRESS — AdOff Premium (VPN & DNS redesign)

> Stato esecutivo del progetto. Design congelato in `.claude/PLAN-vpn-dns-redesign.md` (102 decisioni AQ).
> Aggiornare ad ogni step. Checkpoint a fine di ogni fase.

## Stato: FASE 1 WRAP-UP COMPLETE ✅ — post-verifica congruenza 2026-07-14

---

## TODO BOARD

### FASE 0 — Sicurezza & fix ✅ (completata 2026-07-14, commit 3cc9a6a)
- [x] Estrarre modulo VPN separato dal worker.js → `vpn-module.js` (~340 righe)
- [x] Gating server-side /vpn/* (token ECDSA tier=premium) — bloccante → verifyPremiumToken() con anti-replay ±5min + deviceId match
- [x] Fix `/vpn/create` (username+password generati) → randomBase64url() lato worker
- [x] Fix `/verify-mobile-license` 405 (gestire GET) → aggiunto in blocco GET worker.js riga ~8033
- [ ] ~~verifica firma ECDSA client Dart~~ → **RIMANDATA a FASE 2** (client mobile in repo separato)
- [x] Cron CF giornaliero: auto-disable inattivi 7gg + abbonamenti scaduti → handleCronVpnAutoDisable(), cron 0 10 * * *
- [x] Rate-limit /vpn/create (2/h per IP) + audit log D1 vpn_audit + deviceId lock
- [x] **GATE DEPLOYED ✅**: tutti i 4 endpoint bloccano 403 post-redeploy (Version ID 7b6b6be6)
  - `/vpn/create` → 403 ✅ | `/vpn/delete` → 403 ✅ | `/vpn/enable` → 403 ✅ | `/vpn/disable` → 403 ✅
  - `/vpn/servers` → 200 (pubblico, corretto) | `/vpn/profile` → 200 (pubblico, corretto)
  - `/vpn/config` → 403 ✅ | `/verify-mobile-license` GET → 400 ✅ (era 405)
- [ ] **Multi-device empirico**: basato su inferenza (OpenVPN multi-sessione OK, WireGuard statico = rischio). Test reale con VPNRESELLERS_API_KEY nell'ambiente.
- ⚠️ **Balance WARNING**: $25.00 insufficiente — ricaricare $100+ per lancio utenti reali.

### FASE 1 — Tier Premium & pulizia (ESTENSIONE ✅, CHECKOUT ⬜)
- [ ] Checkout Stripe: SKU Premium (€4,99/mo · Founder €29,99→€49,99 · std €49,99) price_data inline + founder pool separato
- [ ] Multi-valuta (prezzi fissi psicologici) + PayPal + Apple/Google Pay + crypto (BTCPay/Coinbase, USDT/USDC)
- [ ] Licenza flag `tier: premium` + token firmato + upgrade Pro→Premium proration
- [ ] Provisioning account VPN al primo uso (fix flusso)
- [x] Rimuovere UI VPN dal popup → upsell (banner + sezione) ✅ (2026-07-14, commits 4e74d73)
- [x] Badge 3 livelli Free/Pro/Premium nel popup ✅ (2026-07-14, commits 4e74d73)
- [x] Sezione Premium in options.html ✅ (2026-07-14, commit 67b7b55)
- [x] Propagazione a Firefox + Safari ✅ (2026-07-14, commit 6304ee4)
- [ ] Cap 3 device + gestione device self-service /account

### FASE 1bis — Test E2E 🟡 (parziale — gating PASS, multi-device PENDING)
- [ ] Stripe test mode checkout completo
- [ ] Account VPNresellers test reale (create/enable/config/disable) — serve VPNRESELLERS_API_KEY in env
- [ ] Connessione VPN reale 3 device
- [x] Gating: non-Premium → 403 — **TESTATO e PASS** post-redeploy (2026-07-14)
  - `/vpn/servers` → 200 PASS (pubblico, corretto)
  - `/vpn/profile` → 200 PASS (pubblico, corretto)
  - `/vpn/config` → 403 PASS | `/vpn/create` → 403 PASS | `/vpn/delete` → 403 PASS
  - `/vpn/enable` → 403 PASS | `/vpn/disable` → 403 PASS
  - `/verify-mobile-license` GET → 400 PASS (era 405)
  - Report: `.claude/TEST-REPORT-vpn.md`

### FASE 2 — VPN reale mobile + DNS Guard (IN PROGRESS)
- [x] **Mobile scaffold**: LicenseService (trial ECDSA, verifyTrialOnline, checkPro) + crypto_keys.dart (JWK pubkey embeddata)
- [x] **GET /verify-mobile-license**: license_service.dart usa GET (già corretto, riga 124)
- [x] **DNS Guard**: refreshBlocklist() + refreshBlocklistIfNeeded() (cron 7gg via SharedPreferences)
- [ ] VpnService mobile: DNS-filter → tunnel reale (protocollo da test Fase 0)
- [ ] Kill-switch (mobile VpnService + desktop firewall)
- [ ] App desktop Tauri (riusa UX vpn-tray) — in parallelo mobile
- [ ] Feature Premium: auto-rotation + fast-connect + country-lock
- [ ] Gating Premium mobile/desktop + dichiarazioni privacy store native

### FASE 3 — Lancio & comunicazione (SITO) ✅ (2026-07-14)
- [x] Landing /premium (15 lingue hreflang, bundle value, pain-point, onestà piattaforme, CTA trial)
- [x] Multi-valuta prezzi progettati in constants.json (USD/GBP/CHF) — implementazione nel checkout worker
- [x] VPN Policy doc (site/vpn-policy.html): no-log, EU giurisdizione, cosa si traccia, P2P consentito, kill-switch
- [x] Pagina vs/ NordVPN+ProtonVPN+ExpressVPN (vs/vpn-standalone.html)
- [x] Pagina vs/ AdGuard VPN (vs/adguard-vpn.html)
- [x] Pagina vs/ Brave VPN+Shield (vs/brave-vpn.html)
- [x] SPEC checkout Premium (SPEC-checkout-premium.md): SKU, price_data inline, founder pool separato, multi-valuta, crypto gateway, upgrade Pro→Premium proration
- [x] constants.json SSOT aggiornato (_pending_vpn section)
- [x] Upsell banner pricing index.html (PENDING test E2E — visible ma non ancora live)
- [ ] ~~PRICING-PLAN.md~~ → RIMANDATO post test E2E (marchiato PENDING nei prezzi)
- [ ] Congruenza prezzi/versioni/pre-deploy (post worker implementation + test E2E)
- [ ] Contenuti SEO (guide adblock+VPN, FAQ AEO, blog)
- [ ] Monitoring: alert balance + dashboard admin costo + alert errori API + report margine settimanale
- [ ] Analytics funnel (upsell→click, checkout, prima connessione, upgrade)
- [ ] Anti-churn (email pre-scadenza, win-back, downgrade, dashboard valore)
- [ ] CHECKLIST GO-LIVE (no leak IP/DNS, kill-switch, gating 403, congruenza)
- [ ] Canali: Telegram EN + email Pro + social + in-app · Deploy multi-browser+store

---

## FAILED APPROACHES (non riprovare)
- VPN-estensione instradante nel browser con VPNresellers → NO proxy HTTP/SOCKS (verificato).
- $1,99 × N device → è $1,99/utente fino a 10 connessioni.
- VPN nel trial / nei referral → costo reale.
- Lifetime con VPN → una tantum insostenibile su costo ricorrente.
- Cap banda tecnico → API non espone GB.

## DO NOT
- NON lasciare /vpn/* senza gating server-side.
- NON chiamare il tier "Pro+" (è "Premium").
- NON aggiornare doc pricing pubblici prima del test E2E.
- NON lanciare la VPN prima del test multi-device.
- NON loggare traffico/IP/siti utente (solo stato connessione per billing).
