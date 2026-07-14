# AdOff AI Autopilot — Piano Implementation Definitivo

> **Data**: 2026-05-09
> **Versione**: 1.1 (revisione post-specifiche LLM locale)
> **Stato**: Approvato post-questionario 25/25 + 4 chiarimenti + specifiche infra leobox
> **Founder**: zero-budget cash, infra completa già operativa (leobox Strix Halo + n8n + LiteLLM)
> **Target**: Sistema AI che gestisce pre-vendita + vendita + post-vendita + auto-fix + auto-deploy autonomamente

## Changelog
- **v1.2** (2026-05-15): **Pivot pilastro marketing**. Reddit Responsible Builder Policy (nov 2025) ha reso impossibile/ban-risk l'automazione community. Epic 5 social rielaborato in `sviluppo/marketing/strategia/STRATEGIA-SOCIAL-CONTENT-2026.md` (AUTORITATIVO per il social): T4 Reddit-hunter rimosso, T25 mention sentinel degradato a read-only, T43-T48 → S1-S9 (TikTok/IG/FB content-broadcast, Remotion+TTS, scheduling via tool terzo, zero engagement-bot). Reddit/forum/Quora fuori scope.
- **v1.1** (2026-05-09): Eliminato Oracle Cloud Free Tier (n8n già su leobox). LLM Gateway = LiteLLM esistente. Costi runtime 5-15 EUR/mese → 0 EUR/mese (fallback GLM-4.6 + MiniMax M2.5 + Claude Opus Pro OAuth). LLM routing aggiornato con modelli reali (Qwen2.5-72B-abl, DeepSeek-R1, Qwen Coder 32B, WhiteRabbitNeo, Qwen3-Embedding-8B, BGE-Reranker-v2.5). Architettura network Tailscale + CF Tunnel + Access MFA documentata.
- **v1.0** (2026-05-09): Piano iniziale post-questionario.

---

## 1. DECISIONI CONSOLIDATE

### 1.1 Boundaries autonomia AI (Sezione A)

| Parametro | Decisione | Riferimento |
|---|---|---|
| Scope modifiche codice AI | Regole adblock + CSS + content sito (no logica ext, no backend) | Q1 |
| Deploy autonomy | Hybrid: regole direct CWS, codice canary 5%→25%→100% in 72h | Q2 |
| Gates umani obbligatori | Pricing, legal pages, CWS perms, refund >10€, comunicati pubblici | Q3 |
| Auto-rollback trigger | Crash >2x baseline OR conversion -25% OR rating -0.3★ in 24h | Q4 |

### 1.2 Identità & comportamento social (Sezione B)

| Parametro | Decisione | Riferimento |
|---|---|---|
| Identità social | Account brand "AdOff" + AI dichiarata come assistente brand | Q5 |
| Disclosure AI | Trasparente in support, neutra in social marketing (voce "noi") | Q6 |
| Lingue lancio | Tier 1 (8) day-1: EN/ES/PT/DE/FR/IT/HI/RU. Tier 2 (7) day +30: JA/KO/ZH/PL/TR/AR/ID | Q7 |
| Aggressività post | Ultra-safe: 1-2 post/giorno, max 3 commenti per account | Q8 |

### 1.3 AI Customer Support (Sezione C)

| Parametro | Decisione | Riferimento |
|---|---|---|
| Canali bot support | Popup estensione + sito chat + Telegram pubblico + email auto-reply | Q9 |
| Knowledge base | Bibbia + codebase + storico tickets + reviews CWS/AMO/Edge | Q10 |
| Escalation triggers | Refund/billing + 3-round loop + legal keywords + **user-asks (forced)** + **confidence <70%** | Q11 + chiarimento 2 |
| Lingue bot | Tutte le 15 lingue native (Llama/Qwen multilingua) | Q12 |

### 1.4 Auto-Fix Loop (Sezione D)

| Parametro | Decisione | Riferimento |
|---|---|---|
| Fonti feedback | CWS reviews + AMO reviews + Telegram tickets + Reddit mentions + Sentry errors + competitor site changes (NO usage-metrics, privacy stance preserved) | Q13 + chiarimento 3 |
| Test gate pre-deploy | Lint+build + Vitest unit + Playwright smoke (15 siti) + visual regression (Percy) + contract test API | Q14 |
| Frequenza deploy | Event-driven: critical urgent immediato, normale weekly martedì 09:00 UTC | Q15 |
| CWS auto-publish | **Full-auto da subito** (founder accetta rischio CWS ban su prima release errata) | Q16 + chiarimento 4 |

### 1.5 Pre-vendita (Sezione E)

| Parametro | Decisione | Riferimento |
|---|---|---|
| Content AI auto-pubblica | Blog SEO 1-2/sett per lingua + vs/competitor mensili + FAQ da tickets + release notes | Q17 |
| Ads paid | Reinvestire 20% MRR in Google Ads dopo MRR > 1K EUR/mese | Q18 |
| Roadmap product | AI propone top 5 feature mensilmente da feedback aggregato, founder picks 1-2 | Q19 |

### 1.6 Stack tecnico (Sezione F) — RIVISTO v1.1

| Parametro | Decisione | Riferimento |
|---|---|---|
| Hardware host | **leobox**: GMKtec EVO-X2, AMD Ryzen AI Max+ 395 (Strix Halo), 8060S iGPU 40 CU, 128GB LPDDR5X UMA, 2TB NVMe LUKS2+TPM2 | spec utente |
| Inference engines | Ollama (Vulkan, default chat), vLLM (ROCm 7.2 batch), llama.cpp (custom batch), Lemonade NPU (Phase 7+) | spec utente D06 |
| LLM gateway | **LiteLLM Proxy** già operativo su leobox:4000 (OpenAI-compat, virtual keys, fallback, routing) | spec D09 |
| LLM Day-1 | Qwen2.5-72B-abl Q4 (chat) · DeepSeek-R1-Distill-70B-abl Q4 (reasoning) · Qwen2.5-Coder-32B-abl Q4 (coding) · WhiteRabbitNeo-8B (cybersec) · Qwen3-Embedding-8B FP16 · BGE-Reranker-v2.5 FP16 | spec D07/D08 |
| LLM cloud fallback | MiniMax M2.5 + GLM-4.5/4.6 via LiteLLM routing + Claude Opus Pro via OAuth (DX01) | spec utente |
| Vector DB | Cloudflare Vectorize (free tier 5M vectors/mo, integrato Workers) | Q21 |
| Orchestrator | n8n self-hosted Docker **già su leobox** (no Oracle Cloud) | Q22 + spec |
| Network esposizione | Tailscale (founder admin) + Cloudflare Tunnel + Access MFA (n8n webhook + Open WebUI only, NO LLM diretti) | spec D10 |
| Observability | CF Analytics + Sentry (free 5K events/mo) + AI weekly self-monitor + Telegram alerts P0/P1/P2 + Uptime Kuma + Healthchecks.io | Q23 + spec |
| Reliability | UPS 600-1000 VA, Btrfs snapper auto-snapshot, Docker unless-stopped, systemd ai-stack.target, SLA target ≥99.5% | spec D03 |

