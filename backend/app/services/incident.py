from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Attachment,
    Booking,
    Incident,
    IncidentComment,
    IncidentStatus,
    LedgerEntityType,
    Resource,
    ResourceStatus,
    Role,
    User,
)
from app.schemas.incident import (
    IncidentCreate,
    IncidentRead,
    IncidentResolveRequest,
)
from app.services.ledger import append_ledger_event


async def list_incidents(session: AsyncSession, actor: User) -> list[IncidentRead]:
    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)

    stmt = select(Incident, Resource).join(Resource, Incident.resource_id == Resource.id).order_by(Incident.created_at.desc())
    if not is_staff:
        stmt = stmt.where(Incident.reporter_id == actor.id)

    res = await session.execute(stmt)
    rows = res.all()

    incidents: list[IncidentRead] = []
    for inc, resource in rows:
        inc_data = IncidentRead.model_validate(inc)
        inc_data.resource_name = resource.name
        incidents.append(inc_data)
    return incidents


async def get_incident(session: AsyncSession, actor: User, incident_id: str) -> Incident:
    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(selectinload(Incident.comments))
    )
    res = await session.execute(stmt)
    incident = res.scalar_one_or_none()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "INCIDENT_NOT_FOUND", "message": "Incident report not found."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if not is_staff and incident.reporter_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You can only view incidents you reported or are authorised to review."},
        )

    return incident


async def create_incident(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    payload: IncidentCreate,
) -> Incident:
    bkg_stmt = select(Booking).where(Booking.id == booking_id)
    bkg_res = await session.execute(bkg_stmt)
    booking = bkg_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    attachment_ids: list[str] = []
    attachment_hashes: list[str] = []

    for ph in (payload.photos or [])[:4]:
        raw_bytes = (ph.data_url + ph.file_name).encode("utf-8")
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()

        att = Attachment(
            organization_id=actor.organization_id,
            file_name=ph.file_name,
            mime_type=ph.mime_type or "image/svg+xml",
            size_bytes=len(ph.data_url),
            sha256=sha256_hash,
            data_url=ph.data_url,
            uploaded_by=actor.id,
            linked_entity_type="INCIDENT",
            confirmed=True,
        )
        session.add(att)
        await session.flush()
        att.linked_entity_id = att.id
        attachment_ids.append(att.id)
        attachment_hashes.append(sha256_hash)

    incident = Incident(
        organization_id=actor.organization_id,
        booking_id=booking.id,
        resource_id=booking.resource_id,
        reporter_id=actor.id,
        reporter_name=actor.name,
        category=payload.category,
        reported_stage=payload.reported_stage or "User report",
        affected_part=payload.affected_part,
        description=payload.description.strip(),
        attachment_ids=attachment_ids,
        attachment_hashes=attachment_hashes,
        status=IncidentStatus.REPORTED,
        requires_human_review=True,
        assisted_draft_used=payload.assisted_draft_used,
    )
    session.add(incident)
    await session.flush()

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action="INCIDENT_REPORTED",
        entity_type=LedgerEntityType.INCIDENT,
        entity_id=incident.id,
        reason=incident.description,
        metadata={
            "bookingId": booking.id,
            "resourceId": booking.resource_id,
            "category": incident.category,
            "assistedDraftUsed": incident.assisted_draft_used,
            "attachmentSha256": attachment_hashes,
        },
    )

    return await get_incident(session, actor, incident.id)


async def add_incident_comment(
    session: AsyncSession,
    actor: User,
    incident_id: str,
    message: str,
) -> IncidentComment:
    incident = await get_incident(session, actor, incident_id)

    if not message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Comment text cannot be empty."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    comment = IncidentComment(
        incident_id=incident.id,
        author_id=actor.id,
        author_name=actor.name,
        author_role=actor_roles[0] if actor_roles else "USER",
        message=message.strip(),
    )
    session.add(comment)
    await session.flush()

    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action="INCIDENT_COMMENT_ADDED",
        entity_type=LedgerEntityType.INCIDENT,
        entity_id=incident.id,
        reason=comment.message,
        metadata={"bookingId": incident.booking_id},
    )

    return comment


async def resolve_incident(
    session: AsyncSession,
    actor: User,
    incident_id: str,
    payload: IncidentResolveRequest,
) -> Incident:
    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only authorised staff can review and resolve incidents."},
        )

    incident = await get_incident(session, actor, incident_id)

    now = datetime.now(UTC)
    incident.status = payload.status
    incident.reviewer_id = actor.id
    incident.reviewer_name = actor.name
    incident.resolution_outcome = payload.resolution_outcome
    incident.resolution = payload.resolution.strip()
    if payload.status == IncidentStatus.RESOLVED:
        incident.resolved_at = now

    if payload.mark_resource_maintenance:
        res_stmt = select(Resource).where(Resource.id == incident.resource_id)
        res_res = await session.execute(res_stmt)
        res_obj = res_res.scalar_one_or_none()
        if res_obj:
            res_obj.status = ResourceStatus.MAINTENANCE

    await session.flush()

    action_label = "INCIDENT_RESOLVED" if payload.status == IncidentStatus.RESOLVED else f"INCIDENT_{payload.status.value}"
    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "MANAGER",
        action=action_label,
        entity_type=LedgerEntityType.INCIDENT,
        entity_id=incident.id,
        reason=incident.resolution,
        metadata={
            "bookingId": incident.booking_id,
            "resourceId": incident.resource_id,
            "resolutionOutcome": incident.resolution_outcome,
            "reviewerId": actor.id,
        },
    )

    return incident
