# AdOff — Marketing Strategy & Execution Plan

> **Data**: 2026-04-20  
> **Budget**: 0 EUR  
> **Team**: 1 persona + Claude  
> **Obiettivo**: Far conoscere AdOff, dominare ricerca organica e AI, costruire community

---

## PARTE 1: AUDIT STATO ATTUALE

### Cosa ABBIAMO (verde)

| Asset | Stato | Note |
|---|---|---|
| Estensione Chrome v3.1.0 | Funzionante | MV3, ultraleggera, stealth anti-detection |
| Sito web adoff.app | Live su CF Pages | Landing page completa, 6 lingue |
| Sistema licenze | Funzionante | Worker CF + Stripe + KV |
| Sistema referral | Implementato | 15gg Pro per ogni amico pagante |
| Bot Telegram | Attivo | Supporto utenti |
| Pricing | Definito | 2.69/m, 29.59/y, 67.90 lifetime |
| 6 lingue | IT/EN/DE/FR/ES/PT | i18n completo sito + estensione |
| Privacy/Terms/Support | Pagine live | GDPR compliant |
| Trial 15 giorni | Attivo | Senza carta di credito |
| Chrome Web Store | Pubblicato | Extension ID configurato |

### Cosa MANCA (rosso critico)

| Gap | Impatto | Priorita' |
|---|---|---|
| **Zero schema markup** | AI e Google non capiscono cos'e' AdOff | CRITICA |
| **Zero sitemap.xml** | Google non indicizza tutte le pagine | CRITICA |
| **Zero robots.txt** | Nessun controllo su crawling | CRITICA |
| **Zero _headers CF** | Nessun cache, nessun security header | ALTA |
| **Zero hreflang** | Google non sa delle 6 lingue | CRITICA |
| **Zero canonical URL** | Rischio contenuto duplicato | ALTA |
| **Title tag generico** | "AdOff — Ads? Off!" non contiene keyword | CRITICA |
| **OG image = icon 128px** | Share social bruttissimo | ALTA |
| **Zero Twitter Card** | Nessuna preview su X | ALTA |
| **Zero og:type** | Social parser non sanno il tipo | MEDIA |
| **Zero blog/contenuti** | Nessun contenuto per SEO long-tail | CRITICA |
| **Zero pagine comparazione** | Non cattura "AdOff vs X" queries | CRITICA |
| **Zero pagina /faq dedicata** | FAQ solo embedded nella homepage | MEDIA |
| **Zero pagina /how-it-works** | Nessun contenuto tecnico per AI | ALTA |
| **Zero profili social** | Twitter, Reddit, GitHub, Discord inesistenti | CRITICA |
| **Zero Wikidata** | AI non riconosce AdOff come entita' | ALTA |
| **Zero AlternativeTo** | Non appare nelle ricerche "alternativa a X" | ALTA |
| **Zero Product Hunt** | Nessun lancio | ALTA |
| **Zero Google Search Console** | Non monitoriamo le ricerche | CRITICA |
| **Zero Bing Webmaster Tools** | Non monitoriamo Bing (usato da AI) | ALTA |
| **Zero press kit** | Blogger non hanno materiale | MEDIA |

### Score Audit

```
SEO Tecnico:      2/10 (manca tutto: sitemap, robots, schema, hreflang, canonical)
SEO Contenuti:    1/10 (solo landing page, zero blog, zero comparazioni)
Social Presence:  0/10 (zero account social attivi)
AI Visibility:    0/10 (zero schema, zero entity, zero menzioni esterne)
Growth Engine:    3/10 (referral c'e' ma nessun canale di acquisizione)
Brand Authority:  1/10 (nessuna menzione esterna, nessuna review)
```

**Punteggio complessivo: 1.2/10** — Il prodotto e' ottimo, la visibilita' e' quasi zero.

---

## PARTE 2: POSIZIONAMENTO E USP

### Competitor Map

```
                    ALTA EFFICACIA
                         |
            uBO Full     |    AdGuard
            (Firefox)    |    (Est+App)
                         |
   GRATUITO ─────────────┼────────────── PAGAMENTO
                  uBO    |     ★ AdOff Pro
                 Lite    |     Total Adblock
                  ABP    |
                Ghostery |
                         |
                    BASSA EFFICACIA
```

### USP Principale

**"Invisibile ai siti. Invincibile agli ads."**

AdOff e' l'unico ad blocker Chrome con stealth anti-detection nativo in MV3.
I siti non sanno che lo usi. Punto.

### Messaggi di Attacco (per comparazioni)

