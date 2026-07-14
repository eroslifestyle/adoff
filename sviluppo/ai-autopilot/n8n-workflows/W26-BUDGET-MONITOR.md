# W26 — Gemini Budget Cap Monitor

Monitora spesa Gemini API aggregata (daily + monthly), blocca workflow se sopra threshold, notifica Telegram.

## Logica

1. **Schedule**: Every 60 min
2. **DB Setup**: Crea tabelle `budget_alerts` + `workflow_kill_switch` (idempotente)
3. **Query Costs**: 
   - Daily spend ultimi 24h (gemini_copy_drafts)
   - Monthly spend da inizio mese
   - Prezzo: flash $0.075/$0.30, pro $1.25/$10 (input/output per MTok)
4. **Calculate**: Aggrega cost USD → EUR (× 0.92)
5. **Threshold Check**:
   - daily >= 2 EUR → severity=warning, insert alert, notify Telegram
   - daily >= 5 EUR → severity=critical, INSERT kill_switch, disable w20, notify CRITICAL Telegram
   - monthly >= 30 EUR → severity=critical, INSERT kill_switch (separate), notify CRITICAL Telegram
6. **Webhook**: POST `/budget-status` ritorna JSON snapshot (per dashboard)

## Tabelle

### `adoff_autopilot.budget_alerts`
```sql
id SERIAL PRIMARY KEY
timestamp TIMESTAMPTZ DEFAULT NOW()
severity TEXT ('warning'|'critical')
daily_cost_eur NUMERIC(10,2)
monthly_cost_eur NUMERIC(10,2)
n_calls_24h INTEGER
message TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
```

### `adoff_autopilot.workflow_kill_switch`
```sql
id SERIAL PRIMARY KEY
workflow_id TEXT UNIQUE (e.g., 'w20-gemini-copywriter-caption')
disabled BOOLEAN DEFAULT false
reason TEXT
set_at TIMESTAMPTZ DEFAULT NOW()
```

## Setup

1. **Database**:
   ```bash
   psql -d adoff_autopilot < setup-budget-tables.sql
   ```

2. **Environment**:
   - `TELEGRAM_BOT_TOKEN` — Telegram bot token
   - `TELEGRAM_CHAT_ID` — Chat ID per notifiche

3. **n8n**:
   - Import `26-budget-cap-monitor.json`
   - Credential: `adoff-pg-autopilot-credential-1234` (Postgres)
   - Activate

## Testing

```bash
export N8N_API_KEY="your-api-key"
export N8N_URL="http://localhost:5678"
export PG_HOST="localhost"
export PG_USER="postgres"
export PG_DB="adoff_autopilot"

./test-budget-monitor.sh
```

## Webhook Endpoint

**POST** `/budget-status`

**Response**:
```json
{
  "snapshot": {
    "timestamp": "2026-05-20T...",
    "daily_cost_eur": 1.23,
    "daily_cost_usd": 1.34,
    "monthly_cost_eur": 8.45,
    "monthly_cost_usd": 9.18,
    "n_calls_24h": 150,
    "status": "OK|WARNING|CRITICAL"
  },
  "thresholds": {
    "warning_daily_eur": 2,
    "critical_daily_eur": 5,
    "critical_monthly_eur": 30
  }
}
```

## Future Integration

Altri workflow Gemini (w20, w21, w22, w23) dovranno prima di eseguire:
1. Leggere `workflow_kill_switch` per loro workflow_id
2. Se `disabled=true`, skip execution

## Alerts in Telegram

- ⚠️ WARNING: Daily 2-5 EUR
- 🚨 CRITICAL: Daily >= 5 EUR + workflows disabled
- 🚨 CRITICAL: Monthly >= 30 EUR

## Cron Rule

```
Every 60 minutes (0 * * * *)
```

Regolabile in schedule node se serve frequenza diversa (es. ogni 30 min per alert piu' rapidi).
