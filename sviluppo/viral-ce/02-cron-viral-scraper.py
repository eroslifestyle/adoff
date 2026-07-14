#!/usr/bin/env python3
"""
Fase 2: Cron job per ANALYZE di pattern virali da Fase 1 posts
Eseguito: Lunedì 10:00 UTC (configurabile in crontab)

Pipeline:
1. Leggi top-50 posts da Fase 1 posts table (SQLite spike / Postgres prod)
2. ANALYZE via Server Api: chat-max estrae hook, pain_point, structure, trend
3. Genera embedding via nomic-embed
4. Upsert in viral_patterns + viral_ce_runs log
5. Rerank patterns per perf_score

Dipendenze: VITALI
- Fase 1 posts table (SQLite spike: ~/viral_engine.db OR Postgres: adoff_autopilot)
- Server Api LiteLLM :4000 (chat-max, nomic-embed)
- ViralContentEngine PatternAnalyzer module

Configurazione: ~/.config/viral-ce/config.yaml
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
import uuid
import sqlite3
import asyncio

import requests
import yaml

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[
        logging.FileHandler("/home/mrxxx/adoff/sviluppo/viral-ce/viral-ce-scraper.log"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CONFIG_PATH = os.path.expanduser("~/.config/viral-ce/config.yaml")
DEFAULT_CONFIG = {
    "db_type": "sqlite",  # sqlite (spike) or postgres (prod)
    "posts_per_analysis": 50,
    "days_lookback": 7,  # Analyze posts from last N days
    "server_api": {
        "base_url": "http://127.0.0.1:4000",  # LiteLLM Proxy
        "master_key": os.getenv("LITELLM_MASTER_KEY", ""),
    },
    # SQLite spike (Fase 1 ViralContentEngine)
    "sqlite": {
        "db_path": os.path.expanduser("~/Dropbox/1 Programmazione/Progetti/ViralContentEngine/viral_engine.db"),
        "table": "posts",
    },
    # Postgres prod (adoff_autopilot)
    "postgres": {
        "host": "localhost",
        "port": 5432,
        "database": "adoff_autopilot",
        "user": "adoff_api_user",
        "password": os.getenv("ADOFF_DB_PASSWORD", ""),
    },
}

@dataclass
class FasePost:
    """Post from Fase 1 posts table."""
    post_id: str
    platform: str
    caption: str
    views: int
    saves: int
    shares: int
    comments_count: int
    viral_score: float
    published_at: Optional[str] = None

    def engagement_rate(self) -> float:
        """Calculate (saves + shares) / views."""
        if self.views == 0:
            return 0.0
        return (self.saves + self.shares) / self.views


class PatternSignal:
    """Pattern extracted from post (mirrors PatternAnalyzer.PatternSignal)."""
    def __init__(self, pattern_type: str, description: str, confidence: float, examples: List[str]):
        self.pattern_type = pattern_type
        self.description = description
        self.confidence = confidence
        self.examples = examples


class ViralCEScraper:
    """Analyzer for Fase 1 posts to extract viral patterns."""

    def __init__(self, config_path: str = CONFIG_PATH):
        self.config = self._load_config(config_path)
        self.db_conn = None
        self.db_type = self.config.get("db_type", "sqlite")
        self.run_id = uuid.uuid4()
        self.stats = {
            "posts_read": 0,
            "posts_analyzed": 0,
            "patterns_found": 0,
            "errors": 0,
        }

    def _load_config(self, path: str) -> Dict[str, Any]:
        """Load configuration from YAML or use defaults."""
        if os.path.exists(path):
            with open(path, "r") as f:
                config = yaml.safe_load(f) or {}
                # Merge with defaults
                for key, val in DEFAULT_CONFIG.items():
                    if key not in config:
                        config[key] = val
        else:
            logger.warning(f"Config not found at {path}, using defaults")
            config = DEFAULT_CONFIG.copy()

        # Load secrets from environment if not in config
        if not config.get("server_api", {}).get("master_key"):
            config["server_api"]["master_key"] = os.getenv("LITELLM_MASTER_KEY", "")
        if not config.get("postgres", {}).get("password"):
            config["postgres"]["password"] = os.getenv("ADOFF_DB_PASSWORD", "")

        return config

    def run(self) -> bool:
        """Execute full pipeline."""
        logger.info("=" * 70)
        logger.info(f"ViralCE Pattern Analysis Run ID: {self.run_id} (db_type={self.db_type})")
        logger.info("=" * 70)

        try:
            # 1. Connect to database
            self._connect_db()
            logger.info("✓ Database connected")

            # 2. Read Fase 1 posts
            posts = self._read_fase1_posts()
            self.stats["posts_read"] = len(posts)
            logger.info(f"✓ Read {len(posts)} posts from Fase 1")

            if not posts:
                logger.warning("No posts found, aborting run")
                self._log_run_to_db(success=False, error="No posts in Fase 1 table")
                return False

            # 3. Analyze via Server Api (ANALYZE prompt)
            patterns = self._analyze_posts(posts)
            self.stats["posts_analyzed"] = len(posts)
            self.stats["patterns_found"] = len(patterns)
            logger.info(f"✓ Analyzed {len(posts)} posts, extracted {len(patterns)} patterns")

            # 4. Generate embeddings
            patterns_with_embeddings = self._embed_patterns(patterns)
            logger.info(f"✓ Generated embeddings for {len(patterns_with_embeddings)} patterns")

            # 5. Upsert to database
            self._upsert_patterns(patterns_with_embeddings)
            logger.info(f"✓ Upserted patterns to viral_patterns table")

            # 6. Rerank existing patterns
            self._rerank_patterns()
            logger.info("✓ Reranked patterns by performance score")

            # 7. Log run
            self._log_run_to_db(success=True)
            logger.info("✓ Run completed successfully")

            return True

        except Exception as e:
            logger.error(f"Run failed: {str(e)}", exc_info=True)
            try:
                self._log_run_to_db(success=False, error=str(e))
            except:
                pass
            return False
        finally:
            if self.db_conn:
                self.db_conn.close()
                logger.info("Database connection closed")

    def _connect_db(self):
        """Connect to database (SQLite spike or Postgres prod)."""
        if self.db_type == "sqlite":
            db_config = self.config["sqlite"]
            db_path = os.path.expanduser(db_config["db_path"])
            if not os.path.exists(db_path):
                raise FileNotFoundError(f"SQLite DB not found at {db_path}")
            self.db_conn = sqlite3.connect(db_path)
            self.db_conn.row_factory = sqlite3.Row
            logger.info(f"Connected to SQLite: {db_path}")
        else:
            if not PSYCOPG2_AVAILABLE:
                raise ImportError("psycopg2 required for Postgres mode")
            db_config = self.config["postgres"]
            self.db_conn = psycopg2.connect(
                host=db_config["host"],
                port=db_config["port"],
                database=db_config["database"],
                user=db_config["user"],
                password=db_config["password"],
            )
            logger.info(f"Connected to Postgres: {db_config['database']}")

    def _read_fase1_posts(self) -> List[FasePost]:
        """Read top posts from Fase 1 posts table (SQLite spike / Postgres prod)."""
        posts = []
        days_back = self.config.get("days_lookback", 7)
        limit = self.config.get("posts_per_analysis", 50)

        try:
            if self.db_type == "sqlite":
                cursor = self.db_conn.cursor()
                # SQLite doesn't have INTERVAL, use simple date arithmetic
                cursor.execute(f"""
                SELECT
                    post_id, platform, caption, views, saves, shares,
                    comments_count, viral_score, published_at
                FROM posts
                WHERE published_at IS NULL OR published_at >= datetime('now', '-{days_back} days')
                ORDER BY viral_score DESC
                LIMIT {limit}
                """)
                rows = cursor.fetchall()
                for row in rows:
                    posts.append(FasePost(
                        post_id=row[0],  # post_id
                        platform=row[1],  # platform
                        caption=row[2],  # caption
                        views=row[3],  # views
                        saves=row[4],  # saves
                        shares=row[5],  # shares
                        comments_count=row[6],  # comments_count
                        viral_score=row[7],  # viral_score
                        published_at=row[8] if len(row) > 8 else None,  # published_at
                    ))
            else:
                cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute(f"""
                SELECT
                    post_id, platform, caption, views, saves, shares,
                    comments_count, viral_score, published_at
                FROM posts
                WHERE published_at >= NOW() - INTERVAL '{days_back} days'
                ORDER BY viral_score DESC
                LIMIT {limit}
                """)
                rows = cursor.fetchall()
                for row in rows:
                    posts.append(FasePost(
                        post_id=row["post_id"],
                        platform=row["platform"],
                        caption=row["caption"],
                        views=row["views"],
                        saves=row["saves"],
                        shares=row["shares"],
                        comments_count=row["comments_count"],
                        viral_score=row["viral_score"],
                        published_at=row.get("published_at"),
                    ))

        except Exception as e:
            logger.error(f"Error reading Fase 1 posts: {str(e)}")
            self.stats["errors"] += 1

        return posts

    def _analyze_posts(self, posts: List[FasePost]) -> List[Dict[str, Any]]:
        """Analyze posts via Server Api ANALYZE prompt to extract viral patterns."""
        patterns = []
        server_api = self.config["server_api"]
        master_key = server_api["master_key"]

        if not master_key:
            logger.error("LITELLM_MASTER_KEY not set")
            return patterns

        for post in posts:
            try:
                # Build ANALYZE prompt (same as PatternAnalyzer._build_analyze_prompt)
                analyze_prompt = f"""
