# TODO GLOBALE — AdOff ChromePlugin

> **Consolidato 2026-08-11.** Merge sessione fix piano Premium YouTube + release v3.5.70.
> Stato prodotto: **3.5.70** — CWS in review, Edge in review, AMO public, sito live su feat/premium-vpn. Branch `feat/premium-vpn`, HEAD `4eed2be` pushato.
> Esiste un gate di test obbligatorio: `node sviluppo/tests/test-security-invariants.js` deve dare 58 su 58 prima di ogni deploy.

---

## ✅ FATTO — storico per release

### v3.5.70 — fix piano Premium non riconosciuto dal gate YouTube (11/08)

**Root cause**: il commit `4e74d73` (14/07/2026) aveva introdotto il piano licenza `"premium"` (VPN+Premium, EUR 4,99/mese) SOLO in `checkPro()` di `license-client.js` (popup — funzionava), ma NON nei 3 gate che attivano DAVVERO lo stealth/IMA-stub/regole-network su YouTube:
- `content.js` righe ~141-145 (variabile `isPro`, OR inline di `lic.plan === "..."`)
- `background.js` righe ~880-882 (funzione `updateImaRules()`, array `.includes()`)
- `background.js` righe ~1174-1180 (handler messaggio `isProForContent`, due array `.includes()`)

Su YouTube il blocco ads per design e' attivo SOLO per Pro/Trial (anti SABR-backoff, "Free = YouTube intatto"), quindi un utente Premium — visto come Pro nel popup ma Free in questi 3 gate — vedeva tutte le pubblicita'.

**Fix**: aggiunto `"premium"` in tutti e 3 i punti di gating, propagato su tutti e 3 i target browser (Chrome, Firefox, Safari) — 9 file modificati, ogni modifica verificata con `git diff` letterale.

- [x] Version bump 3.5.70 su tutti i manifest.json + changelog
- [x] Build produzione (`node sviluppo/scripts/build.js --store` e senza `--store`)
- [x] Commit `4eed2be` "fix(license): piano Premium non riconosciuto dal gate YouTube (3.5.70)" su feat/premium-vpn, pushato
- [x] Deploy sito: `wrangler pages deploy site/ --project-name adoff-site` → successo
- [x] Chrome Web Store: upload via API → `uploadState: SUCCESS`, in review
- [x] Microsoft Edge: upload draft + publish → 202 Accepted, in review (submission id `cf630582-d1a6-4a76-a056-bd3c9fd54420`)
- [x] Firefox AMO: `web-ext sign` timeout 240s MA server ha accettato; verificato via API: `current_version: "3.5.70"`, `status: "public"`
- [x] Annuncio Telegram @adoffapp (sempre in inglese) con changelog
- [ ] **Safari/Mac App Store**: da fare su Mac con Xcode

### v3.5.69 — fix login Google multi-sottodominio (09/08)

Login Google e OAuth bloccati su siti multi-sottodominio (es. minitmax.io). Root cause: `isSameSiteUrl` confrontava sottodomini esatti invece di registrable domain. Fix con `new URL()` + confronto `hostname` + `eTLD+1`. Commit `798c0f0`, pushato e pubblicato su tutti i canali.

### v3.5.68 — video a un clic fallback (08/08)

Rimossa riemissione CONTENT_RESUME_REQUESTED che causava il toggle (4o click richiesto). Aggiunto fallback play()/pause() per gestire iframe dei player. Commit `ee60852`.

### v3.5.61 — audit riga per riga + due bypass Pro chiusi (04/08)

Audit integrale dei quattro core. Sei bug confermati. Due critici: attributo DOM `data-adoff-loaded` accettava qualsiasi valore (patch: `window.__adoffContentLoaded` isolato ISOLATED world); `isTrialActive()` in content.js aveva fallback su `adoffTrialEnd` scrivibile da DevTools (patch: solo token firmato ECDSA). Test anti-regressione 58 asserzioni validato con mutation testing. Commit `621210d`.

### v3.5.60 — popunder streaming-community.red (04/08)

Root cause: popup blocker viveva in stealth.js senza `all_frames`, girava solo nel frame principale. I popunder partono dall'iframe del player. Fix: estrazione in `popup-blocker.js` con `all_frames: true`, regole DNR Monetag alla fonte, difese aggressive solo dentro iframe non fidati. Zero popunder confermati. Commit `e0df48e`, `82051ec`, `49c51f8`.

