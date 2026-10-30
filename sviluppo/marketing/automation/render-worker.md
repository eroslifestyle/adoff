# render-worker.md — Runbook render Remotion (content factory)

> Render della content bank parametrizzata su **leobox** (o locale). Modello: semi-auto (decisione A, strategia §8): produzione automatica → upload manuale negli scheduler nativi (TikTok Studio / Meta Business Suite).

## Componenti

| Pezzo | Path | Ruolo |
|---|---|---|
| Banca brief | `sviluppo/marketing/automation/hook-bank.json` | Fonte contenuti (da Bibbia), EN+IT, rotazione pilastri |
| Prompt caption | `sviluppo/marketing/automation/caption-prompt.md` | System/user prompt LLM per caption/hashtag/disclosure |
| Engine video | `sviluppo/marketing/video-engine/` | Remotion parametrizzato (`hook-card`, `before-after`) |
| Batch renderer | `sviluppo/marketing/video-engine/batch-render.mjs` | Render N brief × lingua → `output/bank/<id>__<lang>.mp4` + `manifest.json` |
| Workflow n8n | `sviluppo/marketing/automation/content-factory.workflow.json` | Orchestrazione giornaliera (cron→LLM→render→queue→Telegram) |

## Setup one-time (leobox)

```bash
cd ~/adoff/sviluppo/marketing/video-engine        # path repo su leobox
npm install --legacy-peer-deps                     # conflitto peer noto: tailwind-v4 vuole bundler 4.0.449
node batch-render.mjs --id A1-recipe-clutter --lang it   # smoke test (scarica Chrome headless al 1° run)
```

Requisiti: Node 20+, ~200 MB liberi (Chrome Headless Shell), `public/Lexend-var.ttf` presente.

## Comandi batch

```bash
node batch-render.mjs                       # tutti i brief non-dynamic × tutte le lingue del bank
node batch-render.mjs --lang it             # solo IT
node batch-render.mjs --id B1-numbers-nobody-tells   # un brief, tutte le lingue
node batch-render.mjs --include-dynamic     # include brief dynamic:true (placeholder NON risolti)
```

Output: `video-engine/output/bank/<brief.id>__<lang>.mp4` + `output/bank/manifest.json` (indice machine-readable: id, pillar, template, lang, file, hashtagSet).

## Brief `dynamic:true` (build-in-public, pilastro D)

`D1-build-in-public` ha placeholder `{{installs}}` / `{{milestone}}`. NON renderizzare con placeholder grezzi: il workflow n8n li risolve da metrica reale (CWS API / Stripe) prima del render. Manualmente: copiare il brief, sostituire i placeholder con il numero reale, render con `--id`. Mai numeri inventati (regola Bibbia + CLAUDE.md).

## Brand-safety gate (obbligatorio prima dell'upload)

```bash
# zero brand vietati nel CONTENUTO dei brief (esclude il campo notes meta che cita la policy)
python3 -c "
import json,re,sys
d=json.load(open('sviluppo/marketing/automation/hook-bank.json'))
BAN=re.compile(r'youtube|google|facebook|instagram|tiktok|amazon|reddit|twitch|outbrain',re.I)
leak=[(b['id'],l) for b in d['briefs'] for l,p in b['props'].items() if BAN.search(json.dumps(p,ensure_ascii=False))]
print('LEAK — STOP', leak) if leak else print('OK brand-safe')
"
```

Allineato al pre-deploy check di `CLAUDE.md`. I template usano solo UI sintetica (mai screen-record reale).

## Pubblicazione (manuale, semi-auto)

1. n8n invia un **digest Telegram** giornaliero: lista `output/bank/*.mp4` pronti + caption + hashtag + disclosure (da `posts_queue`, status `queued`).
2. Founder scarica gli MP4 e carica negli scheduler nativi:
   - **TikTok**: app TikTok / CapCut (per **aggiungere il suono di tendenza** — vedi sotto) o TikTok Studio web (scheduler ~10gg, senza sound).
   - **Instagram/Facebook**: Meta Business Suite — scheduler nativo (qui usare la variante `audio:true` = bed integrato).
3. Founder marca i post come `posted` (comando Telegram o update manuale `posts_queue`).

### Confine automazione / musica (inequivocabile)

- **n8n NON pubblica su TikTok e NON seleziona la musica.** n8n arriva fino a: video silent + caption + `posts_queue` + digest Telegram. Punto.
- Il **suono di tendenza** TikTok è accessibile **solo dentro l'app TikTok/CapCut** (vincolo licenza Google/TikTok): **nessuna API** (n8n, Buffer, tool terzi) può sceglierlo/iniettarlo. È **sempre un passaggio umano** del founder al momento dell'upload.
- Per questo i template sono **silent di default** (`audio:false`): massimizzano il boost del sound nativo aggiunto in-app. Variante `audio:true` (bed `bgm_full.mp3`, licenza da verificare) **solo** per FB/Shorts/YouTube dove non esiste l'ecosistema trending-sound.
- Regola operativa: TikTok → master silent + sound trending in app. FB/Shorts/YT → variante `audio:true`.

Nessuna API di pubblicazione di terze parti (decisione 2026-05-15: zero dati societari, zero rischio identità).

## Troubleshooting

| Sintomo | Causa | Fix |
|---|---|---|
| `Cannot destructure property 'silent'` a fine run | `browser.close()` API variata tra versioni Remotion | Cosmetico: render già completo. Già gestito con try/catch in `batch-render.mjs`. |
| `ERESOLVE` su `npm install` | peer dep `@remotion/tailwind-v4` vuole `@remotion/bundler@4.0.449` | `npm install --legacy-peer-deps` |
| Font non Lexend nel video | `public/Lexend-var.ttf` mancante | ripristinare il file in `video-engine/public/` |
| Caption con brand reale | LLM ha ignorato il vincolo | regex brand-guard nel workflow → scarta e rigenera (vedi `caption-prompt.md §pipeline`) |
