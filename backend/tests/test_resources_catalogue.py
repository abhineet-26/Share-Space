from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport

from app.core.security import create_access_token
from app.main import app
from app.models import Asset
from app.services.ledger import verify_ledger_chain
from tests.conftest import AdminSessionFactory


@pytest.mark.asyncio
async def test_list_resources_tenant_scoped() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as student Aarav in org_nit
        token_nit = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp_nit = await client.get(
            "/api/v1/resources",
            headers={"Authorization": f"Bearer {token_nit}"},
        )
        assert resp_nit.status_code == 200
        resources_nit = resp_nit.json()
        assert len(resources_nit) >= 9
        for r in resources_nit:
            assert r["organizationId"] == "org_nit"

        # Sign in as Rohan in org_harbour
        token_harbour = create_access_token(
            {"user_id": "usr_rohan", "organization_id": "org_harbour", "roles": ["ADMIN"]}
        )
        resp_harbour = await client.get(
            "/api/v1/resources",
            headers={"Authorization": f"Bearer {token_harbour}"},
        )
        assert resp_harbour.status_code == 200
        resources_harbour = resp_harbour.json()
        assert len(resources_harbour) >= 1
        for r in resources_harbour:
            assert r["organizationId"] == "org_harbour"


@pytest.mark.asyncio
async def test_list_resources_filters() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )

        # 1. Category filter
        resp_cat = await client.get(
            "/api/v1/resources?category=ELECTRONICS",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_cat.status_code == 200
        for r in resp_cat.json():
            assert r["category"] == "ELECTRONICS"

        # 2. Status filter
        resp_status = await client.get(
            "/api/v1/resources?status=PUBLISHED",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_status.status_code == 200
        for r in resp_status.json():
            assert r["status"] == "PUBLISHED"

        # 3. Supervision filter
        resp_sup = await client.get(
            "/api/v1/resources?supervision=STAFF_CONFIRMATION",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_sup.status_code == 200
        for r in resp_sup.json():
            assert r["supervision"] == "STAFF_CONFIRMATION"

        # 4. Training required filter
        resp_tr = await client.get(
            "/api/v1/resources?trainingRequired=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_tr.status_code == 200
        for r in resp_tr.json():
            assert any(req["type"] == "TRAINING" for req in r["requirements"])

        # 5. Search text filter
        resp_search = await client.get(
            "/api/v1/resources?search=Oscilloscope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_search.status_code == 200
        search_res = resp_search.json()
        assert len(search_res) >= 1
        assert "Oscilloscope" in search_res[0]["name"]


@pytest.mark.asyncio
async def test_get_resource_detail() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp = await client.get(
            "/api/v1/resources/res_scope",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resource"]["id"] == "res_scope"
        assert len(data["assets"]) >= 1
        assert "activePolicies" in data
        assert "waitlistCount" in data


@pytest.mark.asyncio
async def test_get_resource_cross_tenant_fails_closed() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # User in org_nit trying to access org_harbour resource
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp = await client.get(
            "/api/v1/resources/res_harbour_laser",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_create_resource_requires_role_and_emits_ledger() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Student without OWNER/MANAGER/ADMIN is rejected
        token_student = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        payload = {
            "name": "High Precision Spectrum Analyzer",
            "category": "ELECTRONICS",
            "department": "Electronics Department",
            "location": "Room 304, RF Systems Lab",
            "description": "9kHz to 3GHz RF spectrum analyzer for high frequency RF testing.",
            "accessInstructions": "Keycard access; must calibrate before use.",
            "condition": "EXCELLENT",
            "status": "DRAFT",
            "supervision": "NONE",
            "accessories": ["N-type to BNC adapter", "Power lead"],
            "usageRules": "No input exceeding +30 dBm.",
            "returnRules": "Zero baseline calibration and wipe exterior.",
            "cancellationPolicy": "Cancel at least 2 hours prior.",
            "requirements": [
                {
                    "key": "tr_rf_safety",
                    "type": "TRAINING",
                    "label": "RF Safety & Instrument Handling",
                    "value": "REQUIRED",
                }
            ],
            "availability": [],
        }
        resp_denied = await client.post(
            "/api/v1/resources",
            headers={"Authorization": f"Bearer {token_student}"},
            json=payload,
        )
        assert resp_denied.status_code == 403
        assert resp_denied.json()["error"]["code"] == "FORBIDDEN"

        # 2. Resource Owner Dr. Meera creates listing
        token_owner = create_access_token(
            {"user_id": "usr_meera", "organization_id": "org_nit", "roles": ["OWNER", "USER"]}
        )
        resp_created = await client.post(
            "/api/v1/resources",
            headers={"Authorization": f"Bearer {token_owner}"},
            json=payload,
        )
        assert resp_created.status_code == 201
        created_res = resp_created.json()
        assert created_res["name"] == "High Precision Spectrum Analyzer"
        assert created_res["ownerId"] == "usr_meera"
        new_res_id = created_res["id"]

    # Verify auto-provisioned asset and ledger chain in DB
    async with AdminSessionFactory() as session:
        # Check asset created
        asset = await session.execute(
            Asset.__table__.select().where(Asset.resource_id == new_res_id)
        )
        asset_row = asset.first()
        assert asset_row is not None
        assert asset_row.qr_token.startswith("qr_org_nit_")

        # Verify ledger chain
        ledger_res = await verify_ledger_chain(session, "org_nit")
        assert ledger_res["valid"] is True


@pytest.mark.asyncio
async def test_update_resource_and_publish_status() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )

        # 1. Update fields
        resp_update = await client.patch(
            "/api/v1/resources/res_scope",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={
                "description": "Updated institutional bench for advanced capstone prototyping.",
                "reason": "Scheduled annual documentation update for research benches.",
            },
        )
        assert resp_update.status_code == 200
        assert "advanced capstone prototyping" in resp_update.json()["description"]

        # 2. Publish status requires reason
        resp_publish_no_reason = await client.post(
            "/api/v1/resources/res_scope/publish",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={"status": "PAUSED", "reason": ""},
        )
        assert resp_publish_no_reason.status_code == 422
        assert resp_publish_no_reason.json()["error"]["code"] == "REASON_REQUIRED"

        # 3. Publish status with reason
        resp_publish = await client.post(
            "/api/v1/resources/res_scope/publish",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={
                "status": "PAUSED",
                "reason": "Temporary pause for annual ESD calibration maintenance.",
            },
        )
        assert resp_publish.status_code == 200
        assert resp_publish.json()["status"] == "PAUSED"


@pytest.mark.asyncio
async def test_resource_availability_and_waitlist() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_user = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        token_manager = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )

        # Availability
        resp_av = await client.get(
            "/api/v1/resources/res_scope/availability",
            headers={"Authorization": f"Bearer {token_user}"},
        )
        assert resp_av.status_code == 200
        assert "bookings" in resp_av.json()

        # Waitlist
        resp_wl = await client.get(
            "/api/v1/resources/res_scope/waitlist",
            headers={"Authorization": f"Bearer {token_manager}"},
        )
        assert resp_wl.status_code == 200
        assert isinstance(resp_wl.json(), list)


@pytest.mark.asyncio
async def test_add_asset_unit() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        token_admin = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        resp = await client.post(
            "/api/v1/resources/res_scope/assets",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={"assetTag": "NIT-EL-OSC-009", "serialNumber": "SN-TEST-8891"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["assetTag"] == "NIT-EL-OSC-009"
        assert data["serialNumber"] == "SN-TEST-8891"
        assert data["qrToken"].startswith("qr_org_nit_")


@pytest.mark.asyncio
async def test_scan_asset_qr_token_contextual_actions() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Diya has NO booking on res_scope -> VIEW_RESOURCE only
        token_diya = create_access_token(
            {"user_id": "usr_diya", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp_diya = await client.get(
            "/api/v1/assets/scan/qr_sec_dso_8f7b2a9e4c1d",
            headers={"Authorization": f"Bearer {token_diya}"},
        )
        assert resp_diya.status_code == 200
        data_diya = resp_diya.json()
        assert data_diya["asset"]["id"] == "ast_scope_01"
        assert data_diya["resource"]["id"] == "res_scope"
        assert any(act["type"] == "VIEW_RESOURCE" for act in data_diya["allowedActions"])
        assert "Scanning a QR code never grants access by itself" in data_diya["explanation"]

        # 2. Aarav has APPROVED booking on res_scope -> CHECK_IN available!
        token_aarav = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp_aarav = await client.get(
            "/api/v1/assets/scan/qr_sec_dso_8f7b2a9e4c1d",
            headers={"Authorization": f"Bearer {token_aarav}"},
        )
        assert resp_aarav.status_code == 200
        data_aarav = resp_aarav.json()
        assert any(act["type"] == "CHECK_IN" for act in data_aarav["allowedActions"])

        # 3. Unknown QR token
        resp_404 = await client.get(
            "/api/v1/assets/scan/qr_unknown_token_999",
            headers={"Authorization": f"Bearer {token_diya}"},
        )
        assert resp_404.status_code == 404
        assert resp_404.json()["error"]["code"] == "NOT_FOUND"

        # 4. Cross-tenant QR scan fails-closed (NIT student scans Harbour asset)
        resp_cross = await client.get(
            "/api/v1/assets/scan/qr_sec_lzr_5f8a1c3d9e2b",
            headers={"Authorization": f"Bearer {token_diya}"},
        )
        assert resp_cross.status_code == 404
