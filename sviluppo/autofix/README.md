# AdOff Auto-Fix System

Sistema notturno che rileva leak pubblicitari, genera fix, e li deploya.

## Struttura
- `build_target_list.py` - Costruisce lista siti da testare
- `crawl.mjs` - Playwright crawler (Pro mode)
- `analyze_and_fix.mjs` - Analisi leak → candidate rules
- `canary_runner.mjs` - Regression suite
- `snapshot.sh` - Snapshot/rollback rules-feed
- `report.mjs` - Report giornaliero
- `autofix_nightly.sh` - Orchestrazione cron

## Setup
```bash
npm install playwright-core
xvfb-run -a node crawl.mjs --dry-run
```

## Cron
```cron
0 0 * * * Europe/Rome cd /path && SHADOW_MODE=1 bash autofix_nightly.sh
```
