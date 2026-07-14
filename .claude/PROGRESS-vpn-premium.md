# PROGRESS — AdOff Premium (VPN & DNS redesign)

> Stato esecutivo del progetto. Design congelato in `.claude/PLAN-vpn-dns-redesign.md` (102 decisioni AQ).
> Aggiornare ad ogni step. Checkpoint a fine di ogni fase.

## Stato: PIANIFICAZIONE COMPLETA — non ancora iniziata l'implementazione

---

## TODO BOARD

### FASE 0 — Sicurezza & fix ⬜ (prossima)
- [ ] Estrarre modulo VPN separato dal worker.js
- [ ] Gating server-side /vpn/* (token ECDSA tier=premium) — bloccante
- [ ] Fix `/vpn/create` (username+password generati)
- [ ] Fix `/verify-mobile-license` 405 (gestire GET) + verifica firma ECDSA client Dart
- [ ] Cron CF giornaliero: auto-disable inattivi 7gg + abbonamenti scaduti + auto-riattiva trasparente
- [ ] 1 account VPN ↔ deviceId lock + rate-limit /vpn/create + anti-replay + binding config + audit log
- [ ] **GATE**: test empirico multi-device WireGuard VS OpenVPN (3 device)

### FASE 1 — Tier Premium & pulizia ⬜
- [ ] Checkout Stripe: SKU Premium (€4,99/mo · Founder €29,99→€49,99 · std €49,99) price_data inline + founder pool separato
- [ ] Multi-valuta (prezzi fissi psicologici) + PayPal + Apple/Google Pay + crypto (BTCPay/Coinbase, USDT/USDC)
- [ ] Licenza flag `tier: premium` + token firmato + upgrade Pro→Premium proration
- [ ] Provisioning account VPN al primo uso (fix flusso)
- [ ] Rimuovere UI VPN dal popup → upsell (banner + sezione + options)
- [ ] Badge 3 livelli Free/Pro/Premium
- [ ] Cap 3 device + gestione device self-service /account

### FASE 1bis — Test E2E ⬜ (gate pre-doc)
- [ ] Stripe test mode checkout completo
- [ ] Account VPNresellers test reale (create/enable/config/disable)
- [ ] Connessione VPN reale 3 device
- [ ] Gating: non-Premium → 403

### FASE 2 — VPN reale mobile + DNS Guard ⬜
- [ ] VpnService mobile: DNS-filter → tunnel reale (protocollo da test Fase 0)
- [ ] Kill-switch (mobile VpnService + desktop firewall)
- [ ] DNS Guard freemium: blocklist statica grande + update remoto (rules-feed)
- [ ] App desktop Tauri (riusa UX vpn-tray) — in parallelo mobile
- [ ] Feature Premium: auto-rotation + fast-connect + country-lock
- [ ] Gating Premium mobile/desktop + dichiarazioni privacy store native

### FASE 3 — Lancio & comunicazione ⬜
- [ ] PRICING-PLAN.md + constants.json + pagine pricing (post test E2E)
- [ ] Messaging 15 lingue + landing /premium + VPN Policy doc + pagine vs/ competitor
- [ ] Contenuti SEO (guide adblock+VPN, FAQ AEO, blog)
- [ ] Monitoring: alert balance + dashboard admin costo + alert errori API + report margine settimanale
- [ ] Analytics funnel (upsell→click, checkout, prima connessione, upgrade)
- [ ] Anti-churn (email pre-scadenza, win-back, downgrade, dashboard valore)
- [ ] Congruenza pre-deploy + CHECKLIST GO-LIVE (no leak IP/DNS, kill-switch, gating 403, congruenza)
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
