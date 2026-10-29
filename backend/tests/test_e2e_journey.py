from __future__ import annotations

from datetime import UTC, datetime, timedelta

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
async def test_full_lifecycle_e2e_journey() -> None:  # noqa: PLR0915
    """Test the complete user story and end-to-end lifecycle per PRD & master prompt:

    discover resource -> view requirements -> evaluate eligibility -> request booking ->
    authorized human decision -> check in -> record initial condition -> return ->
    record final condition -> review/resolve incident -> inspect tamper-evident ledger ->
    simulate tamper -> repair ledger -> export analytics CSV -> reset demo data.
    """
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Student demo login (Aarav Patel)
        login_resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_aarav"},
        )
        assert login_resp.status_code == 200, login_resp.text
        login_data = login_resp.json()
        student_token = login_data.get("token") or login_resp.cookies.get("sharespace_session")
        assert student_token is not None
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Verify /auth/me returns current user profile
        me_resp = await client.get("/api/v1/auth/me", headers=student_headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["user"]["id"] == "usr_aarav"

        # 2. Discover resources
        search_resp = await client.get(
            "/api/v1/resources?search=Oscilloscope",
            headers=student_headers,
        )
        assert search_resp.status_code == 200
        resources = search_resp.json()
        assert len(resources) >= 1
        target_resource = resources[0]
        resource_id = target_resource["id"]

        # 3. View requirements & evaluate eligibility preview
        start_time = (datetime.now(UTC) + timedelta(days=2)).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        end_time = start_time + timedelta(hours=3)

        eligibility_resp = await client.post(
            "/api/v1/bookings/eligibility-check",
            json={
                "resourceId": resource_id,
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
            headers=student_headers,
        )
        assert eligibility_resp.status_code == 200, eligibility_resp.text
        eligibility = eligibility_resp.json()
        assert eligibility["eligible"] is True
        assert len(eligibility["checks"]) >= 7

        # 4. Request booking with idempotency key
        idempotency_key = f"idem_e2e_{int(datetime.now(UTC).timestamp())}"
        booking_payload = {
            "resourceId": resource_id,
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
            "purpose": "Final Year Capstone Project Oscilloscope Testing",
            "projectCode": "FYP-2026",
            "idempotencyKey": idempotency_key,
        }
        create_resp = await client.post(
            "/api/v1/bookings",
            json=booking_payload,
            headers=student_headers,
        )
        assert create_resp.status_code == 201, create_resp.text
        booking = create_resp.json()
        booking_id = booking["id"]
        assert booking["status"] in ("PENDING_REVIEW", "SUBMITTED")

        # Verify idempotency: resending the same payload returns existing booking without duplicate
        dup_resp = await client.post(
            "/api/v1/bookings",
            json=booking_payload,
            headers=student_headers,
        )
        assert dup_resp.status_code in (200, 201)
        assert dup_resp.json()["id"] == booking_id

        # 5. Manager views bookings and makes decision
        manager_token = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        manager_headers = {"Authorization": f"Bearer {manager_token}"}

        org_bookings_resp = await client.get("/api/v1/bookings/org", headers=manager_headers)
        assert org_bookings_resp.status_code == 200
        org_bookings = org_bookings_resp.json()
        assert any(b["id"] == booking_id for b in org_bookings)

        # Manager approves booking with governance reason
        decision_resp = await client.post(
            f"/api/v1/bookings/{booking_id}/decision",
            json={
                "decision": "APPROVED",
                "reason": "Approved for Capstone project validation under Dr. Rao guidance.",
            },
            headers=manager_headers,
        )
        assert decision_resp.status_code == 200
        assert decision_resp.json()["status"] == "APPROVED"

        # 6. Verify student receives notification
        notifs_resp = await client.get("/api/v1/notifications", headers=student_headers)
        assert notifs_resp.status_code == 200
        notifs = notifs_resp.json()
        assert any("Approved" in n["title"] or "approved" in n["message"] for n in notifs)

        # 7. Check-in: record initial condition report at handover
        checkin_resp = await client.post(
            f"/api/v1/bookings/{booking_id}/check-in",
            json={
                "condition": "EXCELLENT",
                "notes": "Device in pristine factory condition with all probe leads attached.",
                "acknowledgedRules": True,
                "photos": [
                    {
                        "fileName": "front_panel.jpg",
                        "mimeType": "image/jpeg",
                        "dataUrl": "data:image/jpeg;base64,dGVzdA==",
                    }
                ],
                "accessories": [{"name": "Probe Lead 1", "present": True}],
            },
            headers=student_headers,
        )
        assert checkin_resp.status_code == 200, checkin_resp.text
        assert checkin_resp.json()["status"] == "CHECKED_OUT_TO_USER"

        # 8. Return: submit final condition report
        return_resp = await client.post(
            f"/api/v1/bookings/{booking_id}/return",
            json={
                "condition": "GOOD",
                "notes": "Lab test finished. Returned clean with minor cosmetic scratch on chassis base.",
                "acknowledgedRules": True,
                "photos": [
                    {
                        "fileName": "return_view.jpg",
                        "mimeType": "image/jpeg",
                        "dataUrl": "data:image/jpeg;base64,cmV0dXJu",
                    }
                ],
                "accessories": [{"name": "Probe Lead 1", "present": True}],
            },
            headers=student_headers,
        )
        assert return_resp.status_code == 200, return_resp.text
        # Unsupervised resource closes directly
        assert return_resp.json()["status"] in ("CLOSED", "RETURN_PENDING_CONFIRMATION")

        # 9. File incident report linked to the booking
        incident_resp = await client.post(
            f"/api/v1/bookings/{booking_id}/incidents",
            json={
                "category": "MINOR_DAMAGE",
                "description": "Minor cosmetic hairline scratch observed on outer chassis base plate during lab session.",
                "reportedStage": "User return report",
                "affectedPart": "Outer chassis base plate",
            },
            headers=student_headers,
        )
        assert incident_resp.status_code == 201, incident_resp.text
        incident = incident_resp.json()
        incident_id = incident["id"]
        assert incident["status"] in ("REPORTED", "OPEN")

        # Add comment on incident
        comment_resp = await client.post(
            f"/api/v1/incidents/{incident_id}/comments",
            json={"message": "Inspected by lab technician. No functional impact on oscilloscope calibration."},
            headers=manager_headers,
        )
        assert comment_resp.status_code in (200, 201)

        # Manager resolves incident (fairness: zero automated penalty)
        resolve_resp = await client.post(
            f"/api/v1/incidents/{incident_id}/resolution",
            json={
                "status": "RESOLVED",
                "resolution": "Reviewed by lab technician. Cosmetic only, no mechanical or electrical defect. No penalty assessed.",
                "resolutionOutcome": "NO_FAULT_FOUND",
                "markResourceMaintenance": False,
            },
            headers=manager_headers,
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["status"] == "RESOLVED"

        # 10. Inspect tamper-evident Trust Ledger
        ledger_resp = await client.get("/api/v1/audit-events", headers=manager_headers)
        assert ledger_resp.status_code == 200
        ledger_data = ledger_resp.json()
        assert len(ledger_data["events"]) >= 5

        # Verify ledger cryptographic hash chain
        verify_resp = await client.get("/api/v1/audit-events/verify", headers=manager_headers)
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["valid"] is True
        assert verify_data["checkedCount"] > 0

        # 11. Simulate ledger tamper and verify detection
        tamper_resp = await client.post(
            "/api/v1/audit-events/simulate-tamper",
            headers=manager_headers,
        )
        assert tamper_resp.status_code == 200

        # Now verify should fail and detect the tampered sequence
        tampered_verify = await client.get("/api/v1/audit-events/verify", headers=manager_headers)
        assert tampered_verify.status_code == 200
        assert tampered_verify.json()["valid"] is False
        assert tampered_verify.json()["firstInvalidSeq"] is not None

        # Repair ledger chain
        repair_resp = await client.post("/api/v1/audit-events/repair", headers=manager_headers)
        assert repair_resp.status_code == 200
        assert repair_resp.json()["valid"] is True

        # Re-verify ledger chain is restored
        post_repair_verify = await client.get("/api/v1/audit-events/verify", headers=manager_headers)
        assert post_repair_verify.status_code == 200
        assert post_repair_verify.json()["valid"] is True

        # 12. Analytics utilisation and RFC 4180 CSV export
        analytics_resp = await client.get("/api/v1/analytics/utilisation", headers=manager_headers)
        assert analytics_resp.status_code == 200
        analytics_data = analytics_resp.json()
        assert "resourceMetrics" in analytics_data
        assert "fairnessByUser" in analytics_data

        csv_resp = await client.get("/api/v1/analytics/export", headers=manager_headers)
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers.get("content-type", "")
        assert "Resource Name" in csv_resp.text

        # 13. Reset demo database
        reset_resp = await client.post("/api/v1/auth/reset-demo", headers=manager_headers)
        assert reset_resp.status_code == 200
        assert reset_resp.json()["status"] == "ok"
