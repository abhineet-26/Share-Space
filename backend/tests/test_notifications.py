from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.core.database import migration_session_factory
from app.core.security import create_access_token
from app.main import app
from app.models import OutboxEvent, OutboxStatus
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_seed() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_get_notifications_user_scoped() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_rohan = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["MANAGER", "USER"]}
        )

        resp_aarav = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        assert resp_aarav.status_code == 200
        notifs_aarav = resp_aarav.json()
        assert len(notifs_aarav) >= 1
        assert all(n["userId"] == "usr_aarav" for n in notifs_aarav)
        assert all(n["organizationId"] == "org_nit" for n in notifs_aarav)

        resp_rohan = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token_rohan}"},
        )
        assert resp_rohan.status_code == 200
        notifs_rohan = resp_rohan.json()
        assert all(n["userId"] == "usr_rohan" for n in notifs_rohan)


@pytest.mark.asyncio
async def test_mark_single_notification_read() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_kabir = create_access_token(
            {"user_id": "usr_kabir", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # 1. Aarav gets notifications
        resp = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        notifs = resp.json()
        target_id = notifs[0]["id"]

        # 2. Kabir tries to mark Aarav's notification as read -> 404
        resp_denied = await client.post(
            f"/api/v1/notifications/{target_id}/read",
            headers={"Authorization": f"Bearer {token_kabir}"},
        )
        assert resp_denied.status_code == 404

        # 3. Aarav marks as read -> 200
        resp_read = await client.post(
            f"/api/v1/notifications/{target_id}/read",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        assert resp_read.status_code == 200
        assert resp_read.json()["readAt"] is not None


@pytest.mark.asyncio
async def test_mark_all_notifications_read() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        resp_all = await client.post(
            "/api/v1/notifications/read-all",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_all.status_code == 204

        resp_verify = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        notifs = resp_verify.json()
        assert all(n["readAt"] is not None for n in notifs)


@pytest.mark.asyncio
async def test_lifecycle_booking_decision_creates_notification_and_outbox() -> None:
    from datetime import UTC, datetime, timedelta

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        now = datetime.now(UTC)
        start_time = (now + timedelta(hours=10)).isoformat()
        end_time = (now + timedelta(hours=12)).isoformat()

        # 1. Aarav creates a booking request
        resp_req = await client.post(
            "/api/v1/bookings",
            headers={"Authorization": f"Bearer {token_student}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
                "purpose": "Audio frequency filter testing and harmonic characterization",
            },
        )
        assert resp_req.status_code == 201
        booking = resp_req.json()
        booking_id = booking["id"]

        # 2. Manager approves booking with explicit reason
        resp_dec = await client.post(
            f"/api/v1/bookings/{booking_id}/decision",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={
                "decision": "APPROVED",
                "reason": "Verified induction and lab hours availability.",
            },
        )
        assert resp_dec.status_code == 200

        # 3. Aarav checks notifications: must contain the decision notification
        resp_notif = await client.get(
            "/api/v1/notifications",
            headers={"Authorization": f"Bearer {token_student}"},
        )
        assert resp_notif.status_code == 200
        notifs = resp_notif.json()
        found = any(booking_id in (n.get("relatedEntityId") or "") for n in notifs)
        assert found is True

        # 4. Check OutboxEvent in DB
        async with migration_session_factory() as db:
            stmt = select(OutboxEvent).where(OutboxEvent.event_type == "NOTIFICATION_DECISION")
            res = await db.execute(stmt)
            outbox_entries = list(res.scalars().all())
            assert len(outbox_entries) >= 1


@pytest.mark.asyncio
async def test_process_outbox_events_flushes_pending() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        resp = await client.post(
            "/api/v1/notifications/process-outbox",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "processed" in data

        async with migration_session_factory() as db:
            stmt = select(OutboxEvent).where(
                OutboxEvent.organization_id == "org_nit",
                OutboxEvent.status == OutboxStatus.PENDING,
            )
            res = await db.execute(stmt)
            pending = list(res.scalars().all())
            assert len(pending) == 0
