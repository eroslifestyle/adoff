# AdOff Content Automation — News-Jacking Workflow

Central hub for automated + semi-automated content generation triggered by ad blocker industry news.

## Architecture

```
automation/
├── newsjack-sentinel/       ← Read-only news monitor (sentinel.py)
│   ├── sentinel.py          ← Poll RSS/JSON feeds, dedupe, write alerts
│   ├── feeds.json           ← Feed URLs + keyword config
│   ├── seen.json            ← Dedup store (auto-generated)
│   ├── triggers/            ← Alert files (trigger_YYYYMMDD_HHMM.json)
│   ├── test_sentinel.py     ← Unit tests
│   └── README.md            ← Sentinel docs
└── [future: n8n workflows for post-publish automation]

video-engine/               ← Remotion reaction templates (separate tree)
├── src/
│   ├── ReactionTemplate1.tsx  ← "Breaking News" (15s)
│   ├── ReactionTemplate2.tsx  ← "We're Still Here" (18s)
│   ├── ReactionTemplate3.tsx  ← "Educational" (20s)
│   └── brand.tsx             ← Shared components
├── render-trigger.mjs       ← Consume trigger JSON → render MP4
├── REACTION_TEMPLATES.md    ← Template + props contract
└── [existing: AdOffTikTok, etc.]
```

## Quick Start

### 1. Sentinel (Monitor Feeds)

```bash
cd sviluppo/marketing/automation/newsjack-sentinel

# One-time test
python3 sentinel.py

# Install cron (every 4 hours)
0 */4 * * * cd /home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/automation/newsjack-sentinel && python3 sentinel.py >> sentinel.log 2>&1
```

### 2. Template Rendering

```bash
cd sviluppo/marketing/video-engine

# Check for new triggers
ls ../automation/newsjack-sentinel/triggers/

# Render a trigger as video
node render-trigger.mjs -t ../automation/newsjack-sentinel/triggers/trigger_20260517_*.json -T 1

# Output: output/reaction_trigger_20260517_*_T1.mp4
```

## Workflow (SLA <48h)

```
1. MONITOR (4h intervals, cron)
   $ python3 sentinel.py
   → Checks feeds for keywords
   → Dedupes
   → Writes trigger_*.json if new event

2. ALERT
   → Trigger file in triggers/
   → Human reviews headline + matched keywords

3. SELECT TEMPLATE
   T1: "Breaking News" — quick facts, policy changes (15s)
   T2: "We're Still Here" — reassurance, trust angle (18s)
   T3: "Educational" — technical depth, MV3 explainer (20s)

4. RENDER VIDEO
   $ node render-trigger.mjs -t triggers/trigger_*.json -T 2
   → MP4 ready

5. POST (within 48h)
   → TikTok/Shorts/Reels/X/Threads
```

## Files Created

### Sentinel (News Monitor)

- `newsjack-sentinel/sentinel.py` — Main script (Python stdlib only)
- `newsjack-sentinel/feeds.json` — Feed config (RSS/JSON URLs + keywords)
- `newsjack-sentinel/test_sentinel.py` — Unit tests (pytest)
- `newsjack-sentinel/README.md` — Sentinel docs + cron setup

### Remotion Templates

- `video-engine/src/ReactionTemplate1.tsx` — Breaking News (15s, slam + explanation + CTA)
- `video-engine/src/ReactionTemplate2.tsx` — We're Still Here (18s, reassurance + trust)
- `video-engine/src/ReactionTemplate3.tsx` — Educational (20s, technical explainer)
- `video-engine/REACTION_TEMPLATES.md` — Props contract + integration guide
- `video-engine/render-trigger.mjs` — Consume trigger JSON → render MP4

### Central Docs

- `automation/README.md` — This file (architecture + workflow overview)

## Props Contract (Templates)

All 3 templates accept identical props:

```typescript
{
  headline: string;          // Event title (~80 chars)
  explanation: string;       // What it means (~200 chars)
  cta_link?: string;         // Default: "https://adoff.app"
  cta_text?: string;         // Default: "adoff.app — un click, e torna il silenzio."
  backgroundColor?: string;  // Default: "#0a0a1a"
}
```

Trigger JSON automatically provides these via `remotion_props` field.

## Testing

```bash
# Sentinel tests (keyword match, dedupe)
cd newsjack-sentinel
pytest test_sentinel.py -v

# Template preview (interactive)
cd video-engine
npm start
# Visit http://localhost:3000/?composition=ReactionTemplate1
```

## Brand Safety Notes

- **Templates use brand components**: BrandBG, Wordmark, Particles, AdWindow (all synthetic)
- **No real brand names**: YouTube → "piattaforme video", Facebook → "social media"
- **All copy**: brand-agnostic, reusable, never hardcoded
- **Aspect ratio**: 9:16 (mobile TikTok/Shorts optimal)
- **Duration**: 15-20s (platform optimal)

## Configuration

Edit `newsjack-sentinel/feeds.json` to:
- Add/remove RSS/JSON feeds
- Customize keywords
- Adjust timeout

Example:
```json
{
  "feeds": [
    {"name": "AdGuard Blog", "url": "https://...", "type": "rss"},
    {"name": "Hacker News", "url": "...", "type": "json", "json_path": "hits"}
  ],
  "keywords": ["ad blocker", "manifest v3", "server-side ad", "extension removed"],
  "timeout_seconds": 10,
  "seen_store_path": "seen.json"
}
```

## Output

When sentinel detects a trigger, it writes:

`triggers/trigger_20260517_140000.json`:
```json
{
  "timestamp": "2026-05-17T14:00:00",
  "title": "Chrome enforces MV3...",
  "summary": "Google rolls out...",
  "url": "https://...",
  "matched_keywords": ["manifest v3", "ad blocker"],
  "suggested_angle": "Reaction: Chrome enforces MV3...",
  "status": "new",
  "remotion_props": {
    "headline": "Chrome enforces MV3...",
    "explanation": "Google accelerates MV3...",
    "cta_text": "adoff.app — un click, e torna il silenzio."
  }
}
```

## Integration with Existing Stack

- **Remotion engine**: Reuses brand.tsx, color palette, Lexend font
- **n8n**: Future: webhook trigger → auto-render + post to social
- **Social scheduler**: Manual publish via Buffer/Later with timing optimization
- **Analytics**: TikTok/YouTube/Instagram native dashboards for engagement tracking

## Next Steps

1. Install sentinel crontab (see newsjack-sentinel/README.md)
2. Add Slack webhook for new triggers (optional)
3. Test: `python3 sentinel.py` → manually trigger a render
4. Setup n8n automation workflow (future)
5. Audit all templates for brand name compliance (Brand Name Policy)

## References

- Operative plan: `strategia/PIANO-OPERATIVO-COMPETITOR-2026.md` §4
- Project instructions: `/CLAUDE.md` (Brand Name Policy, Privacy)
- Video engine: `video-engine/REACTION_TEMPLATES.md`
- Sentinel: `newsjack-sentinel/README.md`
