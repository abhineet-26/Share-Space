from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models import (
    Attachment,
    Booking,
    BookingStatus,
    ConditionReport,
    Incident,
    LedgerEntityType,
    LedgerEvent,
    Resource,
    Role,
    User,
)
from app.schemas.attachment import AttachmentRead
from app.schemas.auth import UserRead
from app.schemas.booking import (
    BookingCancelRequest,
    BookingCreate,
    BookingDecisionRequest,
    BookingDetailResponse,
    BookingEnrichedOrgRead,
    BookingEnrichedUserRead,
    BookingRead,
)
from app.schemas.condition import ConditionReportRead
from app.schemas.incident import IncidentRead
from app.schemas.ledger import LedgerEventRead
from app.schemas.resource import ResourceRead
from app.services.booking import (
    cancel_booking as cancel_booking_service,
)
from app.services.booking import (
    create_booking as create_booking_service,
)
from app.services.booking import (
    decide_booking as decide_booking_service,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a booking request with idempotency key",
)
async def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Booking:
    return await create_booking_service(session, current_user, payload)


@router.get(
    "/mine",
    response_model=list[BookingEnrichedUserRead],
    summary="Get current user's bookings with resource enrichment",
)
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    stmt = (
        select(Booking, Resource)
        .join(Resource, Booking.resource_id == Resource.id)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    result = await session.execute(stmt)
    rows = result.all()

    enriched: list[dict[str, Any]] = []
    for bkg, res in rows:
        data = BookingRead.model_validate(bkg).model_dump(by_alias=True)
        data["resourceName"] = res.name
        data["resourceLocation"] = res.location
        data["resourceSupervision"] = res.supervision.value if hasattr(res.supervision, "value") else str(res.supervision)
        enriched.append(data)
    return enriched


@router.get(
    "/org",
    response_model=list[BookingEnrichedOrgRead],
    summary="Get all organization bookings (manager/admin/owner view)",
)
async def get_all_organization_bookings(
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    stmt = (
        select(Booking, Resource, User)
        .join(Resource, Booking.resource_id == Resource.id)
        .join(User, Booking.user_id == User.id)
        .order_by(Booking.created_at.desc())
    )
    result = await session.execute(stmt)
    rows = result.all()

    enriched: list[dict[str, Any]] = []
    for bkg, res, requester in rows:
        data = BookingRead.model_validate(bkg).model_dump(by_alias=True)
        data["resourceName"] = res.name
        data["resourceLocation"] = res.location
        data["resourceSupervision"] = res.supervision.value if hasattr(res.supervision, "value") else str(res.supervision)
        data["requesterName"] = requester.name
        data["requesterEmail"] = requester.email
        data["requesterDepartment"] = requester.department or ""
        enriched.append(data)
    return enriched


@router.get(
    "/{booking_id}",
    response_model=BookingDetailResponse,
    summary="Get full booking detail with timeline, condition reports, incidents, and ledger events",
)
async def get_booking_detail(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> BookingDetailResponse:
    bkg_stmt = select(Booking).where(Booking.id == booking_id)
    bkg_res = await session.execute(bkg_stmt)
    booking = bkg_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking record not found."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in current_user.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if booking.user_id != current_user.id and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You do not have permission to view another user's private booking details."},
        )

    # 1. Fetch resource and requester
    res_stmt = (
        select(Resource)
        .where(Resource.id == booking.resource_id)
        .options(
            selectinload(Resource.assets),
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
    )
    res_result = await session.execute(res_stmt)
    resource = res_result.scalar_one()

    user_stmt = select(User).where(User.id == booking.user_id)
    user_result = await session.execute(user_stmt)
    requester = user_result.scalar_one()

    # 2. Fetch condition reports
    cr_stmt = select(ConditionReport).where(ConditionReport.booking_id == booking.id)
    cr_res = await session.execute(cr_stmt)
    condition_reports = cr_res.scalars().all()

    # 3. Fetch incidents with comments
    inc_stmt = select(Incident).where(Incident.booking_id == booking.id).options(selectinload(Incident.comments))
    inc_res = await session.execute(inc_stmt)
    incidents = inc_res.scalars().all()

    # 4. Fetch ledger events related to this booking
    led_stmt = (
        select(LedgerEvent)
        .where(
            or_(
                (LedgerEvent.entity_type == LedgerEntityType.BOOKING) & (LedgerEvent.entity_id == booking.id),
                LedgerEvent.event_metadata["bookingId"].astext == booking.id,
            )
        )
        .order_by(LedgerEvent.seq.asc())
    )
    led_res = await session.execute(led_stmt)
    ledger_events = led_res.scalars().all()

    # 5. Fetch associated attachments
    attachment_ids = set()
    for cr in condition_reports:
        for att_id in cr.attachment_ids or []:
            attachment_ids.add(att_id)
    for inc in incidents:
        for att_id in inc.attachment_ids or []:
            attachment_ids.add(att_id)

    attachments: list[Attachment] = []
    if attachment_ids:
        att_stmt = select(Attachment).where(Attachment.id.in_(attachment_ids))
        att_res = await session.execute(att_stmt)
        attachments = att_res.scalars().all()

    # 6. Fetch competing requests
    competing_stmt = (
        select(Booking, User)
        .join(User, Booking.user_id == User.id)
        .where(
            Booking.resource_id == booking.resource_id,
            Booking.id != booking.id,
            Booking.status.not_in([
                BookingStatus.CANCELLED,
                BookingStatus.REJECTED,
                BookingStatus.CLOSED,
                BookingStatus.RETURNED,
            ]),
            Booking.start_at < booking.end_at,
            Booking.end_at > booking.start_at,
        )
    )
    comp_res = await session.execute(competing_stmt)
    competing_rows = comp_res.all()

    competing_requests: list[dict[str, Any]] = []
    for b, u in competing_rows:
        data = BookingRead.model_validate(b).model_dump(by_alias=True)
        data["resourceName"] = resource.name
        data["resourceLocation"] = resource.location
        data["resourceSupervision"] = resource.supervision.value if hasattr(resource.supervision, "value") else str(resource.supervision)
        data["requesterName"] = u.name
        data["requesterEmail"] = u.email
        data["requesterDepartment"] = u.department or ""
        competing_requests.append(data)

    return BookingDetailResponse(
        booking=BookingRead.model_validate(booking),
        resource=ResourceRead.model_validate(resource),
        requester=UserRead.model_validate(requester),
        condition_reports=[ConditionReportRead.model_validate(cr) for cr in condition_reports],
        incidents=[IncidentRead.model_validate(inc) for inc in incidents],
        ledger_events=[LedgerEventRead.model_validate(le) for le in ledger_events],
        attachments=[AttachmentRead.model_validate(a) for a in attachments],
        competing_requests=[BookingEnrichedOrgRead.model_validate(cr) for cr in competing_requests],
    )


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingRead,
    summary="Cancel a booking request",
)
async def cancel_booking(
    booking_id: str,
    payload: BookingCancelRequest = BookingCancelRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Booking:
    return await cancel_booking_service(session, current_user, booking_id, payload.reason)


@router.post(
    "/{booking_id}/decision",
    response_model=BookingRead,
    summary="Manager decision on a booking request (approve, reject, waitlist, needs info)",
)
async def decide_booking(
    booking_id: str,
    payload: BookingDecisionRequest,
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
    session: AsyncSession = Depends(get_db),
) -> Booking:
    return await decide_booking_service(session, current_user, booking_id, payload)
