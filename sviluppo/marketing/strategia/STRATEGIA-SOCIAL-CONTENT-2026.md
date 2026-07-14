# AdOff — Strategia Social Content 2026

> **Data**: 2026-05-15
> **Versione**: 1.0
> **Stato**: AUTORITATIVO per il pilastro social. Sostituisce la sezione social di `STRATEGIA-LANCIO-AUTOMATIZZATO.md` (superseded) e rielabora l'Epic 5 di `sviluppo/ai-autopilot/PIANO-DEFINITIVO.md`.
> **Scope**: SOLO canali social di contenuto (TikTok, Instagram, Facebook + repurpose secondari). Reddit/forum/Quora **fuori scope** — vedi sezione 1.2.
> **Owner**: founder + Claude Code. Budget cash: 0 EUR. Infra: leobox (n8n + LLM locali) già operativa.
> **FONTE UNICA CONSOLIDATA (2026-05-16)**: assorbe/sostituisce `../archive/MARKETING-STRATEGY.md` (obsoleta) e `../archive/STRATEGIA-LANCIO-AUTOMATIZZATO.md` (superseded). I contenuti ancora validi (tier-based 8+7 lingue, KPI launch month, anti-spam discipline) sono recepiti qui. Gli archiviati = solo reference storico, NON guida.

---

## 1. Razionale del pivot

### 1.1 Perché social-content invece di community-automation

Il piano precedente poggiava su automazione organica di community testuali (Reddit hunter ×8, Quora bot, forum locali, AlternativeTo vote). Dopo la **Responsible Builder Policy** di Reddit (nov 2025): API non più self-service, Pushshift morto per non-mod, auto-posting da account nuovi = shadowban garantito. Lo stesso anti-spam vale per Quora/forum. **Pilastro strutturalmente fragile → rimosso.**

I social di contenuto sono una categoria diversa e sana:

| | Reddit/forum (rimosso) | TikTok / IG / FB (nuovo baricentro) |
|---|---|---|
| Natura | Community testuale | Broadcast di contenuto nativo |
| Cosa premia | Risposta utile nel thread | Contenuto che intrattiene/dimostra |
| Cosa banna | Link-drop, auto-promo | Engagement-bot, follow/DM mass |
| Automazione sicura? | No (posting = ban) | **Sì, se solo publish del proprio contenuto** |
| Costo accesso | API gated/impossibile | Scheduling via tool terzi (no app-review) |

**Principio guida**: automatizziamo **solo la pubblicazione di contenuto nostro**. Mai like/follow/commento/DM automatici. Questo rende il rischio ban strutturalmente basso (la fragilità Reddit non si trasferisce qui).

### 1.2 Fuori scope (esplicito)

- Reddit / Hacker News / Quora / forum locali (Wykop, Habr, Tabnews): nessuna automazione. Eventuale partecipazione = manuale, futura, fuori da questo documento.
- Mention sentinel Reddit (vecchio T25): degradato a monitoraggio **read-only** opzionale via `.rss`/`.json` pubblici, nessuna API key, nessuna risposta automatica. Non è un canale di acquisizione.

---

## 2. Vincoli assoluti che plasmano i contenuti

| Vincolo | Implicazione operativa |
|---|---|
| **Brand Name Policy** (CLAUDE.md) | Mai mostrare/nominare piattaforme video/social riconoscibili nei video demo. Le clip "prima/dopo" si girano su **siti neutri**: news generiche, blog ricette, blog tech non-brand. Mai screen-record di piattaforme famose. |
| **Privacy/Identity Policy** | Nessun dato personale del founder. Account brand "AdOff". Bio rimanda a `adoff.app` e form supporto, mai email diretta. |
| **EU AI Act (R7 risk register)** | Disclosure AI: bio profilo include "assistente brand AI" / footer trasparente. Voce dei post = "noi" (brand), non finto-umano individuale. |
| **Ad policy piattaforme** | Meta/TikTok **vietano o limitano** la pubblicità a pagamento di ad-blocker. → **Solo organico** su questi canali. Paid solo Google Search, post-MRR>1K (resta in PIANO-DEFINITIVO T18). |
| **Tono brand** (Bibbia parte 9) | Diretto, onesto, empatico, minimale. Mostrare frustrazione → silenzio → sollievo. Mai paranoia, mai esagerare (i numeri reali bastano). |

---

## 3. Canali e priorità

