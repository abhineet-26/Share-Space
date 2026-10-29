from __future__ import annotations

from datetime import datetime

from app.schemas.base import CamelModel


class AttachmentRead(CamelModel):
    id: str
    organization_id: str
    file_name: str
    mime_type: str
    size_bytes: int
    sha256: str
    data_url: str | None = None
    uploaded_by: str
    linked_entity_type: str | None = None
    linked_entity_id: str | None = None
    confirmed: bool = False
    created_at: datetime
