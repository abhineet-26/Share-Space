from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, model_validator

from app.models import (
    CheckStatus,
    EligibilityOverallStatus,
    PolicyKind,
    PolicyScopeType,
    PolicyStatus,
)
from app.schemas.auth import UserRead
from app.schemas.base import CamelModel
from app.schemas.resource import ResourceRead


class PolicyScope(CamelModel):
    type: PolicyScopeType
    id: str | None = None
    label: str


class PolicyDefinition(CamelModel):
    window_days: int | None = 7
    max_hours_per_user: float | None = None
    applies_to_roles: list[str] | None = None
    min_lead_time_hours: float | None = None
    max_booking_duration_hours: float | None = 8
    require_verified_account: bool | None = True
    require_training_key: str | None = None
    grace_period_minutes: int | None = 15
    priority_order: list[str] | None = None
    tie_breaker: str | None = None
    plain_summary: str = ""


class PolicyVersionRead(CamelModel):
    id: str
    organization_id: str
    policy_id: str
    version: int
    definition: dict[str, Any]
    effective_from: datetime
    created_by: str
    created_by_name: str


class PolicyRead(CamelModel):
    id: str
    organization_id: str
    name: str
    description: str
    scope: PolicyScope
    kind: PolicyKind
    status: PolicyStatus
    active_version: int | None = None
    versions: list[PolicyVersionRead] = []

    @model_validator(mode="before")
    @classmethod
    def populate_scope(cls, data: Any) -> Any:
        if hasattr(data, "scope_type") and not hasattr(data, "scope"):
            scope_dict = {
                "type": data.scope_type.value if hasattr(data.scope_type, "value") else str(data.scope_type),
                "id": data.scope_id,
                "label": data.scope_label,
            }
            data.scope = scope_dict
        elif isinstance(data, dict) and "scope" not in data and "scope_type" in data:
            data["scope"] = {
                "type": data["scope_type"],
                "id": data.get("scope_id"),
                "label": data.get("scope_label", ""),
            }
        return data


class PolicyCreate(CamelModel):
    name: str
    description: str
    scope: PolicyScope
    kind: PolicyKind
    initial_definition: dict[str, Any]


class PolicyVersionCreate(CamelModel):
    definition: dict[str, Any]
    reason: str


class PolicyActivateRequest(CamelModel):
    version: int
    reason: str = ""


class PolicyPreviewPayload(CamelModel):
    policy_id: str | None = Field(default=None, alias="policyId")
    version: int | None = None
    reason: str | None = ""
    draft_definition: dict[str, Any] | None = Field(default=None, alias="draftDefinition")
    sample_user_id: str | None = Field(default=None, alias="sampleUserId")
    sample_resource_id: str | None = Field(default=None, alias="sampleResourceId")
    sample_duration_hours: float | None = Field(default=4.0, alias="sampleDurationHours")


class EligibilityCheck(CamelModel):
    key: str
    label: str
    status: CheckStatus
    reason: str
    next_step: str | None = None


class EligibilityEvaluationResult(CamelModel):
    eligible: bool
    overall_status: EligibilityOverallStatus
    checks: list[EligibilityCheck]
    applied_policy_version_ids: list[str]
    usage_hours_in_window: float
    max_hours_allowed: float
    requested_hours: float


class EligibilityCheckRequest(CamelModel):
    resource_id: str
    user_id: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    exclude_booking_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_dates(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "startAt" in data and "start" not in data:
                data["start"] = data["startAt"]
            if "endAt" in data and "end" not in data:
                data["end"] = data["endAt"]
        return data


class PolicyPreviewResponse(CamelModel):
    before_result: EligibilityEvaluationResult
    after_result: EligibilityEvaluationResult
    sample_user: UserRead
    sample_resource: ResourceRead
