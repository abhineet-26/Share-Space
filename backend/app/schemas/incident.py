from __future__ import annotations

from datetime import datetime

from app.models import IncidentStatus
from app.schemas.base import CamelModel


class IncidentCommentRead(CamelModel):
    id: str
    author_id: str
    author_name: str
    author_role: str
    message: str
    created_at: datetime


class IncidentRead(CamelModel):
    id: str
    organization_id: str
    booking_id: str
    resource_id: str
    reporter_id: str
    reporter_name: str
    category: str
    reported_stage: str | None = None
    affected_part: str | None = None
    description: str
    attachment_ids: list[str] = []
    attachment_hashes: list[str] = []
    status: IncidentStatus
    reviewer_id: str | None = None
    reviewer_name: str | None = None
    resolution_outcome: str | None = None
    resolution: str | None = None
    resolved_at: datetime | None = None
    requires_human_review: bool = True
    assisted_draft_used: bool = False
    comments: list[IncidentCommentRead] = []
    created_at: datetime
