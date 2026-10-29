from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy import select

from app.core.database import migration_session_factory
from app.core.security import create_access_token
from app.main import app
from app.models import Asset, AssetStatus, ConditionReport, LedgerEvent
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_seed() -> None:
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_check_in_requires_rules_acknowledgement() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # 1. Unacknowledged check-in rejected
        resp_reject = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/check-in",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "stage": "CHECK_IN",
                "condition": "EXCELLENT",
                "accessories": [{"name": "Passive 10:1 Probe (Keysight N2862B)", "present": True}],
                "notes": "Testing probe calibration",
                "acknowledgedRules": False,
            },
        )
        assert resp_reject.status_code == 422
        assert "ACKNOWLEDGEMENT_REQUIRED" in str(resp_reject.json())

        # 2. Acknowledged check-in succeeds
        resp_ok = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/check-in",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "stage": "CHECK_IN",
                "condition": "EXCELLENT",
                "accessories": [
                    {"name": "Passive 10:1 Probe (Keysight N2862B)", "present": True},
                    {"name": "Power Cable (IEC C13)", "present": True},
                ],
                "notes": "Verified probe integrity and power supply connection.",
                "acknowledgedRules": True,
                "photos": [
                    {
                        "fileName": "front_panel_checkin.png",
                        "dataUrl": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
                    }
                ],
            },
        )
        assert resp_ok.status_code == 200
        data = resp_ok.json()
        assert data["status"] == "CHECKED_OUT_TO_USER"

        # Verify DB condition report
        async with migration_session_factory() as db:
            cr_stmt = select(ConditionReport).where(
                ConditionReport.booking_id == "bkg_aarav_scope_approved",
                ConditionReport.stage == "CHECK_IN",
            )
            res = await db.execute(cr_stmt)
            report = res.scalar_one_or_none()
            assert report is not None
            assert report.condition.value == "EXCELLENT"
            assert len(report.attachment_ids) == 1
            assert len(report.attachment_hashes) == 1


@pytest.mark.asyncio
async def test_unsupervised_return_closes_booking_and_frees_slot() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # bkg_aarav_dmm_active is CHECKED_OUT_TO_USER on res_dmm (supervision: NONE)
        resp = await client.post(
            "/api/v1/bookings/bkg_aarav_dmm_active/return",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "stage": "RETURN",
                "condition": "GOOD",
                "accessories": [
                    {"name": "Test Leads Red/Black", "present": True},
                    {"name": "Alligator Clips Pair", "present": True},
                ],
                "notes": "Multimeter returned clean to bench drawer.",
                "acknowledgedRules": True,
            },
        )
        assert resp.status_code == 200
        bkg = resp.json()
        assert bkg["status"] == "CLOSED"

        # Verify physical asset is marked AVAILABLE
        async with migration_session_factory() as db:
            ast_stmt = select(Asset).where(Asset.resource_id == "res_dmm")
            res = await db.execute(ast_stmt)
            asset = res.scalar_one_or_none()
            assert asset is not None
            assert asset.status == AssetStatus.AVAILABLE


@pytest.mark.asyncio
async def test_supervised_return_flow_and_staff_confirmation() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_kabir", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # 1. Student cannot confirm return directly
        resp_denied = await client.post(
            "/api/v1/bookings/bkg_kabir_solder_return_pending/return-confirmation",
            headers={"Authorization": f"Bearer {token_student}"},
            json={"stage": "RETURN", "notes": "Self confirmation attempt"},
        )
        assert resp_denied.status_code == 403

        # 2. Staff confirms return
        resp_confirm = await client.post(
            "/api/v1/bookings/bkg_kabir_solder_return_pending/return-confirmation",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={"stage": "RETURN", "notes": "Inspected solder tip and ESD ground clip. Closure approved."},
        )
        assert resp_confirm.status_code == 200
        bkg = resp_confirm.json()
        assert bkg["status"] == "CLOSED"
        assert bkg["returnConfirmedBy"] == "usr_ravi"


@pytest.mark.asyncio
async def test_incident_reporting_review_and_zero_automated_penalty() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # 1. Aarav files an incident report on his booking
        resp_create = await client.post(
            "/api/v1/bookings/bkg_aarav_scope_approved/incidents",
            headers={"Authorization": f"Bearer {token_student}"},
            json={
                "category": "Damage / suspected damage",
                "description": "Probe BNC connector outer shell seems slightly loose during connection",
                "affectedPart": "Channel 1 BNC Jack",
            },
        )
        assert resp_create.status_code == 201
        incident = resp_create.json()
        incident_id = incident["id"]
        assert incident["status"] == "REPORTED"
        assert incident["requiresHumanReview"] is True

        # 2. Add discussion comment
        resp_comment = await client.post(
            f"/api/v1/incidents/{incident_id}/comments",
            headers={"Authorization": f"Bearer {token_student}"},
            json={"message": "Noticed it after unpacking from storage case; did not force the twist-lock."},
        )
        assert resp_comment.status_code == 201
        assert resp_comment.json()["authorId"] == "usr_aarav"

        # 3. Student cannot resolve incident
        resp_resolve_denied = await client.post(
            f"/api/v1/incidents/{incident_id}/resolution",
            headers={"Authorization": f"Bearer {token_student}"},
            json={
                "status": "RESOLVED",
                "resolution": "Attempting self resolution without authority",
            },
        )
        assert resp_resolve_denied.status_code == 403

        # 4. Manager resolves incident: ZERO automated penalty per RULES.md Section 8
        resp_resolve = await client.post(
            f"/api/v1/incidents/{incident_id}/resolution",
            headers={"Authorization": f"Bearer {token_manager}"},
            json={
                "status": "RESOLVED",
                "resolutionOutcome": "WEAR_AND_TEAR_LOGGED",
                "resolution": "Inspected BNC connector. Wear is normal mechanical fatigue. Replaced connector lock-nut. No penalty or restriction applied to student.",
            },
        )
        assert resp_resolve.status_code == 200
        resolved = resp_resolve.json()
        assert resolved["status"] == "RESOLVED"
        assert resolved["resolutionOutcome"] == "WEAR_AND_TEAR_LOGGED"
        assert resolved["reviewerId"] == "usr_ravi"

        # 5. Verify Trust Ledger contains INCIDENT_RESOLVED event
        async with migration_session_factory() as db:
            stmt = select(LedgerEvent).where(
                LedgerEvent.action == "INCIDENT_RESOLVED",
                LedgerEvent.entity_id == incident_id,
            )
            res = await db.execute(stmt)
            event = res.scalar_one_or_none()
            assert event is not None
            assert event.reason is not None
            assert "mechanical fatigue" in event.reason.lower()
