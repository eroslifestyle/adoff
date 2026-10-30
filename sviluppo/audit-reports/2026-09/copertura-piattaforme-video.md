# Audit copertura piattaforme video — AdOff v3.6.11 (Chrome `app/`)

Data: 2026-09-13 · Metodo: solo grep/read sui file runtime, zero assunzioni. Nessun file modificato.

## Iniezione (per chi tutto questo gira)

`app/manifest.json:21-65` — **4 content scripts tutti su `<all_urls>`**:
- `src/popup-blocker.js` MAIN, all_frames (manifest:23-32)
- `src/player-probe.js` ISOLATED, all_frames (manifest:34-41)
- `src/stealth.js` MAIN, top frame (manifest:43-51)
- `src/content.js` + `src/ads-hide.css` ISOLATED (manifest:53-65)

Dunque stealth/CSS girano su OGNI sito; ciò che differenzia le piattaforme sono i rami interni.

## Architectura rilevante

- `stealth.js:9` — `isVideoPlatform = hostname.includes("youtube.com")` (solo YouTube).
- `stealth.js:16-48` — `BROADCASTER_SITES` (42 domini: raiplay, mediasetinfinity, la7, discoveryplus, bbc, itv/itvx, channel4/5, my5.tv, pbs, pluto.tv, tubi, zdf, ard, ardmediathek, rtl, rtlplus, joyn, servustv, orf, france.tv, tf1, 6play, m6, arte, mycanal, rtve, atresplayer, mitele, lasexta, rtp, tvi, sic, globo, + CH srf/rsi/rts) → **NON ricevono lo stub in-page**; ricevono la neutralizzazione IMA via redirect DNR (vedi "Secondo canale" sotto).
- `stealth.js:71-79` — `PREMIUM_STREAMING` (paramountplus, parampunt, primevideo): niente stub né override (SSAI proprietario).
- `stealth.js:46-62` — `STEALTH_EXCLUDED` (youtube, google, gmail, facebook, instagram, twitter/x, github, reddit, amazon, microsoft, live/outlook, linkedin): niente stealth override.
- `stealth.js:1146-1148` — gate verbatim: `if (isPremiumStreaming) return;` poi `if (!isBroadcaster && !isStealhExcluded) { activateStealth(); injectImaStub(); }` → **lo stub in-page gira sui siti NON-broadcaster e non-esclusi** (es. vimeo, dailymotion, rumble, bitchute, odysee, peertube, kick se usano IMA). YouTube escluso (in STEALTH_EXCLUDED), broadcaster esclusi.
  - **NOTA DIVERGENZA (2026-09-13)**: il commento a stealth.js:17 ("Siti broadcasting — ricevono IMA stub") DICE il contrario del codice a stealth.js:1148 (la negazione di isBroadcaster). Il codice è vincolante: broadcaster ricevono IMA via redirect DNR dinamico, non via stub in-page. Il commento è stantio.
- **Secondo canale IMA — redirect DNR** (`background.js:787-789`): regole dinamiche `IMA_REDIRECT_RULES` id **50001** (`||imasdk.googleapis.com/js/sdkloader/ima3.js` → redirect a `/stubs/google-ima3.js`) e **50002** (idem `ima3_dai.js`), con `excludedInitiatorDomains: PREMIUM_STREAMING_INITIATORS` (background.js:769 = `["paramountplus.com"]`). Aggiunte SOLO se `isPro && enabled` (background.js:816-825; `isPro = adoffPlanTier(...) !== "free"`, background.js:801-802 — sempre vero col tier fisso "premium"); rimosse se protezione spenta (822-824). Questo è il canale che serve i broadcaster: chiunque carichi ima3.js ottiene lo stub, in-page o rediretto.
- Rule statica **900** (`adblock-rules.json:2240-2250`): block `||imasdk.googleapis.com` (script) con `excludedInitiatorDomains: [paramountplus.com, netflix.com]`; attiva SEMPRE (mai rimossa/toccata in background.js — unico riferimento a "900" è un commento a background.js:768). Rule **220** (adblock-rules.json:1684-1694) identica ma senza esclusioni, priority 1: effettivamente maschera l'effetto dell'esclusione di 900 per paramount (220 vince sul block comunque).
- `content.js:193` — `isVideoPlatform()` = solo youtube.com (selettori `VIDEO_PLATFORM_AD_SELECTORS`, content.js:251-267).
- `content.js:215-249` — `GENERIC_AD_SELECTORS` (Adsense/GPT/Taboola/Outbrain/classi generiche): valgono su tutti i siti.

## Tabella verdetto

