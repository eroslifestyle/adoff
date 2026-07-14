# Workflow Migration Plan (2026-05-20 — Redundancy Cleanup)

## Executive Summary
- **Duplicate copy agents**: W11-copy-agent (46 nodi, varianti komplesse) → DEPRECATED, sostituito da W99-copy-agent (35 nodi, architettura pulita)
- **Creation pipeline triplets** (W02, W11, W14 vs W15): W02/W11/W14 inactive, saranno deprecati in Sprint 2 dopo implementazione W00 Master Orchestrator
- **Gemini AI workflows** (W20-W25): attualmente inactive, candidati attivazione post-testing W00 integration
- **Anti-patterns**: 3 workflow usano filesystem reads (W12, W13, W14); 5 usano hardcoded platform branching (legittimo per ora, refactor in channels table post-MVP)

---

## 1. Workflow Duplication Matrix

### Copy Agent (DECISIONE: W11 → DEPRECATED)

| Aspetto | W99 (Standard) | W11 (Deprecated) | Azione |
|---------|---|---|---|
| **Nomi nodi** | webhook, validate, build-prompt, call-copy-max, parse, resp | trig, prep, llm, parse, resp | W11 ha 46 nodi, W99 ha 35: W11 contiene logica ridondante |
| **Webhook path** | `/copy-agent` | `/copy-agent` | **Identico** — usano lo stesso endpoint |
| **Struttura** | Validate → build prompt → Ollama → parse → response | Prepare → Ollama → Parse → Response | W99 è più snello |
| **Active** | true | true | Entrambi attivi: CONFLITTO |
| **Riferimenti** | Nessuno trovato | Nessuno trovato | Zero dipendenze: safe deprecate |
| **Output format** | Complex (stats, char_count, eval_duration) | Simple (variants array + summary) | W99 output complesso consigliato |

**Decisione**: Rinominare `W11-copy-agent.json` → `W11-copy-agent.json.deprecated-20260520`. W99 diventa l'unico copy agent.

---

### Creation Pipelines (W02, W11, W14, W15) — DEPRECATION ROADMAP

| WF | Nome | Active | Scopo | Vs W00 Master | Roadmap |
|---|---|---|---|---|---|
| **W02** | Social Cross-post Hub | false | Crosspost seed post su 6 piattaforme | Sarà rimpiazzato da W00→W16 | Sprint 2: add deprecation note; Sprint 3: remove |
| **W11** | Multilang Channel Publisher | false | Traduci + publish draft multilingua | Sarà rimpiazzato da W00→W18 | Sprint 2: add deprecation note; Sprint 3: remove |
| **W14** | Social Enqueue | false | Batch enqueue video draft da bank | Sarà rimpiazzato da W00→W17 (cyber-purge) | Sprint 2: add deprecation note; Sprint 3: remove |
| **W15** | Cyber-Purge Producer | false | **Specifico cyber-purge video pipeline** | **MANTENERE — non rimpiazzare** | ✓ Keep in production |

**Logica**: W00 orchestrator chiama W16 (crosspost), W17 (enqueue), W18 (multilang) con una sola API unificata. Ma vecchio W02/W11/W14 restano per backward-compat per Sprint 1. Deprecation notice → disattivazione graduale.

---

### Gemini AI Workflows (W20–W25) — ACTIVATION PENDING

| WF | Nome | Active | Endpoint | Stato | Pre-req |
|---|---|---|---|---|---|
| W20 | Gemini Copywriter Caption Multilingua | **false** | `/w20-gemini-copy-caption` | Ready → activate after W00 tested | W00 routing ✓ |
| W21 | Gemini Email + Ad Copy + Landing | **false** | `/w21-gemini-email-ad` | Ready → activate after W00 tested | W00 routing ✓ |
| W22 | Gemini Strategist + Calendar | **false** | `/w22-gemini-strategist` | Ready → activate after W00 tested | W00 routing ✓ |
| W23 | Gemini SEO Keyword Research | **false** | `/w23-gemini-seo` | Ready → activate after W00 tested | W00 routing ✓ |
| W25 | Approve & Publish Drafts | **false** | `/w25-approve-publish` | Ready → activate after W00 tested | W00 routing ✓ |

**Piano di attivazione**:
1. Test W00 integrazione con webhook mock (Sprint 1 — this week)
2. Attiva W20/21/22/23/25 dopo validazione webhook (Sprint 2)
3. Monitora webhook call volume (quota Gemini API controllato via W29 HMAC)

---

## 2. Migration Timeline

### Sprint 1 (Week of 2026-05-20) — THIS WEEK
- ✅ Deprecate W11-copy-agent (rename + mark inactive)
- ✅ Verify W99-copy-agent is primary (active=true)
- ✅ Add Sticky Notes: "W02/W11/W14 deprecated 2026-05-20, use W00"
- ✅ Add Sticky Notes: "W20/21/22/23/25 activate post-W00" on each Gemini WF
- Document this plan (this file)

