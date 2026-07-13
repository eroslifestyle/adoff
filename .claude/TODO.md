# AdOff — TODO Unico Consolidato

**Ultimo aggiornamento:** 2026-07-13
**Versione reale:** 3.5.32 (tutti e 3 i manifest)
**Store status:** ✅ CWS 3.5.32 LIVE | ⚠️ AMO in review | ✅ Edge 202 Accepted (op baa21678)

---

## ⬜ In ordine di priorità

### P0 — ✅ FATTO: Options page redesign "AdBlock-inspired" (2026-07-13)

> SHIPPED v3.5.32. Commits: 0487b9b + c9e9f85.
> Deploy: CWS LIVE, Site LIVE, Edge 202, AMO in review.

Integrazioni completate:
- [x] **Sidebar redesign** — emoji Unicode nav icons (⚙️🛡️✨💫📊🎁🔧❓💡ℹ️) + 🔒 Pro lock badges
- [x] **Pro showcase** — 6 feature card con icone + 🔒 lock + CTA "Inizia gratis"
- [x] **Grafico statistiche animato** — canvas bezier smooth + tab Oggi/Settimana/Mese/Anno/Sempre (dati REALI da adoffDailyStats)
- [x] **Temi (gamification)** — sec-temi + sec-cambio-immagine con griglia e pro-gated
- [x] **Banner upsell persistente** — sticky banner in alto con dismiss remember
- [ ] **Extension State (trasparenza)** — RIMANDATO (non nei branch)
- [ ] **nav-lock SVG invece emoji** — RIMANDATO (non nei branch)

**File:** options.{html,css,js} + background.js (3 target sync)

---

### P0 — Bloccanti / Core

- [ ] **Trial Anti-Fraud System** — Implementare fingerprint hardware resiliente
  - Fase 1: generateResilientFingerprint() in background.js
  - Fase 2: trial_fingerprints table + anti-abuse in worker.js
  - Fase 3: account via di fuga per falsi positivi
  - Dettaglio: [[adoff-trial-antifraud-system]]

- [x] **Store: Edge API credentials** — API key scaduta (4ZL6...) sostituita con nuova (UiQ7...). POST submissions → HTTP 202 ✅. "InProgressSubmission" = Microsoft già revisiona una submission esistente. Azione: aspettare fine revisione Microsoft OPPURE andare su Partner Center → chiudere submission in coda.

---

### P1 — Marketing & Launch (bloccati da mesi)

- [ ] **Product Hunt launch** — kit esiste in `sviluppo/seo-tools/PRODUCT-HUNT-LAUNCH-KIT.md`. Da decidere se lanciare o archiviare.
- [ ] **Reddit + Show HN** — kit esiste in `sviluppo/seo-tools/REDDIT-SHOWHN-KIT.md`. Stesso discorso.
- [ ] **AlternativeTo + G2 + Wikidata** — mai iniziato. Da decidere se priorità.
- [ ] **Bing sitemap submit** — sitemap aggiornata (172 URL) ma mai submitterta a Bing Webmaster Tools.
  - Verificare che il sito sia registrato in Bing Webmaster

---

### P2 — SEO

- [ ] **SEO server-side lang detection** — Googlebot vede sempre IT (client-side i18n). Richiede fallback server-side o pre-render.
- [ ] **OG image 1200×630** — avatar512 esiste, ma specifica OG completa mai implementata su tutte le pagine.

---

### P3 — Pipeline & Infra (parcheggiati)

- [ ] **Deploy NotebookLM→YouTube** — worker costruito, mai deployato su leobox. Da rivalutare se serve.
- [ ] **Admin UI HTTPS** — admin UI è 127.0.0.1:8790 (non pubblico). Se serve accesso esterno, completare con CF Tunnel.
- [ ] **TikTok Production submit** — sandbox OK, production in attesa di video demo. Da valutare priorità.

---

### P4 — Opzionali / Nice-to-have

- [ ] **RTL Arabic rendering** — supporto base esiste, test completo mai confermato.
- [ ] **EPP-TUNE** — ventola leobox: valutare `balance_power` EPP se ancora rumorosa.
- [ ] **Anti-silenzio telegram** — `telegram_daily_post.py` logga su /dev/null; crash invisibili. Redirigere stderr.
- [ ] **Content bank 13 lingue** — hook-bank esteso solo EN/IT, tier-2 mai tradotto.

---

## ✅ Ultime cose fatte (2026-07-13)

- Analisi completa sistema trial: vulnerabilità critica identificata (deviceId cancellabile)
- Ricerca competitor: NordVPN/AdGuard/TotalAdBlock/ulteriori strategie
- Sessione AQ: 6 domande, strategia definita
- Checkpoint + vault creati

## ✅ Ultime cose fatte (2026-07-08)

- CWS 3.5.28 confermato LIVE (uploadState OK, PKG_INVALID_VERSION = già pubblicata)
- AMO 3.5.28 confermato LIVE (web-ext: "Version 3.5.28 already exists")
- Pulizia 12 file Dropbox conflict copy dal 2026-06-22 (.claude/)
- Checkout PROGRESS.md: zero checkbox attive

---

## ❌ Non riprovare (archiviati)

- ~~SEO/AEO agent settimanale~~ → SUPERATO dal sistema autonomo funzionante
- ~~Trial anti-crack ECDSA~~ → SHIPPED v3.5.3
- ~~Uninstall survey~~ → SHIPPED v3.5.3
- ~~Admin panel fix~~ → SHIPPED 2026-07-04 (commit 0a33de6)
- ~~JSON-LD trailing comma~~ → SHIPPED 2026-07-08 (commit 650509f)
- ~~leobox GPU/fan fix~~ → RISOLTO 2026-06-27
