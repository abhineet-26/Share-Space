from __future__ import annotations

import contextlib
import secrets
from typing import Annotated

import ulid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.exceptions import (
    ForbiddenError,
    NotFoundError,
    ReasonRequiredError,
    RequestValidationError,
)
from app.models import (
    Asset,
    AssetStatus,
    AvailabilityWindow,
    Booking,
    BookingStatus,
    LedgerEntityType,
    Policy,
    PolicyStatus,
    PolicyVersion,
    RequirementType,
    Resource,
    ResourceCategory,
    ResourceRequirement,
    ResourceStatus,
    Role,
    SupervisionLevel,
    User,
)
from app.schemas.asset import AssetCreate, AssetRead
from app.schemas.booking import BookingRead, ResourceAvailabilityResponse
from app.schemas.resource import (
    ActivePolicyItem,
    PolicyRead,
    PolicyVersionRead,
    RequirementRead,
    ResourceCreate,
    ResourceDetailResponse,
    ResourcePublishRequest,
    ResourceRead,
    ResourceUpdate,
    WaitlistBookingItem,
)
from app.services.ledger import append_ledger_event

MIN_REASON_LENGTH = 5

router = APIRouter(prefix="/resources", tags=["Resources"])


def _to_resource_read(res: Resource) -> ResourceRead:
    requirements_list = [
        RequirementRead(
            key=req.key,
            type=req.type,
            label=req.label,
            value=req.value,
        )
        for req in (res.requirements if hasattr(res, "requirements") and res.requirements else [])
    ]
    availability_list = list(
        res.availability if hasattr(res, "availability") and res.availability else []
    )
    return ResourceRead(
        id=res.id,
        organization_id=res.organization_id,
        owner_id=res.owner_id,
        owner_name=res.owner_name,
        department=res.department,
        name=res.name,
        model_number=res.model_number,
        category=res.category,
        illustration_type=res.illustration_type,
        location=res.location,
        access_instructions=res.access_instructions,
        description=res.description,
        condition=res.condition,
        status=res.status,
        supervision=res.supervision,
        accessories=res.accessories or [],
        usage_rules=res.usage_rules,
        return_rules=res.return_rules,
        cancellation_policy=res.cancellation_policy,
        policy_ids=res.policy_ids or [],
        requirements=requirements_list,
        availability=availability_list,
    )


@router.get(
    "",
    response_model=list[ResourceRead],
    status_code=status.HTTP_200_OK,
    summary="List resources with search and attribute filters",
)
async def list_resources(  # noqa: PLR0913
    _current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, description="Search across name, description, location, etc."),
    category: str | None = Query(None, description="Filter by resource category"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    supervision: str | None = Query(None, description="Filter by supervision level"),
    training_required: bool | None = Query(None, alias="trainingRequired", description="Filter by training required"),
) -> list[ResourceRead]:
    stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .order_by(Resource.name.asc())
    )

    if category and category.upper() != "ALL":
        with contextlib.suppress(ValueError):
            stmt = stmt.where(Resource.category == ResourceCategory(category))

    if status_filter and status_filter.upper() != "ALL":
        with contextlib.suppress(ValueError):
            stmt = stmt.where(Resource.status == ResourceStatus(status_filter))

    if supervision and supervision.upper() != "ALL":
        with contextlib.suppress(ValueError):
            stmt = stmt.where(Resource.supervision == SupervisionLevel(supervision))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Resource.name).like(term),
                func.lower(Resource.description).like(term),
                func.lower(Resource.location).like(term),
                func.lower(Resource.department).like(term),
                func.lower(Resource.model_number).like(term),
            )
        )

    if training_required is not None:
        if training_required:
            stmt = stmt.where(
                Resource.id.in_(
                    select(ResourceRequirement.resource_id).where(
                        ResourceRequirement.type == RequirementType.TRAINING
                    )
                )
            )
        else:
            stmt = stmt.where(
                ~Resource.id.in_(
                    select(ResourceRequirement.resource_id).where(
                        ResourceRequirement.type == RequirementType.TRAINING
                    )
                )
            )

    result = await session.execute(stmt)
    resources = result.scalars().all()
    return [_to_resource_read(r) for r in resources]


