from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from httpx import ASGITransport

from app.core.security import create_access_token
from app.main import app


@pytest.mark.asyncio
async def test_create_booking_idempotency_returns_same_record() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(days=5, hours=2)).isoformat()
        end_time = (now + timedelta(days=5, hours=5)).isoformat()
        idempotency_key = "idem_aarav_capstone_001"

        payload = {
            "resourceId": "res_scope",
            "start": start_time,
            "end": end_time,
            "purpose": "Hardware sensor calibration for autonomous drone capstone project",
            "idempotencyKey": idempotency_key,
        }

        # First request
        resp1 = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert resp1.status_code == 201
        bkg1 = resp1.json()
        assert bkg1["idempotencyKey"] == idempotency_key
        assert bkg1["status"] in ["PENDING_REVIEW", "WAITLISTED"]

        # Duplicate request with same idempotency key
        resp2 = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert resp2.status_code in [200, 201]
        bkg2 = resp2.json()
        assert bkg2["id"] == bkg1["id"]
        assert bkg2["idempotencyKey"] == bkg1["idempotencyKey"]


@pytest.mark.asyncio
async def test_create_booking_purpose_validation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(days=6, hours=1)).isoformat()
        end_time = (now + timedelta(days=6, hours=3)).isoformat()

        # Purpose too short (< 8 chars)
        resp = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "test",
            },
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_booking_conflict_rejected_unless_waitlist() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Diya requests slot that overlaps bkg_aarav_scope_approved (now + 2h to now + 5h)
        token = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(hours=3)).isoformat()
        end_time = (now + timedelta(hours=4)).isoformat()

        # Without joinWaitlistIfConflict -> 409 SCHEDULE_CONFLICT
        resp_conflict = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Digital signal analysis for telecommunications lab assignment",
                "joinWaitlistIfConflict": False,
            },
        )
        assert resp_conflict.status_code == 409
        err = resp_conflict.json()
        assert "SCHEDULE_CONFLICT" in str(err)

        # With joinWaitlistIfConflict -> 201 WAITLISTED
        resp_waitlist = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Digital signal analysis for telecommunications lab assignment",
                "joinWaitlistIfConflict": True,
            },
        )
        assert resp_waitlist.status_code == 201
        data = resp_waitlist.json()
        assert data["status"] == "WAITLISTED"
        assert data["waitlistPosition"] is not None
        assert data["waitlistPosition"] >= 1


@pytest.mark.asyncio
async def test_create_booking_eligible_becomes_pending_review() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        # 3 days in the future, non-conflicting
        start_time = (now + timedelta(days=3, hours=10)).isoformat()
        end_time = (now + timedelta(days=3, hours=13)).isoformat()

        resp = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Oscilloscope frequency response verification for senior thesis",
                "projectCode": "THESIS-2026-EE",
                "teamMembers": ["Aarav Sharma", "Kavya Patel"],
            },
        )
        assert resp.status_code == 201
        booking = resp.json()
        assert booking["status"] == "PENDING_REVIEW"
        assert booking["priorityFactors"] is not None
        assert len(booking["policyVersionIds"]) > 0
        assert len(booking["eligibilityChecks"]) >= 6


@pytest.mark.asyncio
async def test_cancel_booking_permissions() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_diya = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # Diya cannot cancel Aarav's booking
        resp_forbidden = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/cancel",
            headers={"Authorization": f"Bearer {token_diya}"},
            json={"reason": "Attempting to cancel someone else's booking"},
        )
        assert resp_forbidden.status_code == 403

        # Aarav cancels own booking
        resp_cancel = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/cancel",
            headers={"Authorization": f"Bearer {token_aarav}"},
            json={"reason": "Lab project partner fell ill, rescheduling session."},
        )
        assert resp_cancel.status_code == 200
        assert resp_cancel.json()["status"] == "CANCELLED"
        assert resp_cancel.json()["decisionReason"] == "Lab project partner fell ill, rescheduling session."