| # | Canale | Priorità | Ruolo | Formato primario |
|---|---|---|---|---|
| 1 | **TikTok** | ALTA | Reach organica nuovi account, top-funnel | Video verticale 15-40s, hook 1s, edutainment/demo |
| 2 | **Instagram** | ALTA | Reels (repurpose TikTok) + autorità (carousel dati) + bio-link | Reels + carousel + Stories build-in-public |
| 3 | **Facebook Page** | MEDIA | Legittimità/recensioni + repurpose Reels, audience 35+ | Reel mirror + post Page |
| 4 | **YouTube Shorts** | MEDIA (repurpose) | Distribuzione extra del verticale, SEO video | Short = stesso master verticale |
| 5 | **X / Threads** | BASSA (repurpose) | Build-in-public testuale, indie/dev audience | Thread testo + clip |

TikTok è il **motore di test creativo** (cicli rapidi, reach indipendente dai follower). IG/FB/Shorts/X = **amplificazione del vincente** via repurpose, non produzione separata.

---

## 4. Pilastri di contenuto (dalla Bibbia)

| Pilastro | Angle | Asset Bibbia | Frequenza |
|---|---|---|---|
| **A. Demo prima/dopo** | Stesso sito neutro: clutter pubblicitario → silenzio. Hero format. | Parte 7 (viaggio emozionale), Parte 3 (3 livelli) | 40% |
| **B. "I numeri che nessuno ti dice"** | Stat-hook: 6.000-10.000 ads/giorno, 47% pagina = pub, 30h/anno persi a saltare | Parte 2 (problema), Parte 8 (numeri chiave) | 25% |
| **C. Storytelling emozionale** | Frustrazione → momento → serenità. Palette emozionale per fase. | Parte 7, Parte 9 (palette) | 15% |
| **D. Build-in-public** | Milestone install/MRR, dietro le quinte, "indie vs adtech" | Stats Stripe/CWS API (già disponibili) | 15% |
| **E. Comparativo soft** | ultraleggera vs MB, no "acceptable ads", privacy assoluta, zero config | Parte 5 (10 vantaggi) | 5% |

Hook obbligatori (frasi pronte Bibbia parte 7): *"Ricordi quando internet era bello?"*, *"Il mio ad blocker pesa meno di questa foto"*, *"Un click. Dieci secondi. Internet torna tuo."*

---

## 5. Pipeline produzione AI (zero-budget, infra leobox)

```
Bibbia (KB) ──▶ Script gen (Qwen2.5-72B su leobox)
                      │
                      ├──▶ Traduzione 15 lingue (DeepL Free + Qwen HI/AR)
                      │
                      ▼
              TTS voiceover (skill /tts-pro, voci multilingua)
                      │
                      ▼
        Video assembly programmatico (skill /remotion)
        — composizioni code-defined, brand-safe, zero filming,
          niente screen-record di brand vietati: UI sintetica/mock
                      │
              ┌───────┴────────┐
              ▼                ▼
      Carousel IG (template   Master verticale 9:16
      SVG/Canva, dati Bibbia) (TikTok/Reels/Shorts)
              │                │
              └───────┬────────┘
                      ▼
         Scheduling = SCHEDULER NATIVI piattaforma
         — TikTok Studio (web, ~10gg) · Meta Business
           Suite (IG/FB). Zero dati societari, zero API,
           zero rischio identità. Tool terzi solo futuri
           e solo se non richiedono ragione sociale.
                      │
                      ▼
         n8n orchestration (genera/prepara asset+caption,
         log su D1; pubblicazione schedulata nei nativi)
```

**Perché Remotion**: video definiti in codice → nessun girato, nessun rischio di mostrare brand vietati (UI mock/sintetica), versioning Git, 15 lingue parametriche, costo 0. La Bibbia fornisce già copy/storytelling/palette per ogni scena.

**Perché scheduler nativi (decisione 2026-05-15)**: il flusso TikTok Business richiede ragione sociale + licenza + foto societarie → **viola la REGOLA ASSOLUTA privacy/identità** (identità developer protetta). Business escluso su TikTok. TikTok Studio (web) ha scheduler nativo (~10gg, qualsiasi account, zero API/verifica); Meta Business Suite scheduli IG/FB nativamente. Zero costi, zero esposizione identità, zero app-review. I tool terzi (Buffer/Metricool/Postiz) restano opzione futura solo se non richiedono dati societari e supportano Creator. Vedi `dec-no-business-tiktok-privacy`.

