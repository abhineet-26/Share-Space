from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.models import ConditionLevel
from app.schemas.base import CamelModel


class PhotoInput(CamelModel):
    file_name: str
    data_url: str
    mime_type: str | None = "image/svg+xml"


class ConditionReportCreate(CamelModel):
    stage: str
    condition: ConditionLevel
    accessories: list[dict[str, Any]] = []
    notes: str = ""
    photos: list[PhotoInput] = []
    acknowledged_rules: bool = Field(..., description="Must acknowledge usage rules")
    incident_category: str | None = None
    incident_description: str | None = None


class StaffConfirmationRequest(CamelModel):
    stage: str = "RETURN"  # HANDOVER or RETURN
    notes: str = ""


class ConditionReportRead(CamelModel):
    id: str
    organization_id: str
    booking_id: str
    stage: str
    condition: ConditionLevel
    accessories: list[dict[str, Any]] = []
    notes: str
    attachment_ids: list[str] = []
    attachment_hashes: list[str] = []
    acknowledged_rules: bool = False
    reporter_id: str
    reporter_name: str
    actual_timestamp: datetime
    staff_confirmed_by: str | None = None
    staff_confirmed_at: datetime | None = None
    created_at: datetime
