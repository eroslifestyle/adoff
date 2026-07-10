# Project Global TOD — AdOff ChromePlugin

**Main HEAD**: e71cfca · **Branch**: master · **Updated**: 2026-07-10 20:20

## ✅ Done (ultimi 30, evidence-gated)

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

_(vuoto)_

## ⬜ Backlog (prossimi, in ordine di priorità)

- [ ] **AUTOFIX-ADMIN-TAB** — Tab "Auto-Fix / Ad-Leak" in admin dashboard
      Comando: `curl -s "https://api.adoff.app/admin/autofix/status" -H "X-Admin-Token: $ADMIN_TOKEN"`
      Done when: endpoint ritorna JSON con siti testati/leak/trend + tab visibile in admin
- [ ] **AUTOFIX-PRIVACY-I18N** — Aggiornare privacy policy 15 lingue con clausola diagnostica opt-in
      Comando: `grep -l "Diagnostica" "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site/privacy/"*.html | wc -l`
      Done when: tutte e 15 le privacy policy contengono la clausola consenso opt-in
- [ ] **AUTOFIX-BROAD-DOMAIN-QUALITY** — Qualità candidate rules: `||bat.bing.com^` (Vimeo) è tracking Microsoft legittimo; `||amazon-adsystem.com^` (Twitch) potrebbe impattare embed Amazon
      Comando: `cd "/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/autofix" && node analyze_and_fix.mjs --verbose`
      Done when: candidate rules con 0 false-positive tracking (solo real ad-network)
- [ ] **EDGE-EXPIRY-2026-09** — Rinnovare EDGE_API_KEY scaduta 2026-09-20
      Comando: vai su https://partner.microsoft.com/dashboard/microsoftedge/publishapi → Create/Renew API credentials
      Done when: tab Edge in admin mostra "Credenziali valide — pronto per upload/publish"

## 🚫 Deferred / Blocked / Waived

- [~] **GA4-HISTORICAL** — GA4 proprietà nuova (2026-07-09), dati crescono col tempo — attesa naturale

## Cross-ref

- Decisioni: `progetti/AdOff/decisioni/`
- Sessioni: `progetti/AdOff/sessioni/`
- Audit: `progetti/AdOff/audit/`
