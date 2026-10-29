from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import model_validator

from app.models import BookingStatus
from app.schemas.base import CamelModel


class BookingRead(CamelModel):
    id: str
    organization_id: str
    resource_id: str
    user_id: str
    start: datetime | None = None
    end: datetime | None = None
    start_at: datetime
    end_at: datetime
    purpose: str
    project_code: str | None = None
    team_members: list[str] = []
    status: BookingStatus
    idempotency_key: str
    policy_version_ids: list[str] = []
    eligibility_checks: list[dict[str, Any]] = []
    waitlist_position: int | None = None
    waitlist_reason: str | None = None
    priority_factors: dict[str, Any] | None = None
    decision_reason: str | None = None
    decided_by: str | None = None
    decided_at: datetime | None = None
    is_policy_override: bool = False
    handover_confirmed_by: str | None = None
    handover_confirmed_at: datetime | None = None
    return_confirmed_by: str | None = None
    return_confirmed_at: datetime | None = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def populate_start_end(cls, data: Any) -> Any:
        if (
            hasattr(data, "start_at")
            and getattr(data, "start_at", None) is not None
            and (not hasattr(data, "start") or getattr(data, "start", None) is None)
        ):
            data.start = data.start_at
        if (
            hasattr(data, "end_at")
            and getattr(data, "end_at", None) is not None
            and (not hasattr(data, "end") or getattr(data, "end", None) is None)
        ):
            data.end = data.end_at
        if isinstance(data, dict):
            if "startAt" in data and "start" not in data:
                data["start"] = data["startAt"]
            elif "start_at" in data and "start" not in data:
                data["start"] = data["start_at"]
            if "endAt" in data and "end" not in data:
                data["end"] = data["endAt"]
            elif "end_at" in data and "end" not in data:
                data["end"] = data["end_at"]
        return data


class ResourceAvailabilityResponse(CamelModel):
    bookings: list[BookingRead]
