from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.models import Booking, BookingStatus


@pytest.mark.integration
async def test_overlapping_confirmed_bookings_rejected(app_session: AsyncSession) -> None:
    """PostgreSQL exclusion constraint rejects overlapping confirmed bookings for the same resource."""
    await set_tenant_context(app_session, "org_nit")
    now = datetime.now(UTC)

    # 1. First confirmed booking on res_scope
    booking_1 = Booking(
        id="bkg_overlap_test_1",
        organization_id="org_nit",
        resource_id="res_scope",
        user_id="usr_aarav",
        start_at=now + timedelta(days=10, hours=9),
        end_at=now + timedelta(days=10, hours=12),
        purpose="Experiment Session 1",
        status=BookingStatus.APPROVED,
        idempotency_key="idemp_overlap_1",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    app_session.add(booking_1)
    await app_session.flush()

    # 2. Second overlapping confirmed booking on the SAME resource (10:00 - 13:00 overlaps 9:00 - 12:00)
    booking_2_overlapping = Booking(
        id="bkg_overlap_test_2",
        organization_id="org_nit",
        resource_id="res_scope",
        user_id="usr_diya",
        start_at=now + timedelta(days=10, hours=10),
        end_at=now + timedelta(days=10, hours=13),
        purpose="Experiment Session 2 (conflicting)",
        status=BookingStatus.APPROVED,
        idempotency_key="idemp_overlap_2",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    app_session.add(booking_2_overlapping)

    # Exclusion constraint MUST trigger an IntegrityError / exclusion violation
    with pytest.raises((IntegrityError, DBAPIError)) as excinfo:
        await app_session.flush()

    assert "exclude_overlapping_confirmed_bookings" in str(excinfo.value).lower() or "exclusion" in str(excinfo.value).lower()
    await app_session.rollback()


@pytest.mark.integration
async def test_non_overlapping_confirmed_bookings_accepted(app_session: AsyncSession) -> None:
    """Non-overlapping confirmed bookings on the same resource succeed without conflict."""
    await set_tenant_context(app_session, "org_nit")
    now = datetime.now(UTC)

    # Slot A: 09:00 - 11:00
    bkg_a = Booking(
        id="bkg_non_overlap_a",
        organization_id="org_nit",
        resource_id="res_scope",
        user_id="usr_aarav",
        start_at=now + timedelta(days=11, hours=9),
        end_at=now + timedelta(days=11, hours=11),
        purpose="Morning Slot",
        status=BookingStatus.APPROVED,
        idempotency_key="idemp_non_overlap_a",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    # Slot B: 11:00 - 13:00 (half-open range [09:00, 11:00) and [11:00, 13:00) do NOT overlap)
    bkg_b = Booking(
        id="bkg_non_overlap_b",
        organization_id="org_nit",
        resource_id="res_scope",
        user_id="usr_diya",
        start_at=now + timedelta(days=11, hours=11),
        end_at=now + timedelta(days=11, hours=13),
        purpose="Midday Slot",
        status=BookingStatus.APPROVED,
        idempotency_key="idemp_non_overlap_b",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    app_session.add_all([bkg_a, bkg_b])
    await app_session.flush()
    await app_session.rollback()


@pytest.mark.integration
async def test_overlapping_non_confirmed_bookings_allowed(app_session: AsyncSession) -> None:
    """Overlapping bookings where one or both are in non-blocking status (e.g. WAITLISTED) succeed."""
    await set_tenant_context(app_session, "org_nit")
    now = datetime.now(UTC)

    # Confirmed booking
    bkg_confirmed = Booking(
        id="bkg_conf_slot",
        organization_id="org_nit",
        resource_id="res_camera",
        user_id="usr_aarav",
        start_at=now + timedelta(days=12, hours=14),
        end_at=now + timedelta(days=12, hours=17),
        purpose="Project Filming",
        status=BookingStatus.APPROVED,
        idempotency_key="idemp_conf_slot",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    # Waitlisted booking for the exact same slot
    bkg_waitlist = Booking(
        id="bkg_wl_slot",
        organization_id="org_nit",
        resource_id="res_camera",
        user_id="usr_diya",
        start_at=now + timedelta(days=12, hours=14),
        end_at=now + timedelta(days=12, hours=17),
        purpose="Alternative filming request",
        status=BookingStatus.WAITLISTED,
        idempotency_key="idemp_wl_slot",
        waitlist_position=1,
        policy_version_ids=[],
        eligibility_checks=[],
    )
    app_session.add_all([bkg_confirmed, bkg_waitlist])
    # Both must succeed because exclusion constraint applies ONLY WHERE status in confirmed statuses
    await app_session.flush()
    await app_session.rollback()


@pytest.mark.integration
async def test_invalid_time_range_rejected_by_check_constraint(app_session: AsyncSession) -> None:
    """Check constraint check_booking_time_range enforces start_at < end_at."""
    await set_tenant_context(app_session, "org_nit")
    now = datetime.now(UTC)

    # Start time after end time
    inverted_booking = Booking(
        id="bkg_inverted_time",
        organization_id="org_nit",
        resource_id="res_scope",
        user_id="usr_aarav",
        start_at=now + timedelta(hours=5),
        end_at=now + timedelta(hours=2),  # Invalid: end < start
        purpose="Time traveler experiment",
        status=BookingStatus.REQUESTED,
        idempotency_key="idemp_inverted_time",
        policy_version_ids=[],
        eligibility_checks=[],
    )
    app_session.add(inverted_booking)

    with pytest.raises((IntegrityError, DBAPIError)) as excinfo:
        await app_session.flush()

    assert "check_booking_time_range" in str(excinfo.value).lower()
    await app_session.rollback()