### v3.5.59 — rule-feed mai applicato (02/08)

Client: 35.143 regole a una sola `updateDynamicRules()` atomica, sfondava il limite e falliva silenziosamente. Feed: 35.000 regole con sintassi regex in `urlFilter` (accetta solo ABP), inerti. Fix: chunking + cap `MAX_NUMBER_OF_DYNAMIC_RULES` (30.000), throttle 6h, normalizzazione ABP, generatore riscritto. Da 0 a 29.900 regole in 3s. Commit `c10120d`, `5da1a0a`.

### v3.5.58 — SABR YouTube risolto (02/08)

Root cause: SABR (Server-Side Ad Insertion) — YouTube non serve piu' URL diretti, ogni segmento passa dal server che decide. Nessun adblock MV3 puo' bloccarlo senza seek. Soluzione: cold-load (oggetto senza streamingData forza richiesta intercettabile), hook JSON.stringify, qualita' 144p durante l'annuncio, ricarica di soccorso. Confermato dall'utente. Commit `7d52b88`.

### v3.5.54 — overlay SSAI + playbackRate (31/07)

Overlay invisibile nero brandizzato durante `ad-showing` (z-index 999999). Cattura e ripristino playbackRate. Deploy CWS, AMO listed, Edge, sito, Telegram msg 93. Commit `8914ab8`.

### v3.5.45-3.5.53 — saga YouTube (30/07)

Race condition Layer A (strip perdeva la corsa), instant-skip ripristinato (3.5.43), RIMOSSO IL SEEK (3.5.52, forma FadBlock pura), Layer A strip ricorsivo (3.5.53: adBreaks/adConfig strippati, midroll -80%, preroll eliminati).

### v3.5.41 — REGOLA 178 RIMOSSA (29/07)

Regola 178 bloccava lo stream del contenuto (`ctier=L` = content tier, non ad marker). Schermo nero 10-15s. Regole 144→143. Commit `79bd308`.

### v3.5.44 — BUG CRITICO LICENZE (29/07)

Ogni pagante declassato a Free a ogni avvio. `revalidateLicense()` aggiornava `lastValidated` senza ricalcolare `adoffIntegrity`. Gate in content.js lo vedeva come manomesso. Commit `xxx`.

### v3.5.38 — anti-detection (28/07)

Merge-accessor su `googletag`/`adsbygoogle`: i siti sovrascrivevano lo spoof. Ora 18 chiavi stabili. Wall investing.com sparito. Commit `xxx`, pushato e pubblicato.

---

## 🔴 BLOCCANTI (soldi / produzione)

- [ ] **Refill wallet VPNresellers: ~24,74 USD → 100+ USD.** A ~1,99 USD/account copre ~12 attivazioni. Oltre soglia: provisioning VPN fallisce → incasso senza consegna. Azione dell'utente. Saldo verificabile via API con `VPNRESELLERS_API_KEY` gia' impostato.
  - refs: `CP_20260729_1757` §To-Do 1, `PROGRESS-vpn-premium.md`

---

## 🟠 RELEASE E CANALI

- [x] **v3.5.70** — CWS in review, Edge in review, AMO public (3.5.70.xpi), sito live su feat/premium-vpn, Telegram msg 114.
- [ ] **Safari/Mac App Store v3.5.70** — richiede Mac con Xcode. Da fare quando disponibile.
  - Comando: `node sviluppo/scripts/build.js --target safari`
  - Poi da Mac: aggiornare progetto Xcode + Product → Archive → Distribute App → App Store Connect
  - Done when: submission visibile su App Store Connect
- [ ] **Monitorare review Microsoft Edge** — submission id `cf630582-d1a6-4a76-a056-bd3c9fd54420`, in review. Nessuna azione finche' non arriva notifica.

---

## 🟡 TECNICI — decisioni e verifiche aperte

