#!/usr/bin/env python3
"""
Fase 2: IDEATE Generation (W42-IDEATE-VIRAL backbone)
Generates 5 ultra-viral, brand-coherent briefs by synthesizing:
  - internal_learning (AdOff own post performance)
  - external_learning (viral patterns from competitor analysis, via RAG)

Pipeline:
1. get_ideate_input(pillar, platform) → RAG retrieval
2. Build IDEATE prompt (system + internal + external + task)
3. Call chat-max → generate 5 briefs JSON
4. Parse + validate briefs
5. Store in content_seeds table (for W43 downstream + W45 feedback)

Usage:
  python3 05-ideate-generate.py --pillar "privacy-awareness" --platform tiktok
"""

import os
import sys
import json
import argparse
import sqlite3
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

# Import RAG retrieval (same directory)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location(
    "ideate_rag", os.path.join(os.path.dirname(os.path.abspath(__file__)), "04-ideate-rag-retrieval.py")
)
ideate_rag = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ideate_rag)
get_ideate_input = ideate_rag.get_ideate_input


SYSTEM_PROMPT = """Tu sei un copywriter ultra-virale con il compito di generare brief per post che siano:
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

Sintetizza entrambe. Non ignorare nessuna."""


def build_ideate_prompt(ideate_input: Dict[str, Any]) -> str:
    """Build full IDEATE prompt from RAG input."""

    pillar = ideate_input["pillar"]
    platform = ideate_input["platform"]
    internal = ideate_input["internal_learning"]
    external = ideate_input["external_learning"]
    constraints = ideate_input["brand_constraints"]

    return f"""{SYSTEM_PROMPT}

---

INTERNAL LEARNING (What works for US in the last 30 days):
{json.dumps(internal, indent=2, ensure_ascii=False)}

---

EXTERNAL LEARNING (Top viral patterns from competitor analysis):
{json.dumps(external, indent=2, ensure_ascii=False)}

---

TASK:
Generate 5 hook-briefs for pillar "{pillar}" on {platform}.

Each brief MUST:
1. Incorporate 1-2 of the viral patterns above (cite pattern_type in applied_patterns)
2. Use one of the internal learning insights as the hook angle
3. Respect brand constraints: {constraints}
4. Be platform-specific ({platform} = DM-share/completion focused, NOT likes)
5. Include AI disclosure
6. Suggest format + hashtags appropriate for the pillar

Output ONLY a JSON array of 5 brief objects (no extra text):

[
  {{
    "id": "brief-001",
    "pillar": "{pillar}",
    "platform": "{platform}",
    "hook": "First 0-3s hook text...",
    "applied_patterns": ["hook", "pain_point"],
    "applied_internal_insight": "which internal learning insight used",
    "suggested_format": "Reel 15-30s / Carousel 5+ frames / etc",
    "suggested_hashtags": ["#tag1", "#tag2", "#tag3"],
    "body": "Frame-by-frame or scene-by-scene breakdown of the content...",
    "ai_disclosure": "Disclosure text",
    "notes": "Why this brief drives saves/shares. Which patterns combined and why."
  }},
  ...
]

IMPORTANT:
- Do NOT ignore external_learning patterns. These are empirically proven to drive saves/shares.
- Do NOT ignore internal_learning insights. These are what our audience responds to.
- Synthesis wins: brief combining BOTH external pattern + internal insight = highest viral probability.
- Every brief must be immediately actionable by a copywriter/designer.
- Output ONLY the JSON array, no preamble."""


def call_ideate(prompt: str, server_api_base: str, server_api_key: str) -> Optional[str]:
    """Call chat-max to generate briefs."""
    try:
        resp = requests.post(
            f"{server_api_base}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {server_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "chat-max",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.85,  # Higher temp for creative briefs
                "max_tokens": 2500,
            },
            timeout=300,
        )

        if resp.status_code != 200:
            print(f"IDEATE call failed: {resp.status_code} - {resp.text[:300]}")
            return None

        data = resp.json()
        return data["choices"][0]["message"]["content"]

    except Exception as e:
        print(f"Error calling IDEATE: {e}")
        return None


