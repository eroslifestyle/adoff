# RESUME — AdOff SMM Autopilot

> File entry-point per riprendere il lavoro in una nuova chat Claude Code. Aggiornato 2026-05-20 fine sessione build.

## Stato attuale (2026-05-20)

**AdOff SMM Autopilot operativo end-to-end ma NON ancora attivato in produzione.**

- ✅ **22 workflow n8n** importati e funzionanti (id `w00-w50`, vedi `docker exec n8n n8n list:workflow`)
- ✅ **23 tabelle DB** in schema `adoff_autopilot` (Postgres `n8n-postgres`)
- ✅ **Autonomy score 98/100** verificato da Gemini Pro audit #100 (GO_WITH_CAVEATS)
- ⏳ **Workflow tutti `active=false`** — vanno attivati seguendo runbook step-by-step
- ⏳ **OAuth token 8 platform** = `pending_oauth` (popolare via W42 webhook con dev console grant)
- ⏳ **content_seeds** vuota o quasi (seed iniziali da inserire prima attivazione W00)

## Documentazione completa

### Repo (file system)

```
sviluppo/ai-autopilot/n8n-workflows/
├── workflows/         # 22 JSON workflow + .bak (backup pre-fix)
├── docs/              # 5 audit Gemini + W*-DOCS markdown
├── infra/migrations/  # SQL 001-002-003 (idempotenti)
├── tests/             # gemini_workflows test harness
└── scripts/           # apply-retry-policy, setup-w47-db, ecc.
```

### Wiki vault (Obsidian) — entry points

- **Hub progetto**: `progetti/AdOff/PRJ - AdOff.md` (sezione "SMM Autopilot — Quick Map")
- **Sintesi master**: `universale/CM-Universal/sintesi/adoff-smm-autopilot.md` ([[AdOff SMM Autopilot]])
- **Runbook go-live**: `universale/CM-Universal/concetti/runbook-adoff-smm-autopilot-go-live.md` ([[RUNBOOK - AdOff SMM Autopilot Go-Live]])
- **Decisione metodologica**: [[DEC - SMM Autopilot Audit-Driven Build 2026-05-20]]
- **Pattern riusabili**: [[Closed-loop SMM Autonomy]], [[Bruteforce Wave Pattern]]

### Memoria progetto Claude Code

```
~/.claude/projects/-home-mrxxx-Dropbox-1-Forex-Programmazione-Progetti-ChromePlugin/memory/
├── MEMORY.md                                  # index entries
├── project_gemini_n8n_integration.md          # storia build completa Wave 1-4
└── project_w25_intelligent_approval.md
```

## Come riprendere in nuova chat

### Opzione A — Continua build/test SMM Autopilot

Incolla questo prompt in una nuova chat:

```
Riprendi lavoro AdOff SMM Autopilot. Leggi:
- ~/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/ai-autopilot/RESUME-SMM-AUTOPILOT.md
- ~/.claude/projects/-home-mrxxx-Dropbox-1-Forex-Programmazione-Progetti-ChromePlugin/memory/MEMORY.md
- progetti/AdOff/PRJ-AdOff.md (vault claude-memory)

Stato: 22 workflow importati ma active=false. Voglio [X]:
- attivare in produzione (segui runbook step 1-8)
- ulteriore audit/miglioramento (target 99-100)
- fix specifico (specifica)
- altro (specifica)
```

### Opzione B — Attivazione produzione (go-live)

Segui il runbook step-by-step:

1. Apri il file `sviluppo/ai-autopilot/n8n-workflows/docs/` per i docs di ogni workflow (W42-OAUTH-TOKEN-MANAGER.md ecc.)
2. Step 1 (Telegram): aggiungi TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID a `/opt/n8n/.env`
3. Step 2 (OAuth 8 platform): popola `oauth_tokens` via W42 webhook (parti da Mastodon/Bluesky public)
4. Step 3 (Seed): INSERT iniziali in `content_seeds` (almeno 30 righe)
5. Step 4-7: SQL UPDATE workflow_entity SET active=true per tier (utility → creation → operativo → W00)
6. Restart n8n dopo ogni tier
7. Step 8: trigger `/orchestrator-run-now` con DRY_RUN, poi prod
8. Monitor Telegram 48-72h