@pytest.mark.asyncio
async def test_decide_booking_requires_manager_role_and_reason() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        now = datetime.now(UTC)
        create_resp = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token_student}"},
            json={
                "resourceId": "res_scope",
                "start": (now + timedelta(days=7, hours=2)).isoformat(),
                "end": (now + timedelta(days=7, hours=4)).isoformat(),
                "purpose": "Final validation of microcontroller SPI comms",
            },
        )
        assert create_resp.status_code == 201
        booking_id = create_resp.json()["id"]

        # 1. Student cannot decide bookings
        resp_denied = await client.post(
            f"/api/v1/bookings/{booking_id}/decision",
            headers={"Authorization": f"Bearer {token_student}"},
            json={"decision": "APPROVED", "reason": "Self-approving my peer"},
        )
        assert resp_denied.status_code == 403

        # 2. Reason required (>= 5 chars)
        resp_short_reason = await client.post(
            f"/api/v1/bookings/{booking_id}/decision",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={"decision": "APPROVED", "reason": "ok"},
        )
        assert resp_short_reason.status_code == 422

        # 3. Valid decision by manager
        resp_ok = await client.post(
            f"/api/v1/bookings/{booking_id}/decision",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={
                "decision": "APPROVED",
                "reason": "Approved for robotics team sprint review during verified open hours.",
            },
        )
        assert resp_ok.status_code == 200
        res = resp_ok.json()
        assert res["status"] == "APPROVED"
        assert res["decidedBy"] == "usr_ravi"
        assert res["decisionReason"] == "Approved for robotics team sprint review during verified open hours."


@pytest.mark.asyncio
async def test_decide_booking_overlap_conflict_rejected() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_diya = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        now = datetime.now(UTC)
        wl_resp = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token_diya}"},
            json={
                "resourceId": "res_scope",
                "start": (now + timedelta(hours=3)).isoformat(),
                "end": (now + timedelta(hours=4)).isoformat(),
                "purpose": "Digital signal processing lab assignment measurement",
                "joinWaitlistIfConflict": True,
            },
        )
        assert wl_resp.status_code == 201
        waitlist_booking_id = wl_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/bookings/{waitlist_booking_id}/decision",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={
                "decision": "APPROVED",
                "reason": "Attempting to approve while Aarav's booking occupies the slot",
            },
        )
        assert resp.status_code == 409
        err = resp.json()
        assert "OVERLAP_CONFLICT" in str(err)


@pytest.mark.asyncio
async def test_get_my_bookings_and_org_bookings_isolation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        token_harbour = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["ADMIN", "USER"]}
        )

        # 1. Aarav gets only his bookings
        resp_mine = await client.get(
            "/api/v1/bookings/mine",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        assert resp_mine.status_code == 200
        mine = resp_mine.json()
        assert len(mine) >= 1
        assert all(b["userId"] == "usr_aarav" for b in mine)
        assert all("resourceName" in b for b in mine)

        # 2. Manager gets all org_nit bookings
        resp_org = await client.get(
            "/api/v1/bookings/org",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_org.status_code == 200
        org_bookings = resp_org.json()
        assert len(org_bookings) >= 4
        assert all(b["organizationId"] == "org_nit" for b in org_bookings)
        assert all("requesterName" in b for b in org_bookings)

        # 3. Cross-tenant user Rohan (org_harbour) cannot see org_nit bookings
        resp_harbour = await client.get(
            "/api/v1/bookings/org",
            headers={"Authorization": f"Bearer {token_harbour}"},
        )
        assert resp_harbour.status_code == 200
        harbour_bookings = resp_harbour.json()
        assert all(b["organizationId"] == "org_harbour" for b in harbour_bookings)


@pytest.mark.asyncio
async def test_get_booking_detail_full_graph() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp = await client.get(
            "/api/v1/bookings/bkg_aarav_scope_approved",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        assert resp.status_code == 200
        detail = resp.json()

        assert detail["booking"]["id"] == "bkg_aarav_scope_approved"
        assert detail["resource"]["id"] == "res_scope"
        assert detail["requester"]["id"] == "usr_aarav"
        assert "conditionReports" in detail
        assert "incidents" in detail
        assert "ledgerEvents" in detail
        assert len(detail["ledgerEvents"]) >= 1
        assert "competingRequests" in detail
