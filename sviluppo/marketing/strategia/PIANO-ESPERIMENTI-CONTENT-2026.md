# AdOff — Framework Esperimenti Content 2026 (organico, n8n-automatizzato)

> **Data**: 2026-05-17 · **Stato**: AUTORITATIVO per test & controllo.
> **Metodo**: skill ab-testing adattata al **social organico** (no 50/50 controllato, no paid). Si testa *come* raccontare gli atti di `STORY-BIBLE-2026.md`, mai la storia.
> **Subordinato a**: STORY-BIBLE (costanti), PIANO-MARKETING-PRODUZIONE (esecuzione), STRATEGIA-SOCIAL-CONTENT (principi).

---

## 0. Perché NON A/B classico

Sul social organico non controlli lo split: l'algoritmo distribuisce. Sample size p<0.05 (27k/variante) = irrealistico in Fase A/B. Modello adottato:

- **Creative testing sequenziale + multi-armed bandit**: ogni variante è un "braccio", il KPI proxy ne pesa la rotazione futura.
- **Confronti appaiati**: stesso brief, stesso atto, stessa lingua, stesso slot → cambia **una sola variabile**.
- **Soglia pratica, non statistica**: TikTok come test-bed (reach indipendente dai follower → giudizio rapido). Vincitore = chi batte la **mediana mobile a 14 giorni** del KPI proxy di ≥25% su ≥3 post.

---

## 1. Cosa è costante vs cosa si testa

| INVARIANTE (mai testare) | VARIABILE (testabile, 1 alla volta) |
|---|---|
| Protagonista = "tu", antagonista = "il rumore", mentore = AdOff | **V1 Formula hook** (H1-H6, libreria PIANO-MKT §3.2) |
| 4 atti, motivi ricorrenti (silenzio/contatore/click/ultraleggera/switch) | **V2 Tipologia video** (vedi VIDEO-TIPOLOGIE-2026.md: T1-T6) |
| Voce brand (diretto/onesto/empatico/minimale), palette 4 fasi | **V3 Lunghezza** (10s / 15s / 25s / 40s) |
| Brand Name Policy, AI disclosure, numeri solo-Bibbia | **V4 CTA** (soft "→adoff.app" / domanda / contatore-driven) |
| Tagline "Ads? Off." | **V5 Caption style** (gancio-secco / POV / storytelling) |
| | **V6 Hook timing** (testo a schermo 0s vs 0.5s vs voce) |
| | **V7 Slot orario** (pranzo vs sera, per fuso) |
| | **V8 Lingua-voce** (silent vs voiced /tts-pro, per pilastro C) |

Una sola variabile per esperimento (skill ab-testing: "test one thing").

---

## 2. KPI & guardrail

| Tipo | Metrica | Fonte |
|---|---|---|
| **Primaria** | **save+share rate** (proxy qualità/viralità) | TikTok Studio / Meta Insights export |
| Secondarie | views, watch-through %, follow-da-post, CTR profilo→sito | piattaforma + UTM |
| Conversione | install attribuiti (UTM `adoff.app/?s=<exp_id>`) | sito/analytics |
| **Guardrail** | account restriction/shadowban, commenti negativi spike | manuale + drop reach >60% |

Guardrail negativo significativo → stop variante immediato (skill ab-testing: stop solo su guardrail, mai winner early).

---

## 3. Hypothesis template (ogni esperimento)

```
Poiché [osservazione/dato],
crediamo che [variante della variabile Vx]
causerà [+X% save+share rate]
per [pubblico/atto/lingua].
Lo sapremo quando [≥3 post, mediana14g +25%, guardrail OK].
```

Esempio: *"Poiché H3-POV ha alta identificazione (Bibbia P7), crediamo che la formula hook H3 vs H1 causerà +25% save+share su Atto I IT. Lo sapremo dopo 3 post/variante con guardrail OK."*

---

## 4. ICE backlog (prioritizzazione, ri-score mensile)

| ID | Esperimento (variabile) | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|---|
| E1 | V2: tipologia video T1..T6 → quale fit brand vince | 9 | 6 | 7 | 7.3 |
| E2 | V1: H3-POV vs H1-stat su Atto I | 8 | 7 | 9 | 8.0 |
| E3 | V3: 15s vs 25s (watch-through vs completamento storia) | 7 | 6 | 8 | 7.0 |
| E4 | V4: CTA contatore-driven vs soft | 6 | 5 | 8 | 6.3 |
| E5 | V8: voiced vs silent pilastro C | 7 | 5 | 5 | 5.7 |
| E6 | V7: slot pranzo vs sera | 5 | 6 | 9 | 6.7 |

