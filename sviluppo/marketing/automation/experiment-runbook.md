# experiment-runbook.md — S7-S9 test & controllo (n8n)

> Esegue `PIANO-ESPERIMENTI-CONTENT-2026.md`. Modello: creative testing organico (matched pairs + soglia pratica, NO A/B 50/50). Semi-auto: n8n genera/valuta, founder pubblica.

## Componenti

| Pezzo | Path |
|---|---|
| Workflow n8n | `automation/experiment-engine.workflow.json` (2 trigger: weekly launch · daily evaluate) |
| Backlog/decisioni | tabelle Postgres `experiments`, `post_metrics` (schema `automation/experiment-schema.sql`) |
| Libreria pattern | `strategia/experiment-playbook.md` (append automatico al winner) |
| Variabili testabili | `PIANO-ESPERIMENTI §1` (V1 hook…V8 lingua-voce; +V9 audio: silent vs bed) |
| Costanti (NON testare) | `STORY-BIBLE-2026.md` |

## Setup (leobox, one-time)

```bash
psql -h <pg> -U n8n -d n8n -f /home/mrxxx/adoff/sviluppo/marketing/automation/experiment-schema.sql
python ~/adoff/sviluppo/ai-autopilot/n8n-workflows/scripts/import-workflow.py \
  ~/adoff/sviluppo/marketing/automation/experiment-engine.workflow.json
# credenziali: n8n-postgres (PLACEHOLDER_PG_CREDENTIAL→reale), env TELEGRAM_BOT_TOKEN/CHAT_ID
```

## Ciclo (automatico)

```
[Weekly launch]  pick experiment status=backlog ORDER BY ice DESC
   → esplode in 2 varianti (A=controllo, B=variabile) da experiments.variant_a/b (JSON)
   → batch-render ×2 → posts_queue (workflow=experiment, UTM ?s=<exp>-A|B)
   → status=running → Telegram: "pubblica A/B a giorni alterni, ≥3 post/variante"

[Daily evaluate]  post_metrics ultimi 14g, mediana (saves+shares)/views per variante
   → quando ≥3 post per A e B: se una batte l'altra ≥+25% → winner
   → experiments status=won + append experiment-playbook.md + Telegram
```

## Inserire un esperimento nel backlog (manuale o da skill ab-testing)

```sql
INSERT INTO experiments (id, variable, hypothesis, ice, status, variant_a, variant_b) VALUES
('E2', 'V1 hook formula', 'H3-POV vs H1-stat su Atto I IT: +25% save+share', 8.0, 'backlog',
 '{"template":"hook-card","lang":"it","props":{"id":"B1-numbers-nobody-tells"}}',
 '{"template":"hook-card","lang":"it","props":{"id":"A1-recipe-clutter"}}');
```

`variant_*` = JSON con `template`, `lang`, `props` (id brief hook-bank o override Vx). Una sola variabile cambia tra A e B (skill ab-testing: test one thing).

## Raccolta metriche (input al daily evaluate)

`post_metrics` va popolata da `metrics-collector.workflow.json` (follow-up) o export manuale:
- TikTok Studio → Analytics → export → views/saves/shares/watch%
- Meta Business Suite → Insights → export
- Install: query UTM `adoff.app/?s=<exp>-<variant>` dall'analytics sito

```sql
INSERT INTO post_metrics (post_id, exp_id, variant, platform, views, saves, shares, watch_pct, profile_clicks, installs)
VALUES (<posts_queue.id>, 'E2', 'A', 'tiktok', 5200, 180, 95, 41.2, 60, 7);
```

## Guardrail (stop manuale)

Settimanale 15': se una variante ha reach -60% improvviso o account restriction → `UPDATE experiments SET status='lost' WHERE id=...` e fermare la pubblicazione di quella variante. Mai chiamare winner prima di 3 post/variante (no peeking — skill ab-testing).

## Decisione → produzione

Winner → promuovere il default in `hook-bank.json` (o nel template) per quell'atto/lingua → `content-factory` lo eredita. Perdente: brief/variante resta nel repertorio, non eliminato. Pattern → `experiment-playbook.md` (diventa la linea brand provata).

## Cadenza (ownership: skill ab-testing offline + n8n online)

- Settimanale: launch nuovo ICE-top (auto) + check guardrail (manuale 15')
- Bi-settimanale: i won chiudono da soli; rivedere playbook, rifornire backlog
- Mensile: velocity (4-8/mese), win-rate (20-30%), re-score ICE
