# Project Global TOD — AdOff ChromePlugin

**Main HEAD**: 580e151 · **Branch**: master · **Updated**: 2026-07-11 12:40

## ✅ Done (ultimi 30, evidence-gated)

- [x] **ADMIN-AUTOFIX-DEC-2026-07-11** — Worker: 4 endpoint autofix + D1 schema (autofix_leaks + autofix_decisions) + D1 populated con 24 leak. UI shell (3 bucket, card leak, CTA) ma RENDERING BUG: loadAutofixLeaks() non popola il DOM nonostante API funzionante. Files: worker.js, admin.html, auto_decide.mjs, push_dashboard.mjs, apply_decisions.mjs, fp-heuristics.json · commit `0d58708`
- [x] **ADMIN-EDGE-AUTOFIX-TABS-2026-07-11** — Tab Edge + Autofix vuoti: panel seo/edge/autofix fuori da #page-stats → switchStatsTab() non li trovava → schermata vuota. Fix: chiusura panel seo + spostamento edge/autofix dentro #page-stats + chiusura corretta. KV admin:html aggiornato + worker ridistribuito. Endpoint funzionanti: `/admin/edge/status` (state:ok) + `/admin/autofix/status` (ok:true, 28 rules, 24 open leaks, shadow mode) · commit `580e151`
- [x] **DEPLOY-WORKER-2026-07-10** — wrangler login OAuth + worker deploy + admin.html KV sync · commit `a4e57c2`
  Endpoint `/admin/autofix/status` → JSON `{ok:true, open_leaks:24, fixed_leaks:0, total_rules:28, shadow_mode:true}` ✅
- [x] **DEPLOY-SITE-2026-07-10** — wrangler pages deploy (privacy section 14 GDPR live 16 lingue) · commit `a4e57c2`
  autofix-status.json seeded + pubbl. + rules-feed sync ✅ (progr: commit `89a009d`)
- [x] **AUTOFIX-ADMIN-TAB-2026-07-10** — Tab Autofix + /admin/autofix/status in admin · commit `aa6f504`
  ✅ Deploy completato (wrangler login OAuth sbloccato il token D1-only)
- [x] **AUTOFIX-PRIVACY-I18N-2026-07-10** — Section 14 in all 16 privacy pages (GDPR opt-in) · commit `8f4def8`
  ⚠️ Deploy site: wrangler pages deploy
- [x] **AUTOFIX-BROAD-DOMAIN-QUALITY-2026-07-10** — no-op: bat.bing.com + amazon-adsystem.com già domain-scoped
- [x] **AUTOFIX-SYNC-VERIFIED-2026-07-10** — syncRemoteRules() verificato in tutti e 3 i target (Chrome/Firefox/Safari), 20 rule remote (id 60000+) attive, Playwright test PASS · commit `37bf562`
- [x] **AUTOFIX-SHADOW-VALIDATE-2026-07-10** — 3 bug critici + 4 fix secondari · commit `ed84839` + `330b48f` + `f294139`
  - Bug 1: `sourceDomain` in `urlFilter` (era `||domain^|source` → 85 validation errors) → fix: `domains[]` array
  - Bug 2: `extractDomain` ignorava multi-part TLDs → `||co.uk^` catastrofico → fix: `registrableDomain()`
  - Bug 3: `VALID_RESOURCE_TYPES` aveva `fetch` ma non `xmlhttprequest` → fix: xmlhttprequest
  - Bug 4: canary_runner non applicava candidate rules → fix: `launchPersistentContext` + `updateDynamicRules` range 65000+
  - Bug 5: canary.json canary_sites vs canaries mismatch → fix: unificato
  - Bug 6: deploy su branch main (Production), non production (Preview)
- [x] **AUTOFIX-DEPLOY-LIVE-2026-07-10** — 8 candidate rules (domain-scoped) merged in rules-feed.json + CF Pages main → adoff.app/rules-feed.json live (28 rules, 8 new) · commit `e71cfca`
- [x] **PHASE0-AUTOFIX-2026-07-10** — syncRemoteRules riattivato + YT-Pro-only · commit `2e64a9c` + `cc2785e`
- [x] **AUTOFIX-FASE1-2026-07-10** — Survey opt-in arricchito LIVE · commit `5ccc975`
- [x] **AUTOFIX-FASI2-6-2026-07-10** — Sistema auto-fix notturno completo · commit `622fff9`
- [x] **DEPLOY-3529-2026-07-10** — v3.5.29 deploy CWS + AMO + Site + Telegram msg 65
- [x] **ADMIN-SEO-EDGE-2026-07-10** — Tab SEO/AEO + Edge admin funzionanti · commit `613b917`
- [x] **GA4-FULLSTACK-2026-07-10** — GA4 site-wide (G-RSF32N97JC) · commit `51f788e`
- [x] **EDGE-API-KEY-RENEW-2026-07-10** — EDGE_API_KEY rinnovata

## 🔄 In Progress (max 5)

*(nessuno — tutti i task attivi sono stati completati)*

## ⬜ Backlog (prossimi, in ordine di priorità)

- [ ] **EDGE-EXPIRY-2026-09** — Rinnovare EDGE_API_KEY scaduta 2026-09-20
      Comando: vai su https://partner.microsoft.com/dashboard/microsoftedge/publishapi → Create/Renew API credentials
      Done when: tab Edge in admin mostra "Credenziali valide — pronto per upload/publish"

## 🚫 Deferred / Blocked / Waived

- [~] **GA4-HISTORICAL** — GA4 proprietà nuova (2026-07-09), dati crescono col tempo — attesa naturale

## Cross-ref

- Decisioni: `progetti/AdOff/decisioni/`
- Sessioni: `progetti/AdOff/sessioni/`
- Audit: `progetti/AdOff/audit/`
