from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.core.database import migration_session_factory
from app.core.security import create_access_token
from app.main import app
from app.models import LedgerEvent
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_seed() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_waitlist_auto_promotion_on_cancellation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_diya = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_kabir = create_access_token(
            {"user_id": "usr_kabir", "organization_id": "org_nit", "roles": ["USER"]}
        )

        now = datetime.now(UTC)
        start_time = (now + timedelta(hours=3)).isoformat()
        end_time = (now + timedelta(hours=4)).isoformat()

        # 1. Diya joins waitlist for res_scope (overlaps bkg_aarav_scope_approved)
        resp_diya = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token_diya}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Digital signal processing lab assignment measurement",
                "joinWaitlistIfConflict": True,
            },
        )
        assert resp_diya.status_code == 201
        diya_bkg = resp_diya.json()
        assert diya_bkg["status"] == "WAITLISTED"
        assert diya_bkg["waitlistPosition"] == 1

        # 2. Kabir also joins waitlist
        resp_kabir = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token_kabir}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Robotics motor PWM noise measurement",
                "joinWaitlistIfConflict": True,
            },
        )
        assert resp_kabir.status_code == 201
        kabir_bkg = resp_kabir.json()
        assert kabir_bkg["status"] == "WAITLISTED"
        assert kabir_bkg["waitlistPosition"] == 2

        # 3. Aarav cancels his confirmed booking bkg_aarav_scope_approved
        resp_cancel = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/cancel",
            headers={"Authorization": f"Bearer {token_aarav}"},
            json={"reason": "Lab session finished early, releasing slot for peers."},
        )
        assert resp_cancel.status_code == 200
        assert resp_cancel.json()["status"] == "CANCELLED"

        # 4. Verify Diya is automatically promoted to PENDING_REVIEW
        resp_diya_get = await client.get(
            f"/api/v1/bookings/{diya_bkg['id']}",
            headers={"Authorization": f"Bearer {token_diya}"},
        )
        assert resp_diya_get.status_code == 200
        diya_detail = resp_diya_get.json()["booking"]
        assert diya_detail["status"] == "PENDING_REVIEW"
        assert diya_detail["waitlistPosition"] is None
        assert "Promoted" in (diya_detail["waitlistReason"] or "")

        # 5. Verify Kabir's waitlist position advanced to #1
        resp_kabir_get = await client.get(
            f"/api/v1/bookings/{kabir_bkg['id']}",
            headers={"Authorization": f"Bearer {token_kabir}"},
        )
        assert resp_kabir_get.status_code == 200
        kabir_detail = resp_kabir_get.json()["booking"]
        assert kabir_detail["status"] == "WAITLISTED"
        assert kabir_detail["waitlistPosition"] == 1

        # 6. Verify Trust Ledger recorded WAITLIST_PROMOTED event
        async with migration_session_factory() as db:
            stmt = select(LedgerEvent).where(
                LedgerEvent.action == "WAITLIST_PROMOTED",
                LedgerEvent.entity_id == diya_bkg["id"],
            )
            res = await db.execute(stmt)
            event = res.scalar_one_or_none()
            assert event is not None
            assert event.entity_type.value == "BOOKING"


@pytest.mark.asyncio
async def test_get_resource_waitlist_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        token_student = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # 1. Student is forbidden
        resp_denied = await client.get(
            "/api/v1/resources/res_camera/waitlist",
            headers={"Authorization": f"Bearer {token_student}"},
        )
        assert resp_denied.status_code == 403

        # 2. Manager succeeds
        resp = await client.get(
            "/api/v1/resources/res_camera/waitlist",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp.status_code == 200
        waitlist = resp.json()
        assert len(waitlist) >= 1
        assert waitlist[0]["status"] == "WAITLISTED"
