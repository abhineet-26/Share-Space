from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, model_validator

from app.models import BookingStatus
from app.schemas.attachment import AttachmentRead
from app.schemas.auth import UserRead
from app.schemas.base import CamelModel
from app.schemas.condition import ConditionReportRead
from app.schemas.incident import IncidentRead
from app.schemas.ledger import LedgerEventRead
from app.schemas.resource import ResourceRead


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


class BookingEnrichedUserRead(BookingRead):
    resource_name: str
    resource_location: str
    resource_supervision: str


class BookingEnrichedOrgRead(BookingRead):
    resource_name: str
    resource_location: str
    resource_supervision: str
    requester_name: str
    requester_email: str
    requester_department: str


class BookingCreate(CamelModel):
    resource_id: str
    start: datetime | None = None
    end: datetime | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    purpose: str = Field(..., min_length=8)
    project_code: str | None = None
    team_members: list[str] = []
    idempotency_key: str | None = None
    join_waitlist_if_conflict: bool = False

    @model_validator(mode="before")
    @classmethod
    def reconcile_times(cls, data: Any) -> Any:
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


class BookingCancelRequest(CamelModel):
    reason: str = "Cancelled by user."


class BookingDecisionRequest(CamelModel):
    decision: str  # APPROVED, REJECTED, WAITLISTED, NEEDS_INFORMATION
    reason: str = Field(..., min_length=5)
    is_policy_override: bool = False

    @model_validator(mode="before")
    @classmethod
    def reconcile_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "status" in data and "decision" not in data:
                data["decision"] = data["status"]
            if "decisionReason" in data and "reason" not in data:
                data["reason"] = data["decisionReason"]
        return data


class BookingDetailResponse(CamelModel):
    booking: BookingRead
    resource: ResourceRead
    requester: UserRead
    condition_reports: list[ConditionReportRead] = []
    incidents: list[IncidentRead] = []
    ledger_events: list[LedgerEventRead] = []
    attachments: list[AttachmentRead] = []
    competing_requests: list[BookingEnrichedOrgRead] = []


class ResourceAvailabilityResponse(CamelModel):
    bookings: list[BookingRead]
