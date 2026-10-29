from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

def _create_engine(url: str, is_test: bool = False):
    """Create async engine with appropriate pool settings for the database dialect."""
    if "sqlite" in url:
        # SQLite doesn't support pool_size, max_overflow with NullPool
        return create_async_engine(
            url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            poolclass=NullPool,
            connect_args={"check_same_thread": False},
        )
    else:
        return create_async_engine(
            url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            poolclass=NullPool if is_test else None,
        )

# Application engine (app role, no BYPASSRLS)
engine = _create_engine(settings.DATABASE_URL, is_test=settings.ENVIRONMENT == "test")

# Migration engine (migration role with BYPASSRLS)
migration_engine = _create_engine(settings.DATABASE_MIGRATION_URL, is_test=settings.ENVIRONMENT == "test")

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

migration_session_factory = async_sessionmaker(
    migration_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for FastAPI routes - returns app role session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_migration_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for migration operations - returns migration role session."""
    async with migration_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def db_transaction(session: AsyncSession):
    """Context manager for explicit transaction control."""
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
