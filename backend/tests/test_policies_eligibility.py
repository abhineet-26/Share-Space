from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from httpx import ASGITransport

from app.core.security import create_access_token
from app.main import app
from app.services.ledger import verify_ledger_chain
from tests.conftest import AdminSessionFactory


@pytest.mark.asyncio
async def test_list_and_get_policies_tenant_isolated() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # NIT student lists policies
        token_nit = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp = await client.get(
            "/api/v1/policies",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp.status_code == 200
        policies = resp.json()
        assert len(policies) >= 2
        for p in policies:
            assert p["organizationId"] == "org_nit"

        # Harbour admin lists policies
        token_harbour = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["ADMIN"]}
        )
        resp_h = await client.get(
            "/api/v1/policies",
            headers={"Authorization": f"Bearer {token_harbour}"},
        )
        assert resp_h.status_code == 200
        for p in resp_h.json():
            assert p["organizationId"] == "org_harbour"

        # Detail of seeded policy
        resp_det = await client.get(
            "/api/v1/policies/pol_nit_elec_general",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp_det.status_code == 200
        det = resp_det.json()
        assert det["id"] == "pol_nit_elec_general"
        assert len(det["versions"]) >= 1


@pytest.mark.asyncio
async def test_create_policy_requires_role_and_emits_ledger() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Student without MANAGER/ADMIN is rejected
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        payload = {
            "name": "Weekend Robotics Access Policy",
            "description": "Governs weekend allocation for high-demand robotics workstations.",
            "scope": {
                "type": "ORG",
                "label": "All National Institute of Technology Departments",
            },
            "kind": "USAGE_CAP",
            "initialDefinition": {
                "maxHoursPerUser": 12,
                "windowDays": 7,
                "maxBookingDurationHours": 4,
                "plainSummary": "Max 12 hours weekly, 4 hours per session.",
            },
        }
        resp_denied = await client.post(
            "/api/v1/policies",
            headers={"Authorization": f"Bearer {token_student}"},
            json=payload,
        )
        assert resp_denied.status_code == 403
        assert resp_denied.json()["error"]["code"] == "FORBIDDEN"

        # 2. Admin Priya creates policy
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        resp_created = await client.post(
            "/api/v1/policies",
            headers={"Authorization": f"Bearer {token_admin}"},
            json=payload,
        )
        assert resp_created.status_code == 201
        created = resp_created.json()
        assert created["name"] == "Weekend Robotics Access Policy"
        assert created["activeVersion"] == 1
        assert len(created["versions"]) == 1

    # Verify ledger integrity
    async with AdminSessionFactory() as session:
        ledger_res = await verify_ledger_chain(session, "org_nit")
        assert ledger_res["valid"] is True


@pytest.mark.asyncio
async def test_create_version_and_activate_with_reason() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )

        # 1. Add version 2
        resp_v2 = await client.post(
            "/api/v1/policies/pol_nit_elec_general/versions",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={
                "definition": {
                    "maxBookingDurationHours": 6,
                    "minLeadTimeHours": 2,
                    "plainSummary": "Updated session limit to 6 hours with 2h lead time.",
                },
                "reason": "Adjusted session limits based on mid-semester lab utilization.",
            },
        )
        assert resp_v2.status_code == 201
        v2 = resp_v2.json()
        assert v2["version"] == 2

        # 2. Activate without reason is rejected
        resp_act_empty = await client.post(
            "/api/v1/policies/pol_nit_elec_general/activate",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={"version": 2, "reason": ""},
        )
        assert resp_act_empty.status_code == 422
        assert resp_act_empty.json()["error"]["code"] == "REASON_REQUIRED"

        # 3. Activate with reason succeeds
        resp_act = await client.post(
            "/api/v1/policies/pol_nit_elec_general/activate",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={
                "version": 2,
                "reason": "Approved by Academic Affairs Committee for mid-term access.",
            },
        )
        assert resp_act.status_code == 200
        act_data = resp_act.json()
        assert act_data["activeVersion"] == 2
        assert act_data["status"] == "ACTIVE"

    # Verify ledger chain
    async with AdminSessionFactory() as session:
        ledger_res = await verify_ledger_chain(session, "org_nit")
        assert ledger_res["valid"] is True


@pytest.mark.asyncio
async def test_policy_preview_simulation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        resp = await client.post(
            "/api/v1/policies/pol_nit_elec_general/preview",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={"version": 1, "reason": "Testing dry-run before activation."},
        )
        assert resp.status_code == 200
        preview = resp.json()
        assert "beforeResult" in preview
        assert "afterResult" in preview
        assert "sampleUser" in preview
        assert "sampleResource" in preview


@pytest.mark.asyncio
async def test_eligibility_evaluation_passes_all_checks() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Aarav has verified training for electronics bench
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(days=2)).isoformat()
        end_time = (now + timedelta(days=2, hours=3)).isoformat()

        resp = await client.post(
            "/api/v1/bookings/eligibility-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["eligible"] is True
        assert result["overallStatus"] in ["ELIGIBLE", "REVIEW_REQUIRED"]
        assert len(result["checks"]) >= 6

        # Check keys presence
        check_keys = [c["key"] for c in result["checks"]]
        assert "account_verified" in check_keys
        assert "institution_membership" in check_keys
        assert "resource_status" in check_keys
        assert "time_validity" in check_keys
        assert "time_conflict" in check_keys


@pytest.mark.asyncio
async def test_eligibility_blocks_missing_training() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Diya does NOT have verified 3D printer safety induction
        token = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(days=3)).isoformat()
        end_time = (now + timedelta(days=3, hours=2)).isoformat()

        resp = await client.post(
            "/api/v1/bookings/eligibility-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_3dprint",
                "start": start_time,
                "end": end_time,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["eligible"] is False
        assert result["overallStatus"] == "NOT_ELIGIBLE"

        tr_check = next(
            (c for c in result["checks"] if c["key"] in ["TRAINING_3D_CERT", "tr_3dprint_safety"]),
            None,
        )
        assert tr_check is not None
        assert tr_check["status"] == "FAIL"
        assert tr_check["nextStep"] is not None


@pytest.mark.asyncio
async def test_eligibility_flags_concurrency_conflict() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        # bkg_aarav_scope_approved is seeded at now + 2h to now + 5h
        now = datetime.now(UTC)
        start_time = (now + timedelta(hours=3)).isoformat()
        end_time = (now + timedelta(hours=4)).isoformat()

        resp = await client.post(
            "/api/v1/bookings/eligibility-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        conflict_check = next((c for c in result["checks"] if c["key"] == "time_conflict"), None)
        assert conflict_check is not None
        assert conflict_check["status"] == "REVIEW_REQUIRED"
        assert "waitlist" in conflict_check["reason"].lower()


@pytest.mark.asyncio
async def test_eligibility_blocks_session_duration_exceeded() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        now = datetime.now(UTC)
        start_time = (now + timedelta(days=4)).isoformat()
        # 10 hours requested (policy limit is 8 hours)
        end_time = (now + timedelta(days=4, hours=10)).isoformat()

        resp = await client.post(
            "/api/v1/bookings/eligibility-check",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "resourceId": "res_scope",
                "start": start_time,
                "end": end_time,
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["eligible"] is False
        assert result["overallStatus"] == "NOT_ELIGIBLE"
        dur_check = next((c for c in result["checks"] if c["key"] == "session_duration"), None)
        assert dur_check is not None
        assert dur_check["status"] == "FAIL"
