# AdOff — TODO Unico Consolidato

**Ultimo aggiornamento:** 2026-07-08
**Store status:** ✅ CWS 3.5.28 LIVE | ✅ AMO 3.5.28 LIVE | ⚠️ Edge 404 (creds da verificare)

---

## ⬜ In ordine di priorità

### P0 — Bloccanti / Core

- [ ] **Store: Edge submission bloccata** — c'è una submission precedente in "In review" lato Partner Center. L'API restituisce `InProgressSubmission` e non può pubblicare. Azione: andare su Partner Center → Microsoft Edge Add-ons → AdOff → submissions → chiudere/cancellare la submission in coda, poi riprovare upload+publish.

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