### 1.7 Business critical (Sezione G)

| Parametro | Decisione | Riferimento |
|---|---|---|
| KPI primaria AI | MRR (Monthly Recurring Revenue) | Q24 |
| Kill-switch scenari | TUTTI 6 attivi: negative press, security incident, CWS rejection, legal notice, payment issue, MRR -30% in 7gg | Q25 |

---

## 2. ARCHITETTURA SISTEMA

### 2.1 Topologia logica

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI AUTOPILOT ADOFF                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  EVENT BUS (CF Workers + n8n)                    │  │
│  │  Stripe webhook | Telegram inbound | CWS scrape | Sentry alert   │  │
│  │  Reddit mention | Cron schedule    | Form submit | API errors    │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                          │
│  ┌────────────────────────────▼─────────────────────────────────────┐  │
│  │                  AI BRAIN (Cloudflare Workers)                   │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │  Router    │→ │   RAG        │→ │   LLM Gateway          │  │  │
│  │  │ (decide    │  │  (Vectorize) │  │  ┌──────────────────┐  │  │  │
│  │  │  modello)  │  │  KB chunks   │  │  │ Local LLM Server │  │  │  │
│  │  └────────────┘  │  embeddings  │  │  │ Llama 3.3 70B    │  │  │  │
│  │                  └──────────────┘  │  │ Qwen 2.5 Coder   │  │  │  │
│  │                                    │  │ + altri          │  │  │  │
│  │                                    │  └──────────────────┘  │  │  │
│  │                                    │  ┌──────────────────┐  │  │  │
│  │                                    │  │ Claude API       │  │  │  │
│  │                                    │  │ (task critici)   │  │  │  │
│  │                                    │  └──────────────────┘  │  │  │
│  │                                    └────────────────────────┘  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                               │                                          │
│       ┌───────────┬───────────┼───────────┬───────────┐               │
│       ▼           ▼           ▼           ▼           ▼               │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │
│  │PRE-SALE│  │  SALE  │  │SUPPORT │  │FIX-LOOP│  │ROADMAP │         │
│  │SEO/Soc │  │Stripe  │  │FAQ AI  │  │R→B→F→D │  │AI prop │         │
│  │Content │  │Recovery│  │24/7    │  │Test gat│  │Founder │         │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘         │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              HUMAN-IN-LOOP GATES (Telegram bot)                  │  │
│  │  /approve {pricing|legal|publish|refund-large|public-statement}  │  │
│  │  /KILL → freeze tutto autopilot per 24h                          │  │
│  │  /status → dashboard MRR/installs/reviews/health                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data flow critico: Auto-Fix Loop

```
   ┌─────────────────┐
   │  CWS API        │
   │  AMO API        │
   │  Edge scraping  │      ┌────────────────┐      ┌──────────────────┐
   │  Telegram tick. │─────▶│   Sentinel     │─────▶│  Sentiment       │
   │  Reddit mention │      │   (n8n cron    │      │  Analyzer        │
   │  Sentry errors  │      │    every 30')  │      │  (Local Llama)   │
   │  Competitor crwl│      └────────────────┘      └────────┬─────────┘
   └─────────────────┘                                        │
                                                              ▼
   ┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
   │  Issue Tracker   │◀─────│  Bug Classifier│◀─────│  Topic Extractor │
   │  (D1 db: bugs)   │      │  (Local Llama) │      │  (Local Llama)   │
   └────────┬─────────┘      └────────────────┘      └──────────────────┘
            │
            ▼
   ┌──────────────────┐
   │  Patch Generator │      ┌──────────────────────────┐
   │  scope=rules|css │─────▶│  Test Gate               │
   │  |content-site   │      │  Lint+Build+Vitest       │
   │  (Qwen Coder +   │      │  +Playwright smoke 15    │
   │   Claude API     │      │  +Visual regression      │
   │   per critical)  │      │  +Contract test API      │
   └──────────────────┘      └──────────┬───────────────┘
                                        │ PASS
                                        ▼
                             ┌──────────────────────────┐
                             │  Deploy Pipeline         │
                             │  • Regole → CWS direct   │
                             │  • Codice → canary 5%    │
                             │  • Sito → CF Pages full  │
                             └──────────┬───────────────┘
                                        │
                                        ▼
                             ┌──────────────────────────┐
                             │  Health Monitor (1h)     │
                             │  Crash rate, conv, rate  │
                             │  → trigger rollback se   │
                             │     soglie superate      │
                             └──────────────────────────┘
```

### 2.3 LLM routing strategy — RIVISTA v1.1 (modelli reali leobox)

