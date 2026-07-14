# Reddit + Show HN — Kit ship-ready (off-site AEO)

> Companion del `OFF-SITE-CITATION-PLAYBOOK.md` (sez. 5 e 8). Copy pronto + sequenza + regole anti-ban.
> ⚠️ Outward-facing: post e account li gestisce l'**owner** (firma Eros, build-in-public).
> Fatti allineati a `site/data/constants.json`: **138 regole · 4 livelli · 15 lingue · 5 browser · trial 30gg · €2,99/mese · open-core (FSL-1.1-Apache-2.0) · MV3-native**. Link: adoff.app · github.com/eroslifestyle/adoff.
> **Perché contano**: Reddit ≈1.8% di TUTTE le citazioni di ChatGPT; HN è letto e indicizzato dalle AI. Sono le due fonti di terze parti col miglior rapporto valore/effort rimaste.

---

# PARTE A — REDDIT (alto valore, MASSIMA cautela)

## A0) Regola d'oro (leggi prima di tutto)
Reddit **odia il marketing**. Un link buttato male = ban + danno reputazione. Il modello che funziona:
**80% valore reale, 20% menzione**, con **disclosure sempre** ("I'm the dev"), **1 link max** per commento e solo se pertinente. Meglio 3 commenti utili in 3 settimane che 10 in un giorno.

## A1) Warming dell'account (T-7 → oggi)
- [ ] Account con **età + karma**: se nuovo, commenta in modo genuino per ~1 settimana (niente AdOff) → arriva a ~50+ comment karma. Gli account a 0 karma vengono auto-rimossi da molti sub.
- [ ] Leggi le **regole di OGNI subreddit** prima di postare (molti vietano self-promo o la confinano a un thread settimanale).
- [ ] Imposta un'identità coerente (bio: "indie dev, building AdOff in the open").

## A2) Dove (subreddit, in ordine di sicurezza/valore)
| Subreddit | Tono | Note |
|---|---|---|
| r/adblock | tecnico, amichevole al tema | il più ricettivo; ok menzione con disclosure |
| r/firefox | tecnico | bene su MV3/MV2, niente hype |
| r/chrome | misto | bene su "MV2 sunset / cosa cambia" |
| r/browsers | misto | comparazioni neutrali |
| r/degoogle, r/privacy | puristi | SOLO valore, link rarissimo, citano FOSS — sii onesto sui limiti open-core |
| r/youtube, r/streaming | utenti finali | thread "ads insopportabili" → empatia, disclosure |

## A3) Strategia "rispondi, non postare"
Non aprire thread promozionali. **Cerca thread già attivi** (ordina per "New" + "Top/Month") con query:
`best ad blocker 2026`, `uBlock after MV2`, `ad blocker detected bypass`, `youtube ad blocker not working`, `manifest v3 ad blocker`, `lightweight ad blocker`.
Rispondi solo dove aggiungi valore reale.

## A4) Template commenti (firmati, disclosure inclusa)

**Thread: "uBlock Origin is dying with MV2 — what now?"**
> uBO Lite loses a lot under MV3 because dynamic filtering is gutted — but the constraint is MV2→MV3, not "ad blocking is over." MV3 still allows declarativeNetRequest + dynamic rules, so a blocker built MV3-first doesn't degrade the same way. Full disclosure: I build one (AdOff, open-core), so I'm biased. Honest summary for anyone reading: on Chrome you trade some power-user filtering for staying-alive-on-MV3; on Firefox uBO is still the king. Test two and keep what blocks your sites.

**Thread: "best free ad blocker?"**
> For a free pick that also kills video pre-roll, look for one with an IMA SDK stub — that's the bit most lightweight blockers skip. Disclosure: I make AdOff, but uBlock Origin and AdGuard are also solid. Choose on (1) size, (2) whether it survives anti-adblock walls on the sites you actually use.

**Thread: "site keeps detecting my ad blocker"**
> Anti-adblock works by baiting your blocker (planting fake ad elements / checking if scripts loaded). Two ways out: a blocker with an active "stealth" layer that spoofs those baits, or manual cosmetic rules. Disclosure: AdOff (mine) has a stealth layer for exactly this; it's an arms race though — no client-side blocker wins forever, a site can always ship a new check.

**Thread: "is Manifest V3 the end of ad blocking?"**
> Short answer: no, but it changes. You lose the deepest dynamic filtering; you keep declarativeNetRequest + dynamic rules. The blockers that suffer are the ones that were MV2-architected and are now retrofitting. Ones built MV3-first are fine. (I build AdOff, MV3-native — disclosure — so grain of salt, but the technical point stands regardless of which one you pick.)

