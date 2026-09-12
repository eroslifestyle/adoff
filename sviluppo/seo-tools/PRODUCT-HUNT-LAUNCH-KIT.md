# Product Hunt — Launch Kit AdOff

> Kit **ship-ready** per il lancio su https://www.producthunt.com — tutto copy-paste.
> ⚠️ Outward-facing: la submission la fa l'**owner** (account, post, primo commento). Qui ci sono solo gli asset pronti.
> Fatti allineati a `site/data/constants.json` (v3.5.x): **138 regole network (137 block + 1 allow) · 4 livelli di blocco · 15 lingue · 5 browser · trial 30gg · €2,99/mese · €19,99/anno Founder (primi 100) · €99 lifetime · garanzia rimborso 30gg · MV3-native · open-core (FSL-1.1-Apache-2.0)**.
> Companion: `OFF-SITE-CITATION-PLAYBOOK.md` (sez. 3). Asset gallery: `sviluppo/marketing/BRAND-HUB/5-SCREENSHOT-STORE/pro/`.

---

## 0) Pre-launch checklist (owner, T-7 → T-1)
- [ ] Account PH con **karma maturo** (commenta/upvota per ~1 settimana prima; account nuovo = shadow-throttle).
- [ ] Profilo maker completo: avatar (logo AdOff `BRAND-HUB/2-LOGHI/avatar-1024.png`), bio "Eros — solo maker", link adoff.app + GitHub.
- [ ] Pagina **"Coming soon"** creata 3–7 gg prima (raccoglie follower notificati al go-live).
- [ ] Hunter: auto-hunt va benissimo nel 2026 (il vantaggio dell'hunter famoso è quasi nullo). Se un hunter rilevante si offre, ok; **non** comprare hunt.
- [ ] 6 immagini gallery verificate (vedi §5), thumbnail scelto.
- [ ] Primo commento maker pronto in clipboard (va postato **entro 1 min** dal go-live).
- [ ] Lista di 10–20 persone (Telegram @adoffapp, email trial→Pro, X) avvisate del giorno — **senza chiedere upvote esplicito** (vietato): "siamo live su PH oggi, un saluto è gradito".
- [ ] Giorno scelto: **martedì o mercoledì** (più traffico, meno della valanga del lunedì). Evita weekend e festività US.

## 1) Timing del go-live
- PH "giorno" inizia a **00:01 PT (Pacific)** = **09:01 Europe/Rome** (ora legale, PDT). Postare **subito dopo la mezzanotte PT** dà l'intera giornata per accumulare upvote.
- Owner a Siracusa: target **~09:00–09:30 ora italiana**. Resta reattivo alle prime 3–4 ore (rispondi a OGNI commento → l'engagement spinge il ranking).

---

## 2) Campi del prodotto (copy-paste)

**Name**
```
AdOff
```

**Tagline** (≤60 caratteri — questa è 47)
```
The ad blocker that's invisible to anti-adblock
```
Alternative pronte (se vuoi A/B o se la prima è presa):
- `Ads? Off. The stealth ad blocker built for MV3` (46)
- `Block every ad — even video — and stay undetected` (49)
- `MV3-native ad blocker that survives the MV2 sunset` (50)

**Description** (≤260 caratteri; questa è ~255)
```
Ads? Off. AdOff blocks ads on every site — including video pre-roll — and stays invisible to anti-adblock walls. Built natively for Manifest V3 (immune to the MV2 sunset), 138 rules, 4 blocking layers, 15 languages, featherlight. Free tier + 30-day Pro trial. Open-core.
```

**Topics** (scegli 3, in ordine di rilevanza)
```
Chrome Extensions, Privacy, Productivity
```
Fallback topic se servono: `Browser Extensions`, `Open Source`, `Tech`.

**Links**
```
Website:   https://adoff.app
Install:   https://adoff.app/install
Source:    https://github.com/eroslifestyle/adoff
Press kit: https://adoff.app/press
```

**Pricing label**: `Freemium` (Free tier reale + Pro a pagamento, trial 30gg).

---

## 3) Primo commento del maker (posta entro 1 min dal go-live, firmato Eros)
```
Hi PH 👋 I'm Eros, the solo maker of AdOff.

I built it after one too many "ad blocker detected" walls. Most blockers either get spotted by anti-adblock scripts or break on video pre-roll. AdOff tackles both:

• MV3-native — so it doesn't degrade the way MV2 blockers do under Chrome's new rules (it survives the uBO sunset)
• A universal IMA SDK stub that neutralizes video pre-roll on basically any player
• A real Stealth Mode that hides the blocker from anti-adblock detection
• 4 layers (network + cosmetic + video + stealth), 138 rules, 15 languages, featherlight

The free tier does genuine blocking with no account. Pro adds Stealth + advanced video skip (30-day full trial, no card to start).

Honest about the limits: a determined site can still patch around any client-side blocker, and I'm one person doing this in the open. It's open-core — core + filter rules are on GitHub.

Happy to go deep on the MV3 tradeoffs, the IMA stub, or anything else. Thanks for checking it out 🙏
```

---

## 4) Risposte pronte ai commenti tipici (FAQ PH)

**"How is this different from uBlock Origin?"**
```
uBO is excellent — especially on Firefox where MV2 power-filtering survives. The difference is the moment: on Chrome, MV2 is sunsetting and uBO's full version degrades to uBO Lite (dynamic filtering gutted). AdOff was built MV3-first, so it doesn't lose features in that transition. It also adds two things uBO doesn't focus on: a universal video pre-roll stub and an active Stealth layer against anti-adblock walls. If you're on Firefox and love power-filtering, uBO still wins there — I say that honestly on our /vs page.
```

**"Is it really invisible to anti-adblock?"**
```
On most sites, yes — Stealth Mode spoofs the bait elements and intercepts the detection scripts so the page doesn't see a blocker. But I won't oversell it: anti-adblock is an arms race, a determined site can always ship a new check, and any client-side blocker can be patched around. When a site breaks through, I push a rule update. It's open-core so you can see exactly how the stealth layer works.
```

**"Why should I trust a closed ad blocker with my browsing?"**
```
Fair — that's why it's open-core. The core logic + the 138 filter rules are public on GitHub. AdOff collects no browsing data and needs no account for the free tier. The only thing server-side is license/trial validation (Pro), which is signed and device-bound, not tied to your browsing.
```

**"Free vs Pro?"**
```
Free = network + cosmetic blocking on every site, no account, genuinely useful. Pro = Stealth Mode (anti-adblock evasion) + advanced video pre-roll skip. 30-day full Pro trial, no card to start. €2.99/mo or €19.99/yr (Founder price, locked for the first 100), with a 30-day refund guarantee.
```

**"What about Firefox / Safari / mobile?"**
```
Chrome, Edge, Brave and Opera ship today; Firefox too (MV3 with the gecko background workaround). Safari is converted via the web-extension wrapper and coming to the Mac App Store. Mobile (Firefox Android) is on the radar.
```

**"Manifest V3 means weaker ad blocking though?"**
```
That's the common worry, but the real constraint is MV2→MV3, not "ad blocking is dead." MV3 still gives you declarativeNetRequest + dynamic rules — enough for strong blocking if you build for it. The thing you lose is the deepest power-user dynamic filtering. AdOff trades that for set-and-forget reliability that won't break when Chrome flips the switch.
```

---

## 5) Gallery (6 immagini, 1280×800 — ordine consigliato)
Cartella: `sviluppo/marketing/BRAND-HUB/5-SCREENSHOT-STORE/pro/`

| # | File | Ruolo | Caption (sotto l'immagine) |
|---|------|-------|----------------------------|
| 1 (thumb) | `pro_before_after.png` | Hero / valore immediato | **Before / After — ads gone on every site** |
| 2 | `pro_stealth.png` | Differenziatore #1 | **Stealth Mode: invisible to anti-adblock walls** |
| 3 | `pro_video.png` | Differenziatore #2 | **Universal IMA stub neutralizes video pre-roll** |
| 4 | `pro_streaming.png` | Caso d'uso | **Watch streaming without the ad break** |
| 5 | `pro_popup.png` | Prodotto reale | **One tap + a real-time blocked counter** |
| 6 | `pro_browsers.png` | Reach | **Chrome · Edge · Brave · Opera · Firefox** |

- La **#1 è la thumbnail** della scheda PH: deve reggere da sola in piccolo. `pro_before_after` è la più leggibile a colpo d'occhio.
- 1280×800 = ratio 16:10; PH consiglia 1270×760 (16:9.4) → la differenza è minima, le immagini vengono mostrate con micro-letterbox, **nessun crop di testo**. Se vuoi il fit perfetto: aggiungi 40px di padding palette `#0a0a1a` in basso per portarle a 1280×720 (ma non è necessario).
- **Niente loghi di terze parti** negli asset (regola brand/CWS). Verificare a vista prima dell'upload.
- Logo prodotto/avatar PH: `BRAND-HUB/2-LOGHI/avatar-1024.png` (ridotto da PH a 240×240).

**Video (PRONTO, premium)**: `BRAND-HUB/4-VIDEO/adoff-product-hunt__yt-1920x1080__en.mp4` — 34s, 1920×1080, EN. Mix 50/50 clip cinematiche premium (OmniaStudio: veo3 hook + 2× seedance) ⟷ demo reale del prodotto, voce maschile premium ElevenLabs + musica premium + sottotitoli grandi (PH-muted-friendly), outro logo. 100% brand-safe (zero loghi terzi). Pipeline rigenerabile: `sviluppo/marketing/video-engine/ph-launch/` (`gen_premium.py` + `build.sh`, storyboard in `STORYBOARD.md`). PH accetta MP4 diretto o link YouTube.

---

## 6) Annuncio Telegram @adoffapp (giorno del lancio, EN)
> Da postare il giorno del go-live (immagine brand NUOVA + logo watermark, come da regola release announcement).
```
🚀 AdOff is live on Product Hunt today!

If AdOff has saved you from one too many "ad blocker detected" walls, a visit means a lot to a solo maker.

→ [Product Hunt link]

Built MV3-native, kills video pre-roll, stays invisible to anti-adblock. Free to start. Thank you 🙏
```
⚠️ MAI scrivere "upvote us" (vietato da PH). "Check it out / a visit means a lot" è ok.

---

## 7) Post-launch (T+1 → T+7)
- [ ] Rispondi a TUTTI i commenti residui entro 24h.
- [ ] Aggiungi il badge PH al sito se ranking buono (`/press` o footer): embed ufficiale "Featured on Product Hunt".
- [ ] Logga risultato (rank del giorno, upvote, commenti) nella tabella tracking del playbook.
- [ ] Rigira `python3 sviluppo/seo-tools/authority_signals.py` per rilevare la nuova menzione.
- [ ] Se top-5 del giorno → pitch stampa (playbook sez. 9) citando il piazzamento PH come hook.

---

## 8) Tracking
| Campo | Valore |
|---|---|
| Data lancio | _da compilare_ |
| URL scheda PH | _da compilare_ |
| Tagline usata | The ad blocker that's invisible to anti-adblock |
| Hunter | self / _nome_ |
| Rank del giorno | _da compilare_ |
| Upvote / commenti | _da compilare_ |
| Badge sul sito | ☐ |