| Task | Modello primario | Engine | Fallback chain | Latenza | Volume |
|---|---|---|---|---|---|
| FAQ chat user-facing | Qwen2.5-72B-abl Q4 | vLLM ROCm batch | DeepSeek-R1-70B → MiniMax M2.5 | <2s | 5K query/giorno |
| Reasoning complesso (escalation triage) | DeepSeek-R1-Distill-70B-abl Q4 | Ollama Vulkan | GLM-4.6 → Claude Opus OAuth | <5s | 50/giorno |
| Sentiment analysis review | WhiteRabbitNeo-8B | Ollama Vulkan | Qwen2.5-72B locale | <300ms | 200/giorno |
| Bug classification | Qwen2.5-72B-abl Q4 | Ollama Vulkan | DeepSeek-R1-70B | <500ms | 50/giorno |
| Topic extraction batch | WhiteRabbitNeo-8B | Ollama Vulkan | Qwen2.5-72B | <300ms | 200/giorno |
| Content generation (blog/FAQ/release notes) | Qwen2.5-72B-abl Q4 | vLLM ROCm | DeepSeek-R1 | <30s | 30 article/sett |
| Translation IT→14 lingue | DeepL Free | DeepL API | Qwen2.5-72B (HI/AR/fallback) | <5s | 30×14/sett |
| Code patch (regole adblock JSON + CSS) | Qwen2.5-Coder-32B-abl Q4 | Ollama Vulkan | GLM-4.6 → Claude Opus OAuth | <10s | 5-20/sett |
| Code patch complesso (content-script logic) | Qwen2.5-Coder-32B + GLM-4.6 | LiteLLM routing | Claude Opus OAuth | <30s | 1-3/sett |
| Embedding RAG (KB ingestion) | Qwen3-Embedding-8B FP16 | vLLM batch 32 | — | <50ms/chunk | 50K total + 500/giorno |
| Reranking RAG retrieval | BGE-Reranker-v2.5 FP16 | vLLM | — | <100ms | 5K/giorno |
| Crisis response analysis | Claude Opus Pro (OAuth) | Anthropic API | DeepSeek-R1 → GLM-4.6 | <30s | <1/mese |
| Cybersec analysis (threat detection) | WhiteRabbitNeo-8B v2 | Ollama Vulkan | Qwen2.5-72B-abl | <500ms | on-demand |

**Cost estimate v1.1**: **0 EUR/mese runtime** (LiteLLM routing usa solo locali + cloud fallback già in possesso founder via OAuth).

### 2.4 Architettura network — NUOVA v1.1

```
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE EDGE (workers + pages)              │
│  api.adoff.app · adoff-tickets.workers.dev · adoff.app      │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS + Access MFA
               ▼
┌─────────────────────────────────────────────────────────────┐
│        CLOUDFLARE TUNNEL → leobox (n8n webhook only)        │
│        Open WebUI (founder), nessun LLM endpoint pubblico   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                 LEOBOX (Strix Halo, 24/7)                   │
│  ┌───────────┐    ┌──────────┐    ┌──────────────────────┐ │
│  │   n8n     │───▶│ LiteLLM  │───▶│ Ollama (Vulkan)      │ │
│  │ Docker    │    │  :4000   │    │ vLLM (ROCm batch)    │ │
│  │ workflow  │    │ gateway  │    │ llama.cpp            │ │
│  └───────────┘    └─────┬────┘    └──────────────────────┘ │
│                         │                                    │
│                         └─▶ MiniMax M2.5 (cloud)            │
│                         └─▶ GLM-4.5/4.6 (cloud)             │
│                         └─▶ Claude Opus OAuth (DX01)        │
└─────────────────────────────────────────────────────────────┘
                        ▲
                        │ Tailscale (admin only)
                        │ leobox:11434 (Ollama)
                        │ leobox:8000 (vLLM)
                        │ leobox:4000 (LiteLLM admin)
                ┌───────┴────────┐
                │   Founder      │
                └────────────────┘
```

**Critico**: LLM endpoint **mai esposti pubblicamente**. CF Workers parlano sempre via n8n webhook (CF Tunnel + Access MFA). Tailscale solo per founder admin.

---

## 3. TASK BREAKDOWN

### 3.1 Tabella esecutiva (52 task, 5 epic)

