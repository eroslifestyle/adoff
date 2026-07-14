-- AdOff Budget Monitor — SQL Setup Script
-- Crea le due tabelle necessarie per il workflow W26

-- 1. Tabella alert budget
CREATE TABLE IF NOT EXISTS adoff_autopilot.budget_alerts (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  daily_cost_eur NUMERIC(10,2),
  monthly_cost_eur NUMERIC(10,2),
  n_calls_24h INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabella kill switch per workflow
CREATE TABLE IF NOT EXISTS adoff_autopilot.workflow_kill_switch (
  id SERIAL PRIMARY KEY,
  workflow_id TEXT UNIQUE NOT NULL,
  disabled BOOLEAN DEFAULT false,
  reason TEXT,
  set_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_budget_alerts_severity
  ON adoff_autopilot.budget_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_timestamp
  ON adoff_autopilot.budget_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_kill_switch_workflow_id
  ON adoff_autopilot.workflow_kill_switch(workflow_id);

-- Verifica creazione
\dt adoff_autopilot.budget_alerts
\dt adoff_autopilot.workflow_kill_switch

-- Seed: inserisci workflow w20 con disabled=false
INSERT INTO adoff_autopilot.workflow_kill_switch (workflow_id, disabled, reason)
  VALUES ('w20-gemini-copywriter-caption', false, 'Initial setup')
  ON CONFLICT (workflow_id) DO NOTHING;

-- Verifica seed
SELECT * FROM adoff_autopilot.workflow_kill_switch;