Run per ICE decrescente. E2 e E1 partono per primi. Backlog target ≥20 ipotesi (rifornire da §7).

---

## 5. Disegno operativo (matched pairs)

- **Unità**: il brief `hook-bank.json` (stesso id, stesso atto, stessa lingua).
- **Variante**: si genera la stessa clip cambiando SOLO Vx (es. due render dello stesso brief con tipologia video diversa).
- **Esposizione**: pubblicare le varianti **a giorni alterni stesso slot** sullo stesso account (no due varianti stesso giorno → confonde l'algoritmo). Min 3 cicli/variante.
- **Durata**: 2-4 settimane/esperimento (skill ab-testing) o fino a 3 post/variante validi.
- **Decisione**: tabella interpretazione → vincente = +25% mediana14g & guardrail OK; perdente = -20%; inconcludente = serve più volume o test più audace.

---

## 6. Loop automatizzato in n8n (test & controllo)

```
[cron settimanale]  → seleziona prossimo esperimento ICE-top dal backlog (tabella Postgres experiments)
        ↓
[genera 2 varianti]  hook-bank brief + override Vx  → batch-render.mjs (2 render)
        ↓
[enqueue]  posts_queue con exp_id + variant (A|B) + UTM s=<exp_id>-<variant>
        ↓
[digest Telegram]  founder pubblica a giorni alterni (slot)
        ↓
[cron giornaliero]  fetch metriche (export TikTok/Meta in tabella metrics) + install UTM
        ↓
[valuta]  quando ≥3 post/variante: calcola mediana14g, delta, guardrail
        ↓
[decidi]  vincente → patch hook-bank (promote default Vx) + append experiment-playbook.md
          perdente/incon. → archivia, prossimo ICE
        ↓
[ricicla]  rigenera ipotesi da learnings → backlog
```

### Schema dati (estende infra/db-schema.sql — nuove tabelle)

```sql
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY, variable TEXT, hypothesis TEXT,
  ice NUMERIC(3,1), status TEXT DEFAULT 'backlog', -- backlog|running|won|lost|inconclusive
  variant_a JSONB, variant_b JSONB, started_at TIMESTAMPTZ, decided_at TIMESTAMPTZ, winner TEXT);
CREATE TABLE IF NOT EXISTS post_metrics (
  id BIGSERIAL PRIMARY KEY, post_id BIGINT REFERENCES posts_queue(id),
  exp_id TEXT, variant TEXT, platform TEXT, captured_at TIMESTAMPTZ DEFAULT NOW(),
  views INT, saves INT, shares INT, watch_pct NUMERIC(4,1), profile_clicks INT, installs INT);
```

n8n nodes: scheduleTrigger · Postgres (pick experiment) · Code (build 2 variant props) · executeCommand (batch-render ×2) · Postgres (enqueue) · httpRequest (Telegram) · scheduleTrigger (metrics fetch) · Code (decision rule) · executeCommand (patch hook-bank) · Code (append playbook). Workflow file: `automation/experiment-engine.workflow.json` (follow-up build).

---

## 7. Experiment Playbook (libreria pattern vincenti)

Ogni vittoria → entry in `sviluppo/marketing/strategia/experiment-playbook.md`:

```
## [exp_id] — [variabile]
Data | Ipotesi | Cicli/variante | Risultato: [winner] [KPI] +X% (mediana14g)
Guardrail: OK/violato | Segmenti: [lingua/atto/slot]
Perché ha funzionato | Pattern riusabile | Applicare a: [altri atti/lingue] | Status
```

Il playbook diventa la **linea brand provata**: l'automazione ne eredita i default (hook-bank). Costanti STORY-BIBLE restano invariate — si ottimizza la tattica, non la storia.

---

## 8. Cadenza (skill ab-testing, adattata)

- **Settimanale (15')**: check guardrail esperimenti running (stop solo se guardrail negativo).
- **Bi-settimanale**: chiudi esperimenti completi, aggiorna playbook, lancia prossimo ICE.
- **Mensile (1h)**: velocity (target 4-8 exp/mese), win-rate (20-30% sano), lift cumulato, ri-score ICE, rifornisci backlog.
- **Trimestrale**: audit playbook — quali pattern scalati su tutte le lingue/atti.

---

*Creato 2026-05-17 (skill ab-testing). Le costanti narrative sono in STORY-BIBLE-2026.md. Le tipologie video candidate in VIDEO-TIPOLOGIE-2026.md. Workflow n8n: automation/experiment-engine.workflow.json (build).*
