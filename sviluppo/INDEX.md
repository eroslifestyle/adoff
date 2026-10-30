# AdOff — sviluppo/ Master INDEX

> Mappa di navigazione di tutto lo sviluppo (mai deployato). Riorganizzazione globale 2026-05-16, cleanup ultra-deep 2026-05-28.

## Aree principali

| Cartella | Contenuto | Indice locale |
|---|---|---|
| **marketing/** | Hub UNICO social/marketing/content: strategia, brand, asset, video-engine, automation, keywords | `marketing/INDEX.md` |
| **mvp-core/** | Progetto Next.js sorella (data-monetization app parallela — vedi `docs/MODELLO-BUSINESS-APP-PARALLELA-DATA-MONETIZATION.md`) | — |
| **ai-autopilot/** | Piano AI Autopilot full-lifecycle (`PIANO-DEFINITIVO.md`), n8n-workflows, infra | — |
| **scripts/** | Build (`build.js`), watermark, deploy, utility (`refresh_cf_token.py`) | — |
| **license-system/** | Worker CF licenze (worker, admin, keygen) | — |
| **worker-telegram/** | Worker CF Telegram bot | — |
| **SEO/** | Asset/lavoro SEO sito | — |
| **tests/** | Test suite | — |
| **packages/** | Pacchetti interni | — |
| **build-chrome/ build-firefox/ build-safari/** | Unpacked build estensione (generati da `scripts/build.js`, ripuliti ad ogni build) | — |
| **i18n-work/** | File i18n di lavoro (batch/lingue) raccolti | — |
| **logs/** | Log sessioni + `chat-archive/` (chat storici) | — |
| **data-analisi/** | Screenshot, trascrizioni, analisi competitor | — |
| **reviews/** | Recensioni utenti raccolte | — |
| **viral-ce/** | Materiale viral/content engineering | — |
| **assets/**, **store-assets/**, **svg-studio/** | Asset grafici | — |
| **audit-reports/** | Report audit (per anno/mese) | — |
| **archive/** | Materiale legacy: `dropbox-conflicts/` | — |
| **.archive-pii/** (gitignored) | Chat con PII | — |
| **.secrets/** (gitignored) | Credenziali locali | — |
| **.venv-flux/** | Python venv per tool AI | — |

## Build artifacts — SINGLE SOURCE (regola 2026-06-01)
**Nessuna copia sparsa.** Gli unici artefatti di build ammessi sono:
- `sviluppo/build-{chrome,firefox,safari}/` — unpacked, **ripuliti ad ogni build** da `build.js` (no più residui `-old-*`).
- `sviluppo/adoff-{target}-{prod,store}.zip` — ZIP di lavoro correnti (prod→sito, store→upload CWS/Edge). Sovrascritti ad ogni build.
- `site/adoff-{chrome,firefox,safari}.zip` — ZIP **deployati** (CF Pages), copiati da build SITE. Nomi FISSI, mai versionati.

VIETATO ricreare archivi raccolta-ZIP (`build-output/`, `packages/`) o XPI stale: AMO conserva i firmati server-side, le versioni vecchie si rigenerano. Eliminati 2026-06-01.

## Convenzione
- **La cartella è l'area**: niente prefissi ridondanti sui nomi file (l'area è data dal path). Nomi descrittivi e univoci.
- Documenti ufficiali di prodotto → `docs/` (root). Tutto il resto dev → qui.
- Strategia autoritativa social → `marketing/strategia/STRATEGIA-SOCIAL-CONTENT-2026.md`.
- Chat log Claude → SEMPRE `sviluppo/logs/chat-archive/`, MAI in `docs/`.

## Note post-reorg 2026-05-16
- `sviluppo/brand/` ELIMINATA → confluita in `marketing/brand/` + `marketing/assets/`.
- `video-tiktok` (vecchio) → `marketing/archive/video-tiktok-old/`. `video-tiktok-remotion` → `marketing/video-engine/`.
- Doc marketing/social spostati da `docs/` → `marketing/`. `docs/` ora SOLO ufficiale.
- Junk root/sviluppo rimosso (`*.tmp`, `*_result.txt`, `__pycache__`); ZIP→`build-output/`; i18n→`i18n-work/`.

## Note post-cleanup 2026-05-28 (ultra-deep, parallel bruteforce)
- **766 cartelle** `build-{chrome,firefox,safari}-old-<timestamp>` rimosse (~900 MB) — generate da `scripts/build.js` come backup timestamped, mai usate.
- `sviluppo/video-tiktok-remotion/` (orfano: solo `node_modules` dopo reorg 16/05) → ELIMINATO. Engine attivo in `marketing/video-engine/`.
- `sviluppo/backups/` (i18n-junk, i18n-junk-final-pass, site-pre-final-deploy, site-bak-archive-20260520) → ELIMINATA (sito già deployato, current).
- `sviluppo/firefox-signed/adoff-3.3.3.xpi` → ELIMINATO (v3.4.3 corrente).
- `sviluppo/amo-artifacts/` ripulita: rimossi 3.3.6, 3.4.0, 3.4.1 (obsoleti).
- `sviluppo/tmp-preview/`, `sviluppo/test-zip/`, `sviluppo/Alalisi RoundTable/` → ELIMINATI.
- `sviluppo/archive/*.bak-20260520_*` + `adoff-v3.0.0.zip` → ELIMINATI (obsoleti vs v3.4.3). `archive/dropbox-conflicts/` conservato.
- `docs/chat/` (4 chat log) → spostato in `sviluppo/logs/chat-archive/`.
- `sviluppo/audit-zh-faq-stealth-20260520.md` (stray root) → `audit-reports/2026-05/`.

> **Note `node_modules`**: `marketing/video-engine/node_modules` (~920 MB) e `mvp-core/node_modules` (~670 MB) NON rimossi — rigenerabili con `npm install`, ma in uso attivo. Eliminare manualmente solo se non si lavora su quelle aree.