### Sprint 2 (Week of 2026-05-27) — NEXT WEEK
- Implement W00 Master Orchestrator (routing logic, health checks)
- Test W00 call to W16/W17/W18 (replacements for W02/W11/W14)
- Activate W20/21/22/23/25 (Gemini AI workflows)
- Log: "Using W00 → W16 for crosspost, deprecation of W02 effective 2026-05-27"
- Disable W02, W11 (set active=false) if no incoming calls

### Sprint 3 (Week of 2026-06-03) — FINAL
- Remove W02, W11, W14 JSON files (after log review: zero calls for 1 week)
- W15 cyber-purge stays (not replaced by W00)
- Archive removed WF to `docs/deprecated-workflows-20260603/`

---

## 3. Anti-Patterns Identified

### Pattern A: Filesystem Reads (non-idiomatic, brittle)

**Location**: 3 workflow files read filesystem paths directly

| File | Line | Issue | Alternative |
|------|------|-------|-------------|
| **W13-youtube-publisher.json** | L70 | `command: "python3 /home/mrxxx/adoff/...youtube-upload.py"` | Define python script path in environment var or config table |
| **W14-social-enqueue.json** | L26 | `cat /home/mrxxx/adoff/.../manifest.json` | Query DB (build jobs table) instead of filesystem |
| **W12-youtube-factory.json** | L16 | `cat /home/mrxxx/adoff/.../youtube-seeds.json` | Store seeds in n8n secret or Postgres table, query via HTTP |

**Refactor strategy** (Post-MVP): Create "Config Service" microservice (simple HTTP endpoint) that:
- Serves seeds, manifests, upload scripts as versioned configs
- Allows config hot-reload without W12/W13/W14 restart
- Decouples workflow from host filesystem

---

### Pattern B: Hardcoded Platform Branching (acceptable for now)

**Location**: 5 workflow nodi hardcode platform-specific logic

| File | Logic | Example |
|------|-------|---------|
| **W02-social-crosspost-hub.json** | Platform selector → different prompt per platform | Twitter (280 chars) vs Reddit (1500) vs LinkedIn (1500) |
| **W11-multilang-channel-publisher.json** | Lang-specific text fixes (IT, ES, PT) | IT: "spiacciono" → "spiano" |
| **W14-social-enqueue.json** | Platform-specific file path (TikTok no-logo vs IG/FB con logo) | `no_logo_variant: true` per TikTok |
| **W20-gemini-copywriter-caption.json** | Platform loop generation | Generate 1 copy per (lang × platform) combination |
| **W21-gemini-email-ad-landing.json** | Asset type loop (email_drip, ad_copy, landing_section) | Maps asset → context (email_context vs ad_platform) |

**Current state**: These are **NOT anti-patterns yet** — platform-specific logic is legitimate. But **long-term refactor** (Post-Sprint 3):
- Normalize platform rules into Postgres table: `platform_constraints(platform, max_chars, hashtag_max, emoji_max)`
- Move lang fixes into i18n.json lookup file (not hardcoded maps)
- Index by `platform_id` → eliminates hardcoded branching

**Non-blocking for Sprint 1-2**: Keep as-is. Post-MVP, extract to external config service.

---

## 4. Webhook Validation Checklist

**After activating W20/21/22/23/25**, verify endpoints are exposed:

```bash
# Test W20 webhook
curl -X POST http://localhost:5678/webhook/w20-gemini-copy-caption \
  -H "Content-Type: application/json" \
  -d '{"concept":"test","lang":"it","platform":"instagram","tone":"energica"}' \
  2>&1 | head -20

# Expected: 401 (HMAC missing) — NOT 404 (webhook missing)
# If 404: W20 NOT registered or n8n container not restarted
```

---

## 5. Sticky Notes to Add (Optional, Low Priority)

If n8n UI allows programmatic Sticky Notes, add to these workflow canvases:

**W02, W11, W14** (each):
```
⚠️ DEPRECATED 2026-05-20
Replaced by W00 Master Orchestrator.
Use W16 (crosspost), W17 (enqueue), W18 (multilang).
Will be removed in Sprint 3.
Contact: W00 implementation epic.
```

**W20, W21, W22, W23, W25** (each):
```
⏳ PENDING ACTIVATION
Awaiting W00 Master Orchestrator integration.
Activate after W00 health check passed (Sprint 2).
Endpoint: /w20-gemini-copy-caption (example).
```

**W15** (cyber-purge producer):
```
✓ ACTIVE & MAINTAINED
Part of core cyber-purge video pipeline.
Keep in production. NOT being replaced.
```

---

## References & Links

- **W00 Epic**: `docs/w00-master-orchestrator-epic.md` (implementation roadmap)
- **Gemini Cost Cap**: `docs/gemini-api-cost-limits.md` (API quota strategy)
- **n8n Health**: `docs/n8n-health-checks.md` (webhook validation patterns)

---

**Author**: Analyzer Agent v2.2  
**Date**: 2026-05-20  
**Status**: Ready for Sprint 1 execution
