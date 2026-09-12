# AdOff — Review Poller (Telegram thread 24 "⭐ Recensioni")

Polla le recensioni degli store e posta le **novità** nel topic Telegram Recensioni (thread 24).

## Cosa è affidabile 2026-05-28

| Store | Cosa otteniamo | Come | Stato |
|---|---|---|---|
| **Firefox AMO** | ✅ completa (voto + testo + autore) | API JSON `api/v5/ratings/rating/?addon=adoff` | **ROBUSTO** |
| **Edge Add-ons** | ⚠️ delta aggregato (n. + media) + testi via scraper | API aggregato + Playwright headless | **BUONO** |
| **Chrome Web Store** | ✅ testi completi (autore + voto + corpo) | Playwright headless su `:8788` | **ROBUSTO** |

Dedup: hash MD5 (author + score + body[:100]) — evita duplicati tra refresh.

## File

- `playwright-scraper.js` — Playwright headless per CWS + Edge. Euristiche multi-selector, consent Google, media blocking per velocità. Output JSON `{cws, edge}`.
  - CLI: `node playwright-scraper.js` → JSON stdout
  - Debug: `node playwright-scraper.js --dump cws` → salva HTML in `/tmp/cws-page.html`

- `review-poll-core.js` — logica core (AMO API + Edge aggregato, opzionalmente scraper). Testabile standalone.
  - CLI: `node review-poll-core.js` → test AMO + Edge
  - CLI: `node review-poll-core.js --with-scraper` → aggiunge scraper HTTP

- `scraper-service.js` — HTTP service `:8788` che espone scraper a n8n.
  - `GET  /health` → uptime, stato busy
  - `GET  /poll[?store=cws|edge]` → scrape e dedup (stato in `/var/lib/adoff-scraper-state.json`)
  - `GET  /dump?store=cws|edge` → salva HTML per debug in `/tmp/`
  - `GET  /state` → stato dedup corrente

- `n8n-code-node.js` — logica per **Code node** n8n. Usa `$getWorkflowStaticData` per dedup + `$env` per Telegram.

- `n8n-review-poller.workflow.json` — workflow n8n importabile (Schedule → Code node → Telegram thread 24).

- `adoff-scraper.service` — systemd unit per persistenza `:8788`.

## Import in n8n (via UI — evita il runtime-cache bug noto)

1. n8n → menu ⋮ → **Import from File** → seleziona `n8n-review-poller.workflow.json`.
2. Verifica che `$env.TELEGRAM_BOT_TOKEN` e `$env.TELEGRAM_CHAT_ID` siano in `/opt/n8n/.env` (lo sono). Se l'accesso `$env` nei Code node è bloccato, sostituisci nel Code node con i valori o una credenziale n8n.
3. **Save** dalla UI (il save da UI propaga a runtime; NON affidarsi al solo insert DB — vedi [[n8n-v2-runtime-cache-bug]]).
4. **Activate** il workflow. Trigger ogni 6h.

> Niente API key n8n necessaria con l'import da UI. Per deploy via REST API serve una Personal API Key (n8n → Settings → API).

## Miglioramenti 2026-05-28

### Robustezza scraper
- **Multi-selector** con fallback: CWS prova `section[aria-label*="Reviews"]` → `div[role="region"]` → `[data-section-id="reviews"]`. Edge prova i selettori Fluent UI.
- **Hash MD5 per dedup**: `md5(author + score + body[:100])` evita duplicati testati e falsi positivi su whitespace.
- **Consent Google**: retry su timeout, visual check con `isVisible()`.
- **Media blocking**: immagini, font, video bloccate → scraper 3x più veloce.
- **Atomic writes**: `tmp + rename` per `/var/lib/adoff-scraper-state.json` → no corruzioni.
- **Structured logging JSON**: tutti gli errori loggati su stderr in formato JSON per journalctl.

### Error handling
- Retry 1 volta su navigation timeout (30s max)
- Fallback graceful: se un selettore non trova niente, prova il prossimo (no crash)
- Tutti gli errori catturati e loggati, service non crashare mai
- Dedup: conservativo — meglio ritornare 0 che false positive

### API service HTTP — endpoint completi
| Endpoint | Uso |
|----------|-----|
| `GET /health` | Health check (uptime, busy state) |
| `GET /poll` | Scrape entrambi, dedup, JSON |
| `GET /poll?store=cws` | Scrape solo CWS |
| `GET /poll?store=edge` | Scrape solo Edge |
| `GET /dump?store=cws\|edge` | Salva HTML per debug in `/tmp/` |
| `GET /state` | Stato dedup corrente (vedere cosa è "già visto") |

## Avvio servizio

**Manuale (test rapido)**:
```bash
cd /home/mrxxx/Dropbox/1\ Programmazione/Progetti/ChromePlugin/sviluppo/reviews
node scraper-service.js  # listen :8788
curl http://127.0.0.1:8788/health
curl http://127.0.0.1:8788/poll                    # scrape live (60-90s)
curl "http://127.0.0.1:8788/dump?store=cws"        # debug HTML
curl http://127.0.0.1:8788/state                   # vedi stato dedup
```

**Systemd (persistente)**:
```bash
# Setup
sudo cp /home/mrxxx/Dropbox/1\ Programmazione/Progetti/ChromePlugin/sviluppo/reviews/adoff-scraper.service /etc/systemd/system/
sudo mkdir -p /var/lib && sudo touch /var/lib/adoff-scraper-state.json
sudo chown mrxxx:mrxxx /var/lib/adoff-scraper-state.json && sudo chmod 600 /var/lib/adoff-scraper-state.json
sudo touch /var/log/adoff-scraper.log && sudo chown mrxxx:mrxxx /var/log/adoff-scraper.log

# Avvia
sudo systemctl daemon-reload
sudo systemctl enable --now adoff-scraper.service

# Verifica
systemctl status adoff-scraper.service
journalctl -u adoff-scraper.service -f  # tail JSON logs
tail -f /var/log/adoff-scraper.log
```

## Integrazione n8n

Il Code node (`n8n-code-node.js`) ora:
1. Chiama AMO API (fallback scraper se 4xx/5xx)
2. Chiama Edge aggregato API
3. Chiama lo scraper microservizio su `$env.ADOFF_SCRAPER_URL` (default: `http://100.71.178.53:8788/poll`)
4. Fonde tutto e invia a Telegram thread 24

Dedup via `$getWorkflowStaticData("global")`: hashes tracciati tra run.

## Limiti onesti & calibrazione

- **CWS markup**: richiede Update PERIODICO se Google cambia dom. Usare `--dump cws` per ispezionare il vero DOM e ricalibrare selettori in `extractReviews()`.
- **Google bot detection**: CWS potrebbe bloccare Playwright in futuro. Monitora con `/dump` e toggle user-agent se serve.
- **Euristiche**: conservatrici (scartano ambiguità) — meglio 0 falsi positivi che rumore.
- **Performance**: scraper impega 60-90s per CWS+Edge (headless browser). Timeout richieste da n8n: 180s.
