# AdOff AI Autopilot — RESUME (Session Restart Packet)

> **DOCUMENTO LIVE** — Aggiornato ad ogni milestone. Qualunque istanza di Claude Code che legge questo file può riprendere il lavoro esattamente da dove ci siamo fermati.
>
> **Path**: `d:\Dropbox\1_Forex\Programmazione\ChromePlugin\sviluppo\ai-autopilot\RESUME.md`

---

## STATO ATTUALE (2026-05-09)

**Fase**: Pre-Sprint 0 — piano approvato dal founder, in attesa di OK finale per uscire da plan mode e iniziare Sprint 0 (foundation).

**Progresso**: planning ✓ DONE · esecuzione ✗ NOT STARTED.

**Blocker**: nessuno. Piano definitivo + infrastruttura specifiche complete. Aspettiamo solo conferma "parti" dal founder per esecuzione Sprint 0 Day-1 task paralleli.

---

## CONTESTO PROGETTO

**Cosa è AdOff**: estensione browser MV3 (Chrome/Firefox/Edge/Opera/Safari) ad blocker universale con stealth anti-detection. v3.3.0 in produzione. 15 lingue. Sito adoff.app live su CF Pages. Backend completo (license-api, tickets, Stripe webhook, Telegram bot, Resend email).

**Cosa stiamo costruendo**: AI Autopilot end-to-end che gestisce pre-vendita + vendita + post-vendita + auto-fix + auto-deploy autonomamente.

**Founder**: zero budget cash, infrastruttura LLM locale completa già operativa.

**Hardware founder (leobox)**: GMKtec EVO-X2, AMD Ryzen AI Max+ 395 (Strix Halo), 8060S iGPU 40 CU, 128 GB LPDDR5X UMA, 2 TB NVMe LUKS2+TPM2, NPU XDNA 2 (50 TOPS, riserva Phase 7+).

**Stack inference già attivo**: Ollama (Vulkan), vLLM (ROCm 7.2), llama.cpp, LiteLLM Proxy gateway su leobox:4000.

---

## DOCUMENTI MASTER (leggere PRIMA di lavorare)

| Documento | Path | Scopo |
|---|---|---|
| **Piano Definitivo v1.1** | `sviluppo/ai-autopilot/PIANO-DEFINITIVO.md` | 700+ righe: architettura, 52 task, parallel groups, roadmap, risk register |
| Questionario decisioni | `sviluppo/ai-autopilot/AI-AUTOPILOT-QUESTIONARIO.html` | 25 domande con risposte commentate dal founder |
| Risposte founder | `sviluppo/ai-autopilot/adoff-autopilot-decisioni-2026-05-09-11-43.md` | Decisioni 25/25 + nota libera (server LLM locale) |
| Strategia precedente (SUPERSEDED) | `sviluppo/marketing/archive/STRATEGIA-LANCIO-AUTOMATIZZATO.md` | OBSOLETO: era marketing automation only, sostituito da AI Autopilot |
| Bibbia marketing | `sviluppo/marketing/strategia/ADOFF-BIBBIA-MARKETING.md` | Voce, brand, regole comunicazione |
| Social media kit | `sviluppo/marketing/strategia/SOCIAL-MEDIA-KIT.md` | Bio + thread + post template per 8 piattaforme |
| Pricing autoritativo | `docs/PRICING-PLAN.md` | 2.69/29.59/67.90 EUR (3 devices) |
| Project rules | `CLAUDE.md` (root) | Convenzioni, deploy rules, brand naming policy |
| Vault Obsidian hub | `D:\Dropbox\1_Forex\Programmazione\Eros_Obsidian\ErosTest\Progetti\AdOff\PRJ - AdOff.md` | Hub progetto con tutti i link |

---

## DECISIONI CRISTALLIZZATE (non rimettere in discussione)

### Approvate via questionario 25/25 + 4 chiarimenti

