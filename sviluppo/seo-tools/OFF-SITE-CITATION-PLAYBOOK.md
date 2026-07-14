# Off-Site Citation Playbook — AdOff

> Companion eseguibile di `authority_signals.py` → `.state/authority_report.md`.
> Il report **rileva** le menzioni (oggi 3); questo file fornisce il **copy pronto** per crearne di nuove.
> ⚠️ Le sottomissioni esterne sono outward-facing: le esegue l'owner (account, post Reddit, profili).
> Qui ci sono solo gli asset copy-paste + sequenza + tracking. Tutti i fatti sono allineati a
> `site/data/constants.json` (v3.5.x): **138 regole network · 4 livelli · 15 lingue · trial 30gg ·
> €2,99/mese · €19,99/anno Founder (primi 100) · €99 lifetime · garanzia rimborso 30gg**.

## Perché (razionale AEO)
Il sito è ottimizzato ma poco **citato altrove**: gli LLM/AI-search citano in prevalenza
fonti di terze parti (Reddit ~1.8% di tutte le citazioni ChatGPT, comparison/review site ~33%).
Le pagine `vs/` + author Person "Eros" + byline (fatte) coprono l'on-site E-E-A-T; manca la
**prova off-site**. Obiettivo: trasformare le 3 menzioni in 8–10 ad alto-trust in 4 settimane.

## Priorità & sequenza (4 settimane)
| Sett. | Target | Tipo | Effort | Valore AEO |
|---|---|---|---|---|
| 1 | AlternativeTo | listing | 20 min | ⭐⭐⭐ (alto intento, citato da AI) |
| 1 | GitHub awesome-lists | PR backlink | 30 min | ⭐⭐ (dofollow, repo già esiste) |
| 2 | Product Hunt | launch/maker | 1–2 h | ⭐⭐⭐ (roundup letti da AI) |
| 2 | SaaSHub | listing | 15 min | ⭐⭐ |
| 3 | Reddit (3–4 thread) | community | autentico, diluito | ⭐⭐⭐ |
| 3 | G2 / Capterra | profilo + review | 30 min + review | ⭐⭐ (trust signal) |
| 4 | Wikipedia (citazione) | reference | vedi nota | ⭐ (notabilità non ancora sufficiente) |

---

## 1) AlternativeTo  —  https://alternativeto.net  (P1)
**Azione**: crea la scheda prodotto e collegala come *alternative to* uBlock Origin, AdGuard, AdBlock Plus.

- **Name**: AdOff
- **Also known as**: Ads Off, Ad Off
- **Tagline (≤60)**: Universal stealth ad blocker, invisible to anti-adblock.
- **Description**:
> AdOff is a Manifest V3 ad blocker for Chrome, Edge, Brave, Opera and Firefox that blocks ads on every website while staying invisible to anti-adblock detection. It combines 138 network rules, CSS cosmetic hiding, a universal IMA SDK stub for video pre-roll, and a dedicated Stealth Mode (Pro). Featherlight — a tiny fraction of the size of uBlock Origin or AdBlock Plus. Free tier + 30-day full Pro trial. Open-core (source-available on GitHub).
- **Tags**: ad-blocker, privacy, manifest-v3, anti-adblock, stealth, chrome-extension
- **Links**: Website https://adoff.app · Source https://github.com/eroslifestyle/adoff · CWS listing
- **License**: Freemium / Open-core (FSL-1.1-Apache-2.0)
- **"Alternative to"**: uBlock Origin, AdGuard, AdBlock Plus, Ghostery

---

## 2) GitHub awesome-lists  —  PR backlink (P1)
> ✅ **FATTO 2026-06-21**: PR aperta a **themeselection/best-chrome-extensions** (519★, sezione 🚫 Ad-Blockers, freemium-friendly) → https://github.com/themeselection/best-chrome-extensions/pull/47 (in attesa di review).
> ⚠️ Liste scartate: `privacy-protection-tools/awesome-adblocker` (niente sezione estensioni), `pluja/awesome-privacy` + `Lissy93/awesome-privacy` (FOSS-puriste, freemium rifiutato), `xyNNN/awesome-chrome` (nessuna categoria ad-block/privacy). Forzarle = spam controproducente.

Repo già pubblico: **github.com/eroslifestyle/adoff**. Per altre liste, PR con questa riga (ordina come da loro CONTRIBUTING):

```
- [AdOff](https://adoff.app) — Manifest V3 universal ad blocker with stealth anti-adblock evasion; free tier + open-core. ([source](https://github.com/eroslifestyle/adoff))
```
**Target list** (cerca "awesome" + topic, leggi CONTRIBUTING prima):
- `awesome-privacy` (sezione Ad/Tracker Blockers)
- `awesome-chrome-extensions`
- `awesome-manifest-v3` / liste MV3
- `awesome-selfhosted`-adjacent privacy lists
- topic GitHub: aggiungi i topic `ad-blocker`, `manifest-v3`, `anti-adblock`, `privacy` al repo (aumenta scoperta).

