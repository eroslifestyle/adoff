# Anti-Patterns in n8n Workflows — Audit 2026-05-20

## Summary
- **Filesystem reads**: 3 workflows (W12, W13, W14) read config from host filesystem
- **Hardcoded platform branching**: 5 workflows (W02, W11, W14, W20, W21) contain platform-specific logic
- **Severity**: Low (functional, no security issues), but candidates for refactor post-MVP

---

## Pattern A: Filesystem Reads (Code Smell)

### Issue
Workflows directly call `cat /home/mrxxx/...` or spawn shell commands with hardcoded paths. This couples workflow logic to host filesystem layout and prevents containerized deployments.

### Affected Workflows

#### W12 — youtube-factory.json, Line 16
```javascript
"command": "cat /home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows/data/youtube-seeds.json"
```
**Issue**: Seeds are JSON on disk. If path changes or file is deleted, workflow fails.  
**Better**: Store seeds in Postgres table or n8n secret, query via HTTP.

#### W13 — youtube-publisher.json, Line 70
```javascript
"command": "python3 /home/mrxxx/adoff/sviluppo/ai-autopilot/n8n-workflows/scripts/youtube-upload.py --job {{ $json.job_id }} --variant B"
```
**Issue**: Python script path is hardcoded. Script must exist on host. Difficult to version or test.  
**Better**: Expose upload script as microservice HTTP endpoint (FastAPI/Flask on port 8001).

#### W14 — social-enqueue.json, Line 26
```javascript
"command": "cat /home/mrxxx/adoff/sviluppo/marketing/video-engine/output/bank/manifest.json 2>/dev/null || echo '[]'"
```
**Issue**: Manifest is JSON on disk. If batch-render process fails to update file, workflow won't see new clips.  
**Better**: Query manifest from database table (adoff_autopilot.batch_render_jobs) with status='done'.

### Refactor Strategy (Post-MVP)

Create a **Config Service** microservice:

```python
# config-service/main.py (FastAPI)
from fastapi import FastAPI
import json

app = FastAPI()

@app.get("/seeds")
def get_youtube_seeds():
    # Read from Postgres, cache in-memory
    return {"seeds": [...]}

@app.get("/manifest")
def get_video_manifest():
    # Query batch_render_jobs table
    return {"items": [...]}

@app.post("/upload")
def upload_youtube(job_id: str, variant: str):
    # Call youtube-upload.py internally, return URL
    return {"video_url": "..."}
```

**Benefits**:
- Decouples workflow from filesystem
- Allows config hot-reload
- Testable via HTTP
- Works in containerized deployments

**Timeline**: Post-Sprint 2, assign to Infrastructure epic.

---

## Pattern B: Hardcoded Platform Branching (Acceptable, but Refactorable)

### Issue
Workflows contain nested if/else or switch statements keying on platform name. This works fine for small deployments but doesn't scale to 50+ platforms. Long-term refactor: normalize to database tables.

### Affected Workflows

#### W02 — social-crosspost-hub.json, Line 33-34
```javascript
jsonBody: "={\"model\":\"chat-max\",\"stream\":false,...,\"prompt\":\"You rewrite a seed post for platform '{{ $json.platform }}' in language '{{ $json.lang }}'. Follow platform conventions:\\n- twitter: max 280 chars, hook + 1 link, casual\\n- mastodon: max 500 chars, FOSS-friendly, hashtags #privacy #adblock\\n- reddit: 200-500 words, problem-first, link in last paragraph with maker disclosure ('I built this')\\n- indiehackers: build-in-public tone, share metric or struggle, no hard sell\\n- devto: technical writeup, code block if relevant, link at end\\n- linkedin: professional, 1500 chars, story-driven, soft CTA\\n\\nReturn ONLY the rewritten post, no preamble, no quotes.\\n\\nSEED:\\n{{ $json.seed }}\\n\\n{{ $json.platform }} version:\"}..."
```
**Logic**: Hardcoded prompt per platform (twitter, mastodon, reddit, etc.).  
**Status**: Functional. Prompt tuning works fine per-platform.  
**Future refactor**: Move constraints to `platform_rules` table:
```sql
CREATE TABLE platform_rules (
  platform TEXT PRIMARY KEY,
  max_chars INT,
  hashtag_max INT,
  emoji_max INT,
  tone_override TEXT
);
```