Analyze this viral post and extract the key viral patterns.

**Platform**: {post.platform}
**Caption**: {post.caption[:1000]}
**Stats**: Views={post.views}, Saves={post.saves}, Shares={post.shares}, Comments={post.comments_count}, Viral Score={post.viral_score:.2f}

Identify and describe (max 200 words):
1. **Hook Pattern** (first 0-3 seconds): What captures attention immediately?
2. **Pain Point or Angle**: What problem/insight does it address?
3. **Structural Pattern**: How is the content paced/organized? (e.g., "problem → revelation → call-to-action")
4. **Trend Indicator**: Is this riding a trend? What's the underlying trend?

Respond in JSON format:
{{
  "hook": {{"description": "...", "confidence": 0.0-1.0, "examples": ["...","..."]}},
  "pain_point": {{"description": "...", "confidence": 0.0-1.0, "examples": ["...","..."]}},
  "structure": {{"description": "...", "confidence": 0.0-1.0, "examples": ["..."]}},
  "trend": {{"description": "...", "confidence": 0.0-1.0}}
}}

Be concise and specific. Confidence = how certain you are this pattern is present (0=not present, 1=very clear).
"""

                resp = requests.post(
                    f"{server_api['base_url']}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {master_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "chat-max",  # Use chat-max for analysis
                        "messages": [{"role": "user", "content": analyze_prompt}],
                        "temperature": 0.7,
                        "max_tokens": 800,
                    },
                    timeout=300,  # 5 min timeout for model inference
                )

                if resp.status_code != 200:
                    logger.warning(f"Server Api analysis failed for post {post.post_id}: {resp.status_code} - {resp.text[:200]}")
                    self.stats["errors"] += 1
                    continue

                data = resp.json()
                analysis_text = data["choices"][0]["message"]["content"]

                # Parse analysis JSON to extract pattern signals
                try:
                    json_start = analysis_text.find("{")
                    json_end = analysis_text.rfind("}") + 1
                    if json_start != -1 and json_end > json_start:
                        json_str = analysis_text[json_start:json_end]
                        analysis_data = json.loads(json_str)

                        # Extract pattern signals from JSON
                        type_map = {
                            "hook": "hook",
                            "pain_point": "pain_point",
                            "structure": "structure",
                            "trend": "trend",
                        }

                        for key, pattern_type in type_map.items():
                            if key in analysis_data:
                                pattern_data = analysis_data[key]
                                if isinstance(pattern_data, dict) and pattern_data.get("description"):
                                    pattern = {
                                        "post_id": post.post_id,
                                        "platform": post.platform,
                                        "pattern_type": pattern_type,
                                        "description": pattern_data.get("description", ""),
                                        "confidence": float(pattern_data.get("confidence", 0.5)),
                                        "examples": pattern_data.get("examples", []),
                                        "caption": post.caption,
                                        "analysis": analysis_text,
                                        "perf_score": post.engagement_rate(),
                                        "viral_score": post.viral_score,
                                    }
                                    patterns.append(pattern)

                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON from analysis: {analysis_text[:200]}")
                    self.stats["errors"] += 1

            except Exception as e:
                logger.error(f"Error analyzing post {post.post_id}: {str(e)}")
                self.stats["errors"] += 1

        return patterns

    def _embed_patterns(self, patterns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate embeddings for patterns via Server Api nomic-embed."""
        server_api = self.config["server_api"]
        master_key = server_api["master_key"]

        for pattern in patterns:
            try:
                # Embed description (core pattern info)
                text_to_embed = pattern.get("description", "")[:2000]

                if not text_to_embed:
                    pattern["embedding"] = None
                    continue

                resp = requests.post(
                    f"{server_api['base_url']}/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {master_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "nomic-embed",
                        "input": text_to_embed,
                    },
                    timeout=120,  # 2 min timeout for embeddings
                )

                if resp.status_code != 200:
                    logger.warning(f"Embedding failed for pattern {pattern['pattern_type']}: {resp.status_code}")
                    pattern["embedding"] = None
                    continue

                data = resp.json()
                pattern["embedding"] = data["data"][0]["embedding"]

            except Exception as e:
                logger.error(f"Error embedding pattern: {str(e)}")
                pattern["embedding"] = None

        return patterns

    def _upsert_patterns(self, patterns: List[Dict[str, Any]]):
        """Insert patterns into viral_patterns table (SQLite spike / Postgres prod)."""

        for pattern in patterns:
            try:
                embedding_val = None
                if pattern.get("embedding"):
                    embedding_val = json.dumps(pattern["embedding"]) if self.db_type == "sqlite" else pattern["embedding"]

                if self.db_type == "sqlite":
                    cursor = self.db_conn.cursor()
                    cursor.execute("""
                    INSERT OR IGNORE INTO viral_patterns
                      (source, platform, pattern_type, description, examples, perf_score, embedding, created_at)
                    VALUES
                      (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    """, (
                        f"fase1_{pattern['platform']}",
                        pattern["platform"],
                        pattern["pattern_type"],
                        pattern.get("description", "")[:500],
                        json.dumps(pattern.get("examples", [])),
                        pattern.get("perf_score", 0.0),
                        embedding_val,
                    ))
                else:
                    cursor = self.db_conn.cursor()
                    cursor.execute("""
                    INSERT INTO viral_patterns
                      (source, platform, pattern_type, description, examples, perf_score, embedding, created_at)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT DO NOTHING;
                    """, (
                        f"fase1_{pattern['platform']}",
                        pattern["platform"],
                        pattern["pattern_type"],
                        pattern.get("description", "")[:500],
                        json.dumps(pattern.get("examples", [])),
                        pattern.get("perf_score", 0.0),
                        embedding_val,
                    ))

            except Exception as e:
                logger.error(f"Error upserting pattern: {str(e)}")
                self.stats["errors"] += 1

        self.db_conn.commit()

    def _rerank_patterns(self):
        """Update perf_score for existing patterns based on pattern_performance data."""
        cursor = self.db_conn.cursor()

        try:
            if self.db_type == "sqlite":
                cursor.execute("""
                UPDATE viral_patterns
                SET perf_score = (
                  SELECT AVG(engagement_rate)
                  FROM pattern_performance
                  WHERE pattern_id = viral_patterns.id
                ),
                last_scored_at = datetime('now')
                WHERE EXISTS (
                  SELECT 1 FROM pattern_performance WHERE pattern_id = viral_patterns.id
                )
                AND (last_scored_at IS NULL OR last_scored_at < datetime('now', '-7 days'))
                """)
            else:
                cursor.execute("""
                UPDATE viral_patterns
                SET perf_score = (
                  SELECT AVG(engagement_rate)
                  FROM pattern_performance
                  WHERE pattern_id = viral_patterns.id
                ),
                last_scored_at = NOW()
                WHERE EXISTS (
                  SELECT 1 FROM pattern_performance WHERE pattern_id = viral_patterns.id
                )
                AND (last_scored_at IS NULL OR last_scored_at < NOW() - INTERVAL '7 days')
                """)

            self.db_conn.commit()
            logger.info("Reranked patterns by performance")

        except Exception as e:
            logger.error(f"Error reranking patterns: {str(e)}")

    def _log_run_to_db(self, success: bool = True, error: Optional[str] = None):
        """Log this run to viral_ce_runs table."""
        cursor = self.db_conn.cursor()

        try:
            if self.db_type == "sqlite":
                cursor.execute("""
                INSERT INTO viral_ce_runs
                  (run_type, platform, posts_read, posts_analyzed, patterns_found,
                   success, error_message, completed_at)
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """, (
                    "pattern-analysis",
                    "all",
                    self.stats["posts_read"],
                    self.stats["posts_analyzed"],
                    self.stats["patterns_found"],
                    success,
                    error,
                ))
            else:
                cursor.execute("""
                INSERT INTO viral_ce_runs
                  (run_type, platform, posts_read, posts_analyzed, patterns_found,
                   success, error_message, completed_at)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    "pattern-analysis",
                    "all",
                    self.stats["posts_read"],
                    self.stats["posts_analyzed"],
                    self.stats["patterns_found"],
                    success,
                    error,
                ))

            self.db_conn.commit()

        except Exception as e:
            logger.error(f"Error logging run: {str(e)}")


def main():
    """Entry point for cron job."""
    scraper = ViralCEScraper()
    success = scraper.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