| # | Task | Epic | Type | Files | Agent | Model | Depends | Size | Risk |
|---|---|---|---|---|---|---|---|---|---|
| **EPIC 1: Foundation Infrastructure (~3gg, era 14gg)** — RIVISTO v1.1 |  |  |  |  |  |  |  |  |
| ~~T1~~ | ~~Provisioning Oracle Cloud~~ — **OBSOLETO**: n8n già su leobox | INFRA | — | — | — | — | — | — | — |
| ~~T2~~ | ~~Setup VM Docker/Caddy/Postgres~~ — **OBSOLETO**: stack già operativo | INFRA | — | — | — | — | — | — | — |
| ~~T3~~ | ~~Deploy n8n Docker~~ — **OBSOLETO**: già attivo | INFRA | — | — | — | — | — | — | — |
| T4 | Configurazione CF Tunnel + Access MFA per webhook n8n da CF Workers | INFRA | CONFIG | 2 | DevOps Expert | Sonnet | None | S | MED |
| T5 | Configurazione LiteLLM virtual keys + routing rules per task AdOff (config YAML existente) | INFRA | CONFIG | 1 | AI Integration Expert | Sonnet | T4 | S | LOW |
| T6 | Setup Cloudflare Vectorize index + embedding pipeline | INFRA | SCAFFOLD | 2 | Database Expert | Haiku | None | S | LOW |
| T7 | Setup Cloudflare D1 schema (bugs, leads, mentions, posts_queue, accounts, outreach) | INFRA | SCAFFOLD | 1 | Database Expert | Haiku | None | S | LOW |
| T8 | Setup Sentry (estensione + workers + frontend) | INFRA | CONFIG | 5 | Coder | Haiku | None | S | LOW |
| T9 | Telegram bot extension (kill switch /KILL, /approve, /status) | INFRA | IMPLEMENT | 2 | Coder | Sonnet | None | M | MED |
| **EPIC 2: AI Brain & Knowledge Base (~10gg)** |
| T10 | Ingestion pipeline: Bibbia + store-listing + manuale → chunks | KB | IMPLEMENT | 2 | AI Integration Expert | Sonnet | T6 | M | LOW |
| T11 | Ingestion pipeline: codebase (regole adblock, content scripts critici) → chunks | KB | IMPLEMENT | 2 | AI Integration Expert | Sonnet | T6 | M | LOW |
| T12 | Ingestion pipeline: storico Telegram tickets (anonimizzati) → chunks | KB | IMPLEMENT | 2 | AI Integration Expert | Sonnet | T6 | M | MED |
| T13 | Embedding generation per tutti i chunks (batch overnight) | KB | INTEGRATE | 1 | Coder | Haiku | T10,T11,T12 | S | LOW |
| T14 | RAG query interface (Worker endpoint + reranking) | KB | IMPLEMENT | 2 | AI Integration Expert | Sonnet | T13 | M | MED |
| T15 | Continuous re-indexing scheduler (nightly cron) | KB | IMPLEMENT | 1 | Coder | Haiku | T14 | S | LOW |
| **EPIC 3: AI Customer Support (~14gg)** |
| T16 | Bot FAQ widget per popup estensione | SUPPORT | IMPLEMENT | 4 | Coder | Sonnet | T5,T14 | M | MED |
| T17 | Bot FAQ widget per sito (15 lingue) | SUPPORT | IMPLEMENT | 5 | Coder | Sonnet | T5,T14 | M | LOW |
| T18 | Telegram bot AI handler (rimpiazza ack manuale + escalation) | SUPPORT | IMPLEMENT | 2 | Coder | Sonnet | T5,T9,T14 | M | MED |
| T19 | Email auto-reply Resend webhook + AI handler | SUPPORT | IMPLEMENT | 2 | Coder | Sonnet | T5,T14 | M | LOW |
| T20 | Confidence scoring + escalation logic (user-asks, confidence<70%, loop, legal, refund) | SUPPORT | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T16,T17,T18,T19 | M | HIGH |
| T21 | Multilingual detection + response routing (15 lingue) | SUPPORT | IMPLEMENT | 1 | Coder | Haiku | T20 | S | LOW |
| **EPIC 4: Auto-Fix Loop (~21gg)** |
| T22 | CWS reviews scraper (API ufficiale + fallback HTML) | FIXLOOP | IMPLEMENT | 2 | Integration Expert | Sonnet | None | M | MED |
| T23 | AMO reviews API integration | FIXLOOP | IMPLEMENT | 1 | Integration Expert | Haiku | None | S | LOW |
| T24 | Edge Add-ons reviews scraper | FIXLOOP | IMPLEMENT | 1 | Integration Expert | Sonnet | None | M | MED |
| ~~T25~~ | Reddit mention sentinel — **DEGRADATO v1.2**: Pushshift morto + API gated. Solo monitoring read-only `.rss`/`.json`, nessuna API key, nessuna risposta auto → vedi S7 in STRATEGIA-SOCIAL-CONTENT-2026.md | FIXLOOP | IMPLEMENT | 1 | Integration Expert | Haiku | None | S | LOW |
| T26 | Competitor site changes crawler (top 100 ad-heavy sites) | FIXLOOP | IMPLEMENT | 2 | Integration Expert | Sonnet | None | M | MED |
| T27 | Sentiment analyzer (Llama-based, multilingua) | FIXLOOP | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T5 | M | LOW |
| T28 | Bug classifier (Llama-based, output: scope+severity+component) | FIXLOOP | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T5 | M | MED |
| T29 | Issue tracker D1 schema + dedup logic | FIXLOOP | IMPLEMENT | 2 | Database Expert | Haiku | T7,T28 | M | LOW |
| T30 | Patch generator: regole adblock JSON (Qwen Coder) | FIXLOOP | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T28,T29 | M | HIGH |
| T31 | Patch generator: CSS hiding rules (Qwen Coder) | FIXLOOP | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T28,T29 | M | HIGH |
| T32 | Patch generator: content sito (blog/FAQ/release notes) (Llama) | FIXLOOP | IMPLEMENT | 1 | AI Integration Expert | Sonnet | T28,T29 | M | MED |
| T33 | Test gate pipeline: Vitest unit tests setup | FIXLOOP | TEST | 5 | Tester Expert | Sonnet | None | L | MED |
| T34 | Test gate pipeline: Playwright smoke 15 siti reali | FIXLOOP | TEST | 3 | Browser Automation Expert | Sonnet | None | M | LOW |
| T35 | Test gate pipeline: Visual regression Percy/lost-pixel | FIXLOOP | TEST | 2 | Tester Expert | Haiku | T34 | M | LOW |
| T36 | Test gate pipeline: Contract tests license-api workers | FIXLOOP | TEST | 2 | Tester Expert | Haiku | None | M | MED |
| T37 | Build pipeline integration con auto-bump version + changelog gen | FIXLOOP | INTEGRATE | 2 | DevOps Expert | Sonnet | T30,T31,T32 | M | MED |
| T38 | CWS auto-upload + auto-publish (refresh OAuth, full-auto from day 1) | FIXLOOP | INTEGRATE | 1 | DevOps Expert | Sonnet | T37 | M | **HIGH** |
| T39 | AMO auto-upload + auto-sign (web-ext sign API) | FIXLOOP | INTEGRATE | 1 | DevOps Expert | Sonnet | T37 | M | MED |
| T40 | Edge Add-ons auto-upload (ApiKey scheme v1.1) | FIXLOOP | INTEGRATE | 1 | DevOps Expert | Sonnet | T37 | M | MED |
| T41 | CF Pages auto-deploy sito + canary feature flag | FIXLOOP | INTEGRATE | 2 | DevOps Expert | Sonnet | T37 | M | LOW |
| T42 | Health monitor 1h post-deploy + auto-rollback engine | FIXLOOP | IMPLEMENT | 2 | Monitoring Expert | Sonnet | T38,T39,T40,T41 | L | **HIGH** |
| **EPIC 5: Pre-Sale Marketing & Social (~14gg)** — ⚠️ **RIELABORATO v1.2**: pilastro social ora AUTORITATIVO in `sviluppo/marketing/strategia/STRATEGIA-SOCIAL-CONTENT-2026.md`. T43-T49 sostituiti da S1-S9 (TikTok/IG/FB content-broadcast). T44 account-warming 21gg → seasoning leggero 7-10gg. T45/T47 cross-post: Reddit rimosso, solo social di contenuto. |
| T43 | Account social Tier 1 creation guide (8 platforms) + bio templates | MARKETING | DOCUMENT | 1 | Documenter | Haiku | None | S | LOW |
| T44 | Account warming workflow (1-2 organic post/sett per 21gg) | MARKETING | IMPLEMENT | 1 | N8N Expert | Sonnet | T43 | M | MED |
| T45 | Mention monitor + reply queue (manual approve in Telegram) | MARKETING | IMPLEMENT | 2 | N8N Expert | Sonnet | T9,T25 | M | MED |
| T46 | Multi-language content auto-publish (DeepL + Llama HI/AR) | MARKETING | IMPLEMENT | 2 | N8N Expert | Sonnet | T5 | M | LOW |
| T47 | Cross-post hub (timing locale per lingua, 8 piattaforme) | MARKETING | IMPLEMENT | 2 | N8N Expert | Sonnet | T44 | M | MED |
| T48 | Press kit auto-localizzato 15 lingue | MARKETING | IMPLEMENT | 2 | N8N Expert | Haiku | T46 | M | LOW |
| T49 | Email outreach drip (Resend + 200 blogger/lingua) | MARKETING | IMPLEMENT | 2 | N8N Expert | Sonnet | T46 | M | MED |
| T50 | Wikidata + AlternativeTo + ProductHunt entries | MARKETING | DOCUMENT | 1 | Founder | - | T43 | S | LOW |
| T51 | Roadmap AI proposal (mensile cron, output a Telegram /approve) | MARKETING | IMPLEMENT | 2 | AI Integration Expert | Sonnet | T29 | M | LOW |
| T52 | KPI dashboard (MRR/installs/reviews/health) accessibile da Telegram /status | MONITORING | IMPLEMENT | 2 | Monitoring Expert | Sonnet | T7,T8 | M | LOW |

