#!/usr/bin/env python3
"""
Fase 2: Feedback Loop (W45-PATTERN-PERFORMANCE-FEEDBACK + Nightly RERANK)
Closes the self-improving loop:
  1. Link published post metrics → patterns used in generation
  2. Store engagement in pattern_performance
  3. RERANK: update viral_patterns.perf_score from real performance

This makes patterns that drove REAL engagement rank higher in future RAG retrieval,
and deprioritizes patterns that underperformed.

Two modes:
  --mode feedback : record published post performance for patterns it used
  --mode rerank   : nightly job to update perf_score from pattern_performance aggregates

Usage:
  # Record feedback when a published post's metrics arrive
  python3 06-feedback-rerank.py --mode feedback --post-id 12345 --platform tiktok \
      --pattern-ids 1,3,5 --engagement-rate 0.045 --virality-score 0.82

  # Nightly rerank (cron 22:00 UTC)
  python3 06-feedback-rerank.py --mode rerank
"""

import os
import sys
import argparse
import sqlite3
import logging
from datetime import datetime
from typing import List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_DB = os.path.expanduser(
    "~/Dropbox/1 Programmazione/Progetti/ViralContentEngine/viral_engine.db"
)

# Weight for blending real performance into perf_score (EMA-style)
# new_perf_score = (1-ALPHA)*old + ALPHA*real_avg
PERF_BLEND_ALPHA = 0.4


def record_feedback(
    db_path: str,
    post_id: str,
    platform: str,
    pattern_ids: List[int],
    engagement_rate: float,
    virality_score: float,
):
    """Record published post performance for the patterns it used."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    inserted = 0
    for pattern_id in pattern_ids:
        try:
            cursor.execute("""
            INSERT INTO pattern_performance
              (pattern_id, post_id, platform, engagement_rate, virality_score, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, (pattern_id, post_id, platform, engagement_rate, virality_score))
            inserted += 1
        except Exception as e:
            logger.error(f"Error recording feedback for pattern {pattern_id}: {e}")

    conn.commit()
    conn.close()
    logger.info(f"✓ Recorded feedback for {inserted} patterns (post {post_id})")
    return inserted


def rerank_patterns(db_path: str):
    """Nightly RERANK: update perf_score from pattern_performance aggregates.

    Uses EMA blend so perf_score evolves smoothly toward real engagement,
    keeping some weight on historical/initial scores to avoid volatility.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get patterns that have performance data
    cursor.execute("""
    SELECT
        vp.id,
        vp.perf_score AS old_score,
        AVG(pp.engagement_rate) AS avg_engagement,
        AVG(pp.virality_score) AS avg_virality,
        COUNT(pp.id) AS sample_count
    FROM viral_patterns vp
    INNER JOIN pattern_performance pp ON pp.pattern_id = vp.id
    GROUP BY vp.id
    """)

    rows = cursor.fetchall()
    updated = 0

    for pattern_id, old_score, avg_engagement, avg_virality, sample_count in rows:
        # Real performance signal: blend engagement (60%) + virality (40%)
        avg_engagement = avg_engagement or 0.0
        avg_virality = avg_virality or 0.0
        real_perf = (avg_engagement * 0.6) + (avg_virality * 0.4)

        # EMA blend with old score
        old_score = old_score if old_score is not None else 0.5
        new_score = (1 - PERF_BLEND_ALPHA) * old_score + PERF_BLEND_ALPHA * real_perf

        # Clamp to [0, 1]
        new_score = max(0.0, min(1.0, new_score))

        cursor.execute("""
        UPDATE viral_patterns
        SET perf_score = ?, last_scored_at = datetime('now')
        WHERE id = ?
        """, (new_score, pattern_id))

        updated += 1
        logger.info(
            f"  Pattern {pattern_id}: {old_score:.3f} → {new_score:.3f} "
            f"(real={real_perf:.3f}, n={sample_count})"
        )

    conn.commit()

    # Report top patterns after rerank
    cursor.execute("""
    SELECT id, pattern_type, perf_score
    FROM viral_patterns
    ORDER BY perf_score DESC
    LIMIT 5
    """)
    logger.info("Top 5 patterns after rerank:")
    for pid, ptype, score in cursor.fetchall():
        logger.info(f"  [{pid}] {ptype}: {score:.3f}")

    conn.close()
    logger.info(f"✓ Reranked {updated} patterns")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Feedback loop + pattern rerank")
    parser.add_argument("--mode", required=True, choices=["feedback", "rerank"])
    parser.add_argument("--db-path", default=DEFAULT_DB)

    # Feedback mode args
    parser.add_argument("--post-id", help="Published post ID")
    parser.add_argument("--platform", help="Platform (instagram/tiktok)")
    parser.add_argument("--pattern-ids", help="Comma-separated pattern IDs used in generation")
    parser.add_argument("--engagement-rate", type=float, help="(saves+shares)/views")
    parser.add_argument("--virality-score", type=float, help="Computed virality score")

    args = parser.parse_args()

    if not os.path.exists(args.db_path):
        logger.error(f"Database not found: {args.db_path}")
        sys.exit(1)

    if args.mode == "feedback":
        if not all([args.post_id, args.platform, args.pattern_ids,
                    args.engagement_rate is not None, args.virality_score is not None]):
            logger.error("feedback mode requires: --post-id --platform --pattern-ids --engagement-rate --virality-score")
            sys.exit(1)

        pattern_ids = [int(x.strip()) for x in args.pattern_ids.split(",")]
        record_feedback(
            db_path=args.db_path,
            post_id=args.post_id,
            platform=args.platform,
            pattern_ids=pattern_ids,
            engagement_rate=args.engagement_rate,
            virality_score=args.virality_score,
        )

    elif args.mode == "rerank":
        rerank_patterns(args.db_path)

    sys.exit(0)


if __name__ == "__main__":
    main()
