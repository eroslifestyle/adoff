# Runbook — Pipeline NotebookLM → YouTube (AdOff)

> Dottrina: skill producono artefatti, **n8n esegue**. NotebookLM non ha API →
> worker Playwright con profilo Chrome persistente. Lavoro pesante = queue-worker
> (pattern `media-queue-worker.py`). Pubblicazione = YouTube Data API v3 full-auto.

## Architettura

```
12-youtube-factory.json  (n8n, daily/manual)
    └─ legge data/youtube-seeds.json → enqueue adoff_autopilot.youtube_queue
notebooklm-worker.py     (systemd, leobox, headless Chromium)
    └─ claim job → NotebookLM: A=Video Overview, B=Audio Deep Dive
       └─ B: ffmpeg → MP4 1080p (waveform + caption + brand) → status=done
13-youtube-publisher.json (n8n, ogni 30 min)
    └─ pick done&!published → LLM meta (Ollama) → brand-guard
       → youtube-upload.py (resumable API, privacy=private) → Telegram
```

Path **lato leobox**: progetto montato in `/home/mrxxx/adoff/` (≡ Dropbox
`Progetti/ChromePlugin`). Output `/opt/n8n/local-files` ≡ `/files` nel container.

## File creati

| File | Ruolo |
|---|---|
| `scripts/youtube_queue.sql` | schema `adoff_autopilot.youtube_queue` + `youtube_published` + vista `youtube_ready` |
| `scripts/notebooklm-worker.py` | worker Playwright (modi: default loop, `--login`, `--selftest`, `--probe`) |
| `scripts/youtube-upload.py` | upload API v3 (modi: `--auth`, `--job <id> --variant B`) |
| `workflows/12-youtube-factory.json` | enqueue da seeds |
| `workflows/13-youtube-publisher.json` | meta LLM + upload + Telegram |
| `data/youtube-seeds.json` | sorgenti video (job_id stabile = idempotente) |
| `infra/notebooklm-worker.service` | systemd unit |

## Setup (una-tantum, su leobox salvo dove indicato)

### 1. Dipendenze
```bash
pip install playwright google-api-python-client google-auth-oauthlib google-auth-httplib2
python3 -m playwright install chromium
# ffmpeg/ffprobe già presenti (usati da media-queue-worker.py)
```

### 2. DB schema
```bash
docker exec -i n8n-postgres psql -U n8n -d n8n \
  < /home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows/scripts/youtube_queue.sql
```

### 3. Login Google NotebookLM (profilo persistente)
NotebookLM richiede account Google loggato. Due opzioni:

**Opzione A — login su macchina con GUI poi copia profilo (consigliata):**
```bash
# su questo PC (ha display):
NBLM_PROFILE=~/.nblm-profile python3 notebooklm-worker.py --login
#   → fai login Google, apri NotebookLM, INVIO
rsync -a ~/.nblm-profile/ leobox:/home/mrxxx/.nblm-profile/
```

**Opzione B — login headful su leobox via xvfb+VNC:**
```bash
sudo apt install -y xvfb x11vnc
xvfb-run -a x11vnc -localhost ...   # poi VNC tunnel SSH, login manuale
```

Verifica: `python3 notebooklm-worker.py --selftest` → `[OK] sessione valida`.

### 4. OAuth YouTube (full-auto)
1. Google Cloud Console → progetto → abilita **YouTube Data API v3**.
2. Credenziali → **OAuth client ID → Desktop** → scarica JSON.
3. Salvalo come
   `n8n-workflows/.secrets/client_secret.json` (la dir `.secrets/` è gitignored).
4. Bootstrap refresh token:
   ```bash
   python3 scripts/youtube-upload.py --auth
   #   → apri URL, autorizza, incolla codice → crea .secrets/youtube_oauth.json (600)
   ```
   Scope: `youtube.upload`. Quota: ~6 upload/giorno (1600 unità/upload, 10k/die).

### 5. Credenziale Postgres n8n
I workflow usano `credentials.postgres` placeholder `PLACEHOLDER_PG_CREDENTIAL`
nome `n8n-postgres` — stesso schema degli altri workflow del progetto. Allinea
con `scripts/setup-credentials.sh` (o crea la cred Postgres in n8n UI con quel
nome, poi reimporta).

### 6. Deploy workflow
```bash
cd /home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows
python3 scripts/import-workflow.py workflows/12-youtube-factory.json
python3 scripts/import-workflow.py workflows/13-youtube-publisher.json
docker restart n8n   # ricarica eventuali webhook (qui nessuno: solo schedule)
```
> `import-workflow.py` importa con `active=true`. Verifica in n8n UI prima di
> lasciar girare lo schedule. Per test manuale: esegui i nodi dalla UI.

