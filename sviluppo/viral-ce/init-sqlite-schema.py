#!/usr/bin/env python3
"""
Initialize SQLite schema for ViralContentEngine Fase 2 spike.
Creates viral_patterns, pattern_performance, viral_ce_runs tables.
Safe to run multiple times (CREATE TABLE IF NOT EXISTS).
"""

import sqlite3
import os
import sys

DB_PATH = os.path.expanduser("~/Dropbox/1 Programmazione/Progetti/ViralContentEngine/viral_engine.db")

def init_schema():
    """Create Fase 2 tables in SQLite if they don't exist."""

    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        print("Run ViralContentEngine Fase 1 first to create the DB.")
        return False

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        print(f"Connecting to {DB_PATH}")

        # Create viral_patterns table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS viral_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            platform TEXT NOT NULL,
            pattern_type TEXT NOT NULL,
            description TEXT,
            examples TEXT,
            embedding TEXT,
            perf_score REAL DEFAULT 0.5,
            last_scored_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        print("✓ Created viral_patterns table")

        # Create pattern_performance table (links patterns to posts)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS pattern_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_id INTEGER NOT NULL,
            post_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            engagement_rate REAL,
            virality_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pattern_id) REFERENCES viral_patterns(id)
        )
        """)
        print("✓ Created pattern_performance table")

        # Create viral_ce_runs table (audit log)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS viral_ce_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_type TEXT,
            platform TEXT,
            posts_read INTEGER DEFAULT 0,
            posts_analyzed INTEGER DEFAULT 0,
            patterns_found INTEGER DEFAULT 0,
            success BOOLEAN DEFAULT 0,
            error_message TEXT,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        print("✓ Created viral_ce_runs table")

        # Create indices for common queries
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_viral_patterns_platform
        ON viral_patterns(platform)
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_viral_patterns_perf_score
        ON viral_patterns(perf_score DESC)
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_pattern_performance_pattern_id
        ON pattern_performance(pattern_id)
        """)

        print("✓ Created indices")

        conn.commit()
        conn.close()

        print(f"\n✓ Schema initialized successfully in {DB_PATH}")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    success = init_schema()
    sys.exit(0 if success else 1)
