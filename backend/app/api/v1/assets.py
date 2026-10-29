from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.api.v1.resources import _to_resource_read
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models import Asset, Booking, BookingStatus, Resource, User
from app.schemas.asset import AllowedAction, AssetRead, AssetScanResponse

router = APIRouter(prefix="/assets", tags=["Assets & QR"])


@router.get(
    "/scan/{qr_token}",
    response_model=AssetScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan an institutional asset QR token and receive contextual permitted actions",
)
async def scan_asset_qr(
    qr_token: str,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AssetScanResponse:
    clean_token = qr_token.strip().lower()

    stmt = select(Asset).where(
        or_(
            func.lower(Asset.qr_token) == clean_token,
            func.lower(Asset.asset_tag) == clean_token,
        )
    )
    result = await session.execute(stmt)
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundError("Asset", qr_token)

    # Fetch associated Resource
    res_stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == asset.resource_id)
    )
    resource = (await session.execute(res_stmt)).scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource", asset.resource_id)

    user_roles_str = [r.value if hasattr(r, "value") else str(r) for r in current_user.roles]
    is_staff = any(r in ["OWNER", "MANAGER", "ADMIN"] for r in user_roles_str)

    allowed_actions: list[AllowedAction] = []

    # 1. Check if actor has an APPROVED booking for this resource
    appr_stmt = select(Booking).where(
        Booking.resource_id == resource.id,
        Booking.user_id == current_user.id,
        Booking.status == BookingStatus.APPROVED,
    )
    appr_booking = (await session.execute(appr_stmt)).scalar_one_or_none()
    if appr_booking:
        allowed_actions.append(
            AllowedAction(
                type="CHECK_IN",
                label="Start check-in & initial condition report",
                booking_id=appr_booking.id,
                description=f"You hold approved booking {appr_booking.id} for {resource.name}.",
            )
        )

    # 2. Check if actor has an active checkout (CHECKED_OUT_TO_USER or OVERDUE)
    active_stmt = select(Booking).where(
        Booking.resource_id == resource.id,
        Booking.status.in_([BookingStatus.CHECKED_OUT_TO_USER, BookingStatus.OVERDUE]),
    )
    if not is_staff:
        active_stmt = active_stmt.where(Booking.user_id == current_user.id)
    active_booking = (await session.execute(active_stmt)).scalars().first()
    if active_booking:
        allowed_actions.append(
            AllowedAction(
                type="RETURN",
                label="Submit return & final condition report",
                booking_id=active_booking.id,
                description=f"Active checkout {active_booking.id} is ready for return inspection.",
            )
        )

    # 3. Check if staff can confirm pending return (RETURN_PENDING_CONFIRMATION)
    if is_staff:
        pending_stmt = select(Booking).where(
            Booking.resource_id == resource.id,
            Booking.status == BookingStatus.RETURN_PENDING_CONFIRMATION,
        )
        pending_booking = (await session.execute(pending_stmt)).scalars().first()
        if pending_booking:
            allowed_actions.append(
                AllowedAction(
                    type="STAFF_CONFIRM_RETURN",
                    label="Confirm supervised return (Staff)",
                    booking_id=pending_booking.id,
                    description=f"Booking {pending_booking.id} is awaiting staff return verification.",
                )
            )

    # 4. Always provide VIEW_RESOURCE
    allowed_actions.append(
        AllowedAction(
            type="VIEW_RESOURCE",
            label="View resource specifications & eligibility",
            description="Inspect published requirements, availability calendar, and audit history.",
        )
    )

    if len(allowed_actions) > 1:
        roles_str = ", ".join(user_roles_str)
        explanation = (
            f"Authenticated as {current_user.name} ({roles_str}). "
            "Showing contextual actions permitted for your active bookings and role."
        )
    else:
        explanation = (
            f"Authenticated as {current_user.name}. Scanning a QR code never grants access "
            f"by itself—you do not currently hold an active approved booking for {resource.name}."
        )

    return AssetScanResponse(
        asset=AssetRead.model_validate(asset),
        resource=_to_resource_read(resource),
        allowed_actions=allowed_actions,
        explanation=explanation,
    )
