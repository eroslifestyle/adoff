# TODO — AdOff ChromePlugin

## Attivo
- [ ] **Premium VPN — FASE 0 (sicurezza)**: gating server-side /vpn/* (token ECDSA tier=premium), fix bug /vpn/create (email→username+password) e /verify-mobile-license (405 GET), cron auto-disable 7gg, modulo vpn-module.js separato. Vedi .claude/PLAN-vpn-dns-redesign.md + PROGRESS-vpn-premium.md
- [ ] **GATE lancio VPN**: test empirico multi-device WireGuard VS OpenVPN (3 device)
- [ ] Premium FASE 1: tier Premium €4,99/mo (Founder €29,99→€49,99), rimuovi VPN dal browser→upsell, badge Free/Pro/Premium
- [ ] Premium FASE 2: VPN reale mobile (VpnService tunnel) + app desktop Tauri + DNS Guard freemium
- [ ] Premium FASE 3: landing /premium 15 lingue, vs/ competitor, VPN Policy, lancio + Telegram EN
- [ ] Lanciare le 7 chat parallele (setup git worktree) — .claude/CHAT-PROMPTS-standalone.md
- [ ] Test manuale popup VPN (Chrome dev mode): Free vs Pro flow
- [ ] Post Telegram @adoffapp: changelog v3.5.35 con immagine brand
- [ ] Upload CWS + Edge + AMO: v3.5.35

## Completati
- [x] **Riprogettazione VPN/DNS — 102 sessioni AQ** (18 blocchi) + 5 verifiche subagent — design congelato
- [x] Verificato: VPNresellers $1,99/acct (non per-GB), 1 acct=10 conn (3 device=$1,99), NO proxy HTTP/SOCKS (VPN-estensione impossibile)
- [x] Prodotti: PLAN-vpn-dns-redesign.md, PROGRESS-vpn-premium.md, CHAT-PROMPTS-standalone.md, PROMPTS-vpn-parallel-chats.md
- [x] VPN popup JS+CSS (v3.5.35) — f2c490d
- [x] VPN backend worker deployato su api.adoff.app
- [x] VPNresellers.com API configurata (balance $25, 82 server)
- [x] Trial anti-crack ECDSA P-256
- [x] v3.5.0 — v3.5.34 rilasciati
