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
    logger.info("application_startup", app_name=settings.APP_NAME, version=settings.APP_VERSION, environment=settings.ENVIRONMENT)

    # Verify database connectivity
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("database_connected", url=settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "configured")
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
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="SHARESPACE - Trusted Institutional Resource Sharing Platform",
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
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
        return {"status": "ok", "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}

    @app.get("/readyz", tags=["Health"])
    async def readyz():
        db_ok = False
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            pass

        return {
            "status": "ready" if db_ok else "not_ready",
            "database": "connected" if db_ok else "disconnected",
            "mode": settings.ENVIRONMENT,
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }

    # API router will be included here
    from app.api.router import api_router
    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