### Opzione C — Esplorare/comprendere il sistema

```
Voglio capire come funziona AdOff SMM Autopilot. Leggi la sintesi
universale/CM-Universal/sintesi/adoff-smm-autopilot.md e poi
spiegami il closed loop + i 22 workflow + cosa serve per attivarlo.
```

## Quick commands utili

```bash
# Lista workflow
docker exec n8n n8n list:workflow | sort

# DB tables
docker exec n8n-postgres psql -U n8n -d n8n -c "\dt adoff_autopilot.*"

# Draft generati
docker exec n8n-postgres psql -U n8n -d n8n -c \
  "SELECT workflow, asset_type, COUNT(*), SUM(tokens_in+tokens_out) AS tot_tok 
   FROM adoff_autopilot.gemini_copy_drafts GROUP BY 1,2 ORDER BY 1;"

# Workflow attivi
docker exec n8n-postgres psql -U n8n -d n8n -c \
  "SELECT id, name, active FROM public.workflow_entity ORDER BY id;"

# Restart n8n (dopo cambio active state o env)
cd /opt/n8n && docker compose up -d --no-deps n8n n8n-worker

# Trigger DRY_RUN W00 (test orchestrator senza side-effect)
SECRET=$(grep WEBHOOK_HMAC_SECRET /opt/n8n/.env | cut -d= -f2)
PAYLOAD='{"dry_run":true}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -X POST http://localhost:5678/webhook/orchestrator-run-now \
  -H "Content-Type: application/json" -H "X-AdOff-Signature: $SIG" -d "$PAYLOAD"
```

## Cosa NON è ancora fatto (post sessione 2026-05-20)

1. **OAuth grant 8 platform** (Twitter, Reddit, Mastodon, Bluesky, IG, FB, TikTok, LinkedIn) → manuale, richiede developer console di ogni platform
2. **Seed iniziali content_seeds** → 25-45 entry da inserire (suggerito mix privacy/ad-blocking/browser-performance)
3. **Telegram bot setup** → @BotFather + TOKEN/CHAT_ID in env
4. **First production run** + monitor 48-72h
5. **Routine settimanale**: review draft `needs_review`, performance_insights, engagement_inbox `escalated`

## Caveat noti

- Workflow tutti active=false post-sessione (sicurezza, va attivato manualmente)
- W40 v2 senza token = 0 metrics raccolte (graceful, ma sistema "freddo")
- W45/W46 senza token = limited a Mastodon/HN (public, no auth)
- 2 punti score residui (98/100) = human safety net per crisis high/critical (by design)

## Audit Gemini Pro storia

| # | Score | Δ | Round |
|---|---:|---:|---|
| 1 | 30 | — | Baseline (Gemini-only) |
| 2 | 65 | +35 | Post Wave 1 fix base |
| 3 | 70 | +5 | Wave 2 incompleta (HMAC test live failed) |
| 4 | 95 | +25 | Wave 2 finale (W30 SQLi fix) |
| FULL | 45 | — | Full stack baseline (più severo) |
| post-3 | 90 | +45 | Wave 3 chiude 4 P0 |
| **#100** | **98** | +8 | **Wave 4 chiude caveat** ✓ |

Cost build totale: ~$0.86 Gemini Pro. Cost runtime stimato: $30-80/mese.

## Contatti / riferimenti

- Stack n8n: `/opt/n8n/docker-compose.yml`
- N8n editor: `http://localhost:5678` (login basic auth se configurato)
- Secrets: `~/.secrets/gemini.env` (chmod 600)
- Gemini key: AIzaSyD_txR-ZgGfZRnmVhRmAYCahwYsh6klF6k (ServerN8N Tier 1)
