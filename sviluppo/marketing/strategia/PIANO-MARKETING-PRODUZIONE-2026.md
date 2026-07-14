# AdOff — Piano Marketing: Produzione & Pubblicazione 2026

> **Data**: 2026-05-17 · **Versione**: 1.0 · **Stato**: AUTORITATIVO per l'esecuzione (produzione + pubblicazione).
> **Subordinato a**: `STRATEGIA-SOCIAL-CONTENT-2026.md` (strategia/principi) e `ADOFF-BIBBIA-MARKETING.md` (messaggi/dati). Questo doc = il "come" operativo quotidiano.
> **Pipeline tecnica**: `automation/` (hook-bank, caption-prompt, content-factory.workflow, render-worker, tts-runbook) + `video-engine/` (template parametrizzati).
> **Cadenza obiettivo founder**: 3 post statici/giorno + 5-10 tra video/reel/story/giorno, su tutti i social, in tutte le lingue.

---

## 0. Principio guida e tensione anti-ban (leggere prima di tutto)

La cadenza richiesta è alta. Il rischio NON è la quantità in sé, ma il **burst per-canale-per-account** (più post ravvicinati sullo stesso account = flag spam/shadowban). Si risolve con **un solo principio architetturale**:

> **Produci centralmente, distribuisci orizzontalmente.** I 5-10 video/giorno NON sono 5-10 post sullo stesso canale: sono **1-2 master/giorno × N placement nativi** (TikTok, Reels, Shorts, FB Reel) + Stories leggere + repurpose testuale. Ogni singolo account resta sotto la sua soglia sicura.

Volume aggregato alto, cadenza per-account bassa e costante. Tutto il piano sotto rispetta questo.

---

## 1. Matrice di pubblicazione (cosa esce, dove, quanto)

### 1.1 Limiti sicuri per-canale (NON superare per account/lingua)

| Canale | Video/giorno | Statici/giorno | Story/giorno | Note anti-ban |
|---|---|---|---|---|
| TikTok | 1 (max 2, distanziati 5h+) | — | — | Test-bed creativo. >2/giorno su account giovane = rischio. |
| Instagram | 1 Reel | 1 carousel | 2-4 Story | Reel = repurpose master. Story = build-in-public, basso rischio. |
| Facebook Page | 1 Reel (mirror) | 1 post/carousel | 1-2 Story | Pubblico 35+, repurpose. |
| YouTube Shorts | 1 (stesso master) | — | — | Solo repurpose, SEO video. |
| X / Threads | — | 1 thread/post | — | Build-in-public testuale, audience indie/dev. |

### 1.2 Come la matrice somma alla cadenza founder (per cluster-lingua)

Con **EN** e **IT** attivi (pipeline pronta), un giorno tipo:

- **Video/Reel/Short**: 1 master EN + 1 master IT = 2 master → ×4 placement nativi (TikTok/IG Reel/FB Reel/Shorts) = **8 video pubblicati** ✅ (range 5-10)
- **Statici**: 1 carousel EN + 1 carousel IT + 1 quote/before-after still = **3 statici** ✅
- **Story**: 2-4 IG + 1-2 FB (build-in-public, micro-clip, poll) = **3-6 story** ✅

Scala lingue → scala il volume aggregato **senza** toccare i limiti per-account. Aggiungere DE/FR/ES/PT raddoppia l'output globale tenendo ogni account sicuro.

### 1.3 Slot orari (fuso del mercato della lingua)

| Slot | Ora locale mercato | Contenuto |
|---|---|---|
| Mattina | 07:30-09:00 | Statico (carousel dati / quote) — consumo "scroll caffè" |
| Pranzo | 12:30-13:30 | Video master (hook forte) — picco reach |
| Sera | 18:30-21:00 | Reel repurpose + Story build-in-public — picco engagement |

