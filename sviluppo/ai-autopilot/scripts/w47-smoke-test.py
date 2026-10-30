#!/usr/bin/env python3
"""
W47 Smoke Test — Verify DB setup and trigger manual test run
Usage: python3 w47-smoke-test.py [--setup|--test|--check]
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection (from env or defaults)
DB_HOST = os.getenv('POSTGRES_HOST', 'localhost')
DB_PORT = os.getenv('POSTGRES_PORT', 5432)
DB_USER = os.getenv('POSTGRES_USER', 'n8n')
DB_PASS = os.getenv('POSTGRES_PASSWORD', '')
DB_NAME = 'adoff_autopilot'

def connect_db():
    """Connect to adoff_autopilot database"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME
        )
        return conn
    except Exception as e:
        print(f"❌ DB connection failed: {e}")
        return None

def setup_tables():
    """Run setup-w47-db.sql"""
    print("🔧 Setting up W47 database tables...")
    conn = connect_db()
    if not conn:
        return False

    try:
        cur = conn.cursor()

        # Create tables with safe ADD COLUMN IF NOT EXISTS
        cur.execute("""
        ALTER TABLE IF EXISTS adoff_autopilot.content_seeds
        ADD COLUMN IF NOT EXISTS angle VARCHAR(20) DEFAULT 'tactical',
        ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(20),
        ADD COLUMN IF NOT EXISTS estimated_score INT DEFAULT 50;
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS adoff_autopilot.news_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          content TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          used BOOLEAN DEFAULT false
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS adoff_autopilot.competitor_activity (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          competitor VARCHAR(100),
          activity_type VARCHAR(50),
          url TEXT UNIQUE,
          title TEXT,
          body TEXT,
          happened_at TIMESTAMP,
          response_idea TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS adoff_autopilot.marketing_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR(100) UNIQUE NOT NULL,
          value JSONB,
          updated_at TIMESTAMP DEFAULT NOW()
        );
        """)

        # Insert default hashtags
        cur.execute("""
        INSERT INTO adoff_autopilot.marketing_config (key, value)
        VALUES ('top_hashtags', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        """, (json.dumps(["privacy", "adblock", "browser", "security", "anti-tracking"]),))

        conn.commit()
        print("✓ Tables created/updated")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        conn.rollback()
        conn.close()
        return False

def insert_test_data():
    """Insert minimal test data for smoke test"""
    print("📝 Inserting test data...")
    conn = connect_db()
    if not conn:
        return False

    try:
        cur = conn.cursor()

        # Insert test news_event
        cur.execute("""
        INSERT INTO adoff_autopilot.news_events (title, content, created_at, used)
        VALUES (%s, %s, %s, false)
        ON CONFLICT DO NOTHING;
        """, (
            'New browser privacy features 2026-05',
            'Major browsers announce stronger ad-blocker support...',
            datetime.now() - timedelta(days=2)
        ))

        # Insert test competitor_activity
        cur.execute("""
        INSERT INTO adoff_autopilot.competitor_activity (competitor, activity_type, title, body, happened_at, created_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (url) DO NOTHING;
        """, (
            'ublock-origin',
            'release',
            'v1.60 released',
            'Added advanced filtering rules for modern ads...',
            datetime.now() - timedelta(days=5),
            datetime.now() - timedelta(days=5)
        ))

        # Ensure at least 1 seed exists
        cur.execute("""
        INSERT INTO adoff_autopilot.content_seeds (seed, angle, topic_tag, used_count, perf_score, active)
        VALUES ('bloccare popup durante visione video', 'educational', 'video-ads', 2, 0.7, true)
        ON CONFLICT DO NOTHING;
        """)

        conn.commit()
        print("✓ Test data inserted")
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Insert failed: {e}")
        conn.rollback()
        conn.close()
        return False

def check_health():
    """Check table readiness"""
    print("🏥 Checking database health...")
    conn = connect_db()
    if not conn:
        return False

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        tables = ['content_seeds', 'news_events', 'competitor_activity', 'marketing_config']
        all_good = True

        for table in tables:
            cur.execute(f"SELECT COUNT(*) as cnt FROM adoff_autopilot.{table};")
            result = cur.fetchone()
            count = result['cnt'] if result else 0
            status = "✓" if count >= 0 else "❌"
            print(f"  {status} {table}: {count} rows")

            # Check specific columns for content_seeds
            if table == 'content_seeds':
                cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='adoff_autopilot' AND table_name='content_seeds'
                ORDER BY ordinal_position;
                """)
                columns = {row['column_name'] for row in cur.fetchall()}
                required = {'seed', 'angle', 'topic_tag', 'perf_score', 'active', 'used_count'}
                missing = required - columns
                if missing:
                    print(f"    ❌ Missing columns: {missing}")
                    all_good = False

        # Check env vars
        print("\n📋 Environment variables:")
        for var in ['GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']:
            status = "✓" if os.getenv(var) else "❌"
            value = os.getenv(var, 'NOT SET')[:10] + '...' if os.getenv(var) else 'NOT SET'
            print(f"  {status} {var}: {value}")

        cur.close()
        conn.close()
        return all_good
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        conn.close()
        return False

def main():
    parser = argparse.ArgumentParser(description='W47 Smoke Test')
    parser.add_argument('--setup', action='store_true', help='Create/update tables')
    parser.add_argument('--test', action='store_true', help='Insert test data')
    parser.add_argument('--check', action='store_true', help='Check health')
    parser.add_argument('--full', action='store_true', help='Full setup + test + check')

    args = parser.parse_args()

    if not args.setup and not args.test and not args.check and not args.full:
        args.check = True  # Default to health check

    if args.full:
        args.setup = args.test = args.check = True

    all_passed = True

    if args.setup:
        if not setup_tables():
            all_passed = False

    if args.test:
        if not insert_test_data():
            all_passed = False

    if args.check:
        if not check_health():
            all_passed = False

    print("\n" + "="*50)
    if all_passed:
        print("✓ All checks passed. W47 ready for workflow import.")
        sys.exit(0)
    else:
        print("❌ Some checks failed. Review above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
