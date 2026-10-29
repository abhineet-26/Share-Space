from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport

from app.core.database import migration_session_factory
from app.core.middleware import rate_limiter
from app.core.security import create_access_token
from app.main import app
from scripts.seed import seed_database


@pytest.fixture(autouse=True)
async def reset_state() -> None:
    rate_limiter.reset()
    async with migration_session_factory() as session:
        await seed_database(session)


@pytest.mark.asyncio
async def test_security_headers_enforced() -> None:
    """Verify that OWASP-compliant security headers are attached to all API responses."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get("/healthz")
        assert resp.status_code == 200

        headers = resp.headers
        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert headers.get("X-Frame-Options") == "DENY"
        assert headers.get("X-XSS-Protection") == "1; mode=block"
        assert "max-age=31536000" in headers.get("Strict-Transport-Security", "")
        assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "geolocation=()" in headers.get("Permissions-Policy", "")
        assert "default-src 'self'" in headers.get("Content-Security-Policy", "")
        assert "frame-ancestors 'none'" in headers.get("Content-Security-Policy", "")


@pytest.mark.asyncio
async def test_cors_policy_allowed_and_disallowed_origins() -> None:
    """Verify CORS pre-flight and request headers for authorized vs unauthorized origins."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Allowed origin
        allowed_resp = await client.options(
            "/api/v1/resources",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed_resp.status_code == 200
        assert allowed_resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert allowed_resp.headers.get("access-control-allow-credentials") == "true"

        # Disallowed malicious origin
        evil_resp = await client.options(
            "/api/v1/resources",
            headers={
                "Origin": "http://malicious-attacker-site.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert evil_resp.headers.get("access-control-allow-origin") is None


@pytest.mark.asyncio
async def test_rate_limiting_enforcement_on_auth_endpoints() -> None:
    """Verify rate limiter blocks burst abuse on sensitive authentication endpoints with 429."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Default RATE_LIMIT_AUTH is 20
        # Send 20 requests -> all should pass
        for i in range(20):
            res = await client.post(
                "/api/v1/auth/demo-login",
                json={"userId": "usr_aarav"},
            )
            assert res.status_code == 200, f"Request {i+1} failed"
            assert int(res.headers.get("X-RateLimit-Remaining", -1)) >= 0

        # 21st request exceeds rate limit and must return 429
        blocked_res = await client.post(
            "/api/v1/auth/demo-login",
            json={"userId": "usr_aarav"},
        )
        assert blocked_res.status_code == 429
        assert blocked_res.headers.get("Retry-After") is not None
        assert blocked_res.headers.get("X-RateLimit-Remaining") == "0"
        err_body = blocked_res.json()
        assert err_body["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_role_security_enforcement_fail_closed() -> None:
    """Verify unprivileged student cannot perform administrative role or ledger modifications."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        student_token = create_access_token(
            {"user_id": "usr_aarav", "organization_id": "org_nit", "roles": ["USER"]}
        )
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 1. Attempt to update user roles
        role_tamper_res = await client.patch(
            "/api/v1/admin/users/usr_aarav/roles",
            json={"roles": ["ADMIN", "MANAGER"], "reason": "Self-promotion attempt"},
            headers=student_headers,
        )
        assert role_tamper_res.status_code == 403

        # 2. Attempt to simulate ledger tamper
        tamper_res = await client.post(
            "/api/v1/audit-events/simulate-tamper",
            headers=student_headers,
        )
        assert tamper_res.status_code == 403

        # 3. Attempt to repair ledger
        repair_res = await client.post(
            "/api/v1/audit-events/repair",
            headers=student_headers,
        )
        assert repair_res.status_code == 403
