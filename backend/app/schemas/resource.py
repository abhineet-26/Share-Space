from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import model_validator

from app.models import (
    ConditionLevel,
    PolicyKind,
    PolicyStatus,
    RequirementType,
    ResourceCategory,
    ResourceStatus,
    SupervisionLevel,
)
from app.schemas.base import CamelModel


class RequirementRead(CamelModel):
    key: str
    type: RequirementType
    label: str
    value: str


class RequirementCreate(CamelModel):
    key: str
    type: RequirementType
    label: str
    value: str


class AvailabilityWindowRead(CamelModel):
    id: str
    resource_id: str
    day_of_week: str | None = None
    start: str
    end: str
    recurrence: str | None = None


class AvailabilityWindowCreate(CamelModel):
    day_of_week: str | None = None
    start: str
    end: str
    recurrence: str | None = None


class ResourceRead(CamelModel):
    id: str
    organization_id: str
    owner_id: str
    owner_name: str
    department: str
    name: str
    model_number: str | None = None
    category: ResourceCategory
    illustration_type: str
    location: str
    access_instructions: str
    description: str
    condition: ConditionLevel
    status: ResourceStatus
    supervision: SupervisionLevel
    accessories: list[str] = []
    usage_rules: str
    return_rules: str
    cancellation_policy: str
    policy_ids: list[str] = []
    requirements: list[RequirementRead] = []
    availability: list[AvailabilityWindowRead] = []


class ResourceCreate(CamelModel):
    name: str
    category: ResourceCategory
    department: str
    location: str
    description: str
    access_instructions: str = ""
    model_number: str | None = None
    illustration_type: str = "workstation"
    condition: ConditionLevel = ConditionLevel.GOOD
    status: ResourceStatus = ResourceStatus.DRAFT
    supervision: SupervisionLevel = SupervisionLevel.NONE
    accessories: list[str] = []
    usage_rules: str = ""
    return_rules: str = ""
    cancellation_policy: str = ""
    policy_ids: list[str] = []
    requirements: list[RequirementCreate] = []
    availability: list[AvailabilityWindowCreate] = []


class ResourceUpdate(CamelModel):
    name: str | None = None
    category: ResourceCategory | None = None
    department: str | None = None
    location: str | None = None
    description: str | None = None
    access_instructions: str | None = None
    model_number: str | None = None
    illustration_type: str | None = None
    condition: ConditionLevel | None = None
    status: ResourceStatus | None = None
    supervision: SupervisionLevel | None = None
    accessories: list[str] | None = None
    usage_rules: str | None = None
    return_rules: str | None = None
    cancellation_policy: str | None = None
    policy_ids: list[str] | None = None
    reason: str | None = None


class ResourcePublishRequest(CamelModel):
    status: ResourceStatus
    reason: str


class PolicyRead(CamelModel):
    id: str
    organization_id: str
    name: str
    description: str
    scope: dict[str, Any]
    kind: PolicyKind
    status: PolicyStatus
    active_version: int | None = None

    @model_validator(mode="before")
    @classmethod
    def populate_scope(cls, data: Any) -> Any:
        if hasattr(data, "scope_type") and not hasattr(data, "scope"):
            scope_dict = {
                "type": data.scope_type.value
                if hasattr(data.scope_type, "value")
                else str(data.scope_type),
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


class PolicyVersionRead(CamelModel):
    id: str
    organization_id: str
    policy_id: str
    version: int
    definition: dict[str, Any]
    effective_from: datetime
    created_by: str
    created_by_name: str


class ActivePolicyItem(CamelModel):
    policy: PolicyRead
    version: PolicyVersionRead | None = None


class ResourceDetailResponse(CamelModel):
    resource: ResourceRead
    assets: list[Any]  # list[AssetRead]
    active_policies: list[ActivePolicyItem]
    waitlist_count: int


class WaitlistBookingItem(CamelModel):
    id: str
    user_id: str
    user_name: str
    resource_id: str
    status: str
    waitlist_position: int | None = None
    start_at: datetime
    end_at: datetime
    created_at: datetime
