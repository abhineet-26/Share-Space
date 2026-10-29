from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError, RequestValidationError
from app.models import Resource, User
from app.schemas.policy import EligibilityCheckRequest, EligibilityEvaluationResult
from app.services.policy import evaluate_eligibility

router = APIRouter(tags=["Eligibility Engine"])


@router.post(
    "/bookings/eligibility-check",
    response_model=EligibilityEvaluationResult,
    status_code=status.HTTP_200_OK,
    summary="Preview deterministic eligibility for a hypothetical booking request",
)
@router.post(
    "/eligibility/evaluate",
    response_model=EligibilityEvaluationResult,
    status_code=status.HTTP_200_OK,
    summary="Evaluate deterministic eligibility for a booking request",
)
async def check_eligibility(
    payload: EligibilityCheckRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EligibilityEvaluationResult:
    start_time = payload.start or payload.start_at
    end_time = payload.end or payload.end_at
    if not start_time or not end_time:
        raise RequestValidationError("Both start and end timestamps are required.")

    # Target user (defaults to current_user, or manager/admin can evaluate on behalf of another user)
    target_user = current_user
    if payload.user_id and payload.user_id != current_user.id:
        target_user = await session.get(User, payload.user_id)
        if not target_user:
            raise NotFoundError("User", payload.user_id)

    # Fetch resource
    res_stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == payload.resource_id)
    )
    resource = (await session.execute(res_stmt)).scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource", payload.resource_id)

    return await evaluate_eligibility(
        session=session,
        user=target_user,
        resource=resource,
        start_at=start_time,
        end_at=end_time,
        exclude_booking_id=payload.exclude_booking_id,
    )
