# tts-runbook.md — S3: voiceover multilingua (variante voiced, opzionale)

> I template MVP (`hook-card`, `before-after`) sono **silent** e brand-safe: restano il default di produzione. Questo runbook copre la **variante voiced** opzionale (composition `tiktok-adoff`), per quando serve voce + sottotitoli karaoke.
> Engine TTS: skill **`/tts-pro`** (Edge TTS / Microsoft Neural — gratis, no API key, integrazione Remotion nativa).

## Quando usare la variante voiced

- Hook narrativi pilastro C (storytelling emozionale) dove la voce aggiunge impatto.
- Mercati dove il testo a schermo non basta per il ritmo TikTok.
- NON per il bulk giornaliero: il silent resta lo standard (zero rischio voce-AI inautentica, zero costi, render più rapido).

## Catena

```
hook-bank.json (props.<lang>)  ──▶  script TTS (hookLine + bullets + outroTagline)
        │
        ▼
   /tts-pro  ──▶  voiceover-<lang>.mp3  +  captions-<lang>.json  (word-level startMs/endMs)
        │
        ▼
   video-engine/public/   (staticFile)  ──▶  composition `tiktok-adoff` (AdOffTikTok.tsx + SyncedCaptions)
        │
        ▼
   render  ──▶  output/bank/voiced/<id>__<lang>.mp4
```

`AdOffTikTok.tsx` consuma `staticFile("voiceover.mp3")` + `../public/captions.json`. Per il multilingua: generare `voiceover-<lang>.mp3` / `captions-<lang>.json` e parametrizzare la composition come fatto per gli altri template (follow-up: estendere `schema.ts` con `VoicedProps { audioSrc, captionsSrc }` + `defaultProps`).

## Voice map (Edge TTS Neural, consigliate)

| Lang | Voce | Note |
|---|---|---|
| it | `it-IT-DiegoNeural` / `it-IT-ElsaNeural` | tono diretto, non enfatico |
| en | `en-US-GuyNeural` / `en-US-AriaNeural` | en-US per reach globale |
| de | `de-DE-ConradNeural` | |
| fr | `fr-FR-HenriNeural` | |
| es | `es-ES-AlvaroNeural` | |
| pt | `pt-BR-AntonioNeural` | pt-BR (mercato maggiore) |

Tier-2 (JA/KO/ZH/PL/TR/AR/ID): Edge TTS ha voci Neural per tutti — selezionare la voce locale standard, mantenere ritmo asciutto.

## Procedura (per un brief)

1. Estrai lo script dal brief: `hookLine` → frase 1; `bullets`/`afterCaption` → corpo; `outroTagline` + "adoff.app" → chiusura. Tono Bibbia parte 9 (diretto, empatico, minimale — mai enfatico).
2. Invoca `/tts-pro` con lo script e la voce della tabella → ottieni `mp3` + `captions.json` word-level.
3. Copia in `video-engine/public/` come `voiceover-<lang>.mp3` / `captions-<lang>.json`.
4. Render composition `tiktok-adoff` (vedi follow-up parametrizzazione) → `output/bank/voiced/<id>__<lang>.mp4`.

## Vincoli

- **Brand-safety**: lo script NON nomina brand reali (eredita i vincoli di `hook-bank.json`).
- **AI disclosure**: la variante voiced richiede comunque la disclosure nel caption (gestita da `caption-prompt.md`); valutare disclaimer "voce sintetica" nel testo del primo video pinnato.
- **Numeri**: solo da Bibbia (nessun numero inventato nello script).
- La voce sintetica NON deve impersonare una persona fisica: voce = "noi" brand, neutra.

## Stato

- Engine `/tts-pro`: disponibile (Edge TTS, multilingua, gratis).
- Composition voiced `tiktok-adoff`: esistente ma hardcoded su `voiceover.mp3`/`captions.json` IT.
- **Follow-up S3** (quando si attiva la variante voiced in produzione): parametrizzare `AdOffTikTok.tsx` con `VoicedProps` (audioSrc/captionsSrc) + voce dell'output `/tts-pro` e aggiungere la composition al `batch-render.mjs` (flag `--voiced`). Non bloccante per Fase B (il silent è lo standard).
