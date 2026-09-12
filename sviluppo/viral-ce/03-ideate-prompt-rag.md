# IDEATE Prompt — ViralContentEngine Integration (Fase 1)

## Context

This prompt is used by AdOff's content factory (n8n workflow W42-IDEATE-VIRAL) to generate ultra-viral, brand-coherent briefs. It integrates two sources of instruction:
1. **Internal learning** (W40/W41 + marketing_config): own post performance, topic scores, best times, hashtags
2. **External learning** (ViralCE + viral_patterns KB): competitor viral patterns, extracted structures, proven hooks

The LLM sees BOTH the internal learning (what works for us) and external patterns (what works in the wild), and synthesizes them into briefs that are BOTH high-probability viral AND on-brand.

## System Prompt

```
Tu sei un copywriter ultra-virale con il compito di generare brief per post che siano:
1. IMPOSSIBILI DA IGNORARE sul feed (hooking primo 0-3s, curiosità, emotional resonance)
2. COERENTI CON IL BRAND (no brand reali, AI disclosure, voce coerente, vincoli Bibbia)
3. FATTI PER GENERARE SENDS/SHARES, non like (audience selection + pain/pleasure toggle)

Non generi contenuti. Generi BRIEF strutturati per copywriter umano + image-gen + music-gen.

Conosci i pattern di viralità che funzionano VERAMENTE:
- IG: sends (DM share) è il segnale #1. Save è #2. Like è debole. Watch-time 3s hook è critico.
- TikTok: completion-rate è il segnale #1. Nicchia singola premia (no 3+ topic jump). Trending audio amplifica.

La tua istruzione permanente arriva da due fonti:
A) INTERNAL LEARNING — cosa funziona per noi negli ultimi 30 giorni
B) EXTERNAL LEARNING — pattern virali estratti da competitor top-performer (save-rate, share-rate, completion-rate driven)

Sintetizza entrambe. Non ignorare nessuna.
```

## Input Payload (JSON)

```json
{
  "pillar": "productivity",
  "target_platform": "instagram",
  "brand_constraints": {
    "no_brand_names": ["Apple", "Microsoft", "Notion"],
    "ai_disclosure_required": true,
    "founder_privacy": true,
    "voice": "conversational, contrarian, data-backed"
  },
  "internal_learning": {
    "top_topics": [
      {"topic": "productivity-systems", "score": 0.87},
      {"topic": "creator-tools", "score": 0.74},
      {"topic": "time-management", "score": 0.62}
    ],
    "best_post_times": ["Tuesday 14:00-16:00 UTC", "Thursday 18:00-20:00 UTC"],
    "winning_hashtags": ["#productivitytips", "#creatoreconomy", "#timeblocking"],
    "winning_formats": ["Carousel (5+ frames)", "Reel 15-30s", "Quote + CTA"],
    "best_engagement_hooks": [
      "contrarian take on productivity",
      "data + shocking statistic",
      "personal story + transformation"
    ]
  },
  "external_learning": {
    "top_viral_patterns_for_platform": [
      {
        "id": "pattern-001",
        "pattern_type": "hook",
        "description": "Video hook 0-3s: opening con domanda retorica + dramatic pause",
        "example_captions": [
          "Most people waste 10+ hours/week on this...",
          "Your biggest productivity killer (nobody talks about it)..."
        ],
        "perf_score_ig": 0.78,
        "perf_score_tiktok": null
      },
      {
        "id": "pattern-002",
        "pattern_type": "pain_point",
        "description": "Caption starts with relatable pain point before positioning solution",
        "example_captions": [
          "Tired of context switching?",
          "This one habit costs you $1000/month..."
        ],
        "perf_score_ig": 0.82,
        "perf_score_tiktok": null
      },
      {
        "id": "pattern-003",
        "pattern_type": "angle",
        "description": "Contrarian take that challenges status quo + data point supporting",
        "example_captions": [
          "Everyone's wrong about task management",
          "Science proves this productivity hack works"
        ],
        "perf_score_ig": 0.71,
        "perf_score_tiktok": null
      }
    ]
  }
}
```

## Prompt to LLM (via Server Api chat-max)

```
{{SYSTEM_PROMPT (above)}}

---

INTERNAL LEARNING (What works for US in the last 30 days):
{{JSON.stringify(input.internal_learning)}}

---

EXTERNAL LEARNING (Top viral patterns from competitor analysis):
{{JSON.stringify(input.external_learning)}}

---

TASK:
Generate 5 hook-briefs for pillar "{{input.pillar}}" on {{input.target_platform}}.

Each brief MUST:
1. Incorporate 1-2 of the viral patterns above (cite pattern IDs in brief)
2. Use one of the "best_engagement_hooks" from internal learning
3. Respect brand constraints: {{JSON.stringify(input.brand_constraints)}}
4. Be platform-specific ({{input.target_platform}} = DM-share focused, not likes)
5. Include AI disclosure if required
6. Suggest one of the "best_post_times" and "winning_hashtags"

Output format: JSON array of brief objects.

[
  {
    "id": "brief-001",
    "pillar": "productivity-systems",
    "platform": "instagram",
    "hook": "Most people waste 10+ hours/week on context switching. Here's the science...",
    "applied_patterns": ["pattern-002", "pattern-003"],
    "applied_internal_hook": "data + shocking statistic",
    "suggested_format": "Carousel (5+ frames)",
    "suggested_time": "Tuesday 14:00-16:00 UTC",
    "suggested_hashtags": ["#productivitytips", "#creatoreconomy", "#contextswitch"],
    "body": "Frame 1: Pain point statement + shocking stat. Frame 2-3: Contrarian explanation. Frame 4: System/framework. Frame 5: CTA + AI disclosure.",
    "ai_disclosure": "This carousel was concept-mapped with AI assistance.",
    "notes": "Combines pain-point pattern (#2, 82% IG engagement) with contrarian angle (#3, 71%). Targets save-rate via relatable pain + data credibility. No brand names. Disclosure included."
  },
  ...
]

IMPORTANT:
- Do NOT ignore external_learning patterns. These are empirically proven to drive saves/shares.
- Do NOT ignore internal_learning hooks. These are what our audience responds to.
- Synthesis wins: brief that combines BOTH external pattern + internal hook = highest viral probability.
- Every brief must be immediately actionable by a copywriter/designer.
```

