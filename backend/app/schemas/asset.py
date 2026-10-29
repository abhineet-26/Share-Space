from __future__ import annotations

from datetime import datetime

from app.models import AssetStatus, ConditionLevel
from app.schemas.base import CamelModel
from app.schemas.resource import ResourceRead


class AssetRead(CamelModel):
    id: str
    organization_id: str
    resource_id: str
    asset_tag: str
    serial_number: str
    qr_token: str
    condition: ConditionLevel
    status: AssetStatus
    last_calibrated_at: datetime | None = None


class AssetCreate(CamelModel):
    asset_tag: str
    serial_number: str


class AllowedAction(CamelModel):
    type: str  # CHECK_IN | RETURN | STAFF_CONFIRM_RETURN | VIEW_RESOURCE
    label: str
    booking_id: str | None = None
    description: str


class AssetScanResponse(CamelModel):
    asset: AssetRead
    resource: ResourceRead
    allowed_actions: list[AllowedAction]
    explanation: str