### 3.2 Parallel Execution Groups

```
GROUP A (parallel — start day 1, ~5gg):
  T1 (Founder) | T6 | T7 | T8 | T9 | T22 | T23 | T24 | T25 | T26 | T33 | T34 | T36 | T43 | T50

GROUP B (after A completes, ~5gg):
  T2 | T4 | T10 | T11 | T12 | T35 | T44

GROUP C (after B, ~5gg):
  T3 | T5 | T13 | T46

GROUP D (after C, ~5gg):
  T14 | T27 | T28 | T48 | T49

GROUP E (after D, ~7gg):
  T15 | T16 | T17 | T18 | T19 | T29 | T45 | T47 | T51 | T52

GROUP F (after E, ~5gg):
  T20 | T30 | T31 | T32

GROUP G (after F, ~5gg):
  T21 | T37

GROUP H (after G, ~5gg):
  T38 | T39 | T40 | T41

GROUP I (after H, ~3gg):
  T42 (HEALTH MONITOR — critico, va testato pesantemente)
```

### 3.3 Critical Path

```
T1 → T2 → T3 → T5 → T14 → T20 → T30 → T37 → T38 → T42
(~37 giorni totali con parallelizzazione)
```

---

## 4. ROADMAP 30/60/90/180 GIORNI

### 4.1 Sprint 0 — Foundation (giorni 1-14)

**Obiettivo**: infrastruttura up & running, AI brain con KB minimale, kill switch operativo.

- D1-D3: T1, T2, T3 (VM Oracle, Docker, n8n online)
- D2-D5 (parallel): T6, T7, T8, T9 (CF infra setup, Sentry, Telegram bot ext)
- D4-D7: T4, T5 (LLM gateway con routing locale)
- D5-D10 (parallel): T10, T11, T12, T13 (KB ingestion + embedding)
- D10-D14: T14 (RAG query interface) + T33 (Vitest setup)

**Deliverable**: bot AI risponde a query test interna su KB locale. Telegram /status mostra health VM.

### 4.2 Sprint 1 — Support (giorni 15-30)

**Obiettivo**: bot support live su tutti i canali, escalation funzionante.

- D15-D20: T16, T17 (widget popup ext + sito)
- D17-D22 (parallel): T18, T19 (Telegram + email AI handler)
- D20-D25: T20, T21 (escalation + multilingua)
- D23-D28: T34, T35, T36 (test infrastructure complete)

**Deliverable**: utenti reali ricevono risposte AI su 4 canali. Confidence <70% triggera escalation umana via Telegram. Test infrastructure pronta per fix-loop.

### 4.3 Sprint 2 — Auto-Fix Loop (giorni 31-50)

**Obiettivo**: ciclo review → bug → fix → test → deploy autonomo.

- D31-D38: T22, T23, T24 (review scrapers)
- D33-D40 (parallel): T25, T26 (mentions + competitor crawl)
- D38-D45: T27, T28, T29 (sentiment + classifier + tracker)
- D42-D48: T30, T31, T32 (patch generators per scope)
- D46-D50: T37, T38, T39, T40, T41 (build + auto-upload tutti i target)
- D48-D50: T42 (health monitor + auto-rollback) — **gate critico**

**Deliverable**: fix-loop attivo per regole adblock + CSS + content sito. Estensione e sito si aggiornano autonomamente con monitoring.

### 4.4 Sprint 3 — Marketing Day-1 launch (giorni 51-65)

**Obiettivo**: account social warm + lancio coordinato Tier 1.

- D51 (assumendo D5 founder ha creato account): T43 + warming già a 14gg
- D51-D58: T44, T45, T46, T47 (workflow social complete)
- D58-D63: T48, T49 (press kit + outreach drip)
- D60: founder completa T50 (Wikidata, AlternativeTo, PH)
- **D65: LAUNCH DAY** (Product Hunt + Show HN + Reddit r/chrome + 8 lingue Tier 1 thread)

**Deliverable**: Lancio coordinato. Account warmati 21gg+. Bot AI gestisce inbound traffic. Auto-fix loop processa primi feedback reali.

### 4.5 Sprint 4 — Optimization & Tier 2 (giorni 66-90)

**Obiettivo**: stabilizzazione MVP, Tier 2 onboarding (7 lingue extra).

- D66-D75: ottimizzazione bot AI da feedback reali (calibrazione confidence threshold)
- D76-D85: Tier 2 onboarding (JA/KO/ZH/PL/TR/AR/ID account warming + workflow)
- D86-D90: T51 (roadmap AI proposal mensile) + T52 (dashboard finale)

