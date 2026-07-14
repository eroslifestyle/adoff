# AdOff News-Jacking System — Deployment Summary (2026-05-17)

**Task S-OPS-5**: News-jacking playbook (operativo)

## Cosa è stato creato

### 1. Newsjack Sentinel — Read-Only News Monitor

**Percorso**: `sviluppo/marketing/automation/newsjack-sentinel/`

**File**:
- `sentinel.py` — Script principale (Python 3.9+, stdlib only, type hints)
- `feeds.json` — Configurazione: 4 feed pubblici (AdGuard RSS, Hacker News Algolia, Google News, Reddit r/privacy RSS)
- `test_sentinel.py` — Unit tests (pytest): keyword match, dedupe, trigger JSON structure
- `README.md` — Setup + cron istruzioni

**Funzionamento**:
1. Polls RSS/JSON feeds ogni 4h (schedulabile via cron)
2. Detect keywords: "ad blocker", "manifest v3", "server-side ad", "extension removed", "anti-adblock"
3. Dedup via JSON store locale (`seen.json`)
4. Scrive alert: `triggers/trigger_YYYYMMDD_HHMM.json`

**Alert JSON include**:
```json
{
  "timestamp": "ISO-8601",
  "title": "Event title",
  "summary": "First 300 chars",
  "url": "Source link",
  "matched_keywords": ["keyword1", "keyword2"],
  "suggested_angle": "Reaction hook",
  "remotion_props": {
    "headline": "...",
    "explanation": "...",
    "cta_text": "adoff.app — un click, e torna il silenzio."
  }
}
```

**SLA**: Alert entro 4h di publicazione → team ha <48h per reagire.

---

### 2. Remotion Reaction Templates — 3 Compositions Parametriche

**Percorso**: `sviluppo/marketing/video-engine/src/`

#### Template 1: "Breaking News" (15s)
- **Uso**: quick facts, policy changes, timeline urgency
- **Scenes**: headline slam (0-3s) → explanation (3-9s) → CTA pulse (9-15s)
- **Props**: headline, explanation, cta_text
- **File**: `ReactionTemplate1.tsx`

#### Template 2: "We're Still Here" (18s)
- **Uso**: reassurance, competitor troubles, trust angle
- **Scenes**: tension with fake ads (0-3s) → relief with shield (3-9s) → trust stats (9-18s)
- **Props**: headline, explanation, cta_text
- **File**: `ReactionTemplate2.tsx`

#### Template 3: "Educational" (20s)
- **Uso**: MV3 enforcement, technical impacts, breaking down complexity
- **Scenes**: headline + tech diagram (0-4s) → explanation + implications (4-12s) → solution (12-20s)
- **Props**: headline, explanation, cta_text
- **File**: `ReactionTemplate3.tsx`

**Proprietà comuni** (TypeScript contract):
```typescript
{
  headline: string;           // Main event (~80 chars)
  explanation: string;        // What it means (~200 chars)
  cta_link?: string;          // Default: "https://adoff.app"
  cta_text?: string;          // Default: "adoff.app — un click, e torna il silenzio."
  backgroundColor?: string;   // Default: "#0a0a1a"
}
```

**Design notes**:
- Brand-safe: zero real brand names (YouTube → "piattaforme video", Facebook → "social media")
- Synthetic UI only: mock ad windows, particles, Wordmark, Particles, BrandBG components
- Aspect ratio: 9:16 (TikTok/Shorts/Reels optimized)
- Color palette reused: `src/brand.tsx` (C.purple, C.soft, C.white, etc.)

---

### 3. Render Helper — Consume Trigger → MP4

**File**: `video-engine/render-trigger.mjs`

**Uso**:
```bash
cd video-engine
node render-trigger.mjs -t ../automation/newsjack-sentinel/triggers/trigger_*.json -T 1
```

**Output**: `output/reaction_trigger_20260517_140000_T1.mp4`

---

### 4. Documentation

**Sentinel**:
- `newsjack-sentinel/README.md` — Setup, cron, integration
- `automation/README.md` — Workflow overview + architecture

**Templates**:
- `video-engine/REACTION_TEMPLATES.md` — Props contract, composition registry, customization

---

## Come usarlo

### Step 1: Setup Sentinel (una volta)

```bash
cd sviluppo/marketing/automation/newsjack-sentinel

# Verifica Python
python3 --version  # 3.9+ OK

# Test execution
python3 sentinel.py

# Output: trigger_YYYYMMDD_HHMM.json in triggers/ directory (or no output if no new triggers)

# Install cron (every 4h)
# Add to crontab -e:
# 0 */4 * * * cd /home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/automation/newsjack-sentinel && python3 sentinel.py >> sentinel.log 2>&1
```

### Step 2: Monitor Feeds

Sentinel runs automatically (via cron). Scrive file in `newsjack-sentinel/triggers/` quando detect un trigger.