---

## 3) Product Hunt  —  https://www.producthunt.com  (P1)
> ⭐ **Kit completo ship-ready**: `PRODUCT-HUNT-LAUNCH-KIT.md` (campi, primo commento, 6 risposte FAQ, gallery+caption, timing, annuncio Telegram, post-launch). Quanto sotto è il sunto.

- **Name**: AdOff
- **Tagline (≤60)**: The ad blocker that's invisible to anti-adblock
- **Description**:
> Ads? Off. AdOff blocks ads on every site — including video pre-roll — and stays invisible to anti-adblock walls. Built natively for Manifest V3 (immune to the MV2 sunset that's crippling other blockers), 138 rules, 4 blocking layers, 15 languages, featherlight. Free tier + 30-day Pro trial. Open-core.
- **First maker comment** (firmato Eros, build-in-public):
> Hi PH 👋 I'm Eros, solo maker of AdOff. I built it because every "ad blocker detected" wall pushed me over the edge. AdOff is MV3-native (so it survives the uBO sunset), neutralizes video pre-roll via a universal IMA stub, and has a real Stealth Mode that hides the blocker from anti-adblock scripts. Free tier is genuinely useful; Pro adds stealth + advanced video skip. Happy to answer anything about the tech (it's open-core on GitHub).
- **Topics**: Chrome Extensions, Privacy, Productivity
- **Gallery**: usa screenshot store da `sviluppo/marketing/BRAND-HUB/5-SCREENSHOT-STORE/` (NO loghi terzi negli asset).

---

## 4) SaaSHub  —  https://www.saashub.com  (P2)
Listing breve, "alternative to uBlock Origin / AdGuard". Riusa tagline + description AlternativeTo. Categoria: Ad Blocker / Privacy.

---

## 5) Reddit  —  community (P2, alto valore, MASSIMA cautela)
> ⭐ **Kit completo ship-ready**: `REDDIT-SHOWHN-KIT.md` Parte A (warming account, subreddit, 4 template commento con disclosure, regole anti-ban, tracking). Sunto sotto.
**Regole**: niente spam. Partecipa **autenticamente** ai thread esistenti "best ad blocker 2026",
"alternative to uBlock after MV2", "anti-adblock bypass". Disclosure sempre ("I'm the dev"). 1 link
max per commento, solo se pertinente. Diluisci: 80% valore, 20% menzione.

Subreddit: r/chrome, r/privacy, r/firefox, r/adblock, r/browsers, r/degoogle.

**Template commento (thread "uBlock Origin is dying with MV2, what now?")**:
> uBO Lite loses a lot under MV3 because dynamic filtering is gutted. Worth knowing the constraint is MV2→MV3, not "ad blocking is over" — MV3 still allows declarativeNetRequest + dynamic rules. Full disclosure, I build AdOff (MV3-native, open-core), so I'm biased, but the honest summary for anyone reading: on MV3 you trade some power-user filtering for staying-alive-on-Chrome. Test a couple and keep what blocks your sites.

**Template (thread "best free ad blocker")**:
> For a free option that also kills video pre-roll, look for one with an IMA SDK stub — that's the piece most lightweight blockers skip. (Disclosure: I make one, AdOff; uBlock Origin and AdGuard are also solid. Pick on size + whether it survives anti-adblock walls on your sites.)

---

## 6) G2 / Capterra  —  review sites (P2)
Crea il profilo prodotto (categoria Ad Blocker / Browser Extension). Riusa description.
Poi raccogli le **prime 3–5 recensioni reali** da utenti trial→Pro (chiedi via email post-trial,
mai incentivare con sconti = vietato dalle policy). Anche 3 review oneste = forte trust signal citato dalle AI.

---

## 7) Wikipedia  —  nota di realtà (P3)
AdOff **non ha ancora notabilità** sufficiente per una voce propria (servono coperture indipendenti
e significative da fonti affidabili). Strategia corretta NON è creare la voce (verrebbe cancellata),
ma **farsi citare** come reference in voci esistenti quando AdOff sarà coperto da stampa terza:
- Voce *Ad blocking* / *Comparison of ad blocking software*: candidabile SOLO dopo ≥2 fonti indipendenti
  (recensione testata tech, non blog). Tienilo come obiettivo del mese 2–3, dopo Product Hunt + review.

---

