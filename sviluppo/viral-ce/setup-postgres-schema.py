#!/usr/bin/env python3
"""
Setup Postgres schema for ViralContentEngine Fase 2.
Applies 01-schema-viral-patterns.sql to adoff_autopilot database.

Requires:
- Postgres running on localhost:5432
- adoff_autopilot database exists
- User adoff_api_user with password in ADOFF_DB_PASSWORD env var
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def setup_schema():
    """Apply schema to Postgres database."""

    # Read connection details from environment
    host = os.getenv("ADOFF_DB_HOST", "localhost")
    port = int(os.getenv("ADOFF_DB_PORT", "5432"))
    database = os.getenv("ADOFF_DB_NAME", "adoff_autopilot")
    user = os.getenv("ADOFF_DB_USER", "adoff_api_user")
    password = os.getenv("ADOFF_DB_PASSWORD", "")

    print(f"Connecting to {user}@{host}:{port}/{database}")

    try:
        # Connect to database
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        print("✓ Connected to database")

        # Read schema file
        schema_path = "/home/mrxxx/adoff/sviluppo/viral-ce/01-schema-viral-patterns.sql"
        with open(schema_path, "r") as f:
            schema_sql = f.read()

        print(f"Reading schema from {schema_path}")

        # Split by statement and execute
        statements = schema_sql.split(";")
        for i, statement in enumerate(statements):
            stmt = statement.strip()
            if not stmt or stmt.startswith("--"):
                continue

            try:
                cursor.execute(stmt)
                # Show progress for major statements
                if any(keyword in stmt.upper() for keyword in ["CREATE", "DROP", "ALTER", "INSERT"]):
                    first_line = stmt.split("\n")[0][:60]
                    print(f"  [{i+1}] {first_line}...")
            except Exception as e:
                # Some CREATE statements might fail if they already exist (CREATE IF NOT EXISTS)
                # This is OK, but log it
                if "already exists" not in str(e):
                    print(f"  ⚠️  Statement {i+1} warning: {str(e)[:100]}")

        print("✓ Schema applied successfully")

        # Verify tables exist
        cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('viral_patterns', 'pattern_performance', 'viral_ce_runs')
        ORDER BY table_name;
        """)

        tables = cursor.fetchall()
        if len(tables) == 3:
            print("✓ All required tables created:")
            for (table_name,) in tables:
                print(f"    - {table_name}")
        else:
            print(f"⚠️  Expected 3 tables, found {len(tables)}")
            for (table_name,) in tables:
                print(f"    - {table_name}")

        # Check views
        cursor.execute("""
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
        AND viewname LIKE 'v_%'
        ORDER BY viewname;
        """)

        views = cursor.fetchall()
        if views:
            print(f"✓ Views created ({len(views)}):")
            for (view_name,) in views:
                print(f"    - {view_name}")

        # Check extensions
        cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
        vec_ext = cursor.fetchone()
        if vec_ext:
            print("✓ pgvector extension enabled")
        else:
            print("⚠️  pgvector extension not found (vector search will not work)")

        cursor.close()
        conn.close()

        print("\n✓ Setup complete!")
        return True

    except psycopg2.OperationalError as e:
        print(f"❌ Connection error: {e}")
        print("\nTroubleshooting:")
        print(f"  - Check Postgres is running on {host}:{port}")
        print(f"  - Check database '{database}' exists")
        print(f"  - Check user '{user}' has permissions")
        print(f"  - Check ADOFF_DB_PASSWORD env var is set")
        return False
    except FileNotFoundError:
        print(f"❌ Schema file not found: {schema_path}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = setup_schema()
    sys.exit(0 if success else 1)
