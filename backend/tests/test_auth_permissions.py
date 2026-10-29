from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport

from app.core.security import create_access_token
from app.main import app
from app.models import User
from app.services.ledger import verify_ledger_chain
from tests.conftest import AdminSessionFactory


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/me")
        assert resp.status_code == 401
        data = resp.json()
        assert data["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_invalid_token_rejected() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert resp.status_code == 401
        data = resp.json()
        assert data["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_demo_login_success_and_cookie_set() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_priya"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["id"] == "usr_priya"
        assert data["user"]["name"] == "Priya Nair"
        assert data["organization"]["id"] == "org_nit"
        assert data["token"] is not None
        set_cookie = resp.headers.get("set-cookie", "")
        assert "sharespace_session" in set_cookie


@pytest.mark.asyncio
async def test_demo_login_unknown_user_rejected() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_non_existent"},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_logout_clears_cookie() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        login_resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_priya"},
        )
        assert login_resp.status_code == 200

        logout_resp = await client.post("/api/v1/auth/logout")
        assert logout_resp.status_code == 200
        cookie_header = logout_resp.headers.get("set-cookie", "")
        assert "sharespace_session" in cookie_header


@pytest.mark.asyncio
async def test_get_me_with_authenticated_session() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as student Aarav
        login_resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_aarav"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        # Call GET /me with token
        resp = await client.get(
            "/api/v1/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["id"] == "usr_aarav"
        assert data["organization"]["id"] == "org_nit"
        assert len(data["allDemoUsers"]) >= 7
        assert len(data["allOrganizations"]) >= 2


@pytest.mark.asyncio
async def test_role_permission_enforcement_student_denied() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as student Aarav (USER role)
        token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        resp = await client.patch(
            "/api/v1/admin/users/usr_kabir/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"roles": ["USER", "MANAGER"], "reason": "Promoting Kabir to manager"},
        )
        assert resp.status_code == 403
        data = resp.json()
        assert data["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_role_permission_enforcement_manager_denied() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as Lab Manager Ravi (MANAGER role, not ADMIN)
        token = create_access_token(
            {"user_id": "usr_ravi", "organization_id": "org_nit", "roles": ["MANAGER", "USER"]}
        )
        resp = await client.patch(
            "/api/v1/admin/users/usr_kabir/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"roles": ["USER", "MANAGER"], "reason": "Promoting Kabir to manager"},
        )
        assert resp.status_code == 403
        data = resp.json()
        assert data["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_role_update_requires_governance_reason() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as Admin Priya (ADMIN role)
        token = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        # Empty reason
        resp_empty = await client.patch(
            "/api/v1/admin/users/usr_kabir/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"roles": ["USER", "MANAGER"], "reason": ""},
        )
        assert resp_empty.status_code == 422
        assert resp_empty.json()["error"]["code"] == "REASON_REQUIRED"

        # Too short reason (< 5 chars)
        resp_short = await client.patch(
            "/api/v1/admin/users/usr_kabir/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"roles": ["USER", "MANAGER"], "reason": "ok"},
        )
        assert resp_short.status_code == 422
        assert resp_short.json()["error"]["code"] == "REASON_REQUIRED"


@pytest.mark.asyncio
async def test_role_update_success_and_ledger_audit_chain() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Sign in as Admin Priya (ADMIN role)
        token = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        governance_reason = "Promoting Kabir to lab manager for Media Arts & Embedded Systems"
        resp = await client.patch(
            "/api/v1/admin/users/usr_kabir/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"roles": ["USER", "MANAGER"], "reason": governance_reason},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "usr_kabir"
        assert "MANAGER" in data["roles"]

    # Verify audit event in ledger
    async with AdminSessionFactory() as session:
        # Verify hash chain integrity for org_nit
        ledger_res = await verify_ledger_chain(session, "org_nit")
        assert ledger_res["valid"] is True
        assert ledger_res["checked_count"] >= 5  # Seed had 4, now 5

        # Fetch target user from DB to verify persistence
        target = await session.get(User, "usr_kabir")
        assert target is not None
        target_roles = [r.value if hasattr(r, "value") else str(r) for r in target.roles]
        assert "MANAGER" in target_roles


@pytest.mark.asyncio
async def test_cross_tenant_admin_modification_blocked_by_rls() -> None:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Admin Priya belongs to org_nit
        token = create_access_token(
            {"user_id": "usr_priya", "organization_id": "org_nit", "roles": ["ADMIN"]}
        )
        # Target usr_rohan belongs to org_harbour
        resp = await client.patch(
            "/api/v1/admin/users/usr_rohan/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "roles": ["USER", "ADMIN"],
                "reason": "Unauthorized attempt to modify cross-tenant user roles",
            },
        )
        # Fail-closed RLS hides org_harbour users from org_nit tenant session -> returns 404
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_demo_personas_unauthenticated_discovery() -> None:
    """Verifies that demo personas can be discovered without an active session."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/api/v1/auth/demo-personas")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True
        personas = data["personas"]
        assert len(personas) >= 5
        persona_ids = [p["id"] for p in personas]
        assert "usr_aarav" in persona_ids
        assert "usr_priya" in persona_ids
        assert "usr_rohan" in persona_ids

        # Ensure no sensitive attributes or passwords leaked
        for p in personas:
            assert "organizationName" in p
            assert "roles" in p
            assert "password" not in p
            assert "hashedPassword" not in p


@pytest.mark.asyncio
async def test_demo_personas_and_login_respect_disabled_flag(monkeypatch) -> None:
    """Verifies that disabling ENABLE_DEMO_LOGIN cleanly hides personas and rejects demo sign-in."""
    from app.core.config import get_settings

    cfg = get_settings()
    monkeypatch.setattr(cfg, "ENABLE_DEMO_LOGIN", False)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Discovery returns enabled=False and empty list
        resp = await client.get("/api/v1/auth/demo-personas")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is False
        assert data["personas"] == []

        # Login is rejected with 403 Forbidden
        login_resp = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_aarav"},
        )
        assert login_resp.status_code == 403
        assert login_resp.json()["detail"]["code"] == "DEMO_DISABLED"


@pytest.mark.asyncio
async def test_demo_reset_protected_in_production(monkeypatch) -> None:
    """Verifies that demo reset is rejected in production unless explicitly enabled and authorized."""
    from app.core.config import get_settings

    cfg = get_settings()
    monkeypatch.setattr(cfg, "ENVIRONMENT", "production")
    monkeypatch.setattr(cfg, "ENABLE_DEMO_RESET", False)

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post("/api/v1/auth/reset-demo")
        assert resp.status_code == 403
        assert resp.json()["detail"]["code"] == "DEMO_RESET_DISABLED"


@pytest.mark.asyncio
async def test_safe_bootstrap_refuses_when_institutional_data_present() -> None:
    """Verifies safe_bootstrap_demo refuses to run when users are already present."""
    from scripts.seed import safe_bootstrap_demo

    async with AdminSessionFactory() as session:
        # DB is already populated by setup fixture
        success = await safe_bootstrap_demo(session)
        assert success is False
