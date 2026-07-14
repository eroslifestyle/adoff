# AdOff — TODO Unico Consolidato

**Ultimo aggiornamento:** 2026-07-14
**Versione reale:** 3.5.33 (tutti e 3 i manifest)
**Store status:** ✅ CWS 3.5.33 LIVE | ⚠️ AMO in review (JWT errore temp) | ✅ Edge 202 Accepted

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

### P0 — ✅ FATTO: Uninstall page integrations (2026-07-13)

> SHIPPED 2026-07-13. Commits: acd4847 + fda4f07.
> Worker deploy: ✅ COMPLETATO (2026-07-13 20:28 UTC) — GITHUB_TOKEN + GITHUB_REPO configurati, GITHUB issues attive. SLACK/DISCORD webhook: skip (non forniti).

3 categorie implementate:
- [x] **Notifiche real-time**: slackNotify() + discordNotify() per PRO/Trial uninstalls (fire-and-forget)
- [x] **Analisi avanzate admin**: handleAdminUninstallAnalytics (cohort/version/funnel/reason-trend) + tab "🗑️ Uninstall"
- [x] **Azioni automatiche**: maybeCreateGithubIssue() (broken_site) + retry offer nella response

Bugfix critici trovati dal piano-guida:
- [x] \`30D\` → \`D30\` (JS identifier illegale)
- [x] \`dh.created_at\` → \`dh.install_ts\` (colonna inesistente, ×5)
- [x] \`if (r.was_pro)\` sempre undefined → rimosso
- [x] \`r.count\` → \`r.total\` (×2)
- [x] \`data.retryOffer\` → \`serverData.retryOffer\`

**Env vars da configurare**: SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL, GITHUB_TOKEN, GITHUB_REPO

---

### P0 — Bloccanti / Core

- [x] **Trial Anti-Fraud System** — SHIPPED v3.5.33 (2026-07-13). Commit 9985e1a. Memory: [[trial-anti-crack-signed-token]].
  - Fase 1: ✅ generateResilientFingerprint() (già esisteva in background.js)
  - Fase 2: ✅ burst detection 5req/min + fingerprint in token (v:2, fp) + abuse flags
  - Fase 3: ✅ account via di fuga (trial_accounts) — wired ma unused
  - Fallback: 30gg → 3gg · license-client syncTrial fix · background.js persist adoffFingerprint

- [x] **Store: Edge API credentials** — API key scaduta (4ZL6...) sostituita con nuova (UiQ7...). POST submissions → HTTP 202 ✅. "InProgressSubmission" = Microsoft già revisiona una submission esistente. Azione: aspettare fine revisione Microsoft OPPURE andare su Partner Center → chiudere submission in coda.

---

### P0 — AdOff Mobile Expansion (nuovo — 2026-07-14)

> Checkpoint: `.claude/checkpoints/CP_20260714_0245.md` · Vault: `Memoria/progetti/AdOff/sessioni/adoff-mobile-expansion-2026-07-14.md`

- [x] **Ricerche competitive**: iOS Safari (limitato, no JS), Android Private DNS (no-app), Android VPN (VpnService, Blokada/AdGuard)
- [x] **30 AQ strategiche**: canale=DNS+VPN, stack=Flutter, DNS backend=AdGuard pubblico, monetizzazione=Pro include mobile, branding=stesso, trial=15gg separato, distro=APK+F-Droid, MITM=selettivo
- [x] **Fase 1 — DNS no-app**: `site/android-dns.html` (SEO page) + banner popup mobile in `app/src/popup.{html,css,js}` + disclosure AdGuard DNS in `site/privacy.html`
- [x] **Fase 2 — Scaffold Flutter**: Flutter 3.44.6 in `~/.flutter-sdk/`, 17 file, `flutter pub get` ✅, `flutter analyze` 0 errors
- [x] **Fase 3 — VPN blocking**: VpnService Kotlin (DNS interceptor IPv4/UDP, NXDOMAIN, blocklist 200+ domini) + MethodChannel `app.adoff/vpn` + home_screen stateful + license_service trial 15gg
- [ ] **Fase 4 — Build APK**: richiede Android SDK (non su leobox). Da Mac: `flutter build apk --release`
- [ ] **Fase 5 — Publish**: F-Droid fork + APK sul sito + GitHub `eroslifestyle/adoff-android`
- [ ] **Fase 6 — Metriche**: Firebase Crashlytics (richiede `google-services.json` da Firebase Console)

### P1 — Marketing & Launch (bloccati da mesi)

- [ ] **Product Hunt launch** — kit VERIFICATO ship-ready 2026-07-13: 6 gallery images + video premium 34.5s. Owner: crea Coming Soon page + lancia martedì/mercoledì 09:00 IT. Kit: `sviluppo/seo-tools/PRODUCT-HUNT-LAUNCH-KIT.md`.
- [ ] **Reddit + Show HN** — kit VERIFICATO ship-ready 2026-07-13 (121 righe). Owner: warming account 1 settimana + seguire regole A0-A6. Kit: `sviluppo/seo-tools/REDDIT-SHOWHN-KIT.md`.
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

- **Trial Anti-Fraud hardening SHIPPED v3.5.33**: burst detection + fingerprint in token + fallback 3gg + sync fix. Worker deployato api.adoff.app. CWS published. Telegram announced.
- Kit PH e Reddit verificati ship-ready
- Memory page `trial-anti-crack-signed-token.md` creata

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