- [ ] **Decidere il destino dell'interruttore "Compatibilita' piattaforme video".** Oggi disarma la protezione YouTube. La causa per cui era nato (regola 178) non esiste piu'. Rischio: utente lo lascia acceso dopo debug e crede che AdOff sia rotto.
- [ ] **Hash integrita' licenza fragile.** `adoffIntegrity` calcolato su TUTTO l'oggetto licenza: qualunque campo aggiunto lo invalida. Valutare hash su sottoinsieme stabile (`rawKey`, `plan`, `expires`). Decisione prima del prossimo cambio schema.
- [ ] **Regola 179** (`videoplayback*oad=`, Pro-only) mai verificata: stessa famiglia della 178 rimossa. Se lo schermo nero ricomparisse in Pro, e' il sospetto numero uno.
- [ ] **`validate_site.py:46` falso positivo** su 233 file: segnala "trial 30gg" mentre il prodotto fa 15. E' la regola del validatore a essere sbagliata, non il sito.
- [ ] **Cron SEO gira nella directory sbagliata**: `~/Dropbox/…` (quasi vuota) invece di `/mnt/backup/…`. Keyword research fallita da 5 settimane.
- [ ] **`constants.json` allineato a 3.5.70** nel prossimo giro di build sito.

---

## 🟢 SITO / SEO / CONTENUTI

- [ ] **Cluster keyword gap: YouTube / Chrome / Android / Twitch / "gratis"** — 581 keyword raccolte, 80 gap. Da coprire con contenuto nuovo.
- [ ] **4 pagine con testo italiano non tradotto**: `fr/license-guide`, `ru/license-guide`, `tr/license-guide`, `tr/adblock-detector`.
- [ ] **`mockup.webp` ha "v3.1.0"** stampato dentro — da rigenerare.
- [ ] **GA4 historical data** — crescono col tempo, nessuna azione.

---

## 🔒 CONGELATI (bloccati da dipendenze)

- **Premium FASE 2**: VPN mobile + Kill-switch + DNS Guard freemium — bloccato dal refill wallet.
- **Premium FASE 3**: SEO guide / FAQ AEO / analytics / anti-churn / GO-LIVE checklist — bloccato da FASE 2.
- **Premium FASE 3**: canali Telegram EN / email Pro / social / in-app — bloccato da FASE 2.

---

## ⛔ DO NOT — vincoli permanenti

> Documentazione completa architettura video 3.5.84: `Memoria/progetti/AdOff/decisioni/architettura-video-3584.md`.

- **MAI duplicare a mano la lista dei nomi di piano** — usare sempre `adoffPlanTier()`. Otto gate con liste diverse tenevano gli abbonati `annual` e `premium_*` senza NESSUNA difesa attiva (fix 3.5.77, presidiato da `sviluppo/tests/test-plan-tier-consistency.js`).
- **MAI congelare il range di qualita' sul massimo** (`setPlaybackQualityRange(max, max)`): manda in stallo il player quando parte un annuncio privo di quella risoluzione → schermo nero perenne (regressione 3.5.80, corretta in 3.5.81). Il range va tenuto aperto verso il basso.
- **MAI abbassare la qualita' fuori da `abbassaQualitaAnnuncio`**: l'abbassamento e' lecito SOLO per la durata dell'annuncio, e SOLO perche' esiste `forzaQualitaMassima` che rialza. Senza quel presidio si torna al "144p persistente" della 3.5.57.
- **MAI seekare senza la guardia su `videoDetails.lengthSeconds`**: se `video.duration` coincide con la durata del contenuto, il media montato E' il contenuto (YouTube marca `ad-showing` PRIMA di scambiare la sorgente) e saltare manda avanti il video dell'utente. Nove versioni di bug hanno questa causa. Senza riferimento sulla durata del contenuto → nessun seek.
- **NON dedurre "e' SSAI" da una differenza di durata**: con vero SSAI il player non marca nemmeno `ad-showing`. La deduzione affrettata ha prodotto la guardia invertita della 3.5.83, che saltava dentro il contenuto.
- **MAI reintrodurre `video.currentTime =` in `activateYoutubeRuntimeKiller`.** Regola d'oro: 9 versioni di bug (3.5.46→3.5.51) nate dal seek.
- **MAI merge di `feat/premium-vpn` su `main`.** `main` e' il repo pubblico open-core (`github.com/eroslifestyle/adoff`), fermo a 3.5.36.
- **NON riattivare lo stall watchdog (Layer D)** — faceva seek.
- **NON rimuovere l'instant-skip (`playbackRate=16`)** — e' l'unico fallback per gli annunci che superano il Layer A.
- **NON usare `wrangler pages deploy site/` diretto** — bypassa il gate i18n. E serve `--branch main` esplicito per production.
- **NON deployare senza OK esplicito dell'utente.**
- **MAI passare l'intero feed a una sola `updateDynamicRules()`** e **mai usare `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` (5.000)**.
- **NON pubblicare `site/rules-feed.json` senza normalizzazione ABP**.
- **NON rimuovere Safari dalle pagine del sito**.
- **NON toccare `app/src/graphify-out/`** (era 84 MB nel posto sbagliato).
- **NON forzare il commit di `.claude/checkpoints/` con `-f`**.
- **NON rilassare le guardie di `translate_batch.py`** senza verifica dei tag HTML.
- **NON aprire le vendite Premium prima del refill wallet.**
- **MAI rimuovere il try/catch annidato attorno a `window.open = safeOpen`** in `popup-blocker.js`.
- **NON applicare `configurable: false` su `window.open`**.
- **MAI aggiungere alla blacklist Layer 1 TLD usati da siti legittimi (.pro .store .shop .online .live .link .work .press)**.
- **NON mettere `all_frames` su `stealth.js`**.
- **NON bloccare `v.vidxgo.co` con una regola di rete** — e' il player.