| Piattaforma | Verdetto | Evidenza sintetica |
|---|---|---|
| youtube.com | **(a) reale** | intero layer A/B/C in stealth.js:100-856, selettori ytd-* content.js:251-267 e ads-hide.css:98-114, 7+ regole DNR youtube (1300-1393), googlevideo rule 1421 |
| vimeo.com | (b→c) | zero match dedicato; MA se usa IMA lo stub in-page c'è (non-broadcaster, stealth.js:1148) + redirect DNR 50001/50002 |
| dailymotion.com (+dmcdn) | (b→c) | idem vimeo (stub in-page possibile via 1148, zero evidenza dedicata) |
| twitch.tv (+ttvnw) | (c) | zero match; SSAI proprietario, IMA non usato |
| rumble.com | (b→c) | idem vimeo |
| bitchute.com | (b→c) | idem vimeo |
| odysee.com | (c) | zero match; non IMA |
| peertube | (c) | zero match; non IMA |
| tiktok.com | (b) | solo 2 regole DNR tracking/ads (1661, 1674); niente ramo, niente CSS |
| facebook.com (Watch) | (b) | 3 regole DNR tracking (199, 215, 228) + STEALTH_EXCLUDED (stealth.js:51); nessun ramo Watch |
| instagram.com | (b) | STEALTH_EXCLUDED (stealth.js:52) + rule 199/215 valgono su instagram embed; zero rami dedicati |
| kick.com | (c) | zero match |
| Piattaforme extra trovate nel codice | vedi sotto | BROADCASTER_SITES / PREMIUM_STREAMING |

## Dettaglio per piattaforma (cite verbatim)

### VERDETTO FINALE (dove gira davvero la neutralizzazione IMA)

**Stub IMA in-page (stealth.js:890, chiamato solo a stealth.js:1151)**: gira su **TUTTI i siti tranne** (1) i 42 `BROADCASTER_SITES` (stealth.js:16-48), (2) i 3 `PREMIUM_STREAMING` (paramountplus/parampunt/primevideo, stealth.js:71-79, return a 1146), (3) gli esclusi `STEALTH_EXCLUDED` (youtube, google, gmail, facebook, instagram, twitter/x, github, reddit, amazon, microsoft, live/outlook, linkedin, stealth.js:46-62), e solo dopo che `isProEnabled()` è vero (nonce `data-adoff-stealth` = `ao_`+8hex, stealth.js:874-877, settato da content.js:79 — sempre attivo col tier premium). I broadcaster NON hanno stub in-page ma hanno il **redirect DNR** 50001/50002 (background.js:787-825) che sostituisce ima3.js/ima3_dai.js con lo stub remoto — stesso effetto, canale diverso. Neutralizzazione IMA EFFETTIVA quindi su: tutti i siti non-esclusi (via 1151) + broadcaster (via DNR) − paramount (escluso da entrambi via 1146 e `excludedInitiatorDomains` background.js:769/788) − netflix (esclusa solo da rule 900).

### youtube.com — (a)
1. Ramo dedicato: `stealth.js:9` `const isVideoPlatform = hostname.includes("youtube.com");`; `stealth.js:499` `activateYoutubeRuntimeKiller()`; Layer A strip di `ytInitialPlayerResponse` (stealth.js:211-214), hook fetch/XHR su `/youtubei/v1/player` (stealth.js:368-369, 448-449); `content.js:193` `isVideoPlatform()`.
2. Stub IMA: **escluso esplicitamente** — `stealth.js:842-843` "Su YouTube niente IMA stub (YouTube non usa IMA SDK) ne' stealth anti-adblock (youtube.com e' in STEALTH_EXCLUDED)" (lista a stealth.js:47); rule 900 non serve qui perché YouTube non carica IMA.
3. DNR: rule 1300 `||youtube.com/api/stats/ads`, 1307 `||youtube.com/pagead/`, 1322 `||youtube.com/ptracking`, 1338 `||youtube.com/get_midroll`, 1353 `||youtubei.googleapis.com/youtubei/v1/player/ad_break`, 1366 `||youtube.com/api/stats/atr`, 1379 `||youtube.com/api/stats/qoe?adformat`, 1421 `googlevideo.com/videoplayback*oad=`, 1709 `||securepubads.g.doubleclick.net` (serve YouTube), + generiche doubleclick (9, 1057, 1079).
4. CSS: `ads-hide.css:90-94` `.ytp-ad-visit-advertiser-button, .ytp-ad-action-interstitial, .ytp-ad-image-overlay, .ytp-ad-timed-pie-countdown-container, .ytp-flyout-cta`; `ads-hide.css:98-107` 9 selettori `ytd-*-renderer` + `#companion-ad`; `ads-hide.css:110-113` `#masthead-ad:not(:empty)`. JS mirror in `content.js:251-267`.

### vimeo.com — (b→c)
1. Nessun ramo (grep vimeo su stealth/content/css/stubs: exit 1).
2. Stub IMA: **sì, in-page** — vimeo non è broadcaster/premium/escluso, quindi il gate `!isBroadcaster && !isStealhExcluded` (stealth.js:1148) è vero → `injectImaStub()` (1151). Più redirect DNR 50001 (background.js:788). Nessuna evidenza che Vimeo usi IMA di suo, quindi copertura potenziale, non dimostrata.
3. DNR: nessuna regola con "vimeo".
4. CSS: nessun selettore vimeo.

