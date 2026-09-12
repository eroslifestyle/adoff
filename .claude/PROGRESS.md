# AdOff — Progress Tracker

## Sessione 2026-07-10 (sera): Sblocco deploy autofix (wrangler login OAuth)

Sbloccati i 2 deploy pendenti dopo `wrangler login` OAuth (token CF era D1-only).

- [x] `wrangler login` OAuth completato (account erosdegrande@gmail.com / ErosLifeStyle) — permessi Workers/KV/Pages ora attivi. Gotcha: redirect_uri fisso su localhost:8976, servita pulizia processi wrangler duplicati prima del login pulito; CF_ACCOUNT_ID nel .env ha virgolette → `tr -d` prima di export
- [x] DEPLOY-WORKER: `wrangler deploy` adoff-license-api (v1e7bf168) + `admin.html` sync in KV (`admin:html`)
- [x] Seed `site/autofix-status.json` (shadow mode: 24 open leaks, 0 fixed, 28 rules) — il file lo genera nightly.sh ma non era mai girato; ora presente per l'endpoint
- [x] DEPLOY-SITE: `wrangler pages deploy` site/ branch main → privacy section 14 GDPR live su 16 lingue + rules-feed + autofix-status.json
- [x] VERIFICA endpoint `/admin/autofix/status` → JSON `{ok:true, open_leaks:24, fixed_leaks:0, total_rules:28, shadow_mode:true}` ✅
- [x] VERIFICA privacy section 14 "Voluntary Diagnostic Data" live su EN/IT/root (con -L per redirect extensionless) ✅
- [x] Commit a4e57c2 + push su master
- [ ] EDGE-EXPIRY-2026-09: rinnovare EDGE_API_KEY su Partner Center (scadenza 2026-09, non urgente)

## Sessione 2026-05-18: Decisioni social + Thin admin UI (sblocco audit)

Ripresa da CP_20260517_2124. Risolti TODO #1 (ridotto) e #2; costruito TODO #4.