@router.get(
    "/{resource_id}",
    response_model=ResourceDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get resource specifications, assets, active policies, and waitlist count",
)
async def get_resource(
    resource_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ResourceDetailResponse:
    stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == resource_id)
    )
    result = await session.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource", resource_id)

    # Fetch physical assets
    asset_stmt = select(Asset).where(Asset.resource_id == resource_id).order_by(Asset.created_at.asc())
    asset_res = await session.execute(asset_stmt)
    assets = [AssetRead.model_validate(a) for a in asset_res.scalars().all()]

    # Fetch waitlist count
    waitlist_count = await session.scalar(
        select(func.count(Booking.id)).where(
            Booking.resource_id == resource_id,
            Booking.status == BookingStatus.WAITLISTED,
        )
    ) or 0

    # Fetch active policies
    policy_stmt = (
        select(Policy)
        .where(
            Policy.organization_id == current_user.organization_id,
            Policy.status == PolicyStatus.ACTIVE,
        )
    )
    policy_res = await session.execute(policy_stmt)
    all_active_policies = policy_res.scalars().all()

    active_policy_items: list[ActivePolicyItem] = []
    for pol in all_active_policies:
        scope_type = (
            pol.scope_type.value
            if hasattr(pol.scope_type, "value")
            else str(pol.scope_type)
        )
        scope_id = pol.scope_id
        matches = (
            scope_type == "ORG"
            or (scope_type == "RESOURCE" and scope_id == resource.id)
            or pol.id in (resource.policy_ids or [])
        )
        if matches:
            version_stmt = select(PolicyVersion).where(
                PolicyVersion.policy_id == pol.id,
                PolicyVersion.version == pol.active_version,
            )
            v_res = await session.execute(version_stmt)
            p_ver = v_res.scalar_one_or_none()
            active_policy_items.append(
                ActivePolicyItem(
                    policy=PolicyRead.model_validate(pol),
                    version=PolicyVersionRead.model_validate(p_ver) if p_ver else None,
                )
            )

    return ResourceDetailResponse(
        resource=_to_resource_read(resource),
        assets=assets,
        active_policies=active_policy_items,
        waitlist_count=waitlist_count,
    )


@router.post(
    "",
    response_model=ResourceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new resource listing (Owner, Manager, Admin)",
)
async def create_resource(
    payload: ResourceCreate,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN], "Create resource listing")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ResourceRead:
    if not payload.name.strip() or not payload.location.strip():
        raise RequestValidationError("Resource name and location are required.")

    resource_id = f"res_{ulid.new().str.lower()}"
    new_res = Resource(
        id=resource_id,
        organization_id=current_user.organization_id,
        owner_id=current_user.id,
        owner_name=f"{current_user.name} ({current_user.department})",
        department=payload.department or current_user.department,
        name=payload.name.strip(),
        model_number=payload.model_number,
        category=payload.category,
        illustration_type=payload.illustration_type,
        location=payload.location.strip(),
        access_instructions=payload.access_instructions,
        description=payload.description,
        condition=payload.condition,
        status=payload.status,
        supervision=payload.supervision,
        accessories=payload.accessories or [],
        usage_rules=payload.usage_rules,
        return_rules=payload.return_rules,
        cancellation_policy=payload.cancellation_policy,
        policy_ids=payload.policy_ids or [],
    )
    session.add(new_res)
    await session.flush()

    # Add requirements
    for req in payload.requirements:
        r_item = ResourceRequirement(
            resource_id=new_res.id,
            key=req.key,
            type=req.type,
            label=req.label,
            value=req.value,
        )
        session.add(r_item)

    # Add availability windows
    for av in payload.availability:
        av_item = AvailabilityWindow(
            resource_id=new_res.id,
            day_of_week=av.day_of_week,
            start=av.start,
            end=av.end,
            recurrence=av.recurrence,
        )
        session.add(av_item)

    # Automatically provision default unit asset with unguessable QR token
    asset_id = f"ast_{ulid.new().str.lower()}"
    category_code = new_res.category.value[:2].upper()
    asset_tag = f"{current_user.organization_id.upper()[:3]}-{category_code}-{secrets.token_hex(2).upper()}"
    qr_token = f"qr_{current_user.organization_id}_{secrets.token_hex(8)}"
    default_asset = Asset(
        id=asset_id,
        organization_id=current_user.organization_id,
        resource_id=new_res.id,
        asset_tag=asset_tag,
        serial_number=f"SN-{secrets.token_hex(4).upper()}",
        qr_token=qr_token,
        condition=new_res.condition,
        status=AssetStatus.AVAILABLE,
    )
    session.add(default_asset)

    # Append audit event to Trust Ledger
    actor_role_str = (
        current_user.roles[0].value
        if hasattr(current_user.roles[0], "value")
        else str(current_user.roles[0])
    )
    await append_ledger_event(
        session=session,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=actor_role_str,
        action="RESOURCE_CREATED",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id=new_res.id,
        reason=f'Created resource listing "{new_res.name}" in status {new_res.status.value}.',
        metadata={
            "category": new_res.category.value,
            "supervision": new_res.supervision.value,
            "status": new_res.status.value,
        },
    )

    await session.flush()
    # Reload with relationships
    stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == new_res.id)
    )
    res_loaded = (await session.execute(stmt)).scalar_one()
    return _to_resource_read(res_loaded)