def parse_briefs(response_text: str) -> List[Dict[str, Any]]:
    """Parse JSON array of briefs from LLM response."""
    try:
        json_start = response_text.find("[")
        json_end = response_text.rfind("]") + 1
        if json_start != -1 and json_end > json_start:
            json_str = response_text[json_start:json_end]
            briefs = json.loads(json_str)
            if isinstance(briefs, list):
                return briefs
    except json.JSONDecodeError as e:
        print(f"Failed to parse briefs JSON: {e}")
        print(f"Response was: {response_text[:500]}")

    return []


def store_briefs(briefs: List[Dict[str, Any]], db_path: str, pillar: str, platform: str):
    """Store briefs in content_seeds table (creates table if needed)."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create content_seeds table if it doesn't exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS content_seeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brief_id TEXT,
        pillar TEXT,
        platform TEXT,
        hook TEXT,
        applied_patterns TEXT,
        suggested_format TEXT,
        suggested_hashtags TEXT,
        body TEXT,
        ai_disclosure TEXT,
        notes TEXT,
        full_brief TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    for brief in briefs:
        cursor.execute("""
        INSERT INTO content_seeds
          (brief_id, pillar, platform, hook, applied_patterns, suggested_format,
           suggested_hashtags, body, ai_disclosure, notes, full_brief, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            brief.get("id", ""),
            pillar,
            platform,
            brief.get("hook", ""),
            json.dumps(brief.get("applied_patterns", [])),
            brief.get("suggested_format", ""),
            json.dumps(brief.get("suggested_hashtags", [])),
            brief.get("body", ""),
            brief.get("ai_disclosure", ""),
            brief.get("notes", ""),
            json.dumps(brief, ensure_ascii=False),
        ))

    conn.commit()
    conn.close()
    print(f"✓ Stored {len(briefs)} briefs in content_seeds")


def generate_briefs(
    pillar: str,
    platform: str,
    db_path: str,
    server_api_base: str,
    server_api_key: str,
) -> List[Dict[str, Any]]:
    """Full IDEATE pipeline: RAG → prompt → generate → parse → store."""

    print(f"=== IDEATE Generation: pillar='{pillar}' platform='{platform}' ===")

    # 1. RAG retrieval
    print("1. Retrieving RAG input...")
    ideate_input = get_ideate_input(
        pillar=pillar,
        platform=platform,
        db_path=db_path,
        server_api_base=server_api_base,
        server_api_key=server_api_key,
    )
    n_patterns = len(ideate_input["external_learning"])
    print(f"   ✓ Internal: {len(ideate_input['internal_learning'])} insights | External: {n_patterns} patterns")

    # 2. Build prompt
    print("2. Building IDEATE prompt...")
    prompt = build_ideate_prompt(ideate_input)

    # 3. Call chat-max
    print("3. Calling chat-max (this may take 1-3 min)...")
    response = call_ideate(prompt, server_api_base, server_api_key)
    if not response:
        print("   ❌ IDEATE generation failed")
        return []

    # 4. Parse briefs
    print("4. Parsing briefs...")
    briefs = parse_briefs(response)
    print(f"   ✓ Parsed {len(briefs)} briefs")

    if not briefs:
        print("   ❌ No briefs parsed")
        return []

    # 5. Store briefs
    print("5. Storing briefs...")
    store_briefs(briefs, db_path, pillar, platform)

    return briefs


def main():
    parser = argparse.ArgumentParser(description="Generate viral content briefs via IDEATE")
    parser.add_argument("--pillar", required=True, help="Topic/pillar (e.g., 'privacy-awareness')")
    parser.add_argument("--platform", default="tiktok", choices=["instagram", "tiktok"])
    parser.add_argument(
        "--db-path",
        default=os.path.expanduser("~/Dropbox/1 Programmazione/Progetti/ViralContentEngine/viral_engine.db"),
    )
    parser.add_argument("--server-api", default="http://127.0.0.1:4000")
    parser.add_argument("--api-key", default=os.getenv("LITELLM_MASTER_KEY", ""))
    args = parser.parse_args()

    if not args.api_key:
        print("❌ LITELLM_MASTER_KEY not set")
        sys.exit(1)

    briefs = generate_briefs(
        pillar=args.pillar,
        platform=args.platform,
        db_path=args.db_path,
        server_api_base=args.server_api,
        server_api_key=args.api_key,
    )

    if briefs:
        print(f"\n=== GENERATED {len(briefs)} BRIEFS ===")
        print(json.dumps(briefs, indent=2, ensure_ascii=False))
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
