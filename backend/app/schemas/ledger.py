from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import model_validator

from app.models import LedgerEntityType
from app.schemas.base import CamelModel


class LedgerEventRead(CamelModel):
    id: str
    organization_id: str
    seq: int
    actor_id: str | None = None
    actor_name: str
    actor_role: str
    action: str
    entity_type: LedgerEntityType
    entity_id: str
    occurred_at: datetime
    reason: str | None = None
    metadata: dict[str, Any] = {}
    prev_hash: str
    hash: str

    @model_validator(mode="before")
    @classmethod
    def reconcile_metadata(cls, data: Any) -> Any:
        if hasattr(data, "event_metadata"):
            return {
                "id": data.id,
                "organization_id": data.organization_id,
                "seq": data.seq,
                "actor_id": data.actor_id,
                "actor_name": data.actor_name,
                "actor_role": data.actor_role,
                "action": data.action,
                "entity_type": data.entity_type,
                "entity_id": data.entity_id,
                "occurred_at": data.occurred_at,
                "reason": data.reason,
                "metadata": getattr(data, "event_metadata", {}) or {},
                "prev_hash": data.prev_hash,
                "hash": data.hash,
            }
        elif isinstance(data, dict):
            if "event_metadata" in data and "metadata" not in data:
                data["metadata"] = data["event_metadata"]
            elif "eventMetadata" in data and "metadata" not in data:
                data["metadata"] = data["eventMetadata"]
        return data


class LedgerVerificationResponse(CamelModel):
    organization_id: str
    is_valid: bool
    verified_at: datetime
    total_events: int
    head_hash: str
    first_invalid_seq: int | None = None
    first_invalid_event_id: str | None = None
    message: str