```bash
# Check for new alerts
ls -lt newsjack-sentinel/triggers/ | head -5

# Read latest trigger
cat newsjack-sentinel/triggers/trigger_*.json | jq .
```

### Step 3: Scegli Template e Rendi Video

Quando leggi un trigger:
1. Valuta il mood/narrative
2. Scegli template (1=breaking, 2=reassurance, 3=tech)
3. Rendi:

```bash
cd video-engine

# Template 1 (Breaking News)
node render-trigger.mjs -t ../automation/newsjack-sentinel/triggers/trigger_20260517_140000.json -T 1

# Template 2 (We're Still Here)
node render-trigger.mjs -t ../automation/newsjack-sentinel/triggers/trigger_20260517_140000.json -T 2

# Output: output/reaction_trigger_20260517_140000_T[1-3].mp4
```

### Step 4: Post Entro 48h

- TikTok (master, 15-20s vertical)
- YouTube Shorts
- Instagram Reels
- X/Threads (video)
- Blog (short explainer)

---

## Customization & Extension

### Modificare Keywords

Edit `newsjack-sentinel/feeds.json`:
```json
{
  "keywords": ["ad blocker", "manifest v3", "server-side ad", ...]
}
```

### Aggiungere Feed

Edit `newsjack-sentinel/feeds.json`:
```json
{
  "feeds": [
    {"name": "Name", "url": "https://...", "type": "rss"},
    {"name": "Name", "url": "https://...", "type": "json", "json_path": "hits"}
  ]
}
```

### Creare 4° Template

1. `cp src/ReactionTemplate3.tsx src/ReactionTemplate4.tsx`
2. Modifica componenti + scenes
3. Registra in `remotion.config.ts`
4. Aggiorna `REACTION_TEMPLATES.md`

### Integrare n8n (Futuro)

Webhook trigger → auto-render → post on social (quando n8n setup)

---

## Vincoli & Compliance

✅ **Brand Name Policy** (ASSOLUTA):
- NO YouTube, Facebook, Chrome, Google per nome
- Use: "piattaforme video", "social media", "browser", "motore di ricerca"
- OK: hostname matches in rules (adblock-rules.json) — purely functional

✅ **Privacy & Identity**:
- Zero founder identity esposto
- No personal data in sentinel logs
- All dev code in `sviluppo/`, mai in `app/`, `site/`, `docs/`

✅ **No Deploy**:
- Tutto dev-only, in `sviluppo/`
- Sentinel non posta mai da solo (read-only HTTP only)
- Render output è solo MP4, nessun publish automatico

✅ **Code Quality**:
- Python: type hints, pathlib, logging (not print), specific exceptions
- TypeScript: reuse brand.tsx, no hardcoding copy
- Tests: pytest for sentinel (keyword match, dedupe)

---

## File Checklist

```
sviluppo/marketing/
├── automation/
│   ├── README.md ✓
│   └── newsjack-sentinel/
│       ├── sentinel.py ✓
│       ├── feeds.json ✓
│       ├── test_sentinel.py ✓
│       ├── README.md ✓
│       ├── triggers/ ✓ (auto-created on first run)
│       └── seen.json (auto-created on first run)
└── video-engine/
    ├── src/
    │   ├── ReactionTemplate1.tsx ✓
    │   ├── ReactionTemplate2.tsx ✓
    │   └── ReactionTemplate3.tsx ✓
    ├── render-trigger.mjs ✓
    └── REACTION_TEMPLATES.md ✓
```

---

## Testing

```bash
# Unit test sentinel (keyword match + dedupe)
cd newsjack-sentinel
pytest test_sentinel.py -v

# Manual sentinel test
python3 sentinel.py

# Preview templates (interactive)
cd video-engine
npm start
# http://localhost:3000/?composition=ReactionTemplate1&inputProps={"headline":"Test"}
```

---

## Workflow Timing

| Fase | SLA | Chi | Tool |
|------|-----|-----|------|
| Monitor | 4h | Cron | sentinel.py |
| Alert | <4h | System | trigger_*.json |
| Review | Subito | Human | Editor/Slack |
| Template select | <30m | Human | Decision |
| Render | 1h | Automation | render-trigger.mjs |
| Post | <48h | Social manager | TikTok/Shorts/etc |

---

## KPI (Plan Operator §6)

- ✓ Reazioni news-jacking pubblicate <48h: attesa ≥1 per trigger
- ✓ Sistema ready per automation n8n (future)
- ✓ Zero hard-coded copy (everything props-driven)
- ✓ Brand-safe (zero brand leaks)

---

**Status**: READY FOR PRODUCTION

Sentinel è live-ready. Templates sono composable. System è scalabile a 4+ templates o automazioni. Zero budget cash, tutto riuso infra esistente (Python stdlib, Remotion + brand.tsx).

Prossimo passo: installa cron `sentinel.py` (vedi newsjack-sentinel/README.md) e testa il primo trigger manualmente.
