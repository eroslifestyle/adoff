# W46 — Proactive Engagement Discovery

**Workflow ID**: `w46-proactive-engagement-discovery`  
**Version**: 1.0  
**Status**: Ready for import  
**n8n**: 2.21.5+

## Obiettivo

Colma il caveat audit Gemini #FINAL: W45 è SOLO reattivo (risponde a chi parla con noi). W46 scopre conversazioni esterne in cui AdOff può intervenire utilmente, senza spam.

## Trigger

| Trigger | Intervallo | Path |
|---------|-----------|------|
| Schedule | 60 minuti | (default) |
| Webhook | POST | `/proactive-scan-now` (HMAC W29) |

## Architettura

```
Schedule / Webhook (HMAC validation)
    ↓
Kill-switch check (env: PROACTIVE_DISCOVERY_DISABLED)
    ↓
Parallel discovery (Phase A):
  ├─ Reddit: GET /r/{subreddit}/new (50 posts)
  ├─ HackerNews: GET /api/v1/search?query=adblock (50 results, ultimi 24h)
  └─ Mastodon: GET /api/v2/search?q=adblock (50 statuses)
    ↓
Merge & normalize (timestamp, age_hours, score)
    ↓
Brand-safety filter (6 checks):
  ├─ Già menziona AdOff → skip
  ├─ Off-topic keywords (politics, religion, nsfw) → skip
  ├─ Verified 1M+ followers (Mastodon only) → skip
  ├─ Già ha sentiment positivo → skip
  ├─ >48h vecchio → skip
  └─ Proceed se tutti OK
    ↓
Gemini Flash: Relevance scoring (0-100)
    ↓
Decision tree:
  ├─ score ≥ 80 + risk_level='low' + engagement_type IN (helpful_comment, subtle_mention)
  │  └─ INSERT status='proactive_drafted', priority=8
  ├─ 60 ≤ score < 80
  │  └─ INSERT status='proactive_review' + Telegram alert
  └─ score < 60 OR risk_level='high'
     └─ INSERT status='ignored'
    ↓
Daily report (19:00 CET): Telegram alert
```

## Discovery Sources

### Reddit
- **URL**: `https://oauth.reddit.com/r/{subreddit}/new?limit=50`
- **Auth**: REDDIT_OAUTH_TOKEN (env)
- **Subreddit target** (configurable): `webdev`, `privacy`, `browsers`, `chrome`, `firefox`, `ProductivityApps`
- **Keyword search**: `adblock`, `ads blocking`, `ad blocker`, `invasive ads`, `popup ads`, `privacy navigating`, `tired of ads`
- **Fallback**: Graceful skip se token missing

### HackerNews
- **URL**: `https://hn.algolia.com/api/v1/search?query={keyword}`
- **Auth**: Nessuna (API pubblica)
- **Filter**: ultimi 24h, score > 5
- **Sempre attivo**: Non richiede credenziali

### Mastodon
- **URL**: `https://mastodon.social/api/v2/search?q={keyword}&type=statuses`
- **Auth**: Nessuna (API pubblica)
- **Filter**: ultimi 24h
- **Sempre attivo**: Non richiede credenziali

### Quora
- **Placeholder**: Struttura pronta ma skip per ora (scraping complesso)
- Future: Chiama W09 quora-answer-scheduler se esiste

## Brand Safety Filter

### Criteri di esclusione (automatici):

| Criterio | Azione |
|----------|--------|
| Già menziona "AdOff" | skip |
| Keyword off-topic (politics, religion, hate, nsfw) | skip |
| Account Mastodon >1M followers | skip (reputational risk) |
| Sentiment positivo (solved, works great, love) | skip |
| >48h vecchio | skip |

### Intent detection (Gemini):
- `looking_for_solution` — utente cerca tool
- `venting` — utente sfoga frustrazione (buon target)
- `comparing_tools` — utente valuta opzioni
- `tech_question` — domanda tecnica generica
- `off_topic` — non pertinente
- `unsuitable` — rischioso

## Gemini Relevance Scoring

**Prompt** a Gemini Flash (temperatura 0.7):

```
Analizza questa conversazione e decidi se AdOff (extension ad-blocker browser, 
privacy-first, anti-tracking) ha un fit naturale come suggerimento.
Non forzare la menzione se non pertinente.

Output JSON:
{
  "relevance_score": 0-100,
  "intent": "looking_for_solution"|"venting"|"comparing_tools"|"tech_question"|"off_topic"|"unsuitable",
  "suggested_engagement_type": "helpful_comment"|"subtle_mention"|"no_action",
  "reasoning": "1-2 righe",
  "draft_reply_in_user_lang": "max 400 char, brand-safe, helpful tone, non pushy",
  "risk_level": "low"|"medium"|"high"
}
```

**Score interpretation**:
- 80-100: Eccellente, procedi con posting
- 60-79: Buono, ma richiede review umana (status='proactive_review')
- 0-59: Basso, ignora (status='ignored')

## Database Schema

### engagement_inbox (columns utilizzate)

```sql
CREATE TABLE engagement_inbox (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  platform TEXT NOT NULL, -- reddit|hackernews|mastodon|twitter|...
  title TEXT,
  body TEXT,
  author TEXT,
  age_hours INT,
  created_at TIMESTAMP DEFAULT NOW(),
  relevance_score INT,
  intent TEXT,
  suggested_engagement_type TEXT,
  reasoning TEXT,
  draft_reply TEXT,
  risk_level TEXT, -- low|medium|high
  status TEXT DEFAULT 'pending', -- proactive_drafted|proactive_review|ignored|posted|failed
  priority INT DEFAULT 5, -- 8=drafted, 5=review, 1=ignored
  source_id TEXT, -- ID da platform
  subreddit TEXT, -- Reddit only
  followers INT -- Mastodon only
);
```

