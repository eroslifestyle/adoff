# AdOff Marketing Config Loader (W28)

**Workflow ID:** ADOFF28CONFIGLOADER1  
**File:** `workflows/28-config-loader.json`  
**Type:** Sub-workflow (callable by Execute Sub-Workflow node or webhook)  
**Status:** Ready for integration

---

## Purpose

Centralized single source of truth for marketing configuration used across all Gemini copywriting workflows (W20/21/22/23/15). Eliminates hardcoded values and enables real-time config updates without workflow edits.

---

## Configuration Loaded

| Key | Type | Values |
|---|---|---|
| `brand_blacklist` | Array | 17 forbidden brand/platform names (YouTube, Google, Facebook, etc.) |
| `forbidden_phrases` | Array | 5 banned phrases (variations of "149 KB") |
| `lang_names` | Object | 15 language codes → display names (it/en/de/fr/es/pt/ru/ar/zh/tr/id/pl/hi/ja/ko) |
| `platform_caps` | Object | Character/hashtag limits per platform (Instagram/Facebook/TikTok) |
| `brand_voice` | Object | Tone guidelines, style flags (energica, brillante, ritmo_alto) |
| `synonyms` | Object | Brand name → safe synonym mappings for copy generation |

---

## Integration Patterns

### Pattern 1: Sub-Workflow Call (Recommended)

In any workflow, add an **Execute Sub-Workflow** node:

```
Node Type: Execute Workflow
Workflow: AdOff 28 - Config Loader
Input: { "keys": "all" }  // or ["brand_blacklist", "lang_names"] for subset
```

Output available as `$json.data`:

```javascript
// In a Code node after Execute Sub-Workflow
const config = $input.first().json.data;
const blacklist = config.brand_blacklist;  // Array of 17 strings
const forbiddenPhrases = config.forbidden_phrases;  // Array of 5 strings
const langNames = config.lang_names;  // Object: {it: "italiano", ...}
```

### Pattern 2: Webhook HTTP GET

Call via HTTP GET (e.g., from external scripts or other systems):

```bash
# Get all config
curl http://localhost:5678/webhook/adoff-marketing-config-webhook?key=all

# Get specific keys
curl 'http://localhost:5678/webhook/adoff-marketing-config-webhook?key=brand_blacklist&key=lang_names'
```

Response (JSON):

```json
{
  "ok": true,
  "timestamp": "2026-05-20T12:00:00.000Z",
  "cached_ttl_min": 10,
  "data": {
    "brand_blacklist": [...],
    "lang_names": {...},
    ...
  }
}
```

---

## Usage in W20/21/22/23/15

### Before (Hardcoded)

```javascript
// In W20/W21 copy prompt
const brandBlacklist = ["YouTube", "Google", "Facebook", ...];  // duplicated in multiple workflows
```

### After (Config-driven)

```javascript
// 1. Add Execute Sub-Workflow node (W28) before copy generation
// 2. In Code node, access config:
const config = $input.previous().json.data;
const brandBlacklist = config.brand_blacklist;

// Use in prompt validation:
if (config.forbidden_phrases.some(phrase => caption.includes(phrase))) {
  throw new Error("Forbidden phrase detected");
}
```

---

## Adding New Config Keys

1. **Edit `28-config-loader.json`** — "Load config (in-memory)" Code node
2. **Add key to `config` object:**
   ```javascript
   config.my_new_key = { ... };
   ```
3. **Test with webhook:** `?key=my_new_key`
4. **For Postgres integration:** After W28 code stabilizes, migrate to real DB query + caching layer

---

## DB Migration (Future)

Once stable, migrate from in-memory to Postgres:

```sql
CREATE TABLE marketing_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed same data as W28 code node
INSERT INTO marketing_config (key, value) VALUES
  ('brand_blacklist', '[...]'::jsonb),
  ('forbidden_phrases', '[...]'::jsonb),
  ...
```

Then replace Code node with Postgres query node:

```javascript
// Postgres Query: SELECT * FROM marketing_config WHERE key = ANY($1)
// Bind params: [requestedKeys]
// Return: array of {key, value} → transform to object
```

---

## Testing

### Smoke Test

1. Import `28-config-loader.json` into n8n
2. Activate workflow
3. Execute Manual Trigger
4. Verify output contains all 6 keys with correct values:
   - `brand_blacklist.length === 17`
   - `forbidden_phrases.length === 5`
   - `lang_names.it === "italiano"`
   - `platform_caps.tiktok.caption_max === 1500`
5. Call webhook: `curl http://localhost:5678/webhook/adoff-marketing-config-webhook?key=lang_names`
6. Verify response includes only `lang_names` subset

### Multi-key Query Test

```bash
curl 'http://localhost:5678/webhook/adoff-marketing-config-webhook?key=brand_blacklist&key=lang_names'
```

Response should include both `brand_blacklist` and `lang_names`, not others.

---

## Notes for W20/21/22/23/15 Integration

- **No changes to existing workflows yet** — this W28 is ready when workflows are refactored
- **Backward compatible:** Old hardcoded values continue to work; W28 is opt-in
- **Caching:** 10-minute TTL (defined in Code node) reduces load
- **Extensibility:** Add new keys without changing workflow logic

---

**Created:** 2026-05-20  
**Status:** Ready for import + smoke test  
**Next:** Refactor W20/21/22/23 to call W28 for config
