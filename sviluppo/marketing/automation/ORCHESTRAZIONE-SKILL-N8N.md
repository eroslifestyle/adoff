# AdOff — Orchestrazione Skill ↔ Pipeline n8n

> **Data**: 2026-05-17 · Mappa: quale skill specializzata governa ogni stadio del flusso, e cosa esegue n8n in automatico.
> **Nota su skills.sh**: la directory pubblica `skills.sh` (pack `coreyhaines31/marketingskills`: content-strategy, ab-test-setup, marketing-psychology, marketing-ideas, social-content, ad-creative, analytics-tracking, seo-audit, launch-strategy…) è **lo stesso pacchetto già installato in locale** nel registry skill. Nessuna installazione esterna necessaria: si orchestrano le skill locali. n8n NON esegue le skill (sono di Claude Code): n8n esegue gli **artefatti** che le skill producono (hook-bank, prompt, workflow, decision rules).

---

## Flusso end-to-end e ownership

| Stadio | Skill (governa, offline=Claude) | Artefatto prodotto | n8n esegue (automatico) |
|---|---|---|---|
| **1. Strategia/Storia** | `content-strategy` + `marketing-psychology` | `STORY-BIBLE-2026.md`, pillar/atti | — (input umano/Claude, raro) |
| **2. Ideazione** | `marketing-ideas` + `copywriting` | `hook-bank.json` (brief, EN+IT→15 lingue) | Read hook-bank, select brief (rotazione pilastri/atti) |
| **3. Copy** | `copywriting` + `marketing-psychology` | `caption-prompt.md` (system/user LLM) | LLM caption+hashtag+disclosure (Qwen leobox) + brand-guard |
| **4. Produzione video** | `remotion` / `video` | `video-engine/` template T1-T6 + `batch-render.mjs` | executeCommand batch-render → MP4 9:16 |
| **4b. Produzione statici** | `image` / `creative-exploration` | `carousel-engine` (follow-up P2) | render carousel PNG |
| **4c. Voiceover (opz.)** | `tts-pro` | `tts-runbook.md` | TTS → mp3+captions (variante voiced) |
| **5. Pianificazione** | `content-strategy` + `social` | `PIANO-MARKETING-PRODUZIONE-2026.md` (matrice canali/slot) | Enqueue posts_queue (slot, fuso, exp_id) |
| **6. Pubblicazione** | `social` | digest Telegram | httpRequest Telegram → upload manuale scheduler nativi (semi-auto) |
| **7. Test** | `ab-testing` | `PIANO-ESPERIMENTI-CONTENT-2026.md` + tabelle experiments/post_metrics | Genera 2 varianti, enqueue con UTM, decision rule |
| **8. Misura/Controllo** | `analytics` | KPI map, schema metrics | fetch metriche piattaforma+UTM → Postgres → valuta vincente |
| **9. Apprendimento** | `ab-testing` + `content-strategy` | `experiment-playbook.md` | patch hook-bank (promote vincenti) + append playbook |
| **10. SEO/Discovery** | `ai-seo` + `seo-audit` | searchable layer (STORY-BIBLE §7) | caption/bio agganciano query (no video) |
| **11. UGC/Referral** | `community-marketing` / `referrals` | workflow S8 (follow-up) | tracking referral → repost UGC |

---

## Workflow n8n (file in `automation/`)

| Workflow | Stadi coperti | Stato |
|---|---|---|
| `content-factory.workflow.json` | 2→6 (select→LLM→guard→render→queue→Telegram) | ✅ costruito |
| `experiment-engine.workflow.json` | 7→9 (genera varianti→enqueue→fetch metriche→decidi→playbook) | ⏳ build (schema in PIANO-ESPERIMENTI §6) |
| `carousel-factory.workflow.json` | 4b (3 statici/giorno) | ⏳ build (dopo carousel-engine P2) |
| `metrics-collector.workflow.json` | 8 (fetch KPI giornaliero → post_metrics) | ⏳ build |
| `12-youtube-factory.json` | 4-YT (seeds→enqueue NotebookLM queue) | ✅ costruito |
| `13-youtube-publisher.json` | 6-YT (meta LLM→upload YouTube API→Telegram) | ✅ costruito |

Deploy su leobox via `ai-autopilot/n8n-workflows/scripts/import-workflow.py`. Postgres `n8n-postgres`, LLM Ollama `172.17.0.1:11434`, Telegram env `TELEGRAM_BOT_TOKEN/CHAT_ID`.

### Sotto-pipeline YouTube long-form (NotebookLM)

| Stadio | Skill/owner | Artefatto | n8n esegue |
|---|---|---|---|
| **4-YT. Produzione video** | `nuclear_n8n` + NotebookLM | PDF sorgenti + `data/youtube-seeds.json` | wf12 enqueue `adoff_autopilot.youtube_queue` |
| **4-YT.b Generazione** | — (worker) | `notebooklm-worker.py` (systemd, Playwright profilo persistente) | A=Video Overview · B=audio Deep Dive→ffmpeg 1080p |
| **6-YT. Pubblicazione** | `ai-seo` (meta) | `youtube-upload.py` (API v3 resumable) | wf13: LLM titolo/desc/tag→brand-guard→upload (private)→Telegram |

NotebookLM **non ha API**: pilotato via browser (vincolo Google login). Pesante/lento ⇒ queue-worker (pattern `media-queue-worker.py`). Dettaglio: `ai-autopilot/n8n-workflows/docs/notebooklm-runbook.md`.

---

## Principio di automazione

- **Le skill girano una volta** (offline, Claude) per produrre artefatti versionati (prompt, template, decision rule, hook-bank).
- **n8n gira ogni giorno** eseguendo quegli artefatti — deterministico, no LLM-as-judge non vincolato, brand-guard sempre attivo.
- **L'apprendimento chiude il loop**: gli esperimenti aggiornano l'hook-bank → l'automazione migliora senza ri-eseguire le skill.
- Le costanti di marca (`STORY-BIBLE`) non sono mai variabili automatiche: solo decisione esplicita umana/Claude.
