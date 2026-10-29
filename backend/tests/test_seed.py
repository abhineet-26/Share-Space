from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Booking,
    ConditionReport,
    Incident,
    LedgerEvent,
    Organization,
    Policy,
    PolicyVersion,
    Resource,
    User,
)
from scripts.seed import seed_database


@pytest.mark.integration
async def test_seed_repeatability(admin_session: AsyncSession) -> None:
    """Running seed multiple times clears and re-populates data cleanly without foreign key or constraint errors."""
    await seed_database(admin_session)
    await seed_database(admin_session)

    # 1. Organizations
    orgs = (await admin_session.execute(select(Organization))).scalars().all()
    assert len(orgs) == 2
    org_ids = {o.id for o in orgs}
    assert "org_nit" in org_ids
    assert "org_harbour" in org_ids

    # 2. Users
    users = (await admin_session.execute(select(User))).scalars().all()
    assert len(users) == 7
    user_ids = {u.id for u in users}
    assert {"usr_aarav", "usr_diya", "usr_kabir", "usr_meera", "usr_ravi", "usr_priya", "usr_rohan"}.issubset(user_ids)

    # 3. Resources
    resources = (await admin_session.execute(select(Resource))).scalars().all()
    assert len(resources) >= 11

    # 4. Bookings
    bookings = (await admin_session.execute(select(Booking))).scalars().all()
    assert len(bookings) >= 7

    # 5. Policies & Versions
    policies = (await admin_session.execute(select(Policy))).scalars().all()
    assert len(policies) >= 2
    versions = (await admin_session.execute(select(PolicyVersion))).scalars().all()
    assert len(versions) >= 2

    # 6. Condition reports & Incidents
    crs = (await admin_session.execute(select(ConditionReport))).scalars().all()
    assert len(crs) >= 2
    incidents = (await admin_session.execute(select(Incident))).scalars().all()
    assert len(incidents) >= 1

    # 7. Ledger events
    ledger_events = (await admin_session.execute(select(LedgerEvent))).scalars().all()
    assert len(ledger_events) >= 5
