#!/usr/bin/env python3
"""
Fase 2: RAG Retrieval for IDEATE Prompt
Implements get_ideate_input() for W42-IDEATE-VIRAL workflow.

Input: pillar (topic), platform (instagram/tiktok), brand_constraints
Output: structured input for IDEATE prompt with:
  - internal_learning: top insights from AdOff's own viral posts (W40/W41 output)
  - external_learning: top-3 viral patterns from competitor signals (viral_ce.viral_patterns via vector search)
  - brand_constraints: guidelines to ensure coherence with AdOff brand

Vector search uses nomic-embed (384-dim) to find semantically similar patterns.
"""

import json
import sqlite3
import requests
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class PatternMatch:
    """Pattern from viral_patterns that matches query."""
    pattern_id: int
    platform: str
    pattern_type: str
    description: str
    examples: List[str]
    confidence: float
    perf_score: float


def get_ideate_input(
    pillar: str,
    platform: str,
    db_path: str,
    server_api_base: str,
    server_api_key: str,
    internal_learning: Optional[List[str]] = None,
    brand_constraints: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve RAG input for IDEATE prompt.

    Args:
        pillar: Topic/pillar (e.g., "productivity", "adblock-awareness")
        platform: Target platform ("instagram" or "tiktok")
        db_path: Path to SQLite database with viral_patterns table
        server_api_base: Base URL of LiteLLM Proxy (e.g., http://127.0.0.1:4000)
        server_api_key: Master key for Server Api
        internal_learning: List of insights from W40/W41 (AdOff's own learning)
        brand_constraints: Brand guidelines (tone, forbidden words, etc.)

    Returns:
        Dict with:
            - pillar
            - platform
            - internal_learning: list of insights
            - external_learning: list of top-3 patterns with examples
            - brand_constraints
    """

    # Default constraints if not provided
    if not brand_constraints:
        brand_constraints = (
            "Tone: helpful, educational, not pushy. "
            "Avoid: political topics, misinformation, aggressive language. "
            "Must mention: AdOff value prop when relevant."
        )

    # Default internal learning if not provided
    if not internal_learning:
        internal_learning = [
            "AdOff users care most about privacy and simplicity",
            "Best performing posts show before/after demo videos",
            "Educational content + light humor resonates",
            "Reel/short-form > long-form on all platforms",
        ]

    # Step 1: Retrieve external learning (patterns from viral_ce.viral_patterns)
    external_patterns = _retrieve_viral_patterns(
        pillar=pillar,
        platform=platform,
        db_path=db_path,
        server_api_base=server_api_base,
        server_api_key=server_api_key,
        top_k=3,
    )

    # Format external learning for IDEATE prompt
    external_learning = []
    for pattern in external_patterns:
        external_learning.append({
            "pattern_type": pattern.pattern_type,
            "description": pattern.description,
            "examples": pattern.examples[:2],  # Top 2 examples
            "confidence": pattern.confidence,
            "perf_score": pattern.perf_score,
        })

    return {
        "pillar": pillar,
        "platform": platform,
        "internal_learning": internal_learning,
        "external_learning": external_learning,
        "brand_constraints": brand_constraints,
    }


def _retrieve_viral_patterns(
    pillar: str,
    platform: str,
    db_path: str,
    server_api_base: str,
    server_api_key: str,
    top_k: int = 3,
) -> List[PatternMatch]:
    """
    Retrieve top-K viral patterns from database via vector similarity search.

    Strategy:
    1. Generate embedding for pillar via nomic-embed
    2. Query viral_patterns for platform
    3. Calculate cosine similarity (simplified: Euclidean distance on normalized vectors)
    4. Return top-K by similarity + perf_score

    For production (Postgres): use pgvector native <-> operator.
    For spike (SQLite): use Python-side similarity calculation.
    """

    # Generate embedding for pillar
    query_embedding = _embed_text(pillar, server_api_base, server_api_key)
    if not query_embedding:
        # Fallback: return top patterns by perf_score
        return _get_top_patterns_by_score(db_path, platform, top_k)

    # Retrieve patterns from DB
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, platform, pattern_type, description, examples, embedding, perf_score
    FROM viral_patterns
    WHERE platform = ?
    ORDER BY perf_score DESC
    LIMIT 100
    """, (platform,))

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

    # Calculate similarity for each pattern
    scored_patterns = []
    for row in rows:
        pattern_embedding = None
        if row["embedding"]:
            try:
                pattern_embedding = json.loads(row["embedding"])
            except:
                pass

        # Similarity score (cosine similarity on normalized vectors)
        similarity = 0.0
        if pattern_embedding:
            similarity = _cosine_similarity(query_embedding, pattern_embedding)

        # Combined score: 70% similarity + 30% perf_score
        combined_score = (similarity * 0.7) + (row["perf_score"] * 0.3)

        try:
            examples = json.loads(row["examples"]) if row["examples"] else []
        except:
            examples = []

        pattern = PatternMatch(
            pattern_id=row["id"],
            platform=row["platform"],
            pattern_type=row["pattern_type"],
            description=row["description"],
            examples=examples,
            confidence=similarity,  # Use similarity as confidence
            perf_score=row["perf_score"],
        )
        scored_patterns.append((combined_score, pattern))

    # Sort by combined score and return top-K
    scored_patterns.sort(key=lambda x: x[0], reverse=True)
    return [p for _, p in scored_patterns[:top_k]]


def _get_top_patterns_by_score(
    db_path: str,
    platform: str,
    top_k: int = 3,
) -> List[PatternMatch]:
    """Fallback: get top patterns by perf_score when vector search fails."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, platform, pattern_type, description, examples, perf_score
    FROM viral_patterns
    WHERE platform = ?
    ORDER BY perf_score DESC
    LIMIT ?
    """, (platform, top_k))

    patterns = []
    for row in cursor.fetchall():
        try:
            examples = json.loads(row["examples"]) if row["examples"] else []
        except:
            examples = []

        patterns.append(PatternMatch(
            pattern_id=row["id"],
            platform=row["platform"],
            pattern_type=row["pattern_type"],
            description=row["description"],
            examples=examples,
            confidence=0.5,
            perf_score=row["perf_score"],
        ))

    conn.close()
    return patterns


def _embed_text(text: str, server_api_base: str, server_api_key: str) -> Optional[List[float]]:
    """Generate embedding for text via Server Api nomic-embed."""
    try:
        resp = requests.post(
            f"{server_api_base}/v1/embeddings",
            headers={
                "Authorization": f"Bearer {server_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "nomic-embed",
                "input": text[:2000],
            },
            timeout=120,
        )

        if resp.status_code != 200:
            return None

        data = resp.json()
        return data["data"][0]["embedding"]

    except Exception as e:
        print(f"Error embedding text: {e}")
        return None


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors (0-1 normalized)."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    import math

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


# Test function
def test_get_ideate_input():
    """Test RAG retrieval with sample data."""
    db_path = "/home/mrxxx/Dropbox/1 Programmazione/Progetti/ViralContentEngine/viral_engine.db"
    server_api_base = "http://127.0.0.1:4000"
    server_api_key = "sk-bfdd4162e6e25133bc7f2b708d68b9b3ccbca46d8e51a9b8"

    result = get_ideate_input(
        pillar="privacy-awareness",
        platform="tiktok",
        db_path=db_path,
        server_api_base=server_api_base,
        server_api_key=server_api_key,
    )

    print("=== IDEATE INPUT ===")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    test_get_ideate_input()
