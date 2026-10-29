"""Initialize PostgreSQL roles and extensions for test database."""

from __future__ import annotations

import os
import sys

import psycopg2


def main() -> None:
    sync_url = os.environ.get(
        "SYNC_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/sharespace_test",
    )
    # Ensure psycopg2-compatible connection string
    if sync_url.startswith("postgresql+psycopg2://"):
        sync_url = sync_url.replace("postgresql+psycopg2://", "postgresql://", 1)

    try:
        conn = psycopg2.connect(sync_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
            cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sharespace_app') THEN
                    CREATE ROLE sharespace_app WITH LOGIN PASSWORD 'changeme' NOBYPASSRLS;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sharespace_migrate') THEN
                    CREATE ROLE sharespace_migrate WITH LOGIN PASSWORD 'changeme' BYPASSRLS CREATEDB;
                END IF;
            END
            $$;
            """)
            cur.execute("GRANT ALL ON SCHEMA public TO sharespace_app;")
            cur.execute("GRANT ALL ON SCHEMA public TO sharespace_migrate;")
            cur.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sharespace_app;"
            )
            cur.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sharespace_app;"
            )
        conn.close()
        print("✓ Successfully initialized PostgreSQL extensions and roles (sharespace_app).")
    except Exception as exc:
        print(f"Error initializing test database: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