| Area | Decisione |
|---|---|
| **Scope modifiche AI** | Solo regole adblock + CSS + content sito (NO logica estensione, NO backend) |
| **Deploy** | Hybrid: regole direct CWS, codice canary 5%→25%→100% in 72h |
| **Gates umani** | pricing, legal, CWS perms, refund, comunicati pubblici |
| **Auto-rollback** | Crash >2x OR conv -25% OR rating -0.3★ in 24h |
| **Identità social** | Account brand "AdOff" + AI dichiarata in support, neutra in marketing |
| **Lingue** | Tier 1 (8) day-1: EN/ES/PT/DE/FR/IT/HI/RU. Tier 2 (7) +30: JA/KO/ZH/PL/TR/AR/ID |
| **Aggressività post** | Ultra-safe: 1-2 post/giorno per account |
| **Canali support** | Popup + sito + Telegram pubblico + email (no Discord per ora) |
| **KB sources** | Bibbia + codebase + tickets storici + reviews CWS/AMO/Edge |
| **Escalation** | refund/billing + 3-loop + legal keywords + user-asks + confidence <70% |
| **Bot lingue** | 15 lingue native |
| **Fonti feedback** | CWS + AMO + Edge reviews + Telegram + Reddit + Sentry + competitor crawl (NO usage-metrics, privacy preserved) |
| **Test gate** | Lint+build + Vitest + Playwright 15 siti + visual regression + contract tests |
| **Frequency deploy** | Event-driven (urgent subito + weekly martedì 09:00 UTC) |
| **CWS auto-publish** | Full-auto da subito (founder accetta rischio R3 mitigato) |
| **Content AI** | Blog SEO + vs/competitor + FAQ + release notes (NO doorway pages) |
| **Ads paid** | Reinvestire 20% MRR dopo 1K EUR/mese |
| **Roadmap** | AI propone top 5 mensili, founder picks 1-2 |
| **LLM stack** | LiteLLM routing: Qwen2.5-72B-abl + DeepSeek-R1-70B + Qwen Coder 32B + WhiteRabbitNeo 8B locali + GLM-4.6/MiniMax fallback + Claude Opus Pro OAuth |
| **Vector DB** | Cloudflare Vectorize |
| **Orchestrator** | n8n già su leobox (NO Oracle Cloud) |
| **Observability** | CF Analytics + Sentry Free + AI weekly self-monitor + Telegram alerts P0/P1/P2 + Uptime Kuma |
| **KPI primaria** | MRR (Monthly Recurring Revenue) |
| **Kill switch** | TUTTI 6 scenari (negative press, security, CWS reject, legal, payment, MRR -30% in 7gg) |

### Cambi v1.1 vs v1.0 piano

- Eliminato Oracle Cloud Free Tier (n8n già su leobox)
- LLM Gateway = LiteLLM esistente (no Worker custom)
- Costo runtime: 5-15 EUR/mese → **0 EUR/mese**
- Wall-clock launch: 65gg → **54gg**
- Wall-clock Tier 2: 90gg → **78gg**
- Ore founder: 200h → **150h**

---

## ARCHITETTURA NETWORK (critica)

```
┌────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE EDGE                           │
│  Workers (license-api, ai-gateway, support-bot, fix-loop)  │
│  Pages (adoff.app + 15 lingue)                             │
└──────────────┬─────────────────────────────────────────────┘
               │ HTTPS + Access MFA
               ▼
┌────────────────────────────────────────────────────────────┐
│       CF TUNNEL → leobox (n8n webhook + Open WebUI)        │
│       LLM endpoint NON esposti pubblicamente               │
└──────────────┬─────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────┐
│                  LEOBOX (Strix Halo, 24/7)                 │
│  n8n Docker → LiteLLM:4000 → Ollama/vLLM/llama.cpp         │
│                              ↓                              │
│                              MiniMax M2.5 / GLM-4.6 cloud   │
│                              Claude Opus Pro OAuth (DX01)   │
└────────────────────────────────────────────────────────────┘
                        ▲
                        │ Tailscale (admin only)
                        │ leobox:11434 / :8000 / :4000
                ┌───────┴────────┐
                │   Founder      │
                └────────────────┘
```

---

## PROSSIMI STEP IMMEDIATI

### Sprint 0 — Foundation (3 giorni, parti appena founder dice "OK parti")

#### Day 1 (parallel)

**TU (Founder, ~3h)**:
- T43 — Crea 8 account social Tier 1 (bio già pronte in `sviluppo/marketing/strategia/SOCIAL-MEDIA-KIT.md`):
  - GitHub Org `AdOff-App`
  - Twitter `@AdOffApp`
  - Reddit `u/adoff_dev`
  - Mastodon `@adoff@fosstodon.org`
  - Discord server "AdOff Community"
  - Product Hunt maker profile
  - AlternativeTo profilo "AdOff"
  - Hacker News maker account
- T50 — Crea entry: Wikidata, AlternativeTo, Product Hunt

**IO (Claude Code, ~4h, parallel)**:
- T6 — Setup Cloudflare Vectorize index + pipeline embedding
- T7 — Setup Cloudflare D1 schema (bugs, leads, mentions, posts_queue, accounts, outreach)
- T8 — Setup Sentry su estensione + workers + frontend
- T9 — Estendi Telegram bot (worker-telegram) con kill switch /KILL, /approve, /status

#### Day 2 (parallel)

**TU + IO**:
- T4 — Configurazione CF Tunnel + Access MFA per webhook n8n da CF Workers
- T5 — Configurazione LiteLLM virtual keys + routing rules per task AdOff (config YAML su leobox)

**IO**:
- T22 — CWS reviews scraper (API ufficiale + fallback HTML)
- T23 — AMO reviews API integration
- T24 — Edge Add-ons reviews scraper

#### Day 3