---

## 6. Disciplina anti-ban (social-specifica)

Diversa da quella Reddit — qui il rischio non è la novità account ma l'inautenticità:

| Regola | Razionale |
|---|---|
| **Solo publish del proprio contenuto** | Zero automazione di like/follow/commento/DM. È la differenza che rende sicuro l'auto-publish. |
| **Re-export nativo, non repost watermarkato** | Reel/Short da TikTok ri-renderizzati dal master, niente watermark TikTok su IG (uccide reach algoritmica). Pipeline Remotion produce N export nativi. |
| **Cadenza costante, non burst** | 1 TikTok/giorno, 1 Reel/giorno, 3 carousel/sett. Ritmo regolare > picchi. |
| **Seasoning leggero account** | 7-10 giorni di profilo completo + 2-3 post organici prima del push lancio (i social tollerano account nuovi che postano contenuto; NON serve warming 21gg stile Reddit). |
| **Disclosure AI in bio** | EU AI Act + autenticità. Voce "noi" brand. |
| **Geo/lingua coerenti** | Account-lingua posta in fuso del mercato; niente IT account che posta solo HI. |
| **Niente ads pagati ad-blocker su Meta/TikTok** | Probabile rifiuto/ban ad account. Solo organico. |
| **Nessun engagement-pod / bot follower** | Detection immediata, shadowban reach. Crescita solo organica + UGC. |

---

## 7. UGC / creator seeding (leva esistente)

Il sistema **referral è già in produzione** (+15gg Pro per amico pagante, codice univoco, dashboard). Riutilizzo come motore UGC a costo zero:

- Gifting codici Pro a micro-creator (privacy/tech, 5-50k follower) → contenuto autentico, non adv (no obbligo disclosure paid perché è gifting prodotto gratuito + referral).
- Hashtag/challenge "internet senza pubblicità" (formato POV, brand-safe).
- Repost (con permesso) di UGC migliore sui canali brand → social proof + volume contenuti senza produzione.

---

## 8. Roadmap

### Fase A — Setup & content bank (giorni 1-10)
- Creazione account brand: TikTok, Instagram, Facebook Page (bio da `SOCIAL-MEDIA-KIT.md`, disclosure AI). YouTube/X = repurpose, account secondari.
- Pipeline produzione: KB→script→TTS→Remotion→scheduling (n8n).
- **Content bank iniziale: 20 master verticali** (mix pilastri A/B/C) + 10 carousel, in EN+IT, pronti tradotti.
- Collegamento tool scheduling terzo + account.
- Seasoning: profili completi, 2-3 post organici/canale.

### Fase B — Lancio (giorni 11-25, sincronizzato con launch AdOff)
- TikTok: 1 video/giorno (rotazione pilastri, A/B hook).
- IG: 1 Reel/giorno (repurpose) + 3 carousel/sett + Stories build-in-public.
- FB Page + Shorts + X: repurpose automatico del vincente.
- Tutti i post: bio-link/UTM → `adoff.app` per attribuzione install.
- Mention monitoring read-only (no risposta auto).

### Fase C — Scale (giorni 26-60)
- Doppiare sui formati/hook vincenti (TikTok come test-bed).
- Avvio UGC/creator seeding via referral.
- Tier 2 lingue (JA/KO/ZH/PL/TR/AR/ID) via pipeline traduzione già pronta.
- Valutazione Google Ads Search (solo se MRR>1K — PIANO-DEFINITIVO T18).

---

## 9. KPI

| Metrica | Target Day-15 | Target Day-30 | Target Day-60 |
|---|---|---|---|
| Video pubblicati (tot canali) | 30+ | 80+ | 200+ |
| TikTok views cumulate | 50K+ | 250K+ | 1M+ |
| Save+share rate (proxy qualità) | >3% | >4% | >5% |
| Follower brand (tot) | 500+ | 2K+ | 8K+ |
| CTR profilo→sito | 2%+ | 3%+ | 4%+ |
| Install attribuiti social (UTM) | 200+ | 1.5K+ | 6K+ |
| Conversion social→trial Pro | 60%+ install | 65%+ | 70%+ |
| Account ban/restriction | 0 | 0 | <1 |
| UGC creator attivati | 0 | 3+ | 15+ |

---

## 10. Task rielaborati (sostituiscono Epic 5 social del PIANO-DEFINITIVO)

