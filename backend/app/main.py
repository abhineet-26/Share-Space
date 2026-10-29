from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, migration_engine
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RateLimitMiddleware, SecurityHeadersMiddleware

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    configure_logging()
    logger.info(
        "application_startup",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    # Verify database connectivity
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info(
            "database_connected",
            url=settings.DATABASE_URL.split("@")[-1]
            if "@" in settings.DATABASE_URL
            else "configured",
        )
    except Exception as e:
        logger.exception("database_connection_failed", error=str(e))
        if settings.is_production:
            raise

    yield

    # Shutdown
    logger.info("application_shutdown")
    await engine.dispose()
    await migration_engine.dispose()


def create_app() -> FastAPI:
    docs_enabled = settings.ENABLE_DOCS
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="SHARESPACE - Trusted Institutional Resource Sharing Platform",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,  # Configured explicitly below using stable ReDoc 2.x bundle
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "X-Request-ID",
            "X-Total-Count",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "Retry-After",
        ],
    )

    # Security Headers & Rate Limiting
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)

    # GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        import ulid

        request_id = request.headers.get("X-Request-ID") or ulid.new().str
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # Register exception handlers
    register_exception_handlers(app)

    # Health check endpoints (no auth required)
    @app.get("/healthz", tags=["Health"])
    async def healthz():
        return {
            "status": "ok",
            "timestamp": __import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
        }

    @app.get("/readyz", tags=["Health"])
    async def readyz():
        db_ok = False
        migration_version = None
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                db_ok = True
                try:
                    res = await conn.execute(
                        text("SELECT version_num FROM alembic_version LIMIT 1")
                    )
                    migration_version = res.scalar_one_or_none()
                except Exception:
                    pass
        except Exception:
            pass

        return {
            "status": "ready" if db_ok else "not_ready",
            "database": "connected" if db_ok else "disconnected",
            "migration_version": migration_version,
            "mode": settings.ENVIRONMENT,
            "timestamp": __import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
        }

    # Explicit ReDoc documentation endpoint using stable ReDoc 2.x
    if docs_enabled:
        from fastapi.openapi.docs import get_redoc_html

        @app.get("/redoc", include_in_schema=False)
        async def redoc_html():
            return get_redoc_html(
                openapi_url=app.openapi_url or "/openapi.json",
                title=f"{settings.APP_NAME} - ReDoc",
                redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js",
                with_google_fonts=False,
            )

    # API router will be included here
    from app.api.router import api_router

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