## Python Helper: RAG Retrieval for IDEATE

```python
def get_ideate_input(pillar: str, target_platform: str, db_conn, api_key: str) -> Dict:
    """
    Assemble input payload for IDEATE prompt by:
    1. Fetching internal_learning from marketing_config (W41 output)
    2. Fetching external_learning by RAG from viral_patterns
    """
    
    # 1. Internal learning (from W41 marketing_config table)
    cursor = db_conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
    SELECT
      topic_scores,
      best_post_times,
      winning_hashtags,
      winning_formats,
      best_engagement_hooks
    FROM marketing_config
    WHERE topic = %s
    ORDER BY updated_at DESC
    LIMIT 1;
    """, (pillar,))
    
    internal = cursor.fetchone() or {}
    
    # 2. External learning: RAG from viral_patterns
    # A. Embed the pillar topic
    embed_resp = requests.post(
        f"{api_server}/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": "nomic-embed", "input": f"{pillar} content strategy viral"},
        timeout=10,
    )
    pillar_embedding = embed_resp.json()["data"][0]["embedding"]
    
    # B. Vector search top-3 patterns for platform
    cursor.execute("""
    SELECT
      id, pattern_type, description, example_captions,
      CASE
        WHEN %s = 'instagram' THEN perf_score_ig
        WHEN %s = 'tiktok' THEN perf_score_yt
        ELSE perf_score
      END as perf_score_platform
    FROM viral_patterns
    WHERE platform = %s
    ORDER BY embedding <-> %s::vector
    LIMIT 3;
    """, (target_platform, target_platform, target_platform, pillar_embedding))
    
    external_patterns = cursor.fetchall()
    
    return {
        "pillar": pillar,
        "target_platform": target_platform,
        "brand_constraints": {
            "no_brand_names": ["Apple", "Microsoft", "Notion", ...],  # From Bibbia
            "ai_disclosure_required": True,
            "founder_privacy": True,
            "voice": "conversational, contrarian, data-backed"
        },
        "internal_learning": internal,
        "external_learning": {
            "top_viral_patterns_for_platform": [dict(p) for p in external_patterns]
        }
    }

# Usage in n8n W42-IDEATE-VIRAL:
# briefing_input = get_ideate_input("productivity", "instagram", db, api_key)
# response = llm.chat_completions(
#     model="chat-max",
#     messages=[{"role": "user", "content": ideate_prompt_template.format(**briefing_input)}]
# )
# briefs = json.loads(response.choices[0].message.content)
```

## Integration into AdOff Content Factory

**Current workflow (W41-HOOK-BANK)**: reads static `hook-bank.json` → caption-prompt → copy generation

**New workflow (W42-IDEATE-VIRAL)**: 
1. Trigger: daily OR manual (same as W41)
2. Input: pillar, platform, brand_constraints
3. Fetch internal_learning from marketing_config
4. RAG retrieval of top-3 viral patterns from viral_patterns (vector search)
5. Call IDEATE prompt to chat-max
6. Parse output briefs
7. **Feed briefs to existing caption-prompt** (no changes to downstream)
8. Store briefs in `content_seeds` for tracking + feedback loop

**Feedback loop closure** (W45-PATTERN-PERFORMANCE-FEEDBACK):
- When published post metrics arrive (W40):
  - Link post → pattern_id used in generation
  - Collect engagement_rate, virality_score
  - Store in pattern_performance table
- Nightly RERANK (22:00 UTC):
  - Update viral_patterns.perf_score from pattern_performance aggregates
  - Patterns with high real performance → higher RAG ranking next cycle
  - Self-learning loop closes

## Key Difference from Static Hook Bank

| Aspect | Static Hook-Bank (Current) | Dynamic IDEATE w/ RAG (New) |
|--------|---------------------------|---------------------------|
| Briefs source | Hand-authored 12 templates | AI-generated from viral signals |
| Update frequency | Manual (weeks) | Automatic (daily) |
| Pattern learning | None | Internal (own posts) + External (competitor) |
| Brand safety | Manual review | Enforced in prompt + AI disclosure injection |
| Feedback | Manual notes | Automatic via pattern_performance rerank |
| Scalability | Hard cap ~50 briefs max | Unlimited (new pillar = new briefs auto-generated) |

---

## Deployment Checklist (Fase 1)

- [ ] Schema viral_patterns + pattern_performance created in Postgres
- [ ] Cron job 02-cron-viral-scraper.py schedulable (provider TBD from Fase 0)
- [ ] IDEATE prompt tested with chat-max on Server Api
- [ ] RAG retrieval function tested (vector search on viral_patterns)
- [ ] n8n W42-IDEATE-VIRAL workflow created
- [ ] Integration test: pillar → internal + external learning → 5 briefs generated → feed to caption-prompt
- [ ] Pattern_performance tracking wired in W45 (feedback loop)
- [ ] Nightly RERANK cron at 22:00 UTC
- [ ] Monitor: latency, embedding quality, pattern quality scores

---

**Status**: Fase 1 backbone complete. Ready for schema application + cron scheduling + workflow integration.
