from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, event
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    @declared_attr.directive
    def __tablename__(cls) -> str:  # type: ignore[misc]
        return cls.__name__.lower()

    # Common columns for all models
    id: Mapped[str] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


# Event listener to automatically update updated_at
@event.listens_for(Base, "before_update", propagate=True)
def update_updated_at(_mapper: Any, _connection: Any, target: Any) -> None:
    target.updated_at = datetime.now(UTC)


def generate_id(prefix: str = "") -> str:
    """Generate a ULID-based ID with optional prefix."""
    import ulid

    # ulid.new() returns a ULID object with .str attribute
    ulid_obj = ulid.new()
    return f"{prefix}_{ulid_obj.str.lower()}" if prefix else ulid_obj.str.lower()
