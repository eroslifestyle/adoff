# AdOff — Tipologie Video (linguaggi di movimento candidati)

> **Data**: 2026-05-17 · Scopo: scegliere la/e tipologia/e che meglio incarna la brand identity. Tutte dinamiche, brand-safe (UI sintetica, zero brand reali), code-defined (Remotion, versionate, 15 lingue parametriche).
> **Selezione**: non per gusto isolato → via esperimento **E1** in `PIANO-ESPERIMENTI-CONTENT-2026.md` (TikTok test-bed, save+share rate). Questo doc = il menu + i criteri.
> **Costanti**: ogni tipologia rispetta `STORY-BIBLE-2026.md` (atti, motivi: silenzio/contatore/click/ultraleggera/switch, palette 4 fasi).

---

## Le tipologie

| ID | Nome | Linguaggio di movimento | Atto/Pilastro forte | Durata | Stato |
|---|---|---|---|---|---|
| **T1** | Before/After | Sito invaso → dissolvenza particellare → pulito. Demo narrativa completa. | A · arco I→II→III in 1 clip | ~16s | ✅ render |
| **T2** | Hook Card | Hook statico forte → bullet fade-up → outro. Sobrio, leggibile. | B/E · Atto I/III | ~13s | ✅ render |
| **T3** | Kinetic Typography | Parole singole a ritmo (scale+blur+ghost), punch, outro. Massimo dinamismo testuale. | C/B · Atto I (hook) | ~11s | ✅ render |
| **T4** | Counter Reveal | Numeri reali che salgono (count-up ease-out, jitter rosso) → crollo a **0** viola. Il contatore protagonista. | B · Atto I→II | ~12s | ✅ render |
| **T5** | Split Screen | Schermo diviso: sinistra ads che pulsano / destra AdOff pulito, divisore luminoso. Confronto satisfying. | A/E · Atto III | ~12s | ✅ render |
| **T6** | Story Beats | 3 battute hard-cut (Rumore→Click→Silenzio) + palette 4 fasi. | C · arco completo | ~14s | ✅ render |
| **T7** | POV Scroll | Prima persona: pagina che scrolla invasa → tap → pulita. TikTok-native. | A/C · Atto I→III | ~12s | ✅ render |
| **T8** | Glitch Purge | Schermo "infetto" (glitch/scanline) → sweep di pulizia luminosa → calma. | A/B · Atto I→II | ~12s | ✅ render |
| **T9** | **Cinematic Narrated** | **Foto fotorealistiche (FLUX.2) Ken Burns + grading + voce narrante (edge-tts) + caption sync + device sintetico al click.** Concept mix umano + device astratto, IT+EN. | A/C · arco completo | ~38s IT / ~51s EN | ✅ render |

> **T9 è la risposta alla richiesta "più dinamico, fotorealistico, voce narrante"**: NON motion-graphics sintetiche ma persona reale generata (brand-safe: schermi sempre sintetici/out-of-frame) + narrazione. Pipeline: `automation/photoreal-pipeline-runbook.md`. Le T1-T8 restano repertorio per hook brevi/repurpose; T9 = formato hero narrativo.

> **Layer audio**: ogni tipologia ha flag `audio` (default `false` = silent per sound trending in-app TikTok; `true` = bed `bgm_full.mp3` per FB/Shorts/YT). n8n NON pubblica né sceglie musica (vincolo licenza — passaggio umano). Vedi `automation/render-worker.md §Confine automazione/musica`.

Render campione: `video-engine/output/typologies/<id>.mp4` (+ gallery `index.html`).

---

## Criteri di brand-fit (come giudicare)

La brand identity AdOff (Bibbia Parte 9): **diretto, onesto, empatico, minimale** — "l'amico tecnico che semplifica", mai azienda che vende, mai nerd che ostenta. Griglia di valutazione (1-5) per ogni tipologia:

| Criterio | Domanda |
|---|---|
| **Minimalismo** | Sottrae o aggiunge rumore visivo? (il prodotto è ultraleggera: il video deve "pesare" poco) |
| **Il silenzio** | Riesce a creare la pausa/stop emotivo (motivo cardine)? |
| **Onestà** | I numeri/claim restano sobri (no iperbole)? |
| **Hook 0-1s** | Ferma il pollice nel primo secondo senza urlare? |
| **Scalabilità 15 lingue** | Regge testi più lunghi (DE/lingue verbose) senza rompersi? |
| **Riconoscibilità** | Si "vede" che è AdOff anche senza logo (palette/motivi)? |
| **Costo/velocità render** | Sostenibile a 5-10/giorno automatici? |

---

## Lettura attesa (ipotesi pre-test, da validare con E1)

- **T1 Before/After**: massima chiarezza prodotto, racconta l'arco intero — rischio: meno "scroll-stopping" nei primi 0.5s. Forte come hero/Atto demo.
- **T2 Hook Card**: il più sobrio/onesto, regge bene 15 lingue — rischio: meno dinamico (può sembrare "slide").
- **T3 Kinetic**: altissimo hook-rate, molto TikTok-native — rischio: se esagerato tradisce il minimalismo (tenere palette/ritmo controllati).
- **T4 Counter**: lo shock dei numeri reali è on-brand (Bibbia P2) e il crollo a 0 è il "silenzio" in forma numerica — candidato forte per Atto I→II.
- **T5 Split**: confronto immediato, molto condivisibile ("guarda la differenza") — rischio: due metà piccole su mobile, testo limitato.

> Nessuna scelta a priori: si pubblicano come varianti dell'esperimento **E1** (matched pairs, stesso brief/atto/lingua/slot) e vince chi supera mediana14g +25% su save+share senza guardrail. Possibile esito: **2-3 tipologie vincenti** assegnate a atti diversi (es. T4→Atto I, T1→demo, T3→hook C).

---

## Mappa tipologia ↔ atto (post-selezione)

Quando E1 chiude, il vincente per atto viene cablato in `hook-bank.json` (nuovo campo `template` per brief già esiste; estendere a T3/T4/T5) e l'automazione `content-factory` lo usa di default. Le perdenti restano disponibili per varianti future, non eliminate (linguaggio di marca = repertorio, non monocultura).

---

*Creato 2026-05-17. Le 5 tipologie pronte sono in output/typologies/. T6 Story Beats = follow-up. La decisione passa SEMPRE da E1 (dato, non gusto).*