**Deliverable**: 15 lingue live. Roadmap AI propone feature mensili. Founder gestisce solo /approve gates.

### 4.6 Sprint 5+ — Continuous (giorni 91-180)

**Obiettivo**: scaling + ottimizzazione costi + ads paid (se MRR > 1K).

- Mese 4: ads paid Google reinvest 20% MRR (T18)
- Mese 5: rifinitura roadmap AI-driven, primi feature implementate da founder pick
- Mese 6: revisione architettura, valutazione q1 upgrade (estensione logic)

---

## 5. STACK FINALE & COSTI — RIVISTO v1.1

### 5.1 Stack tecnico definitivo

| Layer | Tool | Costo/mese | Note |
|---|---|---|---|
| Compute host | **leobox (GMKtec EVO-X2 Strix Halo)** | 0 EUR | Owned hardware, 24/7 always-on |
| Reliability | UPS 600-1000 VA + Btrfs snapper | 0 EUR | Owned, SLA target ≥99.5% |
| Workflow orchestrator | n8n Docker su leobox | 0 EUR | Già operativo |
| LLM gateway | LiteLLM Proxy su leobox:4000 | 0 EUR | Già operativo |
| Inference engines | Ollama (Vulkan), vLLM (ROCm 7.2), llama.cpp | 0 EUR | Già operativi |
| LLM Day-1 (locale) | Qwen2.5-72B-abl + DeepSeek-R1-70B + Qwen Coder 32B + WhiteRabbitNeo 8B | 0 EUR | ~150 GB su NVMe LUKS2 |
| Embedding + Reranker | Qwen3-Embedding-8B + BGE-Reranker-v2.5 | 0 EUR | Local |
| LLM cloud fallback | MiniMax M2.5 + GLM-4.5/4.6 (LiteLLM) + Claude Opus Pro (OAuth DX01) | 0 EUR | Subscription founder personal |
| Network esposizione | Cloudflare Tunnel + Access MFA + Tailscale (admin) | 0 EUR | Already setup |
| Database serverless | Cloudflare D1 | 0 EUR | Free tier 5M reads/giorno |
| Vector DB | Cloudflare Vectorize | 0 EUR | Free tier 5M vectors/mo |
| KV cache | Cloudflare KV | 0 EUR | 100K reads/giorno |
| Storage assets | Cloudflare R2 | 0 EUR | 10 GB |
| Translation | DeepL Free | 0 EUR | 500K char/mo (HI/AR via Qwen locale) |
| Browser automation | Playwright in n8n container | 0 EUR | Su leobox |
| Error tracking | Sentry Free | 0 EUR | 5K events/mo |
| Email outreach | Resend Free | 0 EUR | 3K mail/mo (già operativo) |
| Visual regression | lost-pixel self-hosted | 0 EUR | OSS su leobox |
| Uptime monitoring | Uptime Kuma + Healthchecks.io | 0 EUR | Self-hosted + free tier |
| CDN/Pages | Cloudflare | 0 EUR | adoff.app |
| **TOTALE** | | **0 EUR/mese** | + costo elettricità leobox (~2-5 EUR/mese stimato Strix Halo idle) |

### 5.2 Costo per task LLM — RIVISTO v1.1

| Task | Volume/mese | Modello | Engine | Costo |
|---|---|---|---|---|
| FAQ chat (popup+sito+TG+email) | 150K query | Qwen2.5-72B-abl Q4 | vLLM ROCm batch | 0 |
| Reasoning escalation triage | 1.5K query | DeepSeek-R1-70B-abl Q4 | Ollama Vulkan | 0 |
| Sentiment analysis | 6K reviews/mentions | WhiteRabbitNeo-8B | Ollama Vulkan | 0 |
| Bug classification | 1.5K issues | Qwen2.5-72B-abl Q4 | Ollama Vulkan | 0 |
| Topic extraction batch | 6K item | WhiteRabbitNeo-8B | Ollama Vulkan | 0 |
| Content gen (blog/FAQ/notes) | 120 article | Qwen2.5-72B-abl Q4 | vLLM ROCm | 0 |
| Translation (DeepL) | 14M char | DeepL Free | API | 0 |
| Translation HI/AR fallback | 500K char | Qwen2.5-72B-abl | Ollama | 0 |
| Code patch JSON/CSS | 80 patch | Qwen2.5-Coder-32B-abl | Ollama Vulkan | 0 |
| Code patch logica complessa | 12 patch | Qwen Coder + GLM-4.6 (LiteLLM) | LiteLLM routing | 0 (subscription) |
| Embedding RAG ingest | 50K + 15K/mese | Qwen3-Embedding-8B | vLLM batch 32 | 0 |
| Reranking RAG | 150K | BGE-Reranker-v2.5 | vLLM | 0 |
| Crisis analysis | <3 incident | Claude Opus Pro (OAuth) | Anthropic | 0 (subscription founder) |
| **TOTALE LLM** | | | | **0 EUR/mese** |

### 5.3 Capacità vs domanda (validazione TPS)

| Task | TPS richiesto picco | TPS disponibile | Headroom |
|---|---|---|---|
| FAQ chat 30 query/min picco | ~10 TPS Qwen 72B | 25-35 TPS vLLM batch | **3x** |
| Embedding 500/giorno | ~6/min | 2000 emb/s | **300x** |
| Code patch | <1/giorno | 22-28 TPS Qwen Coder | abbondante |
| Sentiment batch | <1/min | 80-100 TPS WhiteRabbitNeo | **>100x** |

**Conclusione**: hardware dimensionato per **10x volume Year 1**. NPU XDNA 2 (50 TOPS) ancora non utilizzata, riserva per Phase 7+ scaling.

---

## 6. RISK REGISTER