---

## ❌ FAILED APPROACHES — non riprovare

**Video / YouTube**
- **Seek su player MSE YouTube** (6 versioni di guardie): la causa era il seek stesso.
- **Guardia sul cambio di durata** per distinguere annuncio da contenuto: `ad-showing` viene marcato prima dello scambio di sorgente.
- **Hardcoded `playbackRate = 1` in `onAdEnd`**: scartava la velocita' scelta dall'utente. Fix con `savedRate`.
- **403 su `googlevideo.com`**: NON e' un bug AdOff. Sono su `itag=18` deprecato.
- **Test diag-yt-skipads.js** (forza Pro via nonce): non probante, player headless non parte mai per autoplay policy.

**Video / YouTube (2026-08-19)**
- **`eSsai`/`saltaAnnuncioCucito` (3.5.83)**: guardia invertita, saltava quando il media montato era il contenuto. Rimosso in 3.5.84.
- **Alzare la qualita' UNA SOLA VOLTA per video** (prima stesura di `forzaQualitaMassima`): YouTube riapplica la propria preferenza dopo di noi, quindi serve un controllo continuo con throttle.
- **Il fast-forward a 16x come soluzione all'attesa**: non salta l'annuncio, lo SCARICA (16 secondi di stream per secondo reale) — l'attesa e' di rete e nessuna taratura la elimina. Resta valido solo come ripiego.

**Store / deploy**
- **`web-ext sign --channel listed`** → timeout infinito. Usare API REST diretta AMO.
- **AMO upload senza `channel`** → HTTP 400.
- **Upload CWS mentre review precedente aperta** → `ITEM_NOT_UPDATABLE`.
- **`GET /submissions/draft/package` su Edge** → 404: l'endpoint non esiste.
- **Cache purge Cloudflare via token scope Pages/D1** → `10000 Authentication error`.

**Test**
- **Playwright con `channel:"chrome"`**: non inietta content script in `world:MAIN`. Usare `chromium` bundled + `xvfb`.
- **Contare schede aperte senza escludere URL chrome-extension**: la pagina di onboarding viene scambiata per un popunder.
- **Verificare file generati solo con `node --check`**: i delimitatori markdown passano il check e falliscono a runtime.

---

## 📎 Riferimenti

| Cosa | Dove |
|---|---|
| Checkpoint piu' recente | `.claude/checkpoints/CP_20260811_0717.md` |
| Vault progetto | `~/Obsidian/Memoria/progetti/chromeplugin/` |
| Pagina vault unificata | `~/Obsidian/Memoria/progetti/chromeplugin/_INDEX.md` |
| Secrets store | `~/.secrets/adoff-stores.env` |
| Piano VPN Premium | `.claude/PROGRESS-vpn-premium.md`, `.claude/PLAN-vpn-dns-redesign.md` |
