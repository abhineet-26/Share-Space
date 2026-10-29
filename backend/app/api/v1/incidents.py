from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models import Incident, IncidentComment, Role, User
from app.schemas.incident import (
    IncidentCommentCreate,
    IncidentCommentRead,
    IncidentRead,
    IncidentResolveRequest,
)
from app.services.incident import (
    add_incident_comment as add_comment_service,
)
from app.services.incident import (
    get_incident as get_incident_service,
)
from app.services.incident import (
    list_incidents as list_incidents_service,
)
from app.services.incident import (
    resolve_incident as resolve_incident_service,
)

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get(
    "",
    response_model=list[IncidentRead],
    summary="List organization incidents with permissions filtering",
)
async def list_incidents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[IncidentRead]:
    return await list_incidents_service(session, current_user)


@router.get(
    "/{incident_id}",
    response_model=IncidentRead,
    summary="Get incident detail with comments and attachments",
)
async def get_incident(
    incident_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Incident:
    return await get_incident_service(session, current_user, incident_id)


@router.post(
    "/{incident_id}/comments",
    response_model=IncidentCommentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a communication comment to an incident investigation",
)
async def add_comment(
    incident_id: str,
    payload: IncidentCommentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> IncidentComment:
    return await add_comment_service(session, current_user, incident_id, payload.message)


@router.post(
    "/{incident_id}/resolution",
    response_model=IncidentRead,
    summary="Authorised staff review and resolve an incident without automated penalties",
)
async def resolve_incident(
    incident_id: str,
    payload: IncidentResolveRequest,
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
    session: AsyncSession = Depends(get_db),
) -> Incident:
    return await resolve_incident_service(session, current_user, incident_id, payload)