### 7. systemd worker
```bash
sudo cp infra/notebooklm-worker.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now notebooklm-worker
journalctl -u notebooklm-worker -f
```

## Test end-to-end (smoke)
```bash
# 1 metti un PDF reale e aggiorna data/youtube-seeds.json (pdfs path leobox)
# 2 enqueue manuale (senza aspettare lo schedule):
docker exec -i n8n-postgres psql -U n8n -d n8n -c \
 "INSERT INTO adoff_autopilot.youtube_queue (job_id,source_pdfs,mode,topic) \
  VALUES ('test-1',ARRAY['/home/mrxxx/adoff/.../doc.pdf']::text[],'B','demo') \
  ON CONFLICT DO NOTHING;"
# 3 osserva il worker; a status=done lancia il publisher dalla n8n UI
```

## ⚠️ Fragilità note / manutenzione

- **Selettori NotebookLM NON ufficiali**: la UI Google cambia senza preavviso.
  Sono centralizzati in `SEL` dentro `notebooklm-worker.py`. Se un job va in
  `error` con "selettore non trovato": esegui `--probe` (dump DOM) e ricalibra
  `SEL`. Prevedi 1 ricalibrazione ogni qualche mese.
- **ToS**: l'automazione browser di NotebookLM è non ufficiale; usala con account
  dedicato e volumi bassi. Nessuna API ufficiale esiste (verificato 2026-05).
- **Caption mode B**: l'SRT è a split temporale uniforme (NotebookLM non espone
  timing). Upgrade per timing reale: Whisper su `audio_path`
  (`pip install faster-whisper`; genera SRT preciso prima del render).
- **privacy=private** di default sull'upload: i video vanno rivisti e resi
  pubblici a mano (safety). Cambia in `youtube-upload.py` `privacyStatus` se
  vuoi `unlisted`/`public` automatico.
- **Video Overview (mode A)** è già un MP4 finito di NotebookLM: qualità/branding
  limitati → usalo come draft, B come versione pubblicabile.

---

## AGGIORNAMENTO 2026-05-18 — Engine CLI (sostituisce Playwright per create/upload/trigger)

`notebooklm-worker.py` ora usa **`notebooklm-pp-cli`** (RPC batchexecute reverse-engineered,
live-verificato) per i passi prima fragili in Playwright:

| Passo | Prima | Ora |
|---|---|---|
| create notebook | Playwright (selettori UI) | **CLI** `notebooks create` (rpcid CCqFvf) |
| upload PDF | Playwright file chooser | **CLI** `sources add --file` (Scotty resumable, header `X-Goog-Upload-Url`) |
| trigger audio/video | Playwright click | **CLI** `studio generate --kind audio\|video` (rpcid **otmP3b**, audio=1/video=3) |
| attesa-pronto + download MP3/MP4 | Playwright | **Playwright** (invariato — nessun RPC retrieval catturato) |

**Auth bridge**: un solo login. `_cookie_header(ctx)` estrae i cookie google.com dal
context Playwright persistente già loggato e li passa al CLI via `NOTEBOOKLM_COOKIES`.
Nessuna doppia autenticazione.

**Config**: `NBLM_CLI` (default `/home/mrxxx/printing-press/library/notebooklm/notebooklm-pp-cli`).
Override via env `NBLM_CLI`.

**Deploy su leobox**:
```bash
# 1. copia il CLI sul worker host (leobox)
rsync -a /home/mrxxx/printing-press/library/notebooklm/notebooklm-pp-cli leobox:/home/mrxxx/printing-press/library/notebooklm/
# 2. copia worker + seeds aggiornati
rsync -a sviluppo/ai-autopilot/n8n-workflows/scripts/notebooklm-worker.py leobox:/home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows/scripts/
rsync -a sviluppo/ai-autopilot/n8n-workflows/data/youtube-seeds.json leobox:/home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows/data/
# 3. il profilo Playwright loggato resta requisito (per attesa+download). selftest:
python3 notebooklm-worker.py --selftest
# 4. restart systemd unit
sudo systemctl restart notebooklm-worker
```

**IT + ENG**: ogni contenuto = 2 seed (`-it` / `-en`). Il parametro lingua NATIVO
NotebookLM non e' ancora catturato (lo shape `otmP3b` semplice non lo espone; la
selezione lingua vive nel dialog Personalizza → richiesta piu' complessa non
intercettata). Workaround attuale: `topic` in inglese ("Respond ONLY in English…")
→ NotebookLM segue la lingua dell'istruzione. **Follow-up**: sessione di cattura UI
dedicata per `otmP3b` con parametro `language` (come fatto per upload/studio).

