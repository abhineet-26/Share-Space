-- PostgreSQL Database Initialization for SHARESPACE
-- Sets up required extensions and roles for Row-Level Security (RLS) fail-closed isolation.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sharespace_migrate') THEN
        CREATE ROLE sharespace_migrate WITH LOGIN PASSWORD 'changeme' BYPASSRLS CREATEDB;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sharespace_app') THEN
        CREATE ROLE sharespace_app WITH LOGIN PASSWORD 'changeme' NOBYPASSRLS;
    END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE sharespace TO sharespace_migrate;
GRANT ALL ON SCHEMA public TO sharespace_migrate;
GRANT ALL ON SCHEMA public TO sharespace_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sharespace_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sharespace_app;
