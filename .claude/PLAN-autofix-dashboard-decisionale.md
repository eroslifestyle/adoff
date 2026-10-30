# Piano — Tab Autofix decisionale (analizzo → tu decidi → io/nightly fixo)

## Obiettivo
Trasformare il tab **Autofix** dell'admin da cruscotto a 4 numeri in un **pannello operativo**:
1. mostra ogni leak nel dettaglio (evidenza + screenshot + regola candidata già pronta),
2. ti fa decidere per-leak: **Fixa / Ignora (falso positivo) / Rimanda**,
3. persiste le decisioni in **D1 via worker**,
4. le decisioni vengono **applicate**: gli approvati "semplici" dal job notturno, i casi complessi da me on-demand.

## Verifica stato reale (fatta in planning — evidence-gate)
- Sistema **funzionante**, gira in **Shadow Mode**. Ultimo run reale: `2026-07-10T20:00:55Z` (`site/autofix-status.json`).
- **24 leak `open`, 0 `fixed`** (`sviluppo/autofix/logs/state.json`).
- **19 candidate rules** DNR-valide già generate (`candidate_rules/2026-07-10.json`, id 60001–60019, `validation_errors:0`) ma NON applicate a `rules-feed.json`.
- **14 findings** su 11 domini con screenshot (`findings/2026-07-10.json` + `findings/screenshots/2026-07-10/*.png`).
- Molti "leak" sono **tracking/analytics** (google-analytics, gtm, scorecardresearch, bat.bing) e alcuni **DOM falsi positivi** (`[class*="ad-"]` becca `masthead-finish`, commenti YouTube, `down-load-app`). → serve triage, non fix cieco.
- Endpoint attuale: `GET /admin/autofix/status` (worker.js:5924) legge `https://adoff.app/autofix-status.json`. Admin auth = header `X-Admin-Token` + `verifyAdminAuth`. Pattern D1 già usato (`adleak_reports`, `suggestions`, `trials`).
- Admin servito da KV `admin:html` (worker.js:6100); sorgente = `sviluppo/license-system/admin.html`; deploy = ricarica KV.

## Decisioni raccolte (planning)
- **Storage decisioni**: D1 + endpoint worker.
- **Esecuzione fix**: ibrida (nightly applica approvati semplici; io on-demand per i complessi).
- **Dettaglio UI**: completa con screenshot.
- **Raggruppamento**: per priorità + falso-positivo separati.

---

## Architettura del loop decisionale

```
crawl+analyze (nightly) ──▶ findings + candidate_rules (file, leobox)
                                     │
        push arricchito              ▼
   POST /admin/autofix/ingest ─▶ D1 autofix_leaks (verità: leak + candidata + evidenza)
                                     │
   admin tab  ◀── GET /admin/autofix/leaks ── (leggi, con screenshot)
       │
       │ tu decidi per-leak
       ▼
   POST /admin/autofix/decision ─▶ D1 autofix_decisions (fixed/ignored/deferred + note)
                                     │
        ┌────────────────────────────┴───────────────────────┐
        ▼                                                      ▼
   nightly: applica gli 'approvati semplici'            io on-demand: leggo le decisioni,
   (network, alta confidenza) → rules-feed + deploy      genero/valido/testo i complessi,
                                                          aggiorno feed, canary+A/B, deploy
```

Fonte verità = **D1**; snapshot KV `autofix:dashboard` per lettura veloce (pattern GSC). Screenshot serviti da endpoint worker autenticato (proxy da un path non pubblico) — NON esposti su Pages pubblico.

---

## FASE A — Schema dati & ingest (worker + leobox)

### A1. D1 — due tabelle nuove (init idempotente nel worker, come le altre)
```sql
CREATE TABLE IF NOT EXISTS autofix_leaks (
  fingerprint TEXT PRIMARY KEY,
  domain TEXT, category TEXT, site_type TEXT, country TEXT,
  leak_type TEXT,            -- network_leak | dom_visible_ad | video_ad
  ad_network TEXT,           -- doubleclick, googlesyndication, analytics, dom, ...
  blocked_url TEXT, selector TEXT,
  candidate_rule TEXT,       -- JSON della candidata (o null se DOM)
  confidence TEXT,           -- high | medium | low  (classe ad-vero vs tracking vs FP)
  fp_suspect INTEGER,        -- 1 = sospetto falso positivo
  screenshot TEXT,           -- path relativo screenshot
  status TEXT,               -- open | fixed | ignored | deferred | regressed
  first_seen TEXT, last_seen TEXT
);
CREATE TABLE IF NOT EXISTS autofix_decisions (
  fingerprint TEXT PRIMARY KEY,
  decision TEXT,             -- fix | ignore | defer
  note TEXT,
  decided_by TEXT,           -- admin
  decided_at TEXT,
  applied INTEGER DEFAULT 0, -- 0=da fare, 1=applicata
  applied_by TEXT,           -- nightly | claude
  applied_at TEXT
);
```