**IO**:
- T10 — Ingestion pipeline KB: Bibbia + store-listing + manuale → chunks Vectorize
- T11 — Ingestion pipeline codebase (regole adblock + content scripts critici)
- T33 — Vitest unit tests setup (5 file, scaffold)

**Sprint 0 done** → Sprint 1 (Support bot AI) day 4.

---

## RIPRESA DA QUI (Per nuova istanza Claude Code)

### Se inizi una nuova sessione

1. **Leggi**: `CLAUDE.md` (root progetto) + questo `RESUME.md` + `PIANO-DEFINITIVO.md` se serve dettaglio task
2. **Verifica stato git**: `git status` + `git log --oneline -10`
3. **Identifica fase corrente** dal `## STATO ATTUALE` qui sopra
4. **Identifica prossimo task** dal `## PROSSIMI STEP IMMEDIATI`
5. **Verifica decisioni cristallizzate** sopra — non rimettere in discussione, sono validate dal questionario
6. **Cerca task TODO** in `## EXECUTION LOG` qui sotto

### Comandi utili setup ambiente

```bash
# Verifica versioni stores
grep '"version"' app/manifest.json app-firefox/manifest.json app-safari/manifest.json

# Verifica regole declarativeNetRequest
python -c "import json; print(len(json.load(open('app/rules/adblock-rules.json'))))"

# Verifica i18n
grep -oE "^\s*['\"]?[a-z]{2}['\"]?\s*:\s*\{" app/src/i18n.js | sort -u | wc -l

# Build attuale
node sviluppo/scripts/build.js --store    # CWS
node sviluppo/scripts/build.js            # Sito (obfuscation)

# Cloudflare
wrangler whoami
wrangler kv:namespace list
wrangler d1 list
```

---

## EXECUTION LOG (append-only, ogni task completato)

> Aggiungi qui ogni milestone con timestamp + outcome. Una nuova istanza Claude Code legge questo log per capire cosa è già stato fatto.

### 2026-05-09 — Planning Complete

- ✅ Audit completo sistema deployato (Explore agent)
- ✅ Questionario HTML 25 domande creato (`AI-AUTOPILOT-QUESTIONARIO.html`)
- ✅ Risposte founder raccolte (`adoff-autopilot-decisioni-2026-05-09-11-43.md`)
- ✅ 4 chiarimenti critici risolti (LLM specs, escalation, telemetria, CWS publish)
- ✅ Piano definitivo v1.0 creato (`PIANO-DEFINITIVO.md`)
- ✅ Specifiche LLM locale ricevute (Strix Halo + Ollama/vLLM/LiteLLM + 9 modelli + Tailscale + CF Tunnel)
- ✅ Piano definitivo v1.1 (eliminato Oracle, LLM gateway = LiteLLM, costi 0 EUR)
- ✅ RESUME.md creato (questo file)
- ⏳ In attesa: founder OK per uscire da plan mode e iniziare Sprint 0

### Sprint 0 — Foundation

- [ ] T43 — Account social Tier 1 (founder)
- [ ] T50 — Wikidata + AlternativeTo + ProductHunt entries (founder)
- [ ] T6 — CF Vectorize index + embedding pipeline
- [ ] T7 — CF D1 schema (bugs, leads, mentions, posts_queue, accounts, outreach)
- [ ] T8 — Sentry su estensione + workers + frontend
- [ ] T9 — Telegram bot kill switch + /approve + /status
- [ ] T4 — CF Tunnel + Access MFA per webhook n8n
- [ ] T5 — LiteLLM virtual keys + routing AdOff
- [ ] T22 — CWS reviews scraper
- [ ] T23 — AMO reviews API
- [ ] T24 — Edge reviews scraper
- [ ] T10 — KB ingestion: Bibbia + store-listing + manuale
- [ ] T11 — KB ingestion: codebase
- [ ] T33 — Vitest unit tests setup

### Sprint 1+ (vedi PIANO-DEFINITIVO.md sezioni 3-4 per task completi)

---

## CONTATTI & RIFERIMENTI

- **Repository**: `D:\Dropbox\1_Forex\Programmazione\ChromePlugin`
- **Sito**: https://adoff.app
- **License API**: https://api.adoff.app
- **Tickets worker**: https://adoff-tickets.workers.dev
- **Vault Obsidian AdOff**: `D:\Dropbox\1_Forex\Programmazione\Eros_Obsidian\ErosTest\Progetti\AdOff\`
- **Vault claude-memory**: `C:\Obsidian\claude-memory\` (sezione `wiki/progetti/chromeplugin.md`)
- **Founder identity** (vedi DEC privacy): solo email support@adoff.app, no contatti pubblici diretti

---

## CHANGELOG RESUME.md

- **2026-05-09 v1.0**: Creazione iniziale dopo planning AI Autopilot. In attesa OK Sprint 0 start.