**Limite onesto**: il CLM non sa ancora (a) leggere il completamento via `studio
status` (gArtLc torna vuoto), (b) scaricare l'artifact. Per questo Playwright resta
indispensabile per attesa+download. Sostituzione 100% richiede la cattura dell'RPC
di retrieval artifact.

---

## AGGIORNAMENTO 2026-05-18b — Cattura CDP: status/completamento SBLOCCATO

Cattura via Chrome DevTools Protocol (metodo affidabile vs eval interceptor):

- **`studio status` (gArtLc) SBLOCCATO**: shape reale catturato →
  `[[2,null,null,[1,null,...,[1]],[[1,4,2,3,6]]], "<nb>", "NOT artifact.status = \"ARTIFACT_STATUS_SUGGESTED\""]`.
  Ora ritorna artifact reali: id, title, type (1=audio/3=video), **state_code (3=COMPLETED)**,
  duration_sec, e l'URL media. Prima tornava SEMPRE vuoto.
- **`studio download` (nuovo comando)**: estrae l'URL media corretto (variante code 1
  `=m140`) dalla risposta gArtLc.
- **Worker**: `_cli_wait_completed()` rileva il completamento via CLI `studio status`
  (poll state_code==3). Eliminato il polling Playwright fragile sui selettori
  `audio_ready`/`video_ready`. Playwright ora fa SOLO il download finale.

### Muro esterno reale (non aggirabile via replay)

Il fetch dei BYTE media: `lh3.googleusercontent.com/notebooklm/...=m140` fa 302 →
`lh3.google.com/rd-notebooklm/...` → `accounts.google.com/ServiceLogin`. Google
mette i file artifact NotebookLM dietro auth browser interattiva che il replay
header-cookie (anche con cookie su redirect + Referer/Origin) NON supera. Tentativi
fatti: cookie-preserving redirect, variante code 1, Referer/Origin, cattura CDP del
download UI. **Conclusione onesta**: il download dei byte resta a Playwright (suo
UNICO compito residuo). Tutto il resto (create/upload/generate/**status/completamento**)
è CLI. Follow-up aperto: parametro lingua nativo otmP3b (EN) — al momento via
workaround topic-in-inglese.

---

## AGGIORNAMENTO 2026-05-18 — Flusso video = Remotion (linea APPROVATA, NotebookLM dismesso)

NotebookLM-video = vicolo cieco confermato (success ma 0 artifact). Il flusso n8n
ora produce i video col motore Remotion del progetto, secondo la linea approvata
dall'utente (memoria `feedback_video_line`).

**Nuovo worker:** `scripts/remotion-video-worker.py` — drop-in dello stesso
contratto coda (`adoff_autopilot.youtube_queue`, claim SKIP LOCKED, status
queued→processing→done/error, output `/opt/n8n/local-files`, set
`video_b_path`/`duration_sec`/`transcript`). Per job: lang → voce Chatterbox
sincronizzata (brand-clone MIT, NON edge-tts) → render `tech-reveal` → MP4 →
done. `13-youtube-publisher.json` invariato (legge video_b_path).

**Linea video codificata nel motore (non per-job freeform):**
- Template `tech-reveal` (voce narrativa SINCRONIZZATA, ~32s, dettagliato).
- Voce = `gen-voiceover-chatterbox.py` (Chatterbox Multilingual, ref `_brand-ref.wav`).
- Contenuto pain-point (CONTENT nel generatore): bombardamento pubblicità su
  streaming + ogni sito → click → silenzio. MAI prezzi/"a pagamento"/brand reali.
- IT + EN, testo a schermo == lingua voce.

**Selftest / run:**
```bash
python3 scripts/remotion-video-worker.py --selftest   # verifica engine+voce+coda
python3 scripts/remotion-video-worker.py --once        # 1 job e esce
python3 scripts/remotion-video-worker.py               # loop (systemd)
```

**Deploy leobox:** sostituisci l'unit systemd `notebooklm-worker` con
`remotion-video-worker.py` (stesso schema coda; richiede: video-engine dir +
venv Chatterbox `~/.cache/adoff-chatterbox-venv` + node/npx). Override via env:
`ADOFF_VIDEO_ENGINE`, `CHATTERBOX_PY`, `ADOFF_VIDEO_TEMPLATE`.

**`notebooklm-worker.py`** resta solo per audio/notebook NotebookLM via CLI
(create/upload/studio status), NON per i video.