Cadenza **costante, mai a raffica**. Stessa ora ±30min ogni giorno (l'algoritmo premia la regolarità).

---

## 2. Format e mix settimanale

### 2.1 I 3 format di produzione

1. **Master verticale 9:16** (15-40s) — template `before-after` (pilastro A) o `hook-card` (B/C/E). È il prodotto primario, repurposato su 4 placement.
2. **Carousel statico** (1080×1350, 4-6 slide) — dati Bibbia / comparativo / before-after still. Da template SVG/Canva (follow-up: `carousel-engine`).
3. **Story** (1080×1920, 5-15s) — build-in-public, micro-demo, poll/quiz, "dietro le quinte". Bassa produzione, alta autenticità.

### 2.2 Rotazione pilastri (settimana tipo, da strategia §4)

| Giorno | Master video | Carousel | Story |
|---|---|---|---|
| Lun | A (demo prima/dopo) | B (numeri) | build-in-public (milestone) |
| Mar | B (stat-hook) | E (comparativo soft) | micro-demo |
| Mer | C (storytelling) | A (before/after still) | poll "quanti ads hai visto oggi?" |
| Gio | A (demo, hook diverso) | B (numeri, altro dato) | dietro le quinte (indie vs adtech) |
| Ven | B o C (vincente settimana) | D (build-in-public) | recap settimana |
| Sab | repurpose vincente | quote card (tagline) | UGC repost (se disponibile) |
| Dom | C (emozionale) | A (still) | Q&A / community |

Distribuzione aggregata ≈ A 40% · B 25% · C 15% · D 15% · E 5% (coerente con strategia).

---

## 3. Copywriting — i framework virali

### 3.1 Struttura universale di ogni contenuto (3 secondi che decidono tutto)

```
[HOOK 0-1s]  pattern interrupt — fermare il pollice
[TENSIONE 1-8s]  problema/numero/scena riconoscibile (la frustrazione)
[SVOLTA 8-12s]  un click → silenzio (il sollievo)
[PROVA 12-15s]  differenziatore secco (ultraleggera · invisibile · zero dati)
[CTA soft]  "→ adoff.app"  (mai vendita aggressiva, "free" implicito)
```

### 3.2 Le 6 formule di hook (libreria, ruotare — mai lo stesso 2 giorni di fila)

| # | Formula | Esempio EN | Esempio IT |
|---|---|---|---|
| H1 | **Stat-shock** | "You see 10,000 ads a day. Here's day one without them." | "Vedi 10.000 pubblicità al giorno. Ecco il primo giorno senza." |
| H2 | **Pattern interrupt** | "Stop. Look how much of this page is ads." | "Fermati. Guarda quanta parte di questa pagina è pubblicità." |
| H3 | **POV / relatable** | "POV: you just wanted the recipe." | "POV: volevi solo la ricetta." |
| H4 | **Curiosity gap** | "My ad blocker weighs less than this photo. Here's why that matters." | "Il mio ad blocker pesa meno di questa foto. Ecco perché conta." |
| H5 | **Problem-agitation** | "Two ads before a 3-min video. Then a mid-roll. Enough." | "Due pubblicità prima di un video di 3 min. Poi un mid-roll. Basta." |
| H6 | **Nostalgia** | "Remember when the internet was good? Watch this." | "Ricordi quando internet era bello? Guarda qui." |

Fonte frasi verificate: Bibbia Parte 7 (frasi video/social) + Parte 2 (numeri). Tono Bibbia Parte 9: diretto, onesto, empatico, minimale. **Mai** iperbole/paranoia — i numeri reali bastano.

### 3.3 Regole copy ferree

- **1 idea per video.** Un hook, un numero, una svolta. Niente liste di feature nel video.
- **Frasi ≤ 8 parole** nei testi a schermo (lettura mobile in 0.5s).
- **CTA sempre soft**: "→ adoff.app". Mai "Compra", mai "15 giorni gratis" nel video (vive in bio/sito). "Free" implicito.
- **Caption** ≤150 char: gancio (ripreso/variato dall'hook) + CTA. Poi hashtag. Poi riga AI disclosure (obbligatoria, EU AI Act).
- **Brand Name Policy**: mai brand reali nei testi/voce/grafiche. Solo "video platform", "search engine", "social". UI sempre sintetica.
- **Numeri solo da Bibbia.** Mai inventare metriche (vale anche per build-in-public: usa cifre reali CWS/Stripe o nessun numero).
- **Hashtag**: 5-6, set per pilastro (`hook-bank.json §hashtagSets`). No hashtag-stuffing, no trending irrilevanti.

### 3.4 Caption — template per piattaforma

```
TikTok/Reels/Shorts:
<gancio 1 frase> <emoji opzionale>
→ adoff.app
#adblock #noads #privacy #browser #productivity
🤖 AI-assisted brand channel        ← disclosure (lingua target)

Facebook (più discorsivo, 35+):
<gancio + 1 frase contesto>. Zero ads, zero tracking, ultraleggera. → adoff.app
🤖 AI-assisted brand channel

X/Threads (build-in-public):
<metrica o struggle reale>. Nessun VC, nessuna pubblicità, niente tracking. Solo uno strumento.
adoff.app
```

---

## 4. Rollout multilingua (15 lingue, tier-based 8+7)

| Fase | Lingue | Stato pipeline |
|---|---|---|
| **Now** | EN, IT | ✅ hook-bank + render pronti (22 clip già prodotte) |
| **Tier-1** (settimana +1/+2) | + DE, FR, ES, PT (+2 mercati primari) | hook-bank da estendere via `caption-prompt.md §traduzione` (DeepL Free + Qwen) |
| **Tier-2** (Fase C, settimana +4) | JA, KO, ZH, PL, TR, AR, ID | pipeline traduzione già predisposta; AR = override RTL disclosure |

Regole multilingua:
- **1 account/cluster-lingua o 1 account multilingua con post geo-coerenti.** Mai un account IT che posta solo HI (flag inautenticità, strategia §6).
- Posting nel **fuso orario del mercato** della lingua (slot §1.3 in ora locale).
- Disclosure NON tradotta a macchina libera: tabella canonica in `caption-prompt.md` (Short) / `SOCIAL-MEDIA-KIT §1` (Long).
- Re-export **nativo** per ogni piattaforma — mai repost watermarkato (uccide reach algoritmica).

---

## 5. Flusso di produzione giornaliero (operativo)

```
07:00  Cron leobox → content-factory.workflow.json
       ├─ Select briefs (rotazione pilastri, N×lingue del giorno)
       ├─ LLM caption + hashtag + disclosure (Qwen, caption-prompt.md)
       ├─ Brand-guard (regex anti-brand, fallback brand-safe)
       ├─ batch-render.mjs → MP4 9:16 in output/bank/
       ├─ Carousel render (follow-up carousel-engine) → PNG
       ├─ Enqueue posts_queue (Postgres, status=queued)
       └─ Telegram digest → founder

07:30  Founder: review digest (5 min) — approva / scarta / nota ritocco
08:00+ Upload manuale negli scheduler nativi (slot §1.3, fuso mercato):
       • TikTok Studio (web) — schedula ~10gg avanti
       • Meta Business Suite — IG Reel + carousel + Story + FB
       • Shorts/X — repurpose del vincente
Sera   Founder: marca posted in posts_queue (o comando Telegram)
```

Semi-auto (decisione strategia §8): zero API di pubblicazione di terze parti → zero dati societari, zero rischio identità. La review umana di 5 min/giorno è il gate qualità + brand-safety prima della linea automatica.

---

## 6. Roadmap di sviluppo (cosa manca per reggere la cadenza)

| # | Deliverable | Priorità | Stato |
|---|---|---|---|
| P1 | `hook-bank.json` esteso a Tier-1 (DE/FR/ES/PT) | ALTA | ⏳ |
| P2 | **carousel-engine** (template SVG/Remotion still, 1080×1350, dati Bibbia) per i 3 statici/giorno | ALTA | ⏳ da costruire |
| P3 | Story-pack: 6 template Story (build-in-public, poll, micro-demo) | ALTA | ⏳ |
| P4 | Deploy `content-factory.workflow.json` su leobox + smoke test digest | ALTA | ⏳ |
| P5 | Espandere `hook-bank` a 30+ brief (più varietà hook = meno fatica creativa) | MEDIA | ⏳ |
| P6 | Pipeline traduzione 15 lingue (DeepL+Qwen) collegata al render batch | MEDIA | ⏳ |
| P7 | Variante voiced (`tts-runbook.md`) per pilastro C | BASSA | runbook pronto |
| P8 | Dashboard KPI social → Telegram /status (S9) | MEDIA | ⏳ |
| P9 | UGC/creator seeding via referral esistente (S8) | MEDIA | ⏳ |

---

## 7. KPI e ciclo di ottimizzazione

KPI da `STRATEGIA-SOCIAL-CONTENT-2026.md §9` (views, save+share rate, follower, CTR profilo→sito, install attribuiti UTM, conversion→trial, 0 ban).

**Ciclo settimanale**:
1. TikTok = test-bed. Identifica i 2-3 hook/format con save+share rate >3%.
2. I vincenti vengono repurposati su tutti i canali la settimana dopo (amplificazione, non nuova produzione).
3. I perdenti (3 video sotto media) → hook ritirato dalla rotazione, annotato.
4. Aggiorna `hook-bank.json` (promuovi vincenti, retira perdenti) → l'automazione eredita l'apprendimento.

---

## 8. Anti-ban — checklist non negoziabile (ogni giorno)

- [ ] Nessun account supera i limiti §1.1 (video/account/giorno)
- [ ] Cadenza costante, stessa fascia oraria, mai burst
- [ ] Solo publish del proprio contenuto — zero like/follow/commento/DM automatici
- [ ] Re-export nativo per piattaforma — zero watermark cross-post
- [ ] Geo/lingua coerenti per account
- [ ] Disclosure AI presente in ogni caption
- [ ] Brand-guard passato (zero brand reali) — gate in `render-worker.md`
- [ ] Zero ads pagati ad-blocker su Meta/TikTok (solo organico)
- [ ] Zero engagement-pod / follower bot

---

## 9. Decisioni e modifiche ad altri documenti

- Questo piano **non sostituisce** `STRATEGIA-SOCIAL-CONTENT-2026.md` (resta autoritativo per principi/strategia): lo **esegue** alzando la cadenza con il principio "produci centrale, distribuisci orizzontale" (§0) per non violare la disciplina anti-ban §6 della strategia.
- La cadenza di lancio della strategia ("1/giorno/canale") resta il **limite per-account**; il volume aggregato alto si ottiene moltiplicando canali×lingue, non post-per-account.
- `automation/README.md`: roadmap §6 di questo piano integra i task P1-P9.
- `marketing/INDEX.md`: aggiungere riga per questo documento.

---

*Documento creato 2026-05-17. Esecuzione operativa della strategia social. Aggiornare §7 (vincenti/perdenti) settimanalmente e §6 (roadmap) a ogni deliverable chiuso.*
