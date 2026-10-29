from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.core.database import migration_session_factory
from app.core.security import create_access_token
from app.main import app
from app.models import LedgerEvent, TrainingRecord
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_seed() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_get_utilisation_analytics_tenant_scoped() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_nit = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        token_harbour = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["MANAGER", "USER"]}
        )

        resp_nit = await client.get(
            "/api/v1/analytics/utilisation",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp_nit.status_code == 200
        data_nit = resp_nit.json()

        # Check sections exist
        assert "resourceMetrics" in data_nit
        assert "fairnessByUser" in data_nit
        assert "demandByHourBlock" in data_nit
        assert "outcomeCounts" in data_nit

        # Check tenant isolation
        res_ids_nit = [r["resourceId"] for r in data_nit["resourceMetrics"]]
        assert "res_scope" in res_ids_nit
        assert "res_harbour_laser" not in res_ids_nit

        # Harbour tenant isolation
        resp_harbour = await client.get(
            "/api/v1/analytics/utilisation",
            headers={"Authorization": f"Bearer {token_harbour}"},
        )
        assert resp_harbour.status_code == 200
        data_harbour = resp_harbour.json()
        res_ids_harbour = [r["resourceId"] for r in data_harbour["resourceMetrics"]]
        assert "res_harbour_laser" in res_ids_harbour
        assert "res_scope" not in res_ids_harbour


@pytest.mark.asyncio
async def test_utilisation_calculation_accuracy() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_nit = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        resp = await client.get(
            "/api/v1/analytics/utilisation",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp.status_code == 200
        data = resp.json()

        # Check fairness by user: students should have requests count > 0
        fairness = data["fairnessByUser"]
        assert len(fairness) > 0
        assert any(u["userId"] == "usr_aarav" for u in fairness)

        # Check outcome counts: should have counts for seeded bookings
        outcomes = {o["status"]: o["count"] for o in data["outcomeCounts"]}
        assert "APPROVED" in outcomes or "CLOSED" in outcomes or "CHECKED_OUT_TO_USER" in outcomes


@pytest.mark.asyncio
async def test_export_utilisation_csv() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # Student denied export
        resp_denied = await client.get(
            "/api/v1/analytics/export",
            headers={"Authorization": f"Bearer {token_student}"},
        )
        assert resp_denied.status_code == 403

        # Manager export succeeds
        resp = await client.get(
            "/api/v1/analytics/export",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert "attachment" in resp.headers["content-disposition"]

        csv_text = resp.text
        assert (
            "Resource ID,Resource Name,Category,Booked Hours,Available Hours,Utilisation %,Waitlisted Requests,Incident Count"
            in csv_text
        )
        assert "res_scope" in csv_text


@pytest.mark.asyncio
async def test_admin_users_directory() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )

        # Student denied
        resp_denied = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token_student}"},
        )
        assert resp_denied.status_code == 403

        # Admin gets directory
        resp = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "trainings" in data
        assert "organization" in data
        assert data["organization"]["id"] == "org_nit"
        assert any(u["id"] == "usr_aarav" for u in data["users"])


@pytest.mark.asyncio
async def test_profile_data_and_training_request() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # 1. Get profile data
        resp_prof = await client.get(
            "/api/v1/profile/data",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_prof.status_code == 200
        prof = resp_prof.json()
        assert prof["user"]["id"] == "usr_aarav"
        assert prof["organization"]["id"] == "org_nit"
        assert "trainings" in prof
        assert "usageByResource" in prof

        # 2. Request practical verification / induction
        resp_req = await client.post(
            "/api/v1/profile/training/request",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "trainingType": "OPTICAL_TABLE_SAFETY",
                "label": "Laser & Optical Table Practical Induction",
            },
        )
        assert resp_req.status_code == 200
        tr = resp_req.json()
        assert tr["type"] == "OPTICAL_TABLE_SAFETY"
        assert tr["status"] == "PENDING"
        training_id = tr["id"]

        # 3. Check DB and Trust Ledger event
        async with migration_session_factory() as db:
            tr_record = await db.get(TrainingRecord, training_id)
            assert tr_record is not None
            assert tr_record.user_id == "usr_aarav"

            stmt = select(LedgerEvent).where(
                LedgerEvent.action == "TRAINING_ENROLLMENT_REQUESTED",
                LedgerEvent.entity_id == training_id,
            )
            res = await db.execute(stmt)
            event = res.scalar_one_or_none()
            assert event is not None
