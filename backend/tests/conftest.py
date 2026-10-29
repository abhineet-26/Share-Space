from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from scripts.seed import seed_database

settings = get_settings()

# Engine connecting as restricted application role (sharespace_app) - no BYPASSRLS
app_engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=False,
)

# Engine connecting as migration / superuser role (abhi) - for setup & privileged tests
admin_engine = create_async_engine(
    settings.DATABASE_MIGRATION_URL,
    poolclass=NullPool,
    echo=False,
)

AppSessionFactory = async_sessionmaker(
    app_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

AdminSessionFactory = async_sessionmaker(
    admin_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)



@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Ensure database has seed data before running tests."""
    async with AdminSessionFactory() as session:
        await seed_database(session)
    yield


@pytest_asyncio.fixture
async def app_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides a session with restricted runtime role (sharespace_app, RLS enforced)."""
    async with AppSessionFactory() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def admin_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an admin session (superuser/migration role) for privileged operations."""
    async with AdminSessionFactory() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()