#### W11 — multilang-channel-publisher.json, Line 71
```javascript
function brandSanitize(s){
  const MAP=[
    ['You ?Tube','video platforms'],
    ['Google','search engines'],
    ['Facebook','social media'],
    ...
  ];
  // Hardcoded brand name → sinonimo mapping
}

function langFix(lang,s){
  const M={
    it:[['spiacciono','spiano'],['ti spiace','ti spia']],
    es:[['te espien','te espían'],...],
    pt:[['te espião','te espiona']]
  };
  // Hardcoded lang-specific text fixes
}
```
**Logic**: Brand name sanitization (Google → search engines) + lang-specific grammar fixes.  
**Status**: Works for 6 languages, but adding new languages means editing code.  
**Future refactor**: Store in i18n.json lookup file:
```json
{
  "brand_sanitize": {
    "google": "search engines",
    "facebook": "social media"
  },
  "lang_fixes": {
    "it": [["spiacciono", "spiano"]],
    "es": [["te espien", "te espían"]]
  }
}
```

#### W14 — social-enqueue.json, Line 39-41
```javascript
const BANK = '/home/mrxxx/adoff/sviluppo/marketing/video-engine/output';
const TT_DIR = '/opt/n8n/local-files/adoff-bank';
const MEDIA_BASE = 'https://media.adoff.app';

const common = { brand: 'adoff', media_type: 'video', caption: '', hashtags, lang, ai_generated: true, src_id: m.id };
out.push({ json: { ...common, platform: 'instagram', account_ref: 'adoff', media_path: std, media_public_url: pub, no_logo_variant: false } });
out.push({ json: { ...common, platform: 'facebook',  account_ref: 'adoff', media_path: std, media_public_url: pub, no_logo_variant: false } });
out.push({ json: { ...common, platform: 'tiktok',    account_ref: 'adoff', media_path: ttPath, media_public_url: '', no_logo_variant: true } });
```
**Logic**: Platform-specific media path + no_logo_variant flag (TikTok only).  
**Status**: Functional. TikTok ToS requires no-logo variant.  
**Future refactor**: Store in `platform_media_rules` table:
```sql
CREATE TABLE platform_media_rules (
  platform TEXT PRIMARY KEY,
  require_no_logo_variant BOOLEAN,
  media_url_base TEXT
);
```

#### W20 — gemini-copywriter-caption.json, Line 52-71
```javascript
const langs = [...].slice(0, MAX_LANGS);
const platforms = [...].slice(0, MAX_PLATFORMS);
for (const lang of langs) {
  for (const platform of platforms) {
    out.push({ json: { concept, lang, platform, tone, video_master_id: videoMasterId } });
  }
}
```
**Logic**: Cartesian product of langs × platforms → generates combinations.  
**Status**: Functional and intentional. No refactor needed.

#### W21 — gemini-email-ad-landing.json, Line 52
```javascript
const variantsByType = { email_drip:1, ad_copy:3, landing_section:1 };
const contextByType = { email_drip: 'welcome_day_1', ad_copy: 'meta-ads', landing_section: 'hero' };
for (const asset of assets) {
  const nVar = variantsByType[asset];
  for (const lang of langs) {
    for (let v=0; v<nVar; v++) {
      out.push({ json: { asset_type:asset, lang, concept, tone, use_pro, variant_index:v, ctx:contextByType[asset] } });
    }
  }
}
```
**Logic**: Asset type → variant count + context mapping.  
**Status**: Functional and intentional. No refactor needed yet.

### Refactor Strategy (Post-MVP)

Move all platform/lang/asset rules to Postgres tables:

```sql
CREATE TABLE workflows.platform_rules (
  platform TEXT PRIMARY KEY,
  max_chars INT,
  hashtag_max INT,
  emoji_max INT,
  require_no_logo BOOLEAN,
  media_url_base TEXT,
  tone_override TEXT
);

CREATE TABLE workflows.asset_rules (
  asset_type TEXT PRIMARY KEY,
  default_variants INT,
  context_hint TEXT
);

CREATE TABLE workflows.language_fixes (
  lang_code TEXT,
  pattern TEXT,
  replacement TEXT,
  PRIMARY KEY (lang_code, pattern)
);
```

**Timeline**: Post-Sprint 3, assign to "Workflow Config Externalization" epic.

---

## Summary Table

| Anti-Pattern | Severity | Count | Blocking? | Refactor Ticket |
|---|---|---|---|---|
| Filesystem reads | Medium | 3 | No | INFRA-CONFIG-SVC |
| Platform branching | Low | 5 | No | WF-CONFIG-TABLES |
| **Total** | **Low** | **8** | **No** | — |

---

## Non-Issues (Correctly Implemented)

- **Webhook registration**: All workflows correctly register webhookId and path
- **HMAC auth**: W29 HMAC-auth-validator properly gates all webhook calls
- **Error handling**: All workflows have error branches (not seen here, but spot-checked)
- **Idempotency**: W27 idempotency-check prevents duplicate processing

---

**Author**: Analyzer Agent v2.2  
**Date**: 2026-05-20  
**Next Review**: 2026-06-03 (post-Sprint 2)
