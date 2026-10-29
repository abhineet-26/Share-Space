from __future__ import annotations

from datetime import datetime

from app.models import NotificationType, OutboxStatus
from app.schemas.base import CamelModel


class NotificationRead(CamelModel):
    id: str
    organization_id: str
    user_id: str
    type: NotificationType
    title: str
    message: str
    related_entity_id: str | None = None
    related_path: str | None = None
    outbox_status: OutboxStatus
    created_at: datetime
    read_at: datetime | None = None


class OutboxEventRead(CamelModel):
    id: str
    organization_id: str
    event_type: str
    status: OutboxStatus
    attempts: int
    created_at: datetime
    processed_at: datetime | None = None
