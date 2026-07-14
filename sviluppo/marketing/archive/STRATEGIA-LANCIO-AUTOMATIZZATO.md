# AdOff — Strategia di Lancio Multilingua Automatizzato

> ⚠️ **DOCUMENTO SUPERSEDED 2026-05-09** — Il founder ha richiesto un sistema più ampio di solo marketing automation: AI autopilot full-lifecycle (pre-vendita + vendita + post-vendita + auto-fix + auto-deploy).
>
> **DOCUMENTO AUTORITATIVO ATTUALE**: `sviluppo/ai-autopilot/PIANO-DEFINITIVO.md` v1.1
> **Session restart packet**: `sviluppo/ai-autopilot/RESUME.md`
> **Vault Obsidian sintesi**: `Progetti/AdOff/sintesi/AdOff AI Autopilot Plan 2026-05-09.md`
>
> Questo documento resta come reference storico delle decisioni di lancio marketing 2026-05-07 (alcune ancora valide: tier-based 8+7 lingue, KPI launch month). NON usare come guida implementation.
>
> ⚠️ **AGGIORNAMENTO 2026-05-15** — Il pilastro **Reddit/forum/Quora** (workflow #4 Reddit Hunter, #3 Mention Sentinel, account warming 21gg, anti-spam community) è **OBSOLETO**: la Responsible Builder Policy di Reddit (nov 2025) ha reso impossibile/ban-risk l'automazione community. Il sistema social è stato rielaborato in `sviluppo/marketing/strategia/STRATEGIA-SOCIAL-CONTENT-2026.md` (AUTORITATIVO): pivot a TikTok/Instagram/Facebook content-broadcast brand-safe, zero engagement-bot. Reddit/forum fuori scope.
>
> ---
>
> **Data originale**: 2026-05-07
> **Stato prodotto**: AdOff v3.3.0 in produzione (Chrome, Firefox, Edge, Opera)
> **Obiettivo originale**: Lancio capillare a budget 0 EUR su 15 mercati linguistici tramite automazione 100% (n8n su Oracle Cloud Free Tier)
> **Owner decisionale**: solo founder + Claude Code
> **Versione documento**: 1.0 (SUPERSEDED 2026-05-09)

---

## 1. Contesto e decisioni prese

### 1.1 Tre scelte strategiche del 2026-05-07

| Scelta | Decisione | Motivazione |
|---|---|---|
| **Hosting orchestrator** | Oracle Cloud Free Tier (VM ARM A1.Flex 4 OCPU/24GB RAM) | Always Free permanente, capacita' superiore a n8n Cloud Free (5K exec/mo). Self-host = zero limiti. |
| **Stack automation** | n8n self-hosted (Docker) | 600+ integrazioni native, expertise gia' nel sistema (`n8n_expert` agent + skill `/n8n`). Zero reinvenzione ruota. Refactor facile. |
| **Approccio launch** | 100% automatico day-1 con tutti i workflow attivi | Setup 14gg, lancio coordinato su 8 mercati simultaneamente. Massimo impatto vs hybrid lento. |

### 1.2 Scelta NON intrapresa (e perche')

- **Flusso proprietario from-scratch**: scartato. 2-3 settimane di scaffolding (retry, logging, secrets, scheduling) gia' risolti da n8n.
- **Lancio simultaneo 15 lingue**: scartato. Ogni lingua richiede ricerca keyword + landing localizzata + 3-5 profili social locali. Disperdere = ban facili (account nuovi su 15 piattaforme = pattern sospetto). Adottato approccio **tier-based**.

---

## 2. Audit stato attuale (2026-05-07)

### 2.1 Cosa esiste gia' (verde)

**Prodotto**:
- Estensione AdOff v3.3.0 deployata su Chrome Web Store, Firefox AMO, Edge Add-ons, Opera (via Chrome ZIP)
- 112 regole `declarativeNetRequest` reali nel file `app/rules/adblock-rules.json`
- ~150 KB dimensione ZIP installato (153 KB Chrome, 133 KB Firefox)
- 15 lingue identiche tra estensione (`app/src/i18n.js`) e sito (`site/adoff-i18n.js`): `ar de en es fr hi id it ja ko pl pt ru tr zh`

**Sito (`site/`)**:
- 15 sottocartelle linguistiche complete (`site/it/`, `site/de/`, `site/fr/`, `site/es/`, `site/pt/`, `site/en/`, `site/ja/`, `site/ko/`, `site/zh/`, `site/ar/`, `site/hi/`, `site/ru/`, `site/pl/`, `site/tr/`, `site/id/`)
- Pagine localizzate per lingua: `best-ad-blocker-2026.html`, `community.html`, `how-it-works.html`, `press.html`, `privacy.html`, `terms.html`, `withdrawal.html`, `vs/`, `guide.html`, `salesletter.html`
- `sitemap.xml` con `xhtml:link rel="alternate" hreflang` per tutte le 15 lingue
- `robots.txt` configurato (Sitemap + crawl-delay SemrushBot/AhrefsBot)
- `_headers` per Cloudflare Pages
- `BingSiteAuth.xml` (Bing Webmaster Tools gia' verificato)
- Affiliate tracking (`affiliate-tracking.js`) integrato

**Backend**:
- Cloudflare Workers attivi (licenze, telegram, tickets)
- Stripe integrato con 9 prodotti (3 piani x 3 device tier)
- Sistema referral funzionante (+15gg Pro per amico pagante)

### 2.2 Cosa manca (rosso)

| Gap | Impatto | Priorita' |
|---|---|---|
| Account social (zero esistenti) | Nessun canale acquisizione organico | CRITICA |
| Account warming pre-launch | Ban immediato a launch day senza warming 21gg | CRITICA |
| Workflow automation (zero) | Tutto manuale = non scala | CRITICA |
| Lead capture / mention monitoring | Nessuna intelligence su menzioni esterne | ALTA |
| Schema markup JSON-LD | AI/Google non riconosce AdOff come entita' | ALTA (verificare se gia' presente in index.html) |
| Press kit localizzato 15 lingue | Outreach blogger zero | MEDIA |
| Wikidata entry | AI search non cita AdOff | MEDIA |
| Keyword research per 11 lingue mancanti (DE/FR/IT/JA/KO/ZH/AR/HI/PL/TR/ID) | SEO localizzato cieco | MEDIA |

### 2.3 Aggiornamento documento `sviluppo/marketing/archive/MARKETING-STRATEGY.md`

Il documento `sviluppo/marketing/archive/MARKETING-STRATEGY.md` (datato 2026-04-20) e' **OBSOLETO**. Indica score SEO sito 1/10 e contenuti 1/10. Il sito attuale ha gia' SEO completo (sitemap, hreflang 15 lingue, 10+ pagine localizzate). Il vero gap e' solo automazione + social, non SEO tecnico.

---

## 3. Strategia tier-based 15 lingue

### 3.1 Tier 1 — Day-1 (8 lingue, 80% utenti Chrome target)

| Lingua | Mercati primari | ARPU stima | Piattaforme social specifiche da presidiare |
|---|---|---|---|
| **EN** | US, UK, AU, CA, IN-EN, NG | Alto | Reddit (r/chrome, r/privacy, r/SideProject), X, Hacker News, Product Hunt, Mastodon (fosstodon.org), Discord |
| **ES** | ES + LATAM (MX, AR, CL, CO, PE) | Medio | Reddit r/argentina/r/mexico/r/spain, Genbeta, Xataka, TikTok ES |
| **PT** | Brasile + Portogallo | Medio | Tabnews, Reddit r/brasil, GitHub Trending BR, Twitter BR |
| **DE** | DE, AT, CH-DE | Alto | r/de, r/Austria, Heise Forum, Golem, Mastodon DE |
| **FR** | FR, BE, CH-FR, QC | Alto | r/france, Tech Cafe, Korben FR, Twitter FR |
| **IT** | IT, CH-IT | Medio | r/italy, Tom's IT, r/Privacy_IT, Telegram canali tech IT |
| **HI** | India | Basso (volumi alti) | Quora India, ShareChat, Koo, WhatsApp Business |
| **RU** | RU + ex-URSS | Medio (anti-censura demand alta) | VK, Telegram canali tech, Habr, Pikabu |

### 3.2 Tier 2 — Day +30 (7 lingue, fase amplificazione)

| Lingua | Mercati | Piattaforme locali |
|---|---|---|
| **JA** | Giappone | note.com, Hatena, Yahoo Japan, Qiita |
| **KO** | Corea Sud | Naver Cafe, Velog, KakaoTalk Open |
| **ZH** | Taiwan, HK, SG, MY | Bilibili, Zhihu, PTT (Taiwan), Mobile01 |
| **PL** | Polonia | Wykop.pl, Reddit r/poland, Niebezpiecznik |
| **TR** | Turchia | Eksi Sozluk, Reddit r/Turkey, Webrazzi |
| **AR** | MENA (SA, EG, AE, MA) | Twitter AR, blog locali, Mawdoo3 |
| **ID** | Indonesia | Kaskus, Quora ID, Twitter ID |

---

## 4. Stack tecnico zero-budget

| Layer | Tool | Costo | Uso |
|---|---|---|---|
| Compute / orchestrator | Oracle Cloud Free Tier (VM ARM A1.Flex 4 OCPU + 24 GB RAM) | 0 EUR (Always Free) | Host n8n + Caddy + Postgres |
| Workflow engine | n8n self-hosted (Docker) | 0 EUR | 80% dei flussi |
| Reverse proxy / HTTPS | Caddy (auto Let's Encrypt) | 0 EUR | TLS + routing |
| Database operativo | Cloudflare D1 (SQLite serverless) | 0 EUR (free tier 5M reads/d) | Mention dedup, lead capture, posts queue |
| KV / cache | Cloudflare KV | 0 EUR (100K reads/d) | Account warm-status, rate limits |
| Storage assets | Cloudflare R2 | 0 EUR (10 GB free) | Press kit, OG image, video demo |
| Scheduler | n8n cron + GitHub Actions | 0 EUR | Cron jobs distribuiti |
| LLM rewrite | Claude API ($5 free credit) o Groq free tier | ~0 EUR | Anti-spam content variation, keyword expansion |
| Translation | DeepL Free (500K char/mo) + Claude per HI/AR | 0 EUR | Blog post -> 15 lingue |
| Browser automation | Playwright in container n8n | 0 EUR | Reddit/Quora/AlternativeTo posting |
| Analytics sito | Plausible self-hosted o Umami | 0 EUR | Pageview, conversion |
| Email outreach | Resend Free (3K/mo) | 0 EUR | Drip blogger |
| DNS / CDN / Pages | Cloudflare (gia' in uso) | 0 EUR | adoff.app |

---

## 5. Architettura workflow n8n

### 5.1 Workflow universali (1 sola istanza, multi-lingua interno)

| # | Nome | Funzione | Trigger |
|---|---|---|---|
| 1 | **Multi-language Auto-translate** | Pubblica in IT -> DeepL traduce in 13 lingue (DeepL non supporta HI/AR) -> Claude API traduce HI+AR -> 15 versioni -> CF Pages auto-deploy con hreflang | Webhook su nuovo articolo IT |
| 2 | **Social Cross-post Hub** | 1 post sorgente -> adattamento per piattaforma + lingua -> coda Buffer-style con timing locale (mattino fuso del mercato) | Cron 4x/giorno |
| 3 | **Mention Sentinel Universale** | Search API X/Reddit con query in 15 lingue ("ad blocker chrome" tradotto) -> Claude ranking rilevanza -> coda risposta in D1 | Cron ogni 30 min |

### 5.2 Workflow per-lingua (1 istanza x lingua, parallelizzati)

| # | Nome | Funzione | Tier 1 | Tier 2 |
|---|---|---|---|---|
| 4 | **Reddit/Forum-locale Hunter** | r/de, r/france, r/italy, r/argentina + Wykop, VK, Habr, Tabnews. Account warming separato per piattaforma. Risposta utile contestuale (NO spam) con menzione AdOff solo se contesto perfetto. Max 3 post/giorno per account, randomized delay 4-8h. | 8 istanze | +7 istanze |
| 5 | **Local AlternativeTo/G2 Vote** | Login automatico settimanale, vote AdOff in categorie pertinenti, aggiunge come alternativa a uBO/ABP/AdGuard | 8 | +7 |
| 6 | **Local Press Outreach Drip** | Lista 200 blogger tech privacy per lingua (raccolta semi-auto da Hunter free + Google search) -> drip 3 email/settimana con press kit localizzato | 8 | +7 |
| 7 | **Quora Answer Bot** | RSS feed di domande nuove "best ad blocker chrome" per lingua -> genera answer con Claude basato su BIBBIA-MARKETING -> review queue manuale (1 click approve) | 8 | +7 |
| 8 | **Indie Hackers Build-in-Public** | Auto-post settimanale stats da Stripe + Chrome Web Store API (download, recensioni, MRR) | 1 (EN only) | - |
| 9 | **GitHub Trending Watcher** | Quando estensioni concorrenti hanno issue critiche, posta repo `adoff-filter-rules` come alternativa | 1 (EN only) | - |
| 10 | **HN Comment Reach** | Monitor commenti su post "MV3 ad blocking" -> suggest reply pertinente in coda manuale | 1 (EN only) | - |

---

## 6. Schema Cloudflare D1

```sql
-- Mention tracking & dedup
CREATE TABLE mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,          -- 'reddit', 'twitter', 'hn', 'quora'
    source_id TEXT NOT NULL,       -- post/tweet ID univoco piattaforma
    lang TEXT NOT NULL,            -- 'en', 'it', ecc
    url TEXT NOT NULL,
    title TEXT,
    body TEXT,
    author TEXT,
    relevance_score REAL,          -- 0.0-1.0 da Claude ranking
    queued_at INTEGER,             -- unix timestamp
    replied_at INTEGER,            -- NULL se non ancora risposto
    reply_id TEXT,                 -- ID risposta nostra
    UNIQUE(source, source_id)
);

-- Account social pool (warming + posting)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,        -- 'reddit', 'twitter', 'mastodon', ecc
    handle TEXT NOT NULL,
    lang TEXT NOT NULL,            -- account principale per quale lingua
    created_at INTEGER,
    warm_score REAL DEFAULT 0,     -- 0-100, sale con organic posts
    last_post_at INTEGER,
    daily_post_count INTEGER DEFAULT 0,
    daily_reset_at INTEGER,
    status TEXT DEFAULT 'warming', -- 'warming', 'ready', 'banned', 'cooldown'
    secrets_kv_key TEXT            -- riferimento KV per token
);

-- Posts queue (cross-posting)
CREATE TABLE posts_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_post_id TEXT NOT NULL,  -- ID master post
    target_platform TEXT NOT NULL,
    target_account_id INTEGER REFERENCES accounts(id),
    target_lang TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at INTEGER,
    posted_at INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'posted', 'failed', 'skipped'
    failure_reason TEXT
);

-- Lead capture (visite + click outbound)
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_at INTEGER,
    source TEXT,                   -- 'reddit-r/chrome', 'twitter-mention', 'organic-search'
    lang TEXT,
    referrer TEXT,
    landing_page TEXT,
    user_agent_hash TEXT,
    converted_install BOOLEAN DEFAULT 0,
    converted_pro BOOLEAN DEFAULT 0
);

-- Press kit outreach tracking
CREATE TABLE outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blogger_email TEXT NOT NULL,
    blog_url TEXT,
    blogger_lang TEXT NOT NULL,
    first_contact_at INTEGER,
    last_contact_at INTEGER,
    sequence_step INTEGER DEFAULT 0,  -- 0-3 (3 email max)
    status TEXT DEFAULT 'pending',    -- 'pending', 'replied', 'unsubscribed', 'converted'
    notes TEXT
);

CREATE INDEX idx_mentions_lang_source ON mentions(lang, source);
CREATE INDEX idx_accounts_platform_status ON accounts(platform, status);
CREATE INDEX idx_posts_queue_scheduled ON posts_queue(scheduled_at, status);
```

---

## 7. Account social Tier 1 — ordine creazione

| # | Piattaforma | Handle | URL signup | Tempo | Bio reference |
|---|---|---|---|---|---|
| 1 | **GitHub Org** | `AdOff-App` | github.com/organizations/new | 10 min | `sviluppo/marketing/strategia/SOCIAL-MEDIA-KIT.md` sez 1 |
| 2 | **Twitter/X** | `@AdOffApp` | twitter.com/i/flow/signup | 10 min | idem |
| 3 | **Reddit** | `u/adoff_dev` | reddit.com/register | 5 min | idem |
| 4 | **Mastodon** | `@adoff@fosstodon.org` | fosstodon.org | 10 min | idem |
| 5 | **Discord Server** | "AdOff Community" | discord.com/channels/@me | 30 min | idem |
| 6 | **Product Hunt** | maker profile | producthunt.com/signup | 10 min | idem |
| 7 | **AlternativeTo** | profilo "AdOff" | alternativeto.net/register | 15 min | idem |
| 8 | **Hacker News** | maker account | news.ycombinator.com/login | 5 min | n/a (no bio) |

### Regola CRITICA — Account warming

Dopo creazione, **NESSUN post promozionale per 21 giorni**. Solo:
- Profile completo (avatar AdOff, bio, link adoff.app, location/timezone)
- 2-3 post/commenti organici/settimana su argomenti adiacenti (privacy, MV3, Chrome dev, ad blocking news)
- Senza warming = ban immediato a launch day per pattern sospetto

---

## 8. Sequenza esecutiva (14 giorni setup -> launch)

### Settimana 1 — Foundation

| Giorno | Owner | Azione |
|---|---|---|
| D1 | Founder | Provisioning Oracle Cloud Free Tier (registrazione + VM ARM A1.Flex 4 OCPU/24GB Frankfurt + SSH key) |
| D1 | Claude | Schema D1 base + docker-compose.yml n8n+Caddy+Postgres pronto in `sviluppo/launch-automation/` |
| D2 | Founder + Claude | SSH alla VM, deploy stack (n8n, Caddy con HTTPS auto, Postgres) |
| D3 | Claude | Verifica i18n estensione + sito allineati su 15 lingue (CONFERMATO 2026-05-07) |
| D3-D4 | Claude | Keyword research 11 lingue mancanti (DE/FR/IT/JA/KO/ZH/AR/HI/PL/TR/ID) via Google Keyword Planner free + Ahrefs free trial |
| D5 | Founder | Creazione 8 account social Tier 1 (con bio da SOCIAL-MEDIA-KIT) |
| D6-D7 | Founder | Inizio account warming (organic posts 2-3/settimana per 21gg) |

### Settimana 2 — Build workflow

| Giorno | Owner | Azione |
|---|---|---|
| D8-D9 | Claude | Build workflow universali (1 Multi-translate, 2 Cross-post, 3 Mention Sentinel) |
| D10-D12 | Claude | Build workflow per-lingua Tier 1 (8 istanze del workflow 4 Reddit Hunter) |
| D13 | Claude + Founder | 15 OG image localizzate (Canva template + script) + Press kit 15 lingue + 15 thread Twitter di lancio |
| D14 | Founder | **LAUNCH DAY** — Product Hunt (00:01 PT) + Show HN (08:00 ET) + 8 launch coordinati per lingua nei loro fusi orari |

### Settimane 3-6 — Tier 2 + ottimizzazione

- Onboarding Tier 2 (7 lingue aggiuntive)
- Analisi metriche launch -> raddoppia su canali che funzionano
- Amplificazione organica via referral program (gia' in produzione)
- Press outreach 200 blogger tech privacy/lingua

---

## 9. Anti-spam / anti-ban discipline

| Regola | Razionale |
|---|---|
| Mai post copia-incolla | Pattern detection AI delle piattaforme. Sempre LLM-rewrite o template variabile. |
| Risposta UTILE prima del link | Reddit/HN bannano link-drop. Prima dare valore, poi mention soft. |
| Account warming 21gg pre-launch | Account giovani con primo post promozionale = shadowban garantito. |
| Rate limiting reale | Max 3 post/giorno per account, delay randomized 4-8h tra azioni. |
| Geo-IP coerente | Account "ItalianAdOffer" che posta da IP indiano = ban. Usa proxy residenziali per account-lingua se serve. |
| User-agent + fingerprint coerente | Browser automation con Playwright deve mantenere stesso fingerprint per account. |
| Cooldown post-ban | Account bannato = NON tentare recovery, abbandona e rebuilda altro. |
| No DM mass | DM di massa = report istantaneo. Solo conversazioni 1-a-1 con context. |

---

## 10. KPI e monitoring

### 10.1 Launch month (giorni 1-30)

| Metrica | Target Day-7 | Target Day-30 |
|---|---|---|
| Installs CWS | 500+ | 5K+ |
| Recensioni CWS | 10+ | 50+ |
| Star rating | 4.5+ | 4.5+ |
| Visitatori sito unique | 2K+ | 20K+ |
| Conversion install (visit -> install) | 8%+ | 10%+ |
| Trial Pro attivati | 80% degli installs | 80% |
| Conversion trial -> paid | 3%+ | 5%+ |
| Mention sentinel (mention/giorno) | 20+ | 100+ |
| Risposte automatiche postate | 5/giorno | 20/giorno |
| Account social ban rate | <5% | <10% |

### 10.2 Quarter (giorni 31-90)

- Top 10 ricerca organica su almeno 5 long-tail keyword (per 8 lingue Tier 1)
- 200+ recensioni CWS
- Tier 2 onboarded (7 lingue aggiuntive)
- 1.000+ membri Discord
- AdOff menzionato regolarmente da AI search (Perplexity, Bing Chat, Claude.ai)
- MRR 2.000+ EUR

---

## 11. Risk register

| Rischio | Probabilita' | Impatto | Mitigazione |
|---|---|---|---|
| Mass ban account social a launch day | Alta | Critico | 21gg warming non negoziabile. 2-3 account backup per piattaforma. |
| Oracle Cloud Free Tier reclama VM (idle reclaim policy) | Media | Alto | Mantenere CPU > 20% baseline (cron health-check ogni 5 min) |
| n8n self-hosted crash | Bassa | Medio | Docker auto-restart + healthcheck Caddy + alert via Telegram bot esistente |
| Claude API exhausted ($5 free credit) | Media | Medio | Switch a Groq free tier (Llama 3.3 70B) come fallback in workflow |
| Google rifiuta extension per stealth nei prossimi update | Media | Critico | Doppia distribuzione gia' implementata (CWS minified + sito offuscato) |
| Anti-adblock arms race (siti rilevano nostro stealth) | Alta | Alto | Update settimanale rules + community feedback in r/adoff |
| Concorrente copia stealth | Bassa | Medio | First-mover advantage + brand. Filter rules open source comunque pubblici. |

---

## 12. Riferimenti documenti

### Documenti progetto (operativi)
- [BIBBIA-MARKETING](ADOFF-BIBBIA-MARKETING.md) — voce/messaggi/regole brand (da allineare post-launch)
- [MARKETING-STRATEGY](MARKETING-STRATEGY.md) — strategia originale 2026-04-20 (OBSOLETA su SEO sito, valida su social/automation)
- [SOCIAL-MEDIA-KIT](SOCIAL-MEDIA-KIT.md) — bio + thread + post copy-paste-ready
- [PRICING-PLAN](PRICING-PLAN.md) — pricing autoritativo
- [KEYWORDS-EN](KEYWORDS-EN.md) + [KEYWORDS-ES-PT-RU](KEYWORDS-ES-PT-RU.md) — keyword research (mancano 11 lingue)
- [store-listing](store-listing.md) — Chrome Web Store listing EN+IT
- [NOTEBOOKLM-VIDEO-SCRIPT](NOTEBOOKLM-VIDEO-SCRIPT.md) — script video promo

### Documenti sviluppo da creare
- `sviluppo/launch-automation/docker-compose.yml` — n8n + Caddy + Postgres
- `sviluppo/launch-automation/d1-schema.sql` — schema Cloudflare D1 (sez 6 sopra)
- `sviluppo/launch-automation/workflows/` — JSON export n8n workflow

### Documenti vault Obsidian
- `Progetti/AdOff/sintesi/AdOff Strategia Lancio Multilingua Automatizzato 2026-05-07.md` — questo documento (sintesi)
- `Progetti/AdOff/decisioni/DEC - Stack Lancio n8n vs Proprietario - 2026-05-07.md` — record decisione
- `Progetti/AdOff/PRJ - AdOff.md` — hub progetto (aggiornato con link)

---

## 13. Stato esecuzione (live)

| Fase | Stato | Note |
|---|---|---|
| Audit completo | DONE 2026-05-07 | Sito 15 lingue, sitemap+hreflang+robots OK. Manca: account social, automation, keyword research 11 lingue |
| Decisioni strategiche (Oracle + n8n + tier-based) | DONE 2026-05-07 | Confermate da founder |
| Provisioning Oracle Cloud | TODO | Founder, 90 min |
| docker-compose.yml + D1 schema | TODO | Claude, parallelo |
| Account social Tier 1 (8) | TODO | Founder, ~2h |
| Account warming 21gg | TODO | Founder, daily 5-10 min |
| Workflow universali (1, 2, 3) | TODO | Claude, dopo provisioning |
| Workflow per-lingua Tier 1 (8 istanze) | TODO | Claude, settimana 2 |
| LAUNCH DAY | TBD | Target: 14gg da provisioning Oracle |

---

*Documento creato 2026-05-07. Aggiornare campo `Stato esecuzione (live)` ad ogni milestone.*
