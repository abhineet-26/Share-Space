"""add_rls_policies_and_exclusion_constraint

Revision ID: 7663cc40d80a
Revises: 103c1705e0dc
Create Date: 2026-10-29 20:46:40.349011

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7663cc40d80a'
down_revision: str | None = '103c1705e0dc'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables with direct organization_id column
TENANT_TABLES = [
    "user",
    "trainingrecord",
    "resource",
    "asset",
    "policy",
    "policyversion",
    "booking",
    "conditionreport",
    "incident",
    "attachment",
    "ledgerevent",
    "notification",
    "outboxevent",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # 1. Enable btree_gist extension for PostgreSQL exclusion constraint
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # 2. Add start_at < end_at check constraint on booking
    op.execute(
        "ALTER TABLE booking ADD CONSTRAINT check_booking_time_range CHECK (start_at < end_at);"
    )

    # 3. Add exclusion constraint preventing overlapping confirmed bookings for the same resource
    op.execute(
        """
        ALTER TABLE booking ADD CONSTRAINT exclude_overlapping_confirmed_bookings
        EXCLUDE USING gist (
            resource_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (status IN ('APPROVED', 'CHECKED_OUT_TO_USER', 'RETURN_PENDING_CONFIRMATION', 'OVERDUE'));
        """
    )

    # 4. Protect ledgerevent from application-level UPDATE and DELETE
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_ledger_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Updates and deletions on ledgerevent are strictly prohibited';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_protect_ledger_events
        BEFORE UPDATE OR DELETE ON ledgerevent
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ledger_modification();
        """
    )

    # 5. Enable and FORCE Row-Level Security on organization table
    op.execute("ALTER TABLE organization ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE organization FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY organization_tenant_isolation ON organization
        FOR ALL
        USING (id = NULLIF(current_setting('app.org_id', true), ''))
        WITH CHECK (id = NULLIF(current_setting('app.org_id', true), ''));
        """
    )

    # 6. Enable and FORCE Row-Level Security on all direct tenant tables
    for table in TENANT_TABLES:
        table_ident = f'"{table}"' if table == "user" else table
        op.execute(f"ALTER TABLE {table_ident} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table_ident} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table_ident}
            FOR ALL
            USING (organization_id = NULLIF(current_setting('app.org_id', true), ''))
            WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), ''));
            """
        )

    # 7. Enable and FORCE RLS on relationship child tables
    # 7a. resourcerequirement
    op.execute("ALTER TABLE resourcerequirement ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE resourcerequirement FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY resourcerequirement_tenant_isolation ON resourcerequirement
        FOR ALL
        USING (EXISTS (
            SELECT 1 FROM resource r
            WHERE r.id = resourcerequirement.resource_id
            AND r.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM resource r
            WHERE r.id = resourcerequirement.resource_id
            AND r.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ));
        """
    )

    # 7b. availabilitywindow
    op.execute("ALTER TABLE availabilitywindow ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE availabilitywindow FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY availabilitywindow_tenant_isolation ON availabilitywindow
        FOR ALL
        USING (EXISTS (
            SELECT 1 FROM resource r
            WHERE r.id = availabilitywindow.resource_id
            AND r.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM resource r
            WHERE r.id = availabilitywindow.resource_id
            AND r.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ));
        """
    )

    # 7c. incidentcomment
    op.execute("ALTER TABLE incidentcomment ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE incidentcomment FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY incidentcomment_tenant_isolation ON incidentcomment
        FOR ALL
        USING (EXISTS (
            SELECT 1 FROM incident i
            WHERE i.id = incidentcomment.incident_id
            AND i.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM incident i
            WHERE i.id = incidentcomment.incident_id
            AND i.organization_id = NULLIF(current_setting('app.org_id', true), '')
        ));
        """
    )

    # 8. Grant runtime app permissions to sharespace_app role if it exists
    op.execute(
        """
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
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    op.execute("DROP TRIGGER IF EXISTS trg_protect_ledger_events ON ledgerevent;")
    op.execute("DROP FUNCTION IF EXISTS prevent_ledger_modification();")

    op.execute("DROP POLICY IF EXISTS organization_tenant_isolation ON organization;")
    op.execute("ALTER TABLE organization DISABLE ROW LEVEL SECURITY;")

    for table in TENANT_TABLES:
        table_ident = f'"{table}"' if table == "user" else table
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table_ident};")
        op.execute(f"ALTER TABLE {table_ident} DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS resourcerequirement_tenant_isolation ON resourcerequirement;")
    op.execute("ALTER TABLE resourcerequirement DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS availabilitywindow_tenant_isolation ON availabilitywindow;")
    op.execute("ALTER TABLE availabilitywindow DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS incidentcomment_tenant_isolation ON incidentcomment;")
    op.execute("ALTER TABLE incidentcomment DISABLE ROW LEVEL SECURITY;")

    op.execute("ALTER TABLE booking DROP CONSTRAINT IF EXISTS exclude_overlapping_confirmed_bookings;")
    op.execute("ALTER TABLE booking DROP CONSTRAINT IF EXISTS check_booking_time_range;")
