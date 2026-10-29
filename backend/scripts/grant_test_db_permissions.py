"""Grant permissions on all created tables to sharespace_app."""

from __future__ import annotations

import os
import sys

import psycopg2


def main() -> None:
    sync_url = os.environ.get(
        "SYNC_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/sharespace_test",
    )
    if sync_url.startswith("postgresql+psycopg2://"):
        sync_url = sync_url.replace("postgresql+psycopg2://", "postgresql://", 1)

    try:
        conn = psycopg2.connect(sync_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sharespace_app') THEN
                    GRANT USAGE ON SCHEMA public TO sharespace_app;
                    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sharespace_app;
                    REVOKE UPDATE, DELETE ON ledgerevent FROM sharespace_app;
                    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sharespace_app;
                END IF;
            END
            $$;
            """)
        conn.close()
        print("✓ Successfully granted table and sequence permissions to sharespace_app.")
    except Exception as exc:
        print(f"Error granting permissions to sharespace_app: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