| # | Task | Sostituisce | Agent | Model | Size |
|---|---|---|---|---|---|
| S1 | Account brand TikTok/IG/FB + bio disclosure AI + collegamento tool scheduling | T43 (parz.) | Founder + Documenter | Haiku | S |
| S2 | Pipeline KB→script→traduzione 15 lingue | T46 | AI Integration Expert | Sonnet | M |
| S3 | Integrazione TTS multilingua (skill /tts-pro) | nuovo | AI Integration Expert | Sonnet | M |
| S4 | Engine video Remotion (composizioni brand-safe, master 9:16, carousel) | T48 (parz.) | Coder | Sonnet | L |
| S5 | n8n: calendario editoriale + push a tool scheduling + log D1 | T47 | N8N Expert | Sonnet | M |
| S6 | Content bank iniziale 20 video + 10 carousel (EN+IT) | nuovo | Coder + AI Integration | Sonnet | L |
| S7 | Mention monitoring read-only (.rss/.json, NO posting) | T25 degradato | Integration Expert | Haiku | S |
| S8 | UGC/creator seeding via referral esistente (workflow + tracking) | nuovo | N8N Expert | Sonnet | M |
| S9 | Dashboard KPI social → Telegram /status (estende T52) | T52 (estende) | Monitoring Expert | Sonnet | S |
| ~~T4~~ | ~~Reddit/Forum Hunter ×8~~ — **RIMOSSO** (pilastro fragile) | — | — | — | — |
| ~~T49~~ | ~~Email outreach 200 blogger~~ — **fuori scope social** (resta in PIANO-DEFINITIVO se si riattiva press) | — | — | — | — |

**Dipendenze**: S2→S3→S4→S6; S1 indipendente (founder day-1); S5 dopo S1+S4; S7/S8/S9 dopo S5.

---

## 11. Risk register (delta vs PIANO-DEFINITIVO)

| # | Risk | Prob | Impact | Mitigazione |
|---|---|---|---|---|
| RS1 | Tool scheduling terzo cambia pricing/chiude | MED | MED | Astrazione n8n: 2 tool intercambiabili (Buffer + Metricool). Export calendario portabile. |
| RS2 | Reach algoritmica bassa per nicchia "anti-pub" | MED | MED | TikTok come test-bed: itera hook fino a vincente, poi scala. UGC per autenticità. |
| RS3 | Contenuto demo viola brand-name policy (mostra piattaforma vietata) | MED | HIGH | Remotion = UI mock sintetica, **mai screen-record reale**. Review pre-publish su keyword brand. |
| RS4 | Account social restriction per pattern automation | LOW | MED | Solo publish proprio contenuto, zero engagement-bot, cadenza costante. |
| RS5 | Rifiuto ads pagati ad-blocker (Meta/TikTok) | HIGH | LOW | Mai pianificati: solo organico. Paid = Google Search post-MRR. |
| R7 (eredit.) | Disclosure AI insufficiente → EU AI Act | LOW | CRITICAL | Bio + voce "noi" brand + footer. Confermato in S1. |

---

## 12. Modifiche ad altri documenti

- `STRATEGIA-LANCIO-AUTOMATIZZATO.md`: già SUPERSEDED; sezione social ora rimpiazzata da questo documento (annotato).
- `sviluppo/ai-autopilot/PIANO-DEFINITIVO.md`: Epic 5 — task T4 rimosso, T25 degradato (read-only), T43-T48 rielaborati come S1-S9. Annotazione inline.
- `sviluppo/marketing/strategia/SOCIAL-MEDIA-KIT.md`: resta valido per bio/copy; aggiungere disclosure AI nelle bio (TODO follow-up).
- `sviluppo/marketing/strategia/ANALISI-COMPETITOR-SOCIAL-2026.md` (2026-05-17): ricerca competitor (canali, archetipi comunicazione, anti-pattern Total Adblock/eyeo, ecosistema YouTube). Reference.
- `sviluppo/marketing/strategia/PIANO-OPERATIVO-COMPETITOR-2026.md` (2026-05-17): **estende questo documento** con i delta competitor non coperti — positioning trasparenza, offensiva SEO/listicle, outreach creator/press nominativo (S-OPS-1..5), news-jacking, calendario integrato. Operativo, vincoli ereditati invariati.

---

*Documento creato 2026-05-15. Pivot da community-automation (Reddit, rotto da Responsible Builder Policy) a social-content broadcast brand-safe a rischio ban basso. Aggiornare KPI in fase B/C.*