| vs Chi | Angolo di attacco |
|---|---|
| vs ABP/AdBlock | "Il tuo ad blocker e' pagato dagli inserzionisti. AdOff no." |
| vs uBlock Lite | "Costruito per il Chrome di oggi, non di ieri." |
| vs Total Adblock | "67.90 EUR una volta. Non 19 il primo anno e 99 dal secondo." |
| vs AdGuard | "Solo estensione, ultraleggera. Non serve un'app desktop separata." |
| vs Brave | "Non devi cambiare browser. Solo installare un'estensione." |

### Target Audience Prioritari

1. **Ex-utenti uBlock Origin su Chrome** (45M potenziali, frustrati da MV3)
2. **Utenti con muri anti-adblock** (30% degli utenti adblock li incontra)
3. **Privacy advocates** (r/privacy, r/degoogle — pagano per privacy)
4. **Utenti ABP consapevoli** del conflitto interessi Acceptable Ads

---

## PARTE 3: PIANO ESECUTIVO AUTOMATICO

> Tutto quello che segue sara' eseguito da Claude in automatico.

### FASE 1 — SEO Tecnico (sito) [Claude esegue]

**1.1 Schema Markup (index.html)**
- Aggiungere JSON-LD SoftwareApplication
- Aggiungere JSON-LD FAQPage con tutte le FAQ
- Aggiungere JSON-LD Organization

