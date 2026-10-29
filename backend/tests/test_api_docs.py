from __future__ import annotations

import json
from unittest.mock import patch

import httpx
import pytest
from httpx import ASGITransport

from app.core.config import get_settings
from app.main import app, create_app

settings = get_settings()


@pytest.mark.asyncio
async def test_docs_endpoints_available_by_default() -> None:
    """Verifies that Swagger UI, ReDoc, and OpenAPI schema endpoints are accessible."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Swagger UI at /docs
        resp_docs = await client.get("/docs")
        assert resp_docs.status_code == 200
        assert "text/html" in resp_docs.headers.get("content-type", "")
        assert "swagger-ui" in resp_docs.text.lower()

        # 2. ReDoc at /redoc with stable 2.x bundle and without Google Fonts
        resp_redoc = await client.get("/redoc")
        assert resp_redoc.status_code == 200
        assert "text/html" in resp_redoc.headers.get("content-type", "")
        redoc_html = resp_redoc.text
        assert "redoc" in redoc_html.lower()
        # Verify stable ReDoc 2.x bundle URL
        assert "https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js" in redoc_html
        # Verify spec-url points to /openapi.json
        assert 'spec-url="/openapi.json"' in redoc_html
        # Verify Google Fonts are not requested
        assert "fonts.googleapis.com" not in redoc_html
        assert "fonts.gstatic.com" not in redoc_html

        # Verify CSP headers permit ReDoc workers and scripts
        csp = resp_redoc.headers.get("Content-Security-Policy", "")
        assert "worker-src 'self' blob:" in csp
        assert "child-src 'self' blob:" in csp
        assert "https://cdn.jsdelivr.net" in csp

        # 3. OpenAPI schema at /openapi.json
        resp_openapi = await client.get("/openapi.json")
        assert resp_openapi.status_code == 200
        assert "application/json" in resp_openapi.headers.get("content-type", "")
        schema = resp_openapi.json()
        assert schema.get("info", {}).get("title") == "SHARESPACE"
        assert schema.get("info", {}).get("version") == settings.APP_VERSION
        assert len(schema.get("paths", {})) > 0


@pytest.mark.asyncio
async def test_docs_endpoints_available_under_production_settings() -> None:
    """Verifies that /docs, /redoc, and /openapi.json remain available when DEBUG=False."""
    with patch.object(settings, "DEBUG", False), patch.object(settings, "ENABLE_DOCS", True):
        prod_app = create_app()
        transport = ASGITransport(app=prod_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp_docs = await client.get("/docs")
            assert resp_docs.status_code == 200

            resp_redoc = await client.get("/redoc")
            assert resp_redoc.status_code == 200
            assert (
                "https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"
                in resp_redoc.text
            )
            assert "fonts.googleapis.com" not in resp_redoc.text

            resp_openapi = await client.get("/openapi.json")
            assert resp_openapi.status_code == 200
            assert resp_openapi.json().get("info", {}).get("title") == "SHARESPACE"


@pytest.mark.asyncio
async def test_docs_endpoints_can_be_explicitly_disabled() -> None:
    """Verifies that documentation endpoints can be explicitly toggled off via ENABLE_DOCS=False."""
    with patch.object(settings, "DEBUG", False), patch.object(settings, "ENABLE_DOCS", False):
        no_docs_app = create_app()
        transport = ASGITransport(app=no_docs_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp_docs = await client.get("/docs")
            assert resp_docs.status_code == 404

            resp_redoc = await client.get("/redoc")
            assert resp_redoc.status_code == 404

            resp_openapi = await client.get("/openapi.json")
            assert resp_openapi.status_code == 404

            # Health endpoints must remain functional even when docs are disabled
            resp_healthz = await client.get("/healthz")
            assert resp_healthz.status_code == 200
            assert resp_healthz.json().get("status") == "ok"


@pytest.mark.asyncio
async def test_health_and_ready_endpoints() -> None:
    """Verifies that /healthz and /readyz return valid institutional operational status."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp_healthz = await client.get("/healthz")
        assert resp_healthz.status_code == 200
        health_data = resp_healthz.json()
        assert health_data.get("status") == "ok"
        assert "timestamp" in health_data

        resp_readyz = await client.get("/readyz")
        assert resp_readyz.status_code == 200
        ready_data = resp_readyz.json()
        assert ready_data.get("status") == "ready"
        assert ready_data.get("database") == "connected"
        assert ready_data.get("migration_status") == "applied"
        assert "migration_version" in ready_data
        assert "timestamp" in ready_data


def test_openapi_schema_contains_no_secrets() -> None:
    """Ensures OpenAPI schema does not expose database credentials, secrets, or internal keys."""
    schema = app.openapi()
    schema_str = json.dumps(schema).lower()

    prohibited_substrings = [
        "secret-key",
        "app_secret_pass",
        "postgres:postgres",
        "changeme",
        "database_url",
        "sync_database_url",
    ]

    for term in prohibited_substrings:
        assert (
            term not in schema_str
        ), f"Found potentially sensitive term '{term}' in OpenAPI schema"


def test_api_v1_routes_retain_correct_prefix() -> None:
    """Ensures domain routes remain prefixed with /api/v1."""
    schema = app.openapi()
    paths = list(schema.get("paths", {}).keys())

    # Exclude top-level health endpoints
    api_paths = [p for p in paths if not p.startswith("/healthz") and not p.startswith("/readyz")]
    assert len(api_paths) > 0

    for path in api_paths:
        assert path.startswith("/api/v1/"), f"Route '{path}' does not have '/api/v1/' prefix"
