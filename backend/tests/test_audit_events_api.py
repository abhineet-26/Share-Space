from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport

from app.core.database import migration_session_factory
from app.core.security import create_access_token
from app.main import app
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_seed() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_list_audit_events_tenant_isolation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_nit = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_harbour = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["MANAGER", "USER"]}
        )

        resp_nit = await client.get(
            "/api/v1/audit-events",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp_nit.status_code == 200
        data_nit = resp_nit.json()
        assert len(data_nit["events"]) >= 4
        assert all(e["organizationId"] == "org_nit" for e in data_nit["events"])
        assert data_nit["headSeq"] >= 4
        assert len(data_nit["headHash"]) == 64

        resp_harbour = await client.get(
            "/api/v1/audit-events",
            headers={"Authorization": f"Bearer {token_harbour}"},
        )
        assert resp_harbour.status_code == 200
        data_harbour = resp_harbour.json()
        assert len(data_harbour["events"]) >= 1
        assert all(e["organizationId"] == "org_harbour" for e in data_harbour["events"])


@pytest.mark.asyncio
async def test_filter_audit_events_by_type_and_entity() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # 1. Filter by entity_type=RESOURCE
        resp_res = await client.get(
            "/api/v1/audit-events?entity_type=RESOURCE",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_res.status_code == 200
        events_res = resp_res.json()["events"]
        assert len(events_res) > 0
        assert all(e["entityType"] == "RESOURCE" for e in events_res)

        # 2. Filter by action substring
        resp_act = await client.get(
            "/api/v1/audit-events?action=PUBLISHED",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_act.status_code == 200
        events_act = resp_act.json()["events"]
        assert all("PUBLISHED" in e["action"] for e in events_act)


@pytest.mark.asyncio
async def test_verify_clean_chain_succeeds() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )

        resp = await client.get(
            "/api/v1/audit-events/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        res = resp.json()
        assert res["valid"] is True
        assert res["checkedCount"] >= 4
        assert res["firstInvalidSeq"] is None
        assert res["headSeq"] >= 4
        assert len(res["headHash"]) == 64
        assert res["verifiedAt"] is not None


@pytest.mark.asyncio
async def test_simulate_tamper_and_instant_detection() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # 1. Student cannot trigger simulate-tamper
        resp_denied = await client.post(
            "/api/v1/audit-events/simulate-tamper",
            headers={"Authorization": f"Bearer {token_student}"},
        )
        assert resp_denied.status_code == 403

        # 2. Manager triggers simulate-tamper
        resp_tamper = await client.post(
            "/api/v1/audit-events/simulate-tamper",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_tamper.status_code == 200
        tampered_seq = resp_tamper.json()["tamperedSeq"]
        assert tampered_seq > 0

        # 3. Verify immediately flags the exact sequence number
        resp_verify = await client.get(
            "/api/v1/audit-events/verify",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_verify.status_code == 200
        ver = resp_verify.json()
        assert ver["valid"] is False
        assert ver["firstInvalidSeq"] == tampered_seq
        assert "Hash integrity failure" in ver["errorDetails"]


@pytest.mark.asyncio
async def test_repair_chain_restores_integrity() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # 1. Tamper
        await client.post(
            "/api/v1/audit-events/simulate-tamper",
            headers={"Authorization": f"Bearer {token_manager}"},
        )

        # 2. Repair
        resp_repair = await client.post(
            "/api/v1/audit-events/repair",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_repair.status_code == 200
        repaired = resp_repair.json()
        assert repaired["valid"] is True
        assert repaired["firstInvalidSeq"] is None

        # 3. Re-verify
        resp_verify = await client.get(
            "/api/v1/audit-events/verify",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_verify.status_code == 200
        assert resp_verify.json()["valid"] is True
