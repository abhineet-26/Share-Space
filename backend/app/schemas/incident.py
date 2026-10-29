from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, model_validator

from app.models import IncidentStatus
from app.schemas.base import CamelModel
from app.schemas.condition import PhotoInput


class IncidentCommentCreate(CamelModel):
    message: str = Field(..., min_length=1)


class IncidentCommentRead(CamelModel):
    id: str
    author_id: str
    author_name: str
    author_role: str
    message: str
    created_at: datetime


class IncidentCreate(CamelModel):
    category: str
    reported_stage: str | None = "User report"
    affected_part: str | None = None
    description: str = Field(..., min_length=10)
    assisted_draft_used: bool = False
    photos: list[PhotoInput] = []


class IncidentResolveRequest(CamelModel):
    status: IncidentStatus = IncidentStatus.RESOLVED
    resolution_outcome: str | None = None
    resolution: str = Field(..., min_length=8)
    mark_resource_maintenance: bool = False


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
    resource_name: str | None = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def handle_orm_incident(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        if hasattr(data, "__dict__"):
            d = {k: v for k, v in data.__dict__.items() if not k.startswith("_")}
            if "comments" not in d or d.get("comments") is None:
                d["comments"] = []
            return d
        return data
