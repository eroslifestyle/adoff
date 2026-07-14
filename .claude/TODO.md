# TODO — AdOff ChromePlugin

## Attivo
- [x] ~~**VPN provisioning nel webhook**: handleSubscriptionCreated → POST /vpn/create + save vpn_accounts D1~~
- [ ] **Premium VPN — Balance refill**: integrare ricarica automatica quando utenti Premium crescono (API VPNresellers non ha endpoint refill — solo manuale. Trigger: ~$50 rimanenti → alert owner + opzione auto-topup via pannello manuale. Attuale $25 → 0 utenti paganti → ok per ~12 mesi)
- [ ] **GATE lancio VPN**: test empirico multi-device (serve VPNRESELLERS_API_KEY in env)
- [ ] **Premium FASE 2**: VPN reale mobile (VpnService tunnel) + Kill-switch mobile + DNS Guard freemium (blocklist grande)
- [ ] **Premium FASE 3 completo**: contenuti SEO /guide, FAQ AEO, analytics funnel, anti-churn, CHECKLIST GO-LIVE, deploy multi-store
- [ ] **Post Telegram @adoffapp**: changelog v3.5.35 con immagine brand (post deploy)
- [ ] **Upload CWS + Edge + AMO**: v3.5.35

## Completati
- [x] **Riprogettazione VPN/DNS — 102 sessioni AQ** (18 blocchi) + 5 verifiche subagent — design congelato
- [x] **Premium VPN Sprint 1** (2026-07-14): FASE 0 backend ✅ + FASE 1 estensione ✅ + FASE 1+3 sito ✅ + FASE 2 mobile ✅ + FASE 2 desktop ✅ + GATE testato ✅ + congruenza Chat 7 ✅
- [x] **FASE 0 backend**: vpn-module.js + gating 403 (ECDSA P-256 tier=premium) + rate-limit + audit D1 + cron auto-disable + fix /verify-mobile-license GET. Deployato api.adoff.app (Version ID 7b6b6be6)
- [x] **FASE 1 estensione**: rimossa UI VPN dal popup + upsell Premium + badge Free/Pro/Premium (3 colori) + sezione options + Firefox/Safari sync
- [x] **FASE 1+3 sito**: landing /premium (15 lingue) + VPN Policy + vs/ NordVPN+ProtonVPN+AdGuard+Brave + SPEC-checkout-premium.md + constants.json _pending_vpn
- [x] **FASE 2 mobile**: crypto_keys.dart (JWK pubkey ECDSA) + DNS Guard expansion (refreshBlocklist cron 7gg)
- [x] **FASE 2 desktop**: AdOff-desktop/ scaffold Tauri 2.x (4 commands stub: verify_license, get_vpn_servers, get_vpn_config, create_vpn_account)
- [x] **GATE VPN**: testato e PASS — tutti /vpn/* bloccano 403 senza token Premium. smoke-test.sh QA continuo
- [x] **Wrangler login + deploy**: OAuth riuscito, worker deployato senza secrets esposti
- [x] Verificato: zero "Pro+" in codebase, prezzi congruenti €4,99/€29,99/€49,99, versione da manifest, zero PII leaks, sync Chrome/Firefox/Safari, no-log traffico/IP in vpn-module.js
- [x] Trial anti-crack ECDSA P-256
- [x] VPNresellers.com API configurata (balance $25, 82 server, $1,99/acct/mese)
- [x] Sprint 2 Checkout Premium (2026-07-14): checkout Stripe (3 piani €4.99/€29.99/€49.99) + founder pool D1 separato + webhook con tier nel payload + handleGetVpnToken bridge HMAC→ECDSA + E2E testato. Deploy v24e36eb1
- [x] Sprint 2 VPN Provisioning Webhook (2026-07-14): checkout.session.completed tier=premium → provisionVpnForCheckout → D1 vpn_accounts; subscription.deleted → disableVpnForCheckout. E2E testato. Deploy 91a72e3d
- [x] v3.5.0 — v3.5.34 rilasciati
