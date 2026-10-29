from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_BACKEND_DIR / ".env", ".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "SHARESPACE"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    ENABLE_DOCS: bool = Field(
        default=True,
        description="Enable Swagger UI (/docs), ReDoc (/redoc), and OpenAPI (/openapi.json) endpoints",
    )

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./sharespace.db",
        description="Async PostgreSQL URL for app role",
    )
    DATABASE_MIGRATION_URL: str = Field(
        default="sqlite+aiosqlite:///./sharespace.db",
        description="Async PostgreSQL URL for migration role",
    )
    SYNC_DATABASE_URL: str = Field(
        default="sqlite:///./sharespace.db", description="Sync PostgreSQL URL for Alembic"
    )

    # Security
    SECRET_KEY: str = Field(
        default="test-secret-key-for-local-development-only-32-chars-minimum-length",
        min_length=32,
        description="JWT secret key (min 32 chars)",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Demo Login
    ENABLE_DEMO_LOGIN: bool = False
    DEMO_DEFAULT_ORG_ID: str = "org_nit"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # OIDC (Tier 2)
    OIDC_ISSUER: str = ""
    OIDC_CLIENT_ID: str = ""
    OIDC_CLIENT_SECRET: str = ""
    OIDC_REDIRECT_URI: str = ""

    # Object Storage (Tier 2)
    OBJECT_STORAGE_ENDPOINT: str = ""
    OBJECT_STORAGE_BUCKET: str = ""
    OBJECT_STORAGE_ACCESS_KEY: str = ""
    OBJECT_STORAGE_SECRET_KEY: str = ""
    OBJECT_STORAGE_REGION: str = ""

    # AI Services (Tier 2)
    GEMINI_API_KEY: str = ""

    # Monitoring
    SENTRY_DSN: str = ""

    # Rate Limiting
    RATE_LIMIT_DEFAULT: int = 100
    RATE_LIMIT_AUTH: int = 20
    RATE_LIMIT_AI: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
