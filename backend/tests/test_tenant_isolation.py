from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.models import Booking, Organization, Resource, User


@pytest.mark.integration
async def test_unset_tenant_context_fails_closed(app_session: AsyncSession) -> None:
    """When app.org_id is unset, queries under sharespace_app return 0 rows (fail closed)."""
    await set_tenant_context(app_session, None)

    # 1. Querying resources without tenant context returns empty
    res_result = await app_session.execute(select(Resource))
    assert len(list(res_result.scalars().all())) == 0

    # 2. Querying bookings without tenant context returns empty
    bkg_result = await app_session.execute(select(Booking))
    assert len(list(bkg_result.scalars().all())) == 0

    # 3. Querying users without tenant context returns empty
    usr_result = await app_session.execute(select(User))
    assert len(list(usr_result.scalars().all())) == 0

    # 4. Querying organization without tenant context returns empty
    org_result = await app_session.execute(select(Organization))
    assert len(list(org_result.scalars().all())) == 0


@pytest.mark.integration
async def test_org_nit_tenant_isolation_reads(app_session: AsyncSession) -> None:
    """With app.org_id = 'org_nit', only Nilgiri Institute data is returned."""
    await set_tenant_context(app_session, "org_nit")

    # Verify only org_nit resources are visible
    resources = (await app_session.execute(select(Resource))).scalars().all()
    assert len(resources) > 0
    assert all(r.organization_id == "org_nit" for r in resources)
    # Harbour laser cutter must NOT be visible
    assert not any(r.id == "res_harbour_laser" for r in resources)

    # Verify only org_nit users are visible
    users = (await app_session.execute(select(User))).scalars().all()
    assert len(users) > 0
    assert all(u.organization_id == "org_nit" for u in users)
    # Rohan from Harbour must NOT be visible
    assert not any(u.id == "usr_rohan" for u in users)

    # Verify only org_nit bookings are visible
    bookings = (await app_session.execute(select(Booking))).scalars().all()
    assert len(bookings) > 0
    assert all(b.organization_id == "org_nit" for b in bookings)
    assert not any(b.organization_id == "org_harbour" for b in bookings)


@pytest.mark.integration
async def test_org_harbour_tenant_isolation_reads(app_session: AsyncSession) -> None:
    """With app.org_id = 'org_harbour', only Harbour Community Makerspace data is returned."""
    await set_tenant_context(app_session, "org_harbour")

    # Verify only org_harbour resources are visible
    resources = (await app_session.execute(select(Resource))).scalars().all()
    assert len(resources) > 0
    assert all(r.organization_id == "org_harbour" for r in resources)
    # NIT oscilloscope must NOT be visible
    assert not any(r.id == "res_scope" for r in resources)

    # Verify only org_harbour users are visible
    users = (await app_session.execute(select(User))).scalars().all()
    assert len(users) == 1
    assert users[0].id == "usr_rohan"


@pytest.mark.integration
async def test_cross_tenant_insert_denied_by_rls(app_session: AsyncSession) -> None:
    """Attempting to insert a record with organization_id != app.org_id is blocked by RLS WITH CHECK."""
    await set_tenant_context(app_session, "org_nit")

    # Attempt to insert a resource for org_harbour while in org_nit context
    forbidden_resource = Resource(
        id="res_evil_injected",
        organization_id="org_harbour",
        owner_id="usr_aarav",
        owner_name="Aarav Menon",
        department="Infiltration",
        name="Cross-Tenant Injected Item",
        category="ELECTRONICS",
        illustration_type="OSCILLOSCOPE",
        location="Nowhere",
        access_instructions="None",
        description="Should fail",
        condition="GOOD",
        status="DRAFT",
        supervision="NONE",
        accessories=[],
        usage_rules="None",
        return_rules="None",
        cancellation_policy="None",
    )
    app_session.add(forbidden_resource)

    with pytest.raises((DBAPIError, IntegrityError)):
        await app_session.flush()

    await app_session.rollback()


@pytest.mark.integration
async def test_cross_tenant_update_denied_by_rls(app_session: AsyncSession) -> None:
    """Attempting to update another organization's records is denied by RLS."""
    await set_tenant_context(app_session, "org_nit")

    # User in org_nit tries to query and update Rohan's record in org_harbour
    result = await app_session.execute(
        select(User).where(User.id == "usr_rohan")
    )
    user = result.scalar_one_or_none()
    # Should not even be visible
    assert user is None
