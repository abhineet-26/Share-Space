from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Add backend to path for imports
sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.core.config import get_settings
from app.models.base import Base
# Import all models to register them with Base.metadata
from app.models import (  # noqa: F401
    Organization,
    User,
    TrainingRecord,
    Resource,
    ResourceRequirement,
    AvailabilityWindow,
    Asset,
    Policy,
    PolicyVersion,
    Booking,
    ConditionReport,
    Incident,
    IncidentComment,
    Attachment,
    LedgerEvent,
    Notification,
    OutboxEvent,
)

config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

settings = get_settings()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.SYNC_DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_async_engine(
        settings.DATABASE_MIGRATION_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())
