from __future__ import annotations

from app.schemas.auth import OrganizationRead, UserRead
from app.schemas.base import CamelModel


class ResourceMetricItem(CamelModel):
    resource_id: str
    name: str
    category: str
    booked_hours: float
    available_hours: float = 40.0
    utilisation_pct: int
    waitlisted_count: int
    incident_count: int


class FairnessByUserItem(CamelModel):
    user_id: str
    name: str
    academic_group: str
    booked_hours: float
    share_pct: int
    requests_count: int


class DemandByHourBlockItem(CamelModel):
    block: str
    electronics: int
    media_computing: int
    spaces: int


class OutcomeCountItem(CamelModel):
    status: str
    count: int


class AnalyticsUtilisationResponse(CamelModel):
    resource_metrics: list[ResourceMetricItem]
    fairness_by_user: list[FairnessByUserItem]
    demand_by_hour_block: list[DemandByHourBlockItem]
    outcome_counts: list[OutcomeCountItem]


class TrainingRecordRead(CamelModel):
    id: str
    organization_id: str
    user_id: str
    type: str
    label: str
    status: str
    source: str
    verified_by: str | None = None
    expires_at: str | None = None


class AdminUsersResponse(CamelModel):
    users: list[UserRead]
    trainings: list[TrainingRecordRead]
    organization: OrganizationRead


class UsageByResourceItem(CamelModel):
    resource_id: str
    resource_name: str
    hours_used_7d: float


class ProfileDataResponse(CamelModel):
    user: UserRead
    organization: OrganizationRead
    trainings: list[TrainingRecordRead]
    usage_by_resource: list[UsageByResourceItem]