## 8) Hacker News — "Show HN" (P2, one-shot dal tuo account)
> ⭐ **Kit completo ship-ready**: `REDDIT-SHOWHN-KIT.md` Parte B (pre-check, timing, titolo, primo commento tecnico, 4 risposte pronte allo scetticismo HN, tracking). Sunto sotto.
**Titolo** (≤80, niente hype, niente emoji):
> Show HN: AdOff – an MV3-native ad blocker that stays invisible to anti-adblock

**Primo commento** (subito dopo aver postato, firmato):
> I'm Eros, the solo maker. I built AdOff after one too many "ad blocker detected" walls. It's Manifest V3-native (so it doesn't degrade the way MV2 blockers do under Chrome's new rules), blocks network + cosmetic ads, neutralizes video pre-roll via a universal IMA SDK stub, and has a Stealth layer that hides the blocker from anti-adblock scripts. Free tier does real blocking with no account; Pro adds stealth + advanced video skip. It's open-core (filter rules + core on GitHub). Honest about limits: a determined site can still patch around any client-side blocker, and I'm one person. Happy to go deep on the MV3 tradeoffs or the IMA stub. Repo + site in the post.
**Quando**: feriale, ~14:00–16:00 UTC. Non chiedere upvote (contro le regole HN).

---

## 9) Pitch stampa — email a redattori tech (P3, da te, follow-up dopo 5–7 gg)
Target: ghacks.net, BleepingComputer, gHacks, Neowin, AlternativeTo blog. **Oggetto**:
> AdOff: a Manifest V3 ad blocker built to survive Chrome's MV2 sunset

**Corpo** (breve, niente allegati pesanti, link non tracciati):
> Hi [Nome],
> With Chrome retiring Manifest V2 and uBlock Origin's full version going away, most "just use uBO" advice is about to break. I'm Eros, an independent developer; I built **AdOff**, an MV3-native ad blocker (Chrome/Edge/Brave/Opera/Firefox) that blocks network + cosmetic ads, neutralizes video pre-roll, and adds a stealth anti-adblock layer — featherlight, open-core, free tier + optional Pro.
> Angle that may interest your readers: a practical look at what actually survives the MV2→MV3 transition, with a working example. Honest about the limits of client-side blocking.
> Site: https://adoff.app · Source: https://github.com/eroslifestyle/adoff · Press kit: https://adoff.app/press
> Happy to give you a free Pro key and answer anything. Thanks for your time.
> — Eros

---

## 10) Email richiesta recensione G2/Capterra (P2, post-trial, MAI incentivata)
Inviare a utenti che hanno completato il trial → Pro. **Niente sconti/regali in cambio** (vietato dalle policy). **Oggetto**: "Quick favor? 60 seconds on your AdOff experience"
> Hi [Nome],
> You've been using AdOff Pro for a few weeks — thank you. If it's been useful, a short honest review helps other people find it (and tells me what to fix). Two options, whichever you prefer:
> • G2: [link] • Capterra: [link]
> No script, no incentive — just your real experience. Thank you 🙏 — Eros

---

## 11) Script YouTube — 3 video (P2, gap AI Overviews; transcript indicizzabile)
Tieni i transcript puliti (le AI citano i transcript). Carica con titolo + descrizione keyword-rich + link.

**Video A — Demo (60–90s)** "AdOff: block every ad, even video pre-roll":
> Open a video site → pre-roll plays → enable AdOff → reload → video starts instantly, no ad. Show the badge counter. "Network + cosmetic + video, on every site. Manifest V3-native, featherlight, free to start. Link below."

**Video B — Explainer (2–3 min)** "Manifest V3 explained: why your ad blocker is about to change":
> What MV2→MV3 changes (declarativeNetRequest vs dynamic filtering), why uBO Lite is weaker, how AdOff was built MV3-first. Neutral, educational. CTA soft.

**Video C — Comparison (2–3 min)** "AdOff vs uBlock Origin on Chrome in 2026":
> Side-by-side using the vs/ page table (size, MV3, stealth, video). Honest: uBO wins on Firefox power-filtering; AdOff wins on set-and-forget MV3 + anti-adblock. Link to /vs/ublock-origin.

Asset: video demo reali già in `sviluppo/marketing/BRAND-HUB/4-VIDEO/`; voce brand via shim OmniaStudio (chatterbox).

---

## Tracking
Aggiorna `.state/authority_report.md` rigirando `python3 sviluppo/seo-tools/authority_signals.py`
dopo ogni sottomissione: misura le menzioni rilevate (oggi 3 → target 8–10). Log delle azioni
manuali qui sotto.

| Data | Target | Stato | URL |
|---|---|---|---|
| _da compilare_ | AlternativeTo | TODO | |
| _da compilare_ | GitHub awesome-* | TODO | |
| _da compilare_ | Product Hunt | TODO | |
| _da compilare_ | SaaSHub | TODO | |
| _da compilare_ | Reddit | TODO | |
| _da compilare_ | G2 / Capterra | TODO | |
