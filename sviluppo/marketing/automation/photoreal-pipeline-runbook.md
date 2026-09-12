# photoreal-pipeline-runbook.md — T9 Cinematic Narrated (foto reali + voce)

> Concept: **mix umano + device astratto** (persona fotorealistica + schermo SINTETICO nostro, mai brand reali) + voce narrante. Tutto on leobox (questa macchina) — niente SSH, niente stock esterni.

## Stack

| Pezzo | Strumento | Path |
|---|---|---|
| Foto reali | FLUX.2-klein (sd-server :1237) via webhook n8n `/media-gen` | output `/opt/n8n/local-files/` |
| Voce narrante | edge-tts (Microsoft Neural, gratis) — venv `~/.cache/adoff-tts-venv` | `public/voiceover-<lang>.mp3` + `captions-<lang>.json` |
| Script | `automation/narration-script.md` (IT+EN, da Bibbia P7, brand-safe) | — |
| Montaggio | Remotion `src/CinematicNarrated.tsx` (Ken Burns + grading + device sintetico + caption sync + outro) | composition `cinematic-narrated` |
| Render | `render-cinematic.mjs` (durata = voiceover via calculateMetadata) | `output/typologies/cinematic-narrated-<lang>.mp4` |

## Prerequisito: sd-server FLUX.2 attivo

I sd-server sono `disabled` (avvio on-demand, per RAM — vedi memoria pipeline). Prima di generare foto:

```bash
sudo systemctl start adoff-sdserver-flux2.service     # :1237 FLUX.2-klein (foto)
# opzionale: adoff-sdserver-qwen.service (:1238 banner testo) · sd-server-zimage.service (:1236)
# attendere bind (~10s warm modello):
for i in $(seq 1 20); do ss -tlnp | grep -q :1237 && break; sleep 3; done
```
Worker sempre attivi: `media-queue-worker.service`, `image-queue-worker.service`. n8n :5678.
A fine sessione (libera ~12GB VRAM): `sudo systemctl stop adoff-sdserver-flux2.service`.

## Procedura

```bash
cd sviluppo/marketing/video-engine
# 1. voce + caption sincronizzate (IT+EN)
~/.cache/adoff-tts-venv/bin/python gen-voiceover.py        # → public/voiceover-*.mp3 + captions-*.json
# 2. 6 scene fotorealistiche brand-safe (FLUX.2, ~30s/scena)
bash gen-photos.sh                                          # → public/photo/scene1..6.png
# 3. montaggio + render
node render-cinematic.mjs                                   # → output/typologies/cinematic-narrated-it|en.mp4
```

## Brand-safety (vincolo assoluto)

- Prompt foto: persona reale, **schermo MAI visibile/brand reale** (out of frame / sfocato / astratto). Il "prima/dopo" degli ads = **device sintetico** in `CinematicNarrated.tsx` (AdWindow mock), mai screen-record.
- Numeri nello script: solo Bibbia (6.000/giorno, 30 h/anno).
- Disclosure AI nel caption del post (+ valutare nota "voce e immagini sintetiche" nel pinned).
- Voce = narratore brand, non persona fisica identificabile.

## Automazione n8n (follow-up)

`cinematic-factory.workflow.json` (da costruire): cron → start sd-server flux2 → gen-voiceover (lingua del giorno) → gen-photos (prompt da pool brand-safe versionato) → render-cinematic → enqueue posts_queue → Telegram digest → stop sd-server. Pool prompt scena in `automation/photo-prompts.json` (da estrarre da gen-photos.sh, versionato e ruotabile come hook-bank).

## Parametri di qualità

- FLUX.2-klein: ~12-30s/img (warm), 9:16. Per più realismo: `model=flux2` (default). `qwen` solo per banner con testo.
- Voce: IT `it-IT-ElsaNeural` (caldo) · EN `en-US-AriaNeural` (calm). Rate `-4%`. Altre: `edge-tts --list-voices`.
- Durata video = lunghezza voiceover + 3s outro (auto, calculateMetadata). EN ~48s (Aria lenta): per TikTok <34s accorciare script o rate `+8%`.