**1.2 Meta Tag (index.html + tutte le pagine)**
- Title tag ottimizzato con keyword
- Meta description ottimizzata
- og:type, og:url, og:locale
- Twitter Card meta tags
- Canonical URL su ogni pagina
- hreflang per 6 lingue (anche se il contenuto e' dinamico via JS)

**1.3 File Tecnici**
- Creare `sitemap.xml` con tutte le pagine
- Creare `robots.txt` con sitemap reference
- Creare `_headers` per CF Pages (cache, security headers)

**1.4 Performance**
- Aggiungere width/height a tutte le img
- Preload font e hero image
- Security headers (X-Content-Type-Options, X-Frame-Options, CSP)

### FASE 2 — Pagine Contenuto [Claude esegue]

**2.1 Pagine comparazione**
- `/vs/ublock-origin.html` — AdOff vs uBlock Origin 2026
- `/vs/adblock-plus.html` — AdOff vs AdBlock Plus 2026
- `/vs/adguard.html` — AdOff vs AdGuard 2026

**2.2 Pagine guide**
- `/how-it-works.html` — Come funziona AdOff (tecnico)
- `/best-ad-blocker-2026.html` — Migliori ad blocker Chrome 2026

**2.3 Pagina community**
- `/community.html` — Link a Discord, Twitter, Reddit, GitHub

**2.4 Press Kit**
- `/press.html` — Logo, screenshot, description, stats

### FASE 3 — Profili Social [utente deve creare account]

**Account da creare (richiede azione manuale):**

| Piattaforma | Handle | Priorita' | Tempo |
|---|---|---|---|
| GitHub Org | `AdOff-App` | ALTA | 15 min |
| Twitter/X | `@AdOffApp` | ALTA | 10 min |
| Reddit | `u/adoff_dev` | ALTA | 5 min |
| Discord Server | "AdOff Community" | MEDIA | 30 min |
| Mastodon | `@adoff@fosstodon.org` | MEDIA | 10 min |
| YouTube | "AdOff" | MEDIA | 15 min |
| Wikidata | Voce "AdOff" | ALTA | 30 min |
| AlternativeTo | Profilo "AdOff" | ALTA | 20 min |
| Product Hunt | Profilo maker | ALTA | 15 min |
| G2 | Profilo prodotto | MEDIA | 20 min |
| Crunchbase | Profilo prodotto | MEDIA | 15 min |
| Google Search Console | Verifica adoff.app | CRITICA | 10 min |
| Bing Webmaster Tools | Verifica adoff.app | ALTA | 10 min |

**Claude prepara:**
- Bio/description per ogni piattaforma
- README per GitHub
- Struttura server Discord
- Testi per Wikidata/AlternativeTo/PH/G2

### FASE 4 — Content Strategy [Claude prepara testi]

**Articoli pronti da pubblicare:**
1. "AdOff vs uBlock Origin: quale scegliere nel 2026" (EN + IT)
2. "Come AdOff bypassa i sistemi anti-adblock" (EN, tecnico per HN)
3. "I migliori ad blocker per Chrome nel 2026" (EN + IT)
4. Thread Twitter lancio (10 tweet)
5. Post Reddit "Show Reddit" per r/chrome
6. Post Product Hunt (tagline + description)
7. Post Hacker News "Show HN"

### FASE 5 — Deploy e Monitoring [Claude esegue]

- Deploy sito aggiornato su CF Pages
- Verifica schema con Google Rich Results Test
- Submit sitemap a Google Search Console (dopo verifica manuale)
- Setup Google Alerts per "AdOff"

---

## PARTE 4: TIMELINE 90 GIORNI

### Settimana 1: Fondamenta SEO (Claude esegue)
- [x] Audit completo ← FATTO
- [ ] Schema markup su index.html
- [ ] Meta tag ottimizzati su tutte le pagine
- [ ] sitemap.xml + robots.txt + _headers
- [ ] hreflang + canonical su tutte le pagine
- [ ] OG image 1200x630

### Settimana 2: Contenuti (Claude esegue)
- [ ] Pagine comparazione (3x)
- [ ] Pagina how-it-works
- [ ] Pagina best-ad-blocker-2026
- [ ] Pagina community
- [ ] Pagina press kit
- [ ] Deploy sito aggiornato

### Settimana 3: Profili Social (utente + Claude)
- [ ] Creare account (utente)
- [ ] Popolare profili con bio/content (Claude prepara)
- [ ] GitHub org + repo pubblico regole
- [ ] Wikidata entity
- [ ] AlternativeTo profilo

### Settimana 4: Lancio
- [ ] Product Hunt launch (martedi')
- [ ] Show HN post
- [ ] Reddit post in r/chrome
- [ ] Thread Twitter lancio
- [ ] Post Mastodon

### Settimane 5-8: Community
- [ ] Reddit: 3-5 commenti/giorno organici
- [ ] Twitter: 2-3 tweet/giorno
- [ ] Rispondi a OGNI menzione
- [ ] Outreach 10 tech blogger
- [ ] Discord: community attiva

### Settimane 9-12: Amplificazione
- [ ] Secondo round outreach blogger
- [ ] Partnership estensioni complementari
- [ ] Primo video YouTube
- [ ] Analisi metriche e raddoppia su cio' che funziona

---

## PARTE 5: KEYWORD TARGET

### Quick Wins (0-3 mesi, bassa competizione)
- "ad blocker bypass anti-adblock"
- "bloccare pubblicita' video streaming chrome"
- "alternativa ublock origin 2026"
- "ad blocker non rilevabile"
- "estensione chrome invisibile ai siti"

### Mid-tier (3-6 mesi)
- "migliore ad blocker chrome 2026"
- "estensione blocco pubblicita' gratis"
- "ad blocker leggero chrome"

### Target ambizioso (6-12 mesi)
- "ad blocker chrome"
- "best ad blocker 2026"
- "bloccare pubblicita' chrome"

---

## PARTE 6: METRICHE DI SUCCESSO

### KPI 30 giorni
- Schema markup validato su Google Rich Results Test
- Sitemap indexata in Google Search Console
- 5+ profili social attivi
- Product Hunt lanciato
- 10+ recensioni Chrome Web Store

### KPI 90 giorni
- 500+ visitatori organici/mese
- 20+ backlink da domini DA>30
- Top 10 su almeno 3 long-tail keyword
- 50+ recensioni CWS
- 200+ follower Twitter
- AdOff menzionato da almeno 1 AI (Perplexity/Bing)

### KPI 12 mesi
- 5.000+ visitatori organici/mese
- Top 5 per "ad blocker chrome" in almeno 1 mercato
- 200+ backlink domain referral
- 1.000+ membri Discord
- AdOff menzionato regolarmente da AI search

---

## PARTE 7: CHECKLIST "COSA FA CLAUDE" vs "COSA FA L'UTENTE"

### Claude esegue automaticamente:
1. Schema markup JSON-LD su tutte le pagine
2. Meta tag ottimizzati (title, description, OG, Twitter Card)
3. sitemap.xml, robots.txt, _headers
4. hreflang e canonical
5. Pagine comparazione (3+)
6. Pagine guide/how-it-works
7. Pagina community e press kit
8. Testi per profili social (bio, description)
9. README GitHub
10. Testi per Product Hunt, HN, Reddit
11. Deploy su CF Pages
12. Verifica schema markup

### L'utente deve fare manualmente:
1. Creare account social (GitHub, Twitter, Reddit, Discord, Mastodon)
2. Creare account Wikidata e compilare voce
3. Creare profilo AlternativeTo
4. Creare profilo Product Hunt
5. Registrare Google Search Console + Bing Webmaster
6. Creare OG image 1200x630 (o chiedere a Claude di generarla)
7. Postare contenuti preparati da Claude
8. Rispondere ai commenti/feedback
9. Gestire community Discord

---

*Documento generato il 2026-04-20. Basato su 5 ricerche parallele approfondite.*