| # | Risk | Categoria | Prob | Impact | Score | Mitigation |
|---|---|---|---|---|---|---|
| R1 | LLM locale crash/down → bot offline | Tech | LOW | HIGH | M | LiteLLM fallback automatico a MiniMax M2.5 / GLM-4.6 / Claude Opus Pro. Healthchecks.io + Uptime Kuma alert <60s. UPS protegge da power outage. |
| R2 | LLM locale TPS insufficiente | Tech | LOW | MED | L | TPS misurato 3-100x sopra richiesto. NPU XDNA 2 (50 TOPS) riserva non attivata. |
| R3 | CWS auto-publish errore release → estensione broken per 50K utenti | Integration | MED | **CRITICAL** | **HIGH** | Test gate completo + canary 5% (T2 chiamato MA founder ha scelto full-auto). **Mitigation: kill switch /KILL freeze deploy + auto-rollback su crash >2x** |
| R4 | AI patch genera regole adblock errate → siti rotti | Tech | HIGH | HIGH | **HIGH** | Test Playwright su 15 siti reali OBBLIGATORIO pre-deploy. Rollback se rating -0.3★ in 24h. |
| R5 | Bot AI risposta sbagliata su billing/refund | Customer | MED | HIGH | M-H | Hard escalation umana su keyword billing/refund (T20). Confidence threshold 70%. |
| R6 | Account social ban per pattern detection | Marketing | MED | MED | M | Ultra-safe rate (Q8 = 1-2/giorno). 21gg warming. 2-3 backup account/piattaforma. |
| R7 | Disclosure AI insufficiente → EU AI Act sanzione | Legal | LOW | **CRITICAL** | M-H | Bio social trasparente + footer chat "AI assistant". Privacy policy aggiornata. |
| R8 | Server LLM locale data leak (interno → esterno) | Security | VERY LOW | HIGH | L | leobox: ufw default-deny LAN, Tailscale only admin, CF Tunnel + Access MFA per webhook n8n only. NO endpoint LLM esposti. NVMe LUKS2 + TPM2. |
| R17 | leobox hardware failure (Strix Halo APU/RAM/NVMe) | Hardware | LOW | CRITICAL | M-H | Btrfs snapper snapshot pre-update. UPS 600-1000VA. Backup configurazione su Dropbox. RTO recovery: 4-8h con hardware sostitutivo (mini PC equivalente ~800-1500 EUR). Cloud fallback (MiniMax/GLM/Claude) garantisce continuità servizio. |
| R18 | Starlink CGNAT instabilità connessione | Network | MED | MED | M | CF Tunnel gestisce CGNAT trasparentemente. Healthchecks.io monitora. Fallback 4G hotspot opzionale. |
| R9 | Cloudflare Vectorize free tier quota exceeded | Cost | LOW | LOW | L | Monitor quota. Upgrade $5/mo se serve. |
| R10 | KB tickets contiene PII → GDPR | Legal | MED | HIGH | M-H | Anonymizer pipeline (T12) PRIMA dell'embedding. No email/IP/nomi. |
| R11 | Roadmap AI propone feature pessime | Product | MED | MED | M | Founder picks 1-2 da top 5 (Q19). Nessuna implementazione senza approve. |
| R12 | Reddit Pushshift API down (mention sentinel) | Tech | HIGH | LOW | L-M | Fallback Reddit API ufficiale + scraping. Multi-source. |
| R13 | Auto-rollback false positive → blocca improvement legittimo | Tech | MED | MED | M | Soglie balanced (Q4) + override manuale via /approve in Telegram. |
| R14 | Stripe webhook race condition con AI license updates | Integration | LOW | HIGH | M | Webhook idempotency keys + transaction locks. |
| R15 | LLM locale modello degrada su edge case (lingue rare HI/AR) | Tech | MED | MED | M | Eval suite 100 prompt per lingua. Fallback Claude API se score <80%. |
| R16 | Cost overrun Claude API (>30 EUR/mese) | Cost | MED | LOW | L | Rate limit hard 1$/giorno. Alert se >0.50$/giorno. |

**HIGH/CRITICAL risks**: R3, R4, R5, R7 — TUTTI mitigati ma R3 (CWS full-auto) resta il più alto. Founder ha accettato.

---

## 7. FILES DA CREARE/MODIFICARE

### 7.1 Nuovi file (struttura)

```
sviluppo/ai-autopilot/
├── PIANO-DEFINITIVO.md (questo file)
├── AI-AUTOPILOT-QUESTIONARIO.html (esistente)
├── adoff-autopilot-decisioni-2026-05-09-11-43.md (esistente)
├── infra/
│   ├── docker-compose.yml (n8n + caddy + postgres + redis)
│   ├── Caddyfile
│   ├── .env.example
│   └── setup.sh (script provisioning Oracle VM)
├── workers/
│   ├── ai-gateway/ (LLM router worker)
│   │   ├── src/index.ts
│   │   ├── src/llm-clients/local.ts (Llama/Qwen)
│   │   ├── src/llm-clients/claude.ts (Anthropic SDK)
│   │   └── wrangler.toml
│   ├── rag-worker/ (Vectorize query interface)
│   ├── support-bot/ (FAQ AI handler)
│   ├── fix-loop/ (review→fix→deploy)
│   └── health-monitor/ (auto-rollback engine)
├── n8n-workflows/
│   ├── 01-mention-sentinel.json
│   ├── 02-content-translate.json
│   ├── 03-cross-post-hub.json
│   ├── 04-reddit-hunter-en.json
│   ├── ...(altri 12)
├── d1-schemas/
│   ├── bugs.sql
│   ├── leads.sql
│   ├── mentions.sql
│   ├── posts_queue.sql
│   ├── accounts.sql
│   └── outreach.sql
├── tests/
│   ├── playwright-smoke/ (15 siti reali)
│   ├── unit/ (Vitest workers)
│   └── visual-regression/ (lost-pixel config)
└── docs/
    ├── llm-routing-strategy.md
    ├── escalation-rules.md
    └── deployment-runbook.md
```

### 7.2 File esistenti da modificare

| File | Modifica | Task |
|---|---|---|
| `app/src/popup.html` | Add chat widget AI integrato | T16 |
| `app/src/popup.js` | Wire up AI chat con worker | T16 |
| `app/src/license-client.js` | Add error reporting Sentry | T8 |
| `site/support.html` | Add chat widget (15 lingue) | T17 |
| `site/index.html` | Add disclosure AI footer | T7 (legal) |
| `sviluppo/license-system/worker.js` | Add Sentry + emit events Stripe webhook | T8, T14 |
| `sviluppo/worker-telegram/worker.js` | Replace ack manuale con AI handler | T18 |
| `sviluppo/scripts/build.js` | Add CWS/AMO/Edge auto-upload + version bump | T37, T38, T39, T40 |
| `app/manifest.json` | Bump version automated | T37 |
| `app-firefox/manifest.json` | Bump version automated | T37 |
| `app-safari/manifest.json` | Bump version automated | T37 |
| `sviluppo/marketing/archive/STRATEGIA-LANCIO-AUTOMATIZZATO.md` | Annotare superseded da PIANO-DEFINITIVO.md | meta |