@router.patch(
    "/{resource_id}",
    response_model=ResourceRead,
    status_code=status.HTTP_200_OK,
    summary="Update resource configuration (Owner, Manager, Admin)",
)
@router.put(
    "/{resource_id}",
    response_model=ResourceRead,
    status_code=status.HTTP_200_OK,
    summary="Update resource configuration (Owner, Manager, Admin)",
)
async def update_resource(
    resource_id: str,
    payload: ResourceUpdate,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN], "Update resource listing")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ResourceRead:
    stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == resource_id)
    )
    result = await session.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource", resource_id)

    # If user is only OWNER, they must own this resource
    user_roles_str = [r.value if hasattr(r, "value") else str(r) for r in current_user.roles]
    if (
        "OWNER" in user_roles_str
        and not any(r in ["MANAGER", "ADMIN"] for r in user_roles_str)
        and resource.owner_id != current_user.id
    ):
        raise ForbiddenError(
            action="Update another user's resource",
            required_roles=["MANAGER", "ADMIN"],
            current_roles=user_roles_str,
        )

    update_dict = payload.model_dump(exclude_unset=True, exclude={"reason"})
    for field, val in update_dict.items():
        if hasattr(resource, field) and val is not None:
            setattr(resource, field, val)

    actor_role_str = (
        current_user.roles[0].value
        if hasattr(current_user.roles[0], "value")
        else str(current_user.roles[0])
    )
    await append_ledger_event(
        session=session,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=actor_role_str,
        action="RESOURCE_UPDATED",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id=resource.id,
        reason=payload.reason or "Updated resource configuration and usage conditions.",
        metadata={"status": resource.status.value, "condition": resource.condition.value},
    )

    await session.flush()
    return _to_resource_read(resource)


@router.post(
    "/{resource_id}/publish",
    response_model=ResourceRead,
    status_code=status.HTTP_200_OK,
    summary="Change resource publishing lifecycle status (Owner, Manager, Admin)",
)
async def publish_resource(
    resource_id: str,
    payload: ResourcePublishRequest,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN], "Change resource status")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ResourceRead:
    reason_clean = (payload.reason or "").strip()
    if len(reason_clean) < MIN_REASON_LENGTH:
        raise ReasonRequiredError("Change resource status", min_length=MIN_REASON_LENGTH)

    stmt = (
        select(Resource)
        .options(
            selectinload(Resource.requirements),
            selectinload(Resource.availability),
        )
        .where(Resource.id == resource_id)
    )
    result = await session.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError("Resource", resource_id)

    prev_status = resource.status.value
    resource.status = payload.status

    actor_role_str = (
        current_user.roles[0].value
        if hasattr(current_user.roles[0], "value")
        else str(current_user.roles[0])
    )
    await append_ledger_event(
        session=session,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=actor_role_str,
        action=f"RESOURCE_{payload.status.value}",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id=resource.id,
        reason=reason_clean,
        metadata={"previousStatus": prev_status, "newStatus": payload.status.value},
    )

    await session.flush()
    return _to_resource_read(resource)