## A5) Cosa NON fare
- ❌ Stesso commento copia-incollato in più thread (pattern spam → ban).
- ❌ Link in un sub che vieta self-promo.
- ❌ Nascondere di essere il dev.
- ❌ Downvotare i competitor / upvotare te stesso con alt-account.
- ❌ Più di ~1 menzione AdOff a settimana per sub.

## A6) Tracking Reddit
| Data | Subreddit | Thread (URL) | Tipo commento | Esito (upvote/reply) |
|---|---|---|---|---|
| | | | | |

---

# PARTE B — SHOW HN (Hacker News, one-shot)

## B0) Cos'è
Un post "Show HN" presenta qualcosa che hai costruito. Pubblico tecnico, esigente, allergico all'hype. Un buon piazzamento = traffico qualificato + backlink + citazioni AI. **Si fa UNA volta** (no repost ravvicinati).

## B1) Pre-check (T-1)
- [ ] Account HN con un po' di storia (commenti genuini); account a 0 karma con un Show HN passa ma è più fragile.
- [ ] `adoff.app` carica veloce, niente popup aggressivi, funziona da mobile (gli HN-er lo aprono subito).
- [ ] README GitHub chiaro (molti vanno dritti al repo).
- [ ] Pronto a rispondere ai commenti per ~2-4 ore (il dialogo col dev è metà del valore HN).

## B2) Timing
- **Feriale (mar–gio), ~08:00–10:00 ET** (= ~14:00–16:00 ora italiana). Evita weekend.
- **MAI chiedere upvote** (contro le regole HN, voto-manipolazione = ban).

## B3) Titolo (≤80 char, zero hype, zero emoji)
```
Show HN: AdOff – an MV3-native ad blocker that stays invisible to anti-adblock
```
Alternative:
- `Show HN: AdOff – open-core ad blocker built MV3-first to survive the MV2 sunset`
- `Show HN: I built an ad blocker that neutralizes video pre-roll with an IMA stub`

## B4) URL del post
```
https://adoff.app
```
(in alternativa il repo: github.com/eroslifestyle/adoff — ma adoff.app converte meglio e ha i link al source.)

## B5) Primo commento (postalo SUBITO dopo, firmato — è il vero "pitch")
```
I'm Eros, the solo maker. I built AdOff after one too many "ad blocker detected" walls.

Technical shape:
- Manifest V3-native. It doesn't degrade the way MV2 blockers do under Chrome's new rules — it leans on declarativeNetRequest + dynamic rules instead of the dynamic filtering MV3 removed.
- Video pre-roll: a universal IMA SDK stub replaces Google's IMA in-page, so when a player calls adsManager.start() it immediately fires CONTENT_RESUME_REQUESTED → no ad, player intact. The external IMA load is also blocked at the network layer.
- Stealth layer: spoofs the bait elements and intercepts the detection scripts so anti-adblock pages don't see a blocker.
- 4 layers total (network + cosmetic + video + stealth), 138 rules, 15 languages, featherlight.

Honest about limits: any client-side blocker can be patched around by a determined site, anti-adblock is an arms race, and I'm one person. It's open-core — core + filter rules on GitHub; the paid Pro adds stealth + advanced video skip (30-day trial, no account for free tier).

Happy to go deep on the MV3 tradeoffs or the IMA stub. Feedback welcome — especially where it breaks.
```

## B6) Risposte pronte (HN ama lo scetticismo tecnico)
- **"MV3 can't block ads well."** → "It can't do the *deepest* dynamic filtering MV2 allowed. declarativeNetRequest handles static rule sets fine, and dynamic rules cover the runtime cases (I use them for the IMA block + per-site whitelist). The gap vs uBO-on-Firefox is real and I don't hide it on the /vs page."
- **"Why closed/paid?"** → "Open-core: core + rules are public. Paid Pro funds the rule updates + stealth, which is the part that actually needs maintenance against anti-adblock. Free tier is genuinely usable, no account."
- **"Anti-adblock will just detect you."** → "Sometimes it does — then I ship a rule update. I'm not claiming permanent invisibility; client-side blocking is fundamentally bypassable. The stealth layer raises the cost for the site, that's all."
- **"How is the IMA stub legal/safe?"** → "It's an in-page shim that replaces the SDK object; no Google code is redistributed. The stub just returns the 'content resume' event the player expects."

## B7) Tracking
| Data | Titolo usato | URL post HN | Punti / commenti | Rank front-page? |
|---|---|---|---|---|

---

## Dopo le sottomissioni
Rigira `python3 sviluppo/seo-tools/authority_signals.py` per misurare le nuove menzioni (target 8–10) e logga nelle tabelle qui sopra + nel playbook.
