# CP_20260714_VPN_SPRINT2

## Goal
Sprint 2 AdOff Premium VPN — Checkout Stripe + handleGetVpnToken E2E testati.

## Progress/TODO Board
- [x] Checkout Stripe Premium (premium_monthly €4.99, premium_annual €49.99, premium_annual_founder €29.99)
- [x] Founder Premium pool D1 separato (founder_premium_seats)
- [x] Webhook checkout.session.completed: tier nel payload + KV + founder_seats
- [x] Route /founder-status-premium
- [x] handleGetVpnToken: bridge HMAC → ECDSA Premium token
- [x] Route POST /get-vpn-token
- [x] E2E test completo (license → token → vpn/create → vpn/config): PASS
- [ ] VPN provisioning nel webhook: handleSubscriptionCreated → POST /vpn/create + save vpn_accounts D1

## Failed Approaches
- VPNresellers API con auth `username:password` invece di Bearer → endpoint usa Bearer
- VPNresellers /account/list non esiste → usa /servers, /profile, /accounts
- Checkout senza /trial → solo ECDSA trial, non Premium
- verifyPremiumToken accetta solo ECDSA → licenze Premium sono HMAC → serve bridge

## Do NOT
- NON chiamare tier "Pro+" (è "Premium")
- NON loggare traffico/IP utente
- NON pubblicare pricing pubblici prima test E2E VPN completo
- NON lanciare VPN pubblicamente prima del test multi-device
- Balance VPNresellers: $25.00 (attuale) — ricaricare $100+ prima del launch

## Key Decisions
- tier = "premium" non "Pro+"
- pool founder separato D1 (founder_premium_seats vs founder_seats)
- Token payload include campo `t: tier`
- handleGetVpnToken come bridge tra HMAC (checkout) e ECDSA (vpn-module)
- Prezzi da constants.json _pending_vpn: €4.99/mo, €29.99/yr Founder, €49.99/yr std

## Current State
Worker deployed api.adoff.app v24e36eb1.
Checkout Stripe funzionante per 3 piani Premium.
handleGetVpnToken attivo: POST /get-vpn-token.
VPN provisioning E2E testato con successo.
Balance VPNresellers: $25.00 (82 server).
Account test eliminati.

## File Changes
sviluppo/license-system/worker.js (commit 1fc611c feat/premium-vpn):
  - PRICE_CONFIG esteso con premium_monthly/premium_annual/premium_annual_founder
  - getFounderPremiumCount() + handleFounderPremiumStatus()
  - handleCreateCheckout esteso per tier premium + founder gating
  - Webhook: tier nel payload + KV + founder_premium_seats
  - handleGetVpnToken (HMAC → ECDSA bridge)
  - Route /founder-status-premium + POST /get-vpn-token

## Setup
- Wrangler deploy: cd sviluppo/license-system && npx wrangler deploy
- Test locale: source ~/.secrets/adoff-stores.env
- Stripe: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- VPN: VPNRESELLERS_API_KEY
- Admin: ADMIN_TOKEN

## Resume Instructions
Prossimo passo: VPN provisioning nel webhook.
In sviluppo/license-system/worker.js, funzione handleStripeWebhook:
  - Su checkout.session.completed con tier=premium:
    1. Estrai deviceId da metadata (o genera)
    2. POST /vpn/create con deviceId → accountId
    3. Salva {deviceId, accountId} in D1 vpn_accounts
  - Su customer.subscription.deleted con tier=premium:
    1. Leggi accountId da vpn_accounts per customerId
    2. POST /vpn/disable per l'accountId