- [x] Decisioni utente: scope Meta = **solo brand AdOff** → Standard Access (Business Verification SALTABILE); device IG = Android; Pagina FB già collegata [risolto TODO #2]
- [x] Runbook aggiornato: blocco DECISIONI LOCKED, sequenza A0 Android IG→Business, A2 saltabile, checklist
- [x] `scripts/social_queue.sql` — schema `social_posts` + `social_published` + viste (pattern youtube_queue)
- [x] `scripts/social_publish.py` — libreria+dispatcher: creator_info TikTok, page_info Meta, TikTok Direct Post FILE_UPLOAD+poll, IG container→publish, FB Page; CLI `--dispatch`/`--once`
- [x] `admin-ui/app.py` + `templates/publish.html` — thin admin UI FastAPI audit-conforme [risolto TODO #4]
- [x] `requirements.txt` + `infra/adoff-admin-ui.service` + `infra/adoff-social-dispatch.{service,timer}` + .gitignore segreti
- [x] Runbook Parte C: da "da costruire" a spec concreta + setup leobox; py_compile OK
- [x] TODO #1 RISOLTO: IG convertito Creator→**Business** (prerequisito C1 ok)
- [x] STEP 2 META COMPLETO: app `AdOff Publisher` (965237719818838) + casi d'uso Instagram+Pagina + 6 permessi "Pronta per il test"; System User `adoff-sysuser` + token non scadente; `scripts/meta_bootstrap.py` creato; `.secrets/meta_app.json` scritto (ig_user_id 17841414442557578, fb_page_id 1062260056978225); `page_info_meta()` verificato end-to-end ✅
- [x] Fix collaterale: TTS Studio `/api/img/formats` 404 → server riavviato + fallback formati frontend (index.html resiliente)
- [x] STEP 2 TikTok COMPLETO: app `AdOff` (org AdOff) + Sandbox + Login Kit + Content Posting API (Direct Post) + scope video.publish/video.upload/user.info.basic; `scripts/tiktok_oauth.py` creato; `.secrets/tiktok_app.json` + `tiktok_oauth.json` scritti (open_id -000XL8NO3...); `creator_info_tiktok()` verificato end-to-end ✅. Production form bloccato su video demo (atteso → post-deploy + Submit for review)
- [x] TODO #5 COMPLETO: variante render SENZA logo TikTok — `video-engine/src/brand.tsx` Wordmark legge `getInputProps().noLogo`→null; flag `--no-logo` in batch-render.mjs/render.mjs; default legacy invariato; validato e2e (still before-after con/senza logo). Bespoke `tiktok-adoff` ha scena logo propria → TikTok usa template bank con --no-logo
- [x] Workflow n8n `14-social-enqueue.json` COMPLETO: legge bank manifest → INSERT idempotente social_posts draft per IG/FB/TikTok (TikTok→`__nologo.mp4`+no_logo_variant) + digest Telegram. Validato 3-layer (JSON/typeVersion/JS/connessioni)
- [x] DEPLOY CORE su leobox (ambiente Claude È leobox): symlink `/home/mrxxx/adoff`→Dropbox; `social_queue.sql` applicato (social_posts/published/ready/inbox); venv admin-ui + deps; systemd `adoff-admin-ui.service` (LIVE 127.0.0.1:8790, auth OK, bug Starlette TemplateResponse fixato) + `adoff-social-dispatch.timer` (attivo, ogni 10min, no-op finché 0 approvati); workflow `14-social-enqueue` importato in n8n (active, cred PG reale `adoff-pg-autopilot-credential-1234`) — pending reload n8n per registrare schedule. Credenziali admin UI in `.secrets/admin-ui.env`
- [ ] Esporre admin UI su HTTPS (Cloudflare Tunnel/Caddy) + media_public_url per IG/FB + file TikTok in /opt/n8n/local-files
- [ ] Reload n8n (infra condivisa, scelta utente) per attivare schedule wf 14
- [ ] Video demo flusso admin UI (sandbox TikTok) + Submit for review Production
- [ ] Deploy pipeline NotebookLM (wf 12/13 + notebooklm-worker) — sessione separata, stesso path /home/mrxxx/adoff ora valido

## Sessione 2026-05-17 (sera): Pipeline NotebookLM→YouTube + Autorizzazioni Social API

Pipeline YouTube long-form via NotebookLM (no API → worker Playwright) + ricerca/runbook autorizzazioni IG/TikTok/FB.

- [x] Schema DB `adoff_autopilot.youtube_queue` + `youtube_published` + vista `youtube_ready` — `n8n-workflows/scripts/youtube_queue.sql` [20:50]
- [x] `notebooklm-worker.py` — worker Playwright profilo Chrome persistente leobox, A=Video Overview + B=Audio Deep Dive→ffmpeg 1080p (modi --login/--selftest/--probe) [21:00]
- [x] `youtube-upload.py` — upload resumable YouTube Data API v3 (OAuth refresh, --auth) [21:05]
- [x] `12-youtube-factory.json` (enqueue) + `13-youtube-publisher.json` (meta LLM→upload→Telegram) — clone pattern content-factory [21:10]
- [x] `data/youtube-seeds.json` + `infra/notebooklm-worker.service` + `.gitignore` segreti [21:12]
- [x] `docs/notebooklm-runbook.md` + update `automation/ORCHESTRAZIONE-SKILL-N8N.md` [21:14]
- [x] Validazione 3-layer OK: JSON validi, py_compile, node types/typeVersion vs workflow esistenti, connessioni integre, 0 irraggiungibili [21:16]
- [x] Ricerca web profonda IG/TikTok/FB auto-publish 2026 (API ufficiali vs aggregatori vs self-hosted) [21:18]
- [x] `docs/social-api-authorization-runbook.md` — step-by-step TikTok audit + Meta App Review, caveat UX headless + soluzione thin-UI [21:20]
- [~] STEP 1 utente in corso: conversione IG → Business (utente non trova "Impostazioni e privacy" — troubleshooting UI in corso)

### TODO prossima sessione (vedi checkpoint CP_20260517_2124.md)
- Sbloccare conversione IG→Business (capire device/UI utente), poi creare/collegare Pagina FB
- Decisione utente pendente: pubblicazione solo brand AdOff (Standard Access) vs terzi (Advanced+Business Verification)
- STEP 2: registrazione app Meta Developer + TikTok dev (campo per campo)
- Build thin admin UI (sblocca audit TikTok+Meta) + variante video SENZA logo per TikTok (ToS)
- Deploy pipeline NotebookLM su leobox (vedi notebooklm-runbook.md): SQL, profilo Google, OAuth YouTube, import-workflow, systemd

## Sessione 2026-05-17: Doc v3.3.3 + Pipeline Social Content S2-S6

- [x] Doc allineata a v3.3.3 (CLAUDE.md, PRD-ADOFF.md, SICUREZZA-LICENZE.md)
- [x] Checklist apertura canali §7 chiusa (S1 DONE: TikTok/IG/FB creati+configurati)
- [x] S2: `automation/hook-bank.json` (12 brief da Bibbia, EN+IT, pilastri A/B/C/D/E) + `caption-prompt.md`
- [x] S4: `video-engine/src/schema.ts` + HookCard/BeforeAfter parametrizzati + `batch-render.mjs` (render reale validato)
- [x] S5: `automation/content-factory.workflow.json` (9 nodi n8n) + `render-worker.md`
- [x] S3: `automation/tts-runbook.md` (variante voiced opzionale via /tts-pro; parametrizzazione = follow-up non bloccante)
- [~] S6: batch render content bank EN+IT → `video-engine/output/bank/` (in corso)
- [x] `automation/README.md` aggiornato (da "DA COSTRUIRE" → pipeline attiva)

### TODO prossima sessione
- Verificare/validare 2-3 clip a campione della content bank
- Deploy `content-factory.workflow.json` su leobox (import-workflow.py) + smoke test digest Telegram
- Estendere hook-bank alle 13 lingue tier-2 (pipeline traduzione)

## Sessione 2026-04-21 (sera): Homepage Sales Rewrite + i18n Globale + SEO 2026

### Homepage riscritta come sales letter
- [x] Hero: headline diretta "Niente più pubblicità" + benefit-focused sub
- [x] Social proof: rimossi fake press badge, "1.2M+ ads bloccati", 4 browser stat
- [x] 6 testimonial con fonte Chrome Web Store (3 nuove aggiunte)
- [x] Sezione Free vs Pro: tabella 10 righe comparativa
- [x] Feature cards: benefit line su ogni card
- [x] Solution: pill AdOff + 3 bullet + CTA mid-page
- [x] 9 FAQ (3 nuove: velocità, sicurezza, compatibilità)
- [x] Pricing: "Rimborso 30 giorni" su ogni piano Pro
- [x] Schema: BreadcrumbList + FAQPage 9 items + ItemList + WebPage

### Free vs Pro allineato alla realtà
- [x] Free: + "Blocco video ads base (rete)" come feature positiva
- [x] Pro: "Neutralizzazione video avanzata (IMA stub)" + ad skipper + stealth
- [x] Pricing cards + comparison table + feature cards aggiornati

### SEO 2026
- [x] hreflang 15 lingue su TUTTE le 11 pagine (era 6 solo su index)
- [x] robots meta max-image-preview:large su tutte le pagine
- [x] Meta title/description tradotti dinamicamente (15 lingue)
- [x] Sitemap riscritta: 172 URL con hreflang completo

### i18n globale completo
- [x] ~100 nuove chiavi i18n aggiunte a tutte le 15 lingue
- [x] 56 nuove pagine statiche tradotte (guide+privacy+terms+withdrawal × 14 lingue)
- [x] RTL Arabic supportato (dir="rtl" automatico)
- [x] install.html: trial banner + Free vs Pro comparison (tradotti 15 lingue)
- [x] support.html: license key opzionale per Free users
- [x] Footer: 6 nuove chiavi tradotte (best, community, press, vs.*)

### Nav + Footer fixati
- [x] Nav: STATIC_PAGES split EN-root / IT-root (due pattern diversi)
- [x] Nav: tutti i link language-aware (?lang=XX o /XX/ prefix)
- [x] Nav: clean URLs (rimossi .html suffissi)
- [x] Nav: cambio lingua non scrolla a #pricing
- [x] Footer: tutti i link con data-i18n + language-aware
- [x] Footer: clean URLs

### Bug fixati
- [x] FAQ faq.a5: data-i18n → data-i18n-html (link Privacy renderizzato)
- [x] /it/guide e /it/terms servivano homepage → creati file IT
- [x] guide.html root: title inglese → italiano
- [x] community.html: badge "Coming soon" sui placeholder
- [x] Temp file ru/press.html.tmp eliminato

### Checkpoint: CP_20260421_2200.md

## TODO (prossima sessione)

- [ ] SEO server-side: homepage ?lang= mostra sempre IT a Googlebot (client-side only)
- [ ] Bing: submittere sitemap aggiornata (172 URL)
- [ ] Upload CWS/Edge/Firefox con 15 lingue
- [ ] Creare account social (GitHub, Discord, Telegram)
- [ ] Testare RTL Arabic rendering completo
- [ ] Creare OG image 1200x630
- [ ] Lanciare su Product Hunt + HN + Reddit
- [ ] Creare profili (AlternativeTo, Product Hunt, Wikidata, G2)
- [ ] Valutare salesletter.html: aggiornare o rimuovere

## Sessione 2026-04-21 (mattina): Salesletter + i18n Infrastruttura

- [x] Fix dropdown lingue app (da 7 a 15 opzioni) [01:00]
- [x] Fix i18n sito: da 6 a 15 lingue (9 lingue aggiunte con traduzioni complete) [01:30]
- [x] Skill sales-copywriting creata (PAS+4Ps, trigger psicologici, CRO, skills.sh) [02:00]
- [x] Pagina demo salesletter creata (/salesletter.html, 13 sezioni) [02:15]
- [x] Homepage riscritta come salesletter completa [02:30]
- [x] 153 chiavi data-i18n nella homepage, tutte tradotte in 15 lingue [03:00]
- [x] Nav condiviso (nav.js) con data-i18n + localStorage persistenza lingua [03:00]
- [x] Footer condiviso (footer.js) con data-i18n, identico su 113 pagine [03:15]
- [x] Rimossi footer hardcoded da tutte le 113 pagine [03:15]
- [x] Tutti i path assoluti (/nav.js, /footer.js, /i18n.js, /assets/) [03:30]
- [x] Persistenza lingua con localStorage (scelta utente mantenuta cross-pagina) [03:30]
- [x] Checkout Stripe multilingua (locale passato dal frontend al worker) [03:30]
- [x] Ordine lingue alfabetico (sito + app) [03:40]
- [x] Cache fix definitivo: no-cache, no-store sui JS + nomi file stabili [04:00]
- [x] Favicon fix: path assoluto /assets/icon128.png su tutte le pagine [03:45]
- [x] Deploy worker CF aggiornato (locale Stripe) [03:30]
- [x] Pulizia file JS vecchi (10 file eliminati) [04:00]
- [x] Checkpoint + documentazione [04:00]

## Sessione 2026-04-20: Marketing & SEO Mega Sprint

- [x] Ricerca marketing completa (SEO, AI, growth, competitor, social) [22:00]
- [x] Audit sito (score 1.2/10 → 7.5/10) [22:00]
- [x] Schema markup JSON-LD (SoftwareApplication + FAQPage + Organization) [22:00]
- [x] sitemap.xml (112 URL, hreflang 15 lingue) [22:00]
- [x] robots.txt + _headers CF Pages [22:00]
- [x] Meta tag SEO su tutte le pagine esistenti (7 pagine) [22:00]
- [x] 7 nuove pagine contenuto EN (vs x3, how-it-works, best-2026, community, press) [22:00]
- [x] 98 pagine tradotte (14 lingue x 7 pagine) [22:00]
- [x] App i18n.js: da 6 a 15 lingue (3613 righe) [22:00]
- [x] Keyword research 15 mercati (500+ keyword) [22:00]
- [x] Social Media Kit + Marketing Strategy docs [22:00]
- [x] Google Search Console verificato + Bing Webmaster Tools [22:00]