## Anti-Spam Safeguards

| Limite | Descrizione |
|--------|------------|
| **5/giorno per platform** | Max 5 proactive su Reddit, 5 su HN, 5 su Mastodon, etc. |
| **1/giorno per subreddit** | Max 1 conversazione per subreddit per day |
| **No >48h vecchi** | Mai rispondere a thread rotti (no engagement) |
| **4h cooldown** | Aspetta 4h tra proactive su stessa platform |
| **Hard cap: 15/giorno** | Max 15 proactive cross-platform per day |

**Enforcement**: Code node `Enforce daily caps` verifica `engagement_inbox` per created_at::date = CURRENT_DATE.

## Linkage con W45

- Rows con status='proactive_drafted' vengono processati da **W45 (Reactive Engagement Agent)** che effettivamente posta la reply
- W45 riusa la stessa pipeline post-side (comment composition, platform auth, posting)
- Rows con status='proactive_review' rimangono in inbox finché human (admin panel) non approva

## Telegram Reporting

### Real-time alerts
- **On insert review-needed**: Telegram alert per 60 ≤ score < 80
- **On ignored**: Log silenzioso (no alert)
- **Format**:
  ```
  📊 W46 Proactive Discovery
  
  60-80 relevance (needs review):
  "Title"
  
  Platform: reddit
  Score: 72/100
  Risk: low
  Intent: looking_for_solution
  
  URL: https://reddit.com/r/...
  ```

### Daily report (19:00 CET)
```
📊 Proactive Discovery Daily Report (2026-05-21)

Total scanned: 87
High relevance (≥80): 12
Drafted for posting: 5

Per platform:
reddit: 40 scanned, 75/100 avg, 3 drafted, 2 review, 1 ignored
hackernews: 30 scanned, 68/100 avg, 2 drafted, 1 review, 0 ignored
mastodon: 17 scanned, 64/100 avg, 0 drafted, 1 review, 2 ignored
```

## Environment Variables (required)

```bash
# Authentication
WEBHOOK_HMAC_SECRET=<hex-encoded-secret>  # W29 HMAC validation
REDDIT_OAUTH_TOKEN=<token>                # Optional, graceful skip if missing
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat-id>

# Database
PG_CRED_ID=<n8n-postgres-credential-id>  # Local PostgreSQL connection

# Feature flags
PROACTIVE_DISCOVERY_DISABLED=false         # Set true to disable entire workflow

# Optional
REDDIT_DISCOVERY_SUBREDDIT=webdev         # Default subreddit (can cycle)
```

## Import & Setup

### Step 1: Import JSON
```bash
curl -X POST http://n8n-host:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @workflows/46-proactive-engagement-discovery.json
```

### Step 2: Configure credentials
1. Open workflow in n8n UI
2. For each HTTP node requiring auth (Reddit, Gemini), add credentials:
   - `REDDIT_OAUTH_TOKEN` → httpHeaderAuth
   - Google Generative AI → `googleGenerativeAiApi`
   - PostgreSQL → existing local connection

### Step 3: Activate
- Set `active: true` in JSON, or toggle in UI
- Schedule trigger: `0 * * * *` (ogni 60 min)
- Webhook available at: `POST /proactive-scan-now` (HMAC signed)

### Step 4: Smoke test
```bash
# Trigger manual scan via webhook (HN doesn't need auth)
curl -X POST http://n8n-host:5678/webhook/proactive-scan-now \
  -H "x-adoff-signature: <hmac-sha256-signature>" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check engagement_inbox for new rows
psql adoff_db -c "SELECT COUNT(*) FROM engagement_inbox WHERE created_at > NOW() - INTERVAL '5 min' AND source_id LIKE 'w46%';"
```

**Expected**: ≥1 row inserted con intent='proactive_outreach' o status='proactive_review'

## Graceful Degradation

| Scenario | Comportamento |
|----------|---------------|
| REDDIT_OAUTH_TOKEN missing | Skip Reddit phase, continua HN + Mastodon |
| Gemini API down | Webhook response 500, skip scoring, log error |
| Database down | Webhook response 500, store nothing |
| Daily report missing Telegram token | Skip report, no crash |

## Metriche & Monitoring

- **Daily scanned**: Total conversazioni analizzate
- **High relevance**: Score ≥ 80
- **Drafted**: Pronto per posting (W45)
- **Review**: In attesa approval (admin panel)
- **Ignored**: Score < 60 o risk_level='high'
- **Posted**: Già inviato (updated da W45)

## Iterazioni future

1. **Multi-keyword support**: Cicla attraverso `["adblock", "ads blocking", "invasive ads", ...]` invece di hardcoded
2. **Subreddit rotation**: Ogni run seleziona subreddit diverso (round-robin)
3. **Quora integration**: Uncomment placeholder, integra con W09
4. **Competitor mentions**: Rileva se competitori (uBlock, ghostery, etc.) sono mentioned → priority boost se fit meglio
5. **User language detection**: Adatta Gemini prompt + draft_reply alla lingua della conversazione

---

**Last updated**: 2026-05-21  
**Status**: Production-ready