@router.get(
    "/{resource_id}/availability",
    response_model=ResourceAvailabilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get active bookings for calendar display",
)
async def get_resource_availability(
    resource_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ResourceAvailabilityResponse:
    resource = await session.get(Resource, resource_id)
    if not resource:
        raise NotFoundError("Resource", resource_id)

    stmt = (
        select(Booking)
        .where(
            Booking.resource_id == resource_id,
            ~Booking.status.in_([BookingStatus.CANCELLED, BookingStatus.REJECTED]),
        )
        .order_by(Booking.start_at.asc())
    )
    result = await session.execute(stmt)
    bookings = result.scalars().all()
    return ResourceAvailabilityResponse(
        bookings=[BookingRead.model_validate(b) for b in bookings]
    )


@router.get(
    "/{resource_id}/waitlist",
    response_model=list[WaitlistBookingItem],
    status_code=status.HTTP_200_OK,
    summary="Get waitlisted bookings for a resource sorted by position",
)
async def get_resource_waitlist(
    resource_id: str,
    _current_user: Annotated[
        User,
        Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN], "View resource waitlist")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[WaitlistBookingItem]:
    resource = await session.get(Resource, resource_id)
    if not resource:
        raise NotFoundError("Resource", resource_id)

    stmt = (
        select(Booking)
        .where(
            Booking.resource_id == resource_id,
            Booking.status == BookingStatus.WAITLISTED,
        )
        .order_by(Booking.waitlist_position.asc().nulls_last(), Booking.created_at.asc())
    )
    result = await session.execute(stmt)
    waitlist_bookings = result.scalars().all()

    items: list[WaitlistBookingItem] = []
    for b in waitlist_bookings:
        user = await session.get(User, b.user_id)
        items.append(
            WaitlistBookingItem(
                id=b.id,
                user_id=b.user_id,
                user_name=user.name if user else b.user_name,
                resource_id=b.resource_id,
                status=b.status.value,
                waitlist_position=b.waitlist_position,
                start_at=b.start_at,
                end_at=b.end_at,
                created_at=b.created_at,
            )
        )
    return items


@router.post(
    "/{resource_id}/assets",
    response_model=AssetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a physical asset unit for a resource",
)
async def create_asset_for_resource(
    resource_id: str,
    payload: AssetCreate,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN], "Register asset unit")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AssetRead:
    resource = await session.get(Resource, resource_id)
    if not resource:
        raise NotFoundError("Resource", resource_id)

    asset_id = f"ast_{ulid.new().str.lower()}"
    qr_token = f"qr_{current_user.organization_id}_{resource_id[:8]}_{secrets.token_hex(4)}"

    new_asset = Asset(
        id=asset_id,
        organization_id=current_user.organization_id,
        resource_id=resource.id,
        asset_tag=payload.asset_tag.strip(),
        serial_number=payload.serial_number.strip(),
        qr_token=qr_token,
        condition=resource.condition,
        status=AssetStatus.AVAILABLE,
    )
    session.add(new_asset)

    actor_role_str = (
        current_user.roles[0].value
        if hasattr(current_user.roles[0], "value")
        else str(current_user.roles[0])
    )
    await append_ledger_event(
        session=session,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=actor_role_str,
        action="ASSET_REGISTERED",
        entity_type=LedgerEntityType.RESOURCE,
        entity_id=resource.id,
        reason=f"Registered physical unit {new_asset.asset_tag} ({new_asset.serial_number}).",
        metadata={
            "assetId": new_asset.id,
            "assetTag": new_asset.asset_tag,
            "qrToken": new_asset.qr_token,
        },
    )

    await session.flush()
    return AssetRead.model_validate(new_asset)
