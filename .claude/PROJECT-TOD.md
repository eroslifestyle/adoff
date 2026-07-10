# Project Global TOD — AdOff ChromePlugin

**Main HEAD**: b4b4c7b · **Branch**: master · **Updated**: 2026-07-10

## ✅ Done (ultimi 30, evidence-gated)

- [x] **PHASE0-AUTOFIX-2026-07-10** — Canale hotfix syncRemoteRules riattivato + YT-Pro-only + Paramount+ SSAI + test Playwright PASS · commit `2e64a9c` + `cc2785e`
- [x] **AUTOFIX-FASE1-2026-07-10** — Survey opt-in arricchito LIVE (uninstall form con checkbox consenso + domain opzionale) + D1 adleak_reports + worker v2742 · commit `5ccc975`
- [x] **AUTOFIX-FASI2-6-2026-07-10** — Sistema auto-fix notturno completo (crawler+analisi+guardrails+reporting+orchestrazione) in `sviluppo/autofix/` · commit `622fff9`
  - crawler Playwright (16 siti, 4 segnali leak, xvfb headed)
  - analyze_and_fix.mjs (candidate rules id 60000+, dedup fingerprint)
  - canary suite + snapshot.sh + report.mjs + autofix_nightly.sh
  - SHADOW_MODE=1 default (no auto-deploy)
- [x] **DEPLOY-3529-2026-07-10** — v3.5.29 deploy CWS (published OK) + AMO (signed xpi) + Site (pages.dev) + Telegram msg 65 · Edge: draft loaded, manca Submit for review da UI
- [x] **ADMIN-SEO-EDGE-2026-07-10** — Tab SEO/AEO + Edge admin funzionanti · commit `613b917` + `51f788e` + `b4b4c7b`
- [x] **GA4-FULLSTACK-2026-07-10** — Tag GA4 site-wide + proprietà GA4 "AdOff Website" (G-RSF32N97JC, PID 539860764) · commit `51f788e`
- [x] **EDGE-API-KEY-RENEW-2026-07-10** — EDGE_API_KEY rinnovata (Partner Center) + worker updated · live verified

## 🔄 In Progress (max 5)

_(vuoto)_

## ⬜ Backlog (prossimi, in ordine di priorità)

- [ ] **EDGE-EXPIRY-2026-09** — Rinnovare EDGE_API_KEY scaduta 2026-09-20 (Partner Center)
      Comando: vai su https://partner.microsoft.com/dashboard/microsoftedge/publishapi → Create/Renew API credentials
      Done when: tab Edge in admin mostra "Credenziali valide — pronto per upload/publish"
      Riferimento: `memory/project_admin_seo_edge_tabs_fix.md`

## 🚫 Deferred / Blocked / Waived

- [~] **GA4-HISTORICAL** — GA4 proprietà nuova (2026-07-09), dati crescono col tempo — attesa naturale

## Cross-ref

- Decisioni: `progetti/AdOff/decisioni/`
- Sessioni: `progetti/AdOff/sessioni/`
- Audit: `progetti/AdOff/audit/`
