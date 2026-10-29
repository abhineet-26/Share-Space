from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import (
    LedgerEntityType,
    Organization,
    Resource,
    TrainingRecord,
    User,
    VerificationStatus,
)
from app.schemas.analytics import ProfileDataResponse, TrainingRecordRead, UsageByResourceItem
from app.schemas.auth import OrganizationRead, UserRead
from app.schemas.base import CamelModel
from app.services.ledger import append_ledger_event
from app.services.policy import get_rolling_usage_hours

router = APIRouter(prefix="/profile", tags=["profile"])


class TrainingRequestPayload(CamelModel):
    training_type: str = Field(..., alias="trainingType")
    label: str


@router.get("/data", response_model=ProfileDataResponse)
async def get_my_profile_data(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileDataResponse:
    """Get current user's profile, institution, verified trainings, and rolling 7-day usage."""
    org = await session.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    t_stmt = select(TrainingRecord).where(
        TrainingRecord.organization_id == current_user.organization_id,
        TrainingRecord.user_id == current_user.id,
    )
    t_res = await session.execute(t_stmt)
    trainings = list(t_res.scalars().all())

    r_stmt = select(Resource).where(Resource.organization_id == current_user.organization_id)
    r_res = await session.execute(r_stmt)
    resources = list(r_res.scalars().all())

    usage_items: list[UsageByResourceItem] = []
    for r in resources:
        hrs = await get_rolling_usage_hours(session, current_user.id, r.id, window_days=7)
        usage_items.append(
            UsageByResourceItem(
                resource_id=r.id,
                resource_name=r.name,
                hours_used_7d=hrs,
            )
        )

    training_reads = [
        TrainingRecordRead(
            id=t.id,
            organization_id=t.organization_id,
            user_id=t.user_id,
            type=t.type,
            label=t.label,
            status=t.status.value if hasattr(t.status, "value") else str(t.status),
            source=t.source,
            verified_by=t.verified_by,
            expires_at=t.expires_at.isoformat() if t.expires_at else None,
        )
        for t in trainings
    ]

    return ProfileDataResponse(
        user=UserRead.model_validate(current_user),
        organization=OrganizationRead.model_validate(org),
        trainings=training_reads,
        usage_by_resource=usage_items,
    )


@router.post("/training/request", response_model=TrainingRecordRead)
async def request_training(
    payload: TrainingRequestPayload,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TrainingRecordRead:
    """Submit a training induction or certification verification request."""
    record = TrainingRecord(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        type=payload.training_type,
        label=payload.label,
        status=VerificationStatus.PENDING,
        source="STUDENT_REQUEST",
    )
    session.add(record)
    await session.flush()

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in current_user.roles]
    await append_ledger_event(
        session=session,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action="TRAINING_ENROLLMENT_REQUESTED",
        entity_type=LedgerEntityType.TRAINING,
        entity_id=record.id,
        reason=f"{current_user.name} requested practical verification for {payload.label}.",
        metadata={"trainingType": payload.training_type},
    )

    return TrainingRecordRead(
        id=record.id,
        organization_id=record.organization_id,
        user_id=record.user_id,
        type=record.type,
        label=record.label,
        status=record.status.value if hasattr(record.status, "value") else str(record.status),
        source=record.source,
        verified_by=record.verified_by,
        expires_at=None,
    )
