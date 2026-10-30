# AdOff News-Jacking Sentinel

Read-only monitoring system that polls public RSS/JSON feeds for ad blocker news triggers, enabling <48h reaction workflow.

## Features

- **Pure read-only**: no authentication, no posting, no browser API—just HTTP GET
- **Public feeds only**: AdGuard blog RSS, Hacker News (Algolia), Google News, Reddit
- **Keyword detection**: configurable triggers ("ad blocker", "manifest v3", "server-side ad", etc.)
- **Deduplication**: JSON-based seen store prevents duplicate alerts
- **Trigger JSON output**: structured alerts in `triggers/` for Remotion template consumption

## Quick Start

```bash
cd /path/to/sentinel

# Install Python deps (stdlib only — no external packages)
# Verify Python 3.9+
python3 --version

# Run sentinel once
python3 sentinel.py

# Schedule via cron (every 4 hours)
0 */4 * * * cd /home/mrxxx/Dropbox/1 Programmazione/Progetti/ChromePlugin/sviluppo/marketing/automation/newsjack-sentinel && python3 sentinel.py >> sentinel.log 2>&1
```

## Configuration

Edit `feeds.json`:

```json
{
  "feeds": [
    {
      "name": "Feed Name",
      "url": "https://...",
      "type": "rss" | "json",
      "json_path": "hits"  // Only for JSON type
    }
  ],
  "keywords": ["ad blocker", "manifest v3", ...],
  "timeout_seconds": 10,
  "seen_store_path": "seen.json"
}
```

## Output

When a new trigger is detected, a JSON alert is written to `triggers/`:

```json
{
  "timestamp": "2026-05-17T14:23:45.123456",
  "title": "Event title from feed",
  "summary": "First 300 chars of description",
  "url": "https://source.com/article",
  "matched_keywords": ["ad blocker", "manifest v3"],
  "suggested_angle": "Reaction: Event title",
  "status": "new",
  "remotion_props": {
    "headline": "Event title",
    "explanation": "Description text",
    "cta_link": "https://adoff.app",
    "cta_text": "adoff.app — un click, e torna il silenzio."
  }
}
```

## Testing

```bash
pytest test_sentinel.py -v
```

Tests cover:
- Keyword matching (case-insensitive)
- Deduplication logic
- Trigger JSON structure
- Seen store persistence

## Integration with Remotion

1. Sentinel runs on schedule → writes `trigger_YYYYMMDD_HHMM.json` to `triggers/`
2. Claude/team reads the trigger JSON
3. Selects a reaction template from `video-engine/src/ReactionTemplate*.tsx`
4. Passes `remotion_props` as Remotion composition props
5. Template renders headline + explanation + CTA
6. Human posts within 48h

## No External Dependencies

Uses Python stdlib only:
- `urllib` for HTTP
- `xml.etree` for RSS parsing
- `json` for storage
- `logging` for monitoring
- `pathlib` for file ops

No pip install needed — works with stock Python 3.9+.

## Logging

Logs go to stdout/stderr. For persistent logs, add to cron:

```bash
>> /path/to/sentinel/sentinel.log 2>&1
```

Or integrate with syslog:

```python
# In sentinel.py handler setup
handler = logging.handlers.SysLogHandler(address=('/dev/log'))
```

## SLA

- Sentinel runs every 4 hours (cron)
- Detects new triggers within 4h of publication
- Alert JSON ready for team review
- Target: reaction video + post published within 48h