---

## 8. ROLLBACK STRATEGY

### 8.1 Per scope deploy

| Scope | Rollback method | RTO target |
|---|---|---|
| Regole adblock CWS | Re-upload versione precedente da git tag | <30 min |
| Codice estensione (canary) | Stop canary rollout, revoke release CWS staged | <15 min |
| Codice estensione (full) | Re-publish versione N-1 + force update users | 1-7gg (CWS review) |
| Sito CF Pages | Cloudflare instant rollback (built-in) | <2 min |
| Worker Cloudflare | wrangler rollback | <5 min |
| n8n workflow | Versionato in Git, restore JSON workflow | <10 min |
| KB Vectorize | Re-ingest da snapshot Postgres | <1h |

### 8.2 Kill switch totale

Founder digita `/KILL` su Telegram bot:
1. Freeze tutti gli auto-deploy per 24h (configurable)
2. AI bot continua a rispondere (read-only mode)
3. Patch generator disabled
4. Solo manual approve da Telegram per qualsiasi action
5. Auto-resume dopo 24h se non rinnovato

### 8.3 Disaster recovery

| Scenario | Action |
|---|---|
| Oracle VM down | Failover a backup Oracle Cloud (region Amsterdam) — second Always Free VM |
| LLM locale offline | Auto-failover a Claude API per tutto (cost spike controllato da rate limit) |
| Cloudflare down | Tutto il sistema down, but estensione installata continua a funzionare (network blocking gestito da declarativeNetRequest nativo) |
| GitHub repo compromised | Restore da Dropbox backup + revoke tutti gli access token |

---

## 9. COMPLEXITY SUMMARY

**Overall Size**: **XL** (architectural change, multi-modulo, 52 task, integration con 8+ servizi esterni)

**Rationale**:
- 52 task, 5 epic
- 9 parallel groups, critical path 37gg
- Cross-cutting: estensione + sito + backend + AI + social
- Nuove tecnologie: Vectorize, n8n, LLM gateway, sentiment analysis
- Performance-critical (latenza bot <2s)
- Security-sensitive (KB con tickets, customer data)

**Estimated tasks**: 52 totali, 30+ parallelizzabili

**Wall-clock estimate v1.1** (con parallelizzazione massima + infra leobox già pronta):
- Sprint 0 (Foundation): **3gg** (era 14gg, eliminato Oracle Cloud setup)
- Sprint 1 (Support): 16gg
- Sprint 2 (Fix Loop): 20gg
- Sprint 3 (Marketing + Launch): 14gg (parallelo a Sprint 0-2)
- Sprint 4 (Optimization): 24gg
- **Totale a Launch Day: ~54 giorni** (era 65gg, target launch: ~2026-07-02)
- **Totale a Tier 2 + Roadmap AI: ~78 giorni** (era 90gg, target: ~2026-07-26)

**Costo iniziale setup**: 0 EUR cash. Ore-uomo: ~150h founder + Claude (era 200h, eliminato setup VM Oracle).

**Costo runtime continuo**: **0 EUR/mese** (era 5-15 EUR, eliminato Claude API grazie LiteLLM fallback GLM-4.6 + MiniMax M2.5 + Claude Pro OAuth founder).

---

## 10. DA CONFERMARE / NEXT STEPS

### 10.1 Specifiche LLM locale (richiesta info dettagliate)

Per finalizzare il piano e iniziare T4-T5, mi servono:

- **Modelli installati esatti**: nomi + size (es. "llama-3.3-70b-instruct-q4_k_m.gguf", "qwen2.5-coder-32b-instruct-q5_k_m.gguf")
- **Hardware**: GPU (modello, VRAM), RAM sistema, CPU
- **Inference engine**: llama.cpp / vLLM / Ollama / LM Studio / TGI / altro?
- **Endpoint**: URL accessibile? (LAN only / Tailscale / VPN / esposto via reverse proxy)
- **API standard**: compatibile OpenAI? (most engine sono)
- **Capacity**: quante query concurrent può sostenere (TPS stimato)
- **Uptime/SLA**: server sempre acceso o accensione manuale?

### 10.2 Decisioni operative immediate (giorno 1)

Approvazione finale → inizio Sprint 0 → tasks parallelizzati su Group A:
- Founder: T1 (Oracle Cloud signup, ~90 min)
- Founder: T43 (creazione 8 account social Tier 1, ~2h, bio già pronte)
- Claude: T6 (Vectorize index setup), T7 (D1 schema), T8 (Sentry config), T9 (Telegram bot ext) parallelo
- Claude: T22, T23, T24 (review scrapers — workers indipendenti)

### 10.3 Approvazione necessaria

Per uscire da plan mode e iniziare:
- **OK** → procedo con Sprint 0 task immediati (T6, T7, T8, T9 in parallelo)
- **Modifiche** → indica cosa cambiare, rivedo piano

### 10.4 Documentazione vault Obsidian

Post-approvazione:
- Update `Progetti/AdOff/sintesi/AdOff Strategia Lancio Multilingua Automatizzato 2026-05-07.md` → annotare SUPERSEDED da AI Autopilot Plan
- Crea `Progetti/AdOff/decisioni/DEC - AI Autopilot Architecture - 2026-05-09.md`
- Crea `Progetti/AdOff/sintesi/AdOff AI Autopilot Plan 2026-05-09.md`
- Update `Progetti/AdOff/PRJ - AdOff.md` con link
- Append `wiki/Wiki - Log Globale.md`

---

*Piano generato 2026-05-09 da analisi questionario 25/25 + 4 chiarimenti critici. Pronto per esecuzione previa specifiche LLM locale.*