### dailymotion.com — (b→c)
Idem vimeo: zero match "dailymotion"/"dmcdn". Stub in-page attivo (non in nessuna lista di esclusione, stealth.js:1148) + redirect DNR 50001/50002. Nessuna regola DNR dedicata, nessun selettore.

### twitch.tv — (c)
Zero match "twitch"/"ttvnw". Twitch usa SSAI proprietario, non IMA → stub e redirect non agiscono comunque. Non in nessuna lista stealth.js. Nessuna regola DNR, nessun CSS.

### rumble.com — (b→c)
Zero match dedicato. Stub in-page attivo (stealth.js:1148 gate vero) + redirect DNR; nessuna evidenza che Rumble usi IMA.

### bitchute.com — (b→c)
Zero match dedicato. Stub in-page attivo (stealth.js:1148) + redirect DNR 50001 + rule 900 di rete (adblock-rules.json:2242). Copertura potenziale se BitChute usa IMA.

### odysee.com — (c)
Zero match. Nessuna evidenza.

### peertube — (c)
Zero match "peertube". Nessuna evidenza (peertube è federato, centinaia di domini).

### tiktok.com — (b)
1. Nessun ramo dedicato. 2. N/A (non IMA). 3. DNR: rule 1661 `||tiktok.com/api/v1/ads`, rule 1674 `||analytics.tiktok.com` (adblock-rules.json:1658-1680). 4. Nessun selettore CSS tiktok.

### facebook.com / Watch — (b)
1. Nessun ramo Watch. 2. In STEALTH_EXCLUDED (stealth.js:51 "facebook.com") → stealth override disattivati. 3. DNR: rule 199 `||facebook.com/tr`, 215 `||connect.facebook.net/en_US/fbevents`, 228 `||facebook.net/signals` — tracking, non video-ads. 4. Nessun selettore facebook (al massimo i generici `div[id^="div-gpt-ad"]` se FB li usasse, content.js:231).

### instagram.com — (b)
1. Nessun ramo. 2. STEALTH_EXCLUDED (stealth.js:52 "instagram.com"). 3. Stesse regole facebook (199/215/228 coprono connect.facebook.net usato dagli embed IG). 4. Nessun selettore dedicato.

### kick.com — (c)
Zero match "kick" in tutti i file runtime. Kick usa SSAI proprietario; nessuna regola DNR kick, nessun ramo, nessun CSS.

### Altri domini video trovati nel codice (da citare)
- **BROADCASTER_SITES** (stealth.js:16-48, neutralizzazione IMA via redirect DNR 50001/50002 — NON stub in-page, vedi divergenza nota sopra): raiplay.it, rai.it, mediasetinfinity.mediaset.it, mediaset.it, la7.it, discoveryplus.com, bbc.co.uk, bbc.com, itv.com, itvx.com, channel4.com, channel5.com, my5.tv, pbs.org, pluto.tv, tubi.tv, zdf.de, ard.de, ardmediathek.de, rtl.de, rtlplus.de, joyn.de, servustv.com, orf.at, france.tv, tf1.fr, 6play.fr, m6.fr, arte.tv, mycanal.fr, rtve.es, atresplayer.com, mitele.es, lasexta.com, rtp.pt, tvi.pt, sic.pt, globoplay.globo.com, globo.com, srf.ch, rsi.ch, rts.ch → **(a)** per ads IMA.
- **PREMIUM_STREAMING** (stealth.js:71-79): paramountplus.com, parampunt.com (typo?), primevideo.com — stub e stealth volontariamente OFF (SSAI). Netflix citato in commento stealth.js:75. → copertura DNR 900 con `excludedInitiatorDomains` (adblock-rules.json:2247-2250) che li esclude dal blocco IMA.
- **Player library**: nessun riferimento a jwplayer/brightcove/videojs/wistia/kaltura nei file ispezionati (grep zero match); l'unica tecnologia targetizzata è Google IMA (stubs/google-ima3.js:2 "Replaces imasdk.googleapis.com/js/sdkloader/ima3.js", + stub in-page stealth.js:1022-1088).

## Conclusioni operative
- L'unico video platform con pipeline dedicata end-to-end è **YouTube**.
- Le piattaforme "piatteforma principale" (vimeo, dailymotion, twitch, rumble, bitchute, odysee, peertube, kick) **non hanno nulla di dedicato**: beneficiano del CSS generico, dello stub in-page (se non escluse e se usano IMA) e del redirect DNR 50001/50002.
- TikTok/Facebook/Instagram hanno solo regole anti-tracking, non anti-video-ads.
- Se l'obiettivo è dichiarare "funziona su X" in marketing, oggi l'evidenza codice supporta solo YouTube + i broadcaster IMA nazionali.