### A2. Classificatore confidenza + FP (in `analyze_and_fix.mjs`)
Aggiungere a ogni candidata/finding due campi calcolati:
- `confidence`: **high** se ad_network ∈ {doubleclick, googlesyndication, amazon-adsystem, imasdk} · **medium** (tracking utile) se ∈ {analytics, googletagmanager, scorecardresearch, bat.bing, beacon, facebook} · **low** per DOM generici.
- `fp_suspect=1` per i DOM che matchano pattern noti-innocui (`masthead`, `thread`, `comment`, `down-load-app`, testo tipo "Read about our approach"/"risposte"). Lista in `fp-heuristics.json` (nuovo, editabile).

### A3. Ingest endpoint (worker)
`POST /admin/autofix/ingest` (admin token): riceve findings+candidate+classificazione, UPSERT in `autofix_leaks`, rigenera snapshot KV `autofix:dashboard`. Pattern identico a quello descritto nel piano madre (Fase 5).
`push_dashboard.mjs` (nuovo, leobox): dopo analyze, POSTa lo stato a questo endpoint. Aggiunto come step 5-bis in `autofix_nightly.sh`.

### A4. Screenshot endpoint (worker)
`GET /admin/autofix/screenshot?fp=<fingerprint>` (admin token): il nightly carica gli screenshot in KV (`autofix:shot:<fp>`, base64/ArrayBuffer) durante l'ingest; il worker li serve. Così il pannello mostra l'immagine senza esporla pubblicamente.

---

## FASE B — Endpoint di lettura & decisione (worker)

- `GET /admin/autofix/leaks` → lista arricchita: raggruppata server-side in 3 bucket
  **(1) Ads reali alta confidenza · (2) Tracking/analytics · (3) DOM sospetti FP**,
  ciascun leak con: dominio, tipo, network, blocked_url/selector, candidate_rule, confidence, fp_suspect, screenshot-url, status, decisione corrente. Legge da KV snapshot (fallback D1).
- `POST /admin/autofix/decision` `{fingerprint, decision, note}` → UPSERT `autofix_decisions`, aggiorna `autofix_leaks.status` (ignore→ignored, defer→deferred, fix→resta open finché applicata). Supporta anche **batch** `{decisions:[...]}` per approvare in blocco un bucket.
- `GET /admin/autofix/status` (esistente) → arricchito con: n. decisioni pendenti, n. fix approvati non-ancora-applicati, ultimo apply.

Tutti dietro `verifyAdminAuth` (pattern esistente).

---

## FASE C — UI del tab (admin.html)

Riscrivere `loadAutofix()` + markup del panel `[data-panel="autofix"]`. Mantiene la card modalità+4 KPI in alto, poi aggiunge:

1. **Barra riassuntiva CTA** (il "call to action" per te):
   - "🔴 N leak da valutare · ✅ M fix approvati in attesa di apply · 💤 K rimandati"
   - Bottoni globali: **[Approva tutti gli ads-reali]** · **[Ignora tutti i DOM sospetti]** · **[Applica ora i fix approvati]** (quest'ultimo chiama un endpoint che marca "richiesta apply" — vedi Fase D).
   - Riquadro: *"Hai N decisioni pronte. Scrivi in chat 'applica i fix approvati' e li eseguo, oppure attendi il job notturno per gli approvati semplici."*
2. **3 sezioni collassabili** (bucket): Ads reali / Tracking / DOM sospetti-FP. Header con conteggio + azione-di-gruppo.
3. **Card per-leak**: dominio + badge categoria/tipo/confidence, evidenza (URL o selettore + testo), **la regola candidata** in `<code>`, thumbnail screenshot (click → lightbox via screenshot endpoint), e **3 bottoni**: `✅ Fixa` / `🚫 Ignora (FP)` / `⏳ Rimanda`, con campo nota opzionale. Stato decisione mostrato inline; ri-cliccabile per cambiare idea.
4. Persistenza ottimistica: click → POST decision → toast; ricarica leggera.

Solo CSS/vanilla-JS inline già in uso (nessuna dipendenza nuova). Rispetta le variabili tema esistenti (`--input`, `--accent`, `--muted`).

---

## FASE D — Applicazione fix (ibrida)

### D1. Lettura decisioni (per me, on-demand)
`apply_decisions.mjs` (nuovo, leobox): `GET /admin/autofix/decisions?applied=0` → per ogni `fix`:
- **network, confidence high/medium, candidate presente** → auto-applicabile: merge in `site/rules-feed.json` (id 60000+, dedup per urlFilter+domains), snapshot pre-modifica.
- **DOM / video / senza candidata** → genero io la regola/selettore, valido schema DNR, testo.
Poi: canary + A/B (riusa `canary_runner.mjs`), se passa → deploy `wrangler pages deploy site/`, `POST /admin/autofix/decision` con `applied=1, applied_by=claude`, aggiorna `state.json` (`fixed`), Telegram report.

Uso in chat: **"applica i fix approvati"** → eseguo `apply_decisions.mjs`, riporto evidenza (diff feed, canary, deploy log) prima di confermare.

### D2. Nightly automatico (approvati semplici)
In `autofix_nightly.sh`, nuovo step prima del report: legge decisioni `fix` **non applicate** che siano **network + confidence≥medium + candidate valida + canary-ok**, le applica ed esce da Shadow per quelle (cap giornaliero rispettato). I complessi restano `applied=0` per me. Kill-switch `autofix:enabled` onorato.

### D3. Guardrail invariati
Cap giornaliero, canary regression, snapshot+rollback, A/B nello stesso giro, kill-switch KV — come nel piano madre. Nessuna regola che fallisce canary viene deployata. Le `ignore` non vengono mai ri-proposte (status `ignored` sticky salvo cambio manuale).

---

## FASE E — Deploy & verifica
1. Worker: `wrangler deploy` (endpoint nuovi) via `wrangler login` OAuth (token .env è D1-only — vedi memoria).
2. Admin HTML: ricarica KV `admin:html` con la nuova `admin.html`.
3. `autofix-status.json` / dashboard: primo popolamento via `push_dashboard.mjs` (run manuale una tantum sui dati del 2026-07-10 già presenti).
4. Verifica evidence-gate: apri il tab, controlla i 3 bucket popolati con i 24 leak reali, decidi 1 leak di test, verifica riga in D1 (`wrangler d1 execute`), esegui `apply_decisions.mjs` in dry-run.

---

## File toccati / creati
- MODIFICA: `sviluppo/license-system/worker.js` (D1 schema init + 4 endpoint: ingest, leaks, decision, screenshot; arricchisci status)
- MODIFICA: `sviluppo/license-system/admin.html` (markup panel autofix + `loadAutofix()` riscritta + handler decisioni)
- MODIFICA: `sviluppo/autofix/analyze_and_fix.mjs` (classificatore confidence + fp_suspect)
- MODIFICA: `sviluppo/autofix/autofix_nightly.sh` (step push_dashboard + step apply-approvati)
- NUOVI: `sviluppo/autofix/push_dashboard.mjs`, `sviluppo/autofix/apply_decisions.mjs`, `sviluppo/autofix/fp-heuristics.json`
- DEPLOY: worker + KV admin:html + Pages (dashboard/status)

## Do-NOT
- NON esporre screenshot su path pubblico (solo endpoint admin-auth).
- NON applicare fix DOM/video in automatico dal nightly (solo network alta/media confidenza + canary-ok); il resto passa da me.
- NON deployare regole che falliscono canary; rispettare cap giornaliero e id-range 60000+.
- NON ri-proporre leak `ignored`.
- Worker/Pages deploy SOLO via `wrangler login` OAuth (token .env non basta) — riusa gotcha memoria.
- Screenshot/dati crawler restano in `sviluppo/autofix/`, mai dentro `app/`.

## Modalità di costruzione
Sequenza A→B→C→D→E. Fasi A-B-C-D sono in gran parte indipendenti (worker endpoint ∥ UI ∥ classificatore ∥ apply-script) → adatte a fan-out multi-agente se lanci con "ultracode"; altrimenti costruzione lineare con verifica per fase. Shadow Mode resta ON: nulla si deploya in automatico finché non lo decidi tu leak-per-leak.
