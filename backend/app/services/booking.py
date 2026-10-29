from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Asset,
    AssetStatus,
    Attachment,
    Booking,
    BookingStatus,
    CheckStatus,
    ConditionReport,
    Incident,
    IncidentStatus,
    LedgerEntityType,
    NotificationType,
    Resource,
    Role,
    SupervisionLevel,
    User,
)
from app.schemas.booking import BookingCreate, BookingDecisionRequest
from app.schemas.condition import ConditionReportCreate
from app.services.ledger import append_ledger_event
from app.services.notification import create_notification
from app.services.policy import evaluate_eligibility

ALLOWED_TRANSITIONS: dict[BookingStatus, list[BookingStatus]] = {
    BookingStatus.REQUESTED: [
        BookingStatus.PENDING_REVIEW,
        BookingStatus.ELIGIBILITY_BLOCKED,
        BookingStatus.CANCELLED,
        BookingStatus.APPROVED,
    ],
    BookingStatus.NEEDS_INFORMATION: [
        BookingStatus.PENDING_REVIEW,
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
    ],
    BookingStatus.ELIGIBILITY_BLOCKED: [
        BookingStatus.CANCELLED,
        BookingStatus.PENDING_REVIEW,
    ],
    BookingStatus.PENDING_REVIEW: [
        BookingStatus.APPROVED,
        BookingStatus.REJECTED,
        BookingStatus.WAITLISTED,
        BookingStatus.NEEDS_INFORMATION,
        BookingStatus.CANCELLED,
    ],
    BookingStatus.WAITLISTED: [
        BookingStatus.PENDING_REVIEW,
        BookingStatus.APPROVED,
        BookingStatus.REJECTED,
        BookingStatus.CANCELLED,
    ],
    BookingStatus.APPROVED: [
        BookingStatus.CANCELLED,
        BookingStatus.CHECKED_OUT_TO_USER,
        BookingStatus.OVERDUE,
    ],
    BookingStatus.REJECTED: [],
    BookingStatus.CANCELLED: [],
    BookingStatus.CHECKED_OUT_TO_USER: [
        BookingStatus.RETURN_PENDING_CONFIRMATION,
        BookingStatus.RETURNED,
        BookingStatus.CLOSED,
        BookingStatus.OVERDUE,
    ],
    BookingStatus.OVERDUE: [
        BookingStatus.RETURN_PENDING_CONFIRMATION,
        BookingStatus.RETURNED,
        BookingStatus.CLOSED,
    ],
    BookingStatus.RETURN_PENDING_CONFIRMATION: [
        BookingStatus.RETURNED,
        BookingStatus.CLOSED,
    ],
    BookingStatus.RETURNED: [BookingStatus.CLOSED],
    BookingStatus.CLOSED: [],
}

CONFIRMED_OCCUPYING_STATES = [
    BookingStatus.APPROVED,
    BookingStatus.CHECKED_OUT_TO_USER,
    BookingStatus.RETURN_PENDING_CONFIRMATION,
    BookingStatus.OVERDUE,
]
MIN_DECISION_REASON_LENGTH = 5


def validate_transition(from_state: BookingStatus, to_state: BookingStatus) -> None:
    allowed = ALLOWED_TRANSITIONS.get(from_state, [])
    if to_state not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Cannot transition booking from {from_state.value} to {to_state.value}. Allowed next states: {[s.value for s in allowed] or 'none'}.",
            },
        )


async def create_booking(
    session: AsyncSession,
    actor: User,
    payload: BookingCreate,
) -> Booking:
    """Create a booking request with server-side validation and idempotency handling."""
    # 1. Idempotency check per ARCHITECTURE.md Section 5
    if payload.idempotency_key:
        stmt = select(Booking).where(
            Booking.user_id == actor.id,
            Booking.idempotency_key == payload.idempotency_key,
        )
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

    # 2. Time parameters validation
    start_at = payload.start or payload.start_at
    end_at = payload.end or payload.end_at
    if not start_at or not end_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Both start and end times are required."},
        )
    if end_at <= start_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "End time must be after start time."},
        )

    # 3. Resource existence and tenant check
    res_stmt = select(Resource).where(Resource.id == payload.resource_id)
    res_result = await session.execute(res_stmt)
    resource = res_result.scalar_one_or_none()
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RESOURCE_NOT_FOUND", "message": "Resource not found."},
        )

    # 4. Deterministic eligibility evaluation
    eval_result = await evaluate_eligibility(
        session=session,
        user=actor,
        resource=resource,
        start_at=start_at,
        end_at=end_at,
    )

    has_mandatory_fail = any(c.status == CheckStatus.FAIL for c in eval_result.checks)
    has_conflict = any(c.key == "time_conflict" and c.status != CheckStatus.PASS for c in eval_result.checks)

    if has_conflict and not payload.join_waitlist_if_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SCHEDULE_CONFLICT",
                "message": "The requested time slot overlaps an existing confirmed reservation. You can select another slot or submit to join the priority waitlist.",
            },
        )

    initial_status = BookingStatus.PENDING_REVIEW
    waitlist_position: int | None = None
    waitlist_reason: str | None = None

    if has_mandatory_fail:
        initial_status = BookingStatus.ELIGIBILITY_BLOCKED
    elif has_conflict and payload.join_waitlist_if_conflict:
        initial_status = BookingStatus.WAITLISTED
        wl_stmt = select(func.count()).select_from(Booking).where(
            Booking.resource_id == resource.id,
            Booking.status == BookingStatus.WAITLISTED,
        )
        wl_res = await session.execute(wl_stmt)
        current_waitlist_count = wl_res.scalar_one() or 0
        waitlist_position = current_waitlist_count + 1
        waitlist_reason = (
            f"Joined waitlist at position #{waitlist_position} under published Policy POL-PRI-01 v1 "
            "while overlapping confirmed slot is active."
        )

    now = datetime.now(UTC)
    academic_group = getattr(actor, "academic_group", "") or ""
    priority_group_label = (
        "Undergraduate Capstone (Priority Tier 1)"
        if academic_group == "UNDERGRAD_CAPSTONE"
        else (
            "Graduate Research (Priority Tier 1)"
            if academic_group == "GRAD_RESEARCH"
            else "General Coursework (Priority Tier 2)"
        )
    )

    first_fail = next((c for c in eval_result.checks if c.status == CheckStatus.FAIL), None)
    decision_reason = f"Blocked by mandatory requirement: {first_fail.reason}" if has_mandatory_fail and first_fail else None

    checks_json = [c.model_dump(by_alias=True) for c in eval_result.checks]
    priority_factors = {
        "academicPriority": priority_group_label,
        "recentHoursUsed": eval_result.usage_hours_in_window,
        "requestedAt": now.isoformat(),
        "explanation": (
            f"Evaluated under policies [{', '.join(eval_result.applied_policy_version_ids)}]: "
            f"{priority_group_label}, {eval_result.usage_hours_in_window}h used in rolling 7 days."
        ),
    }

    booking = Booking(
        organization_id=actor.organization_id,
        resource_id=resource.id,
        user_id=actor.id,
        start_at=start_at,
        end_at=end_at,
        purpose=payload.purpose.strip(),
        project_code=payload.project_code.strip() if payload.project_code else None,
        team_members=payload.team_members or [],
        status=initial_status,
        idempotency_key=payload.idempotency_key or f"idem_{int(now.timestamp() * 1000)}",
        policy_version_ids=eval_result.applied_policy_version_ids,
        eligibility_checks=checks_json,
        waitlist_position=waitlist_position,
        waitlist_reason=waitlist_reason,
        priority_factors=priority_factors,
        decision_reason=decision_reason,
    )
    session.add(booking)
    await session.flush()

    action_label = (
        "BOOKING_ELIGIBILITY_BLOCKED"
        if initial_status == BookingStatus.ELIGIBILITY_BLOCKED
        else ("BOOKING_WAITLISTED" if initial_status == BookingStatus.WAITLISTED else "BOOKING_REQUESTED")
    )

    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor.roles[0].value if hasattr(actor.roles[0], "value") else str(actor.roles[0]),
        action=action_label,
        entity_type=LedgerEntityType.BOOKING,
        entity_id=booking.id,
        reason=booking.purpose,
        metadata={
            "resourceId": resource.id,
            "status": booking.status.value,
            "policyVersionIds": booking.policy_version_ids,
            "requestedHours": eval_result.requested_hours,
        },
    )

    return booking


async def cancel_booking(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    reason: str,
) -> Booking:
    """Cancel a booking, validating permissions, state transition, and logging to ledger."""
    stmt = select(Booking).where(Booking.id == booking_id)
    res = await session.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if booking.user_id != actor.id and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only the requester or an authorised manager can cancel this booking."},
        )

    validate_transition(booking.status, BookingStatus.CANCELLED)
    was_confirmed = booking.status in [BookingStatus.APPROVED]

    booking.status = BookingStatus.CANCELLED
    booking.decision_reason = reason.strip() or "Cancelled by user."
    await session.flush()

    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action="BOOKING_CANCELLED",
        entity_type=LedgerEntityType.BOOKING,
        entity_id=booking.id,
        reason=booking.decision_reason,
        metadata={"resourceId": booking.resource_id},
    )

    await create_notification(
        session=session,
        organization_id=actor.organization_id,
        user_id=booking.user_id,
        type=NotificationType.CANCELLATION,
        title="Booking Cancelled",
        message=f"Your booking for resource {booking.resource_id} has been cancelled. Notes: {booking.decision_reason}",
        related_entity_id=booking.id,
        related_path=f"/bookings/{booking.id}",
    )

    if was_confirmed:
        await promote_next_waitlisted_if_slot_open(
            session=session,
            resource_id=booking.resource_id,
            freed_start=booking.start_at,
            freed_end=booking.end_at,
            actor=actor,
        )

    return booking


async def promote_next_waitlisted_if_slot_open(
    session: AsyncSession,
    resource_id: str,
    freed_start: datetime,
    freed_end: datetime,
    actor: User,
) -> Booking | None:
    """Promote the highest priority waitlisted booking when a confirmed slot is released."""
    stmt = (
        select(Booking)
        .where(
            Booking.resource_id == resource_id,
            Booking.status == BookingStatus.WAITLISTED,
            Booking.start_at < freed_end,
            Booking.end_at > freed_start,
        )
        .order_by(Booking.waitlist_position.asc().nulls_last(), Booking.created_at.asc())
    )
    res = await session.execute(stmt)
    waitlisted = list(res.scalars().all())

    if not waitlisted:
        return None

    promoted = waitlisted[0]
    promoted.status = BookingStatus.PENDING_REVIEW
    promoted.waitlist_position = None
    promoted.waitlist_reason = "Promoted from #1 on waitlist after conflicting reservation was released."

    # Re-index remaining waitlisted requests for this resource
    for idx, w in enumerate(waitlisted[1:]):
        w.waitlist_position = idx + 1

    await session.flush()

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    await append_ledger_event(
        session=session,
        organization_id=promoted.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "SYSTEM",
        action="WAITLIST_PROMOTED",
        entity_type=LedgerEntityType.BOOKING,
        entity_id=promoted.id,
        reason="Slot released; top waitlisted request promoted to PENDING_REVIEW.",
        metadata={"resourceId": resource_id, "promotedUserId": promoted.user_id},
    )

    await create_notification(
        session=session,
        organization_id=promoted.organization_id,
        user_id=promoted.user_id,
        type=NotificationType.WAITLIST_CHANGE,
        title="Waitlist Request Promoted",
        message=f"A slot opened for resource {resource_id}! Your booking has been promoted to review.",
        related_entity_id=promoted.id,
        related_path=f"/bookings/{promoted.id}",
    )

    return promoted


async def decide_booking(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    payload: BookingDecisionRequest,
) -> Booking:
    """Authorised human review decision on a booking request with governance reasoning."""
    if not payload.reason or len(payload.reason.strip()) < MIN_DECISION_REASON_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "REASON_REQUIRED",
                "message": "A clear decision reason (at least 5 characters) is required for the audit ledger.",
            },
        )

    stmt = select(Booking).where(Booking.id == booking_id)
    res = await session.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    try:
        target_status = BookingStatus[payload.decision]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DECISION", "message": f"Unknown decision '{payload.decision}'."},
        )

    validate_transition(booking.status, target_status)

    now = datetime.now(UTC)

    if target_status == BookingStatus.APPROVED:
        # Recheck concurrency conflict with confirmed bookings
        conf_stmt = select(Booking).where(
            Booking.resource_id == booking.resource_id,
            Booking.id != booking.id,
            Booking.status.in_(CONFIRMED_OCCUPYING_STATES),
            Booking.start_at < booking.end_at,
            Booking.end_at > booking.start_at,
        )
        conf_res = await session.execute(conf_stmt)
        conflicts = conf_res.scalars().all()
        if conflicts:
            c = conflicts[0]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "OVERLAP_CONFLICT",
                    "message": f"Cannot approve: time slot overlaps existing confirmed booking {c.id} ({c.status.value}). Waitlist or reject instead.",
                },
            )

        checks = booking.eligibility_checks or []
        has_failed_mandatory = any(
            isinstance(c, dict) and c.get("status") == CheckStatus.FAIL.value for c in checks
        )
        if has_failed_mandatory and not payload.is_policy_override:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "ELIGIBILITY_FAILED",
                    "message": "Cannot approve a request with a failed mandatory requirement unless an explicit Policy Override is selected and documented.",
                },
            )

        booking.waitlist_position = None
        booking.is_policy_override = payload.is_policy_override

    elif target_status == BookingStatus.WAITLISTED:
        wl_stmt = select(func.count()).select_from(Booking).where(
            Booking.resource_id == booking.resource_id,
            Booking.status == BookingStatus.WAITLISTED,
            Booking.id != booking.id,
        )
        wl_res = await session.execute(wl_stmt)
        cnt = wl_res.scalar_one() or 0
        booking.waitlist_position = cnt + 1
        booking.waitlist_reason = payload.reason.strip()

    booking.status = target_status
    booking.decided_by = actor.id
    booking.decided_at = now
    booking.decision_reason = payload.reason.strip()
    await session.flush()

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    action_map = {
        BookingStatus.APPROVED: "BOOKING_APPROVED",
        BookingStatus.REJECTED: "BOOKING_REJECTED",
        BookingStatus.WAITLISTED: "BOOKING_WAITLISTED",
        BookingStatus.NEEDS_INFORMATION: "BOOKING_NEEDS_INFORMATION",
    }

    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "MANAGER",
        action=action_map.get(target_status, f"BOOKING_{target_status.value}"),
        entity_type=LedgerEntityType.BOOKING,
        entity_id=booking.id,
        reason=booking.decision_reason,
        metadata={
            "resourceId": booking.resource_id,
            "status": booking.status.value,
            "isPolicyOverride": booking.is_policy_override,
            "decidedBy": actor.id,
        },
    )

    notif_type = NotificationType.DECISION if target_status in [BookingStatus.APPROVED, BookingStatus.REJECTED] else NotificationType.WAITLIST_CHANGE
    notif_title = f"Booking {target_status.value.replace('_', ' ').title()}"
    notif_msg = f"Your booking request for resource {booking.resource_id} status changed to {target_status.value}. Reason: {booking.decision_reason}"
    await create_notification(
        session=session,
        organization_id=actor.organization_id,
        user_id=booking.user_id,
        type=notif_type,
        title=notif_title,
        message=notif_msg,
        related_entity_id=booking.id,
        related_path=f"/bookings/{booking.id}",
    )

    return booking


async def check_in_booking(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    payload: ConditionReportCreate,
) -> Booking:
    """Submit initial condition report and check out resource to user."""
    stmt = select(Booking).where(Booking.id == booking_id)
    res = await session.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if booking.user_id != actor.id and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only the booking holder or authorised staff can check in."},
        )

    if not payload.acknowledged_rules:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ACKNOWLEDGEMENT_REQUIRED", "message": "You must acknowledge the usage and safety rules before check-in."},
        )

    validate_transition(booking.status, BookingStatus.CHECKED_OUT_TO_USER)

    now = datetime.now(UTC)
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
            linked_entity_type="CONDITION_REPORT",
            confirmed=True,
        )
        session.add(att)
        await session.flush()
        att.linked_entity_id = att.id
        attachment_ids.append(att.id)
        attachment_hashes.append(sha256_hash)

    # Check staff confirmation if staff is performing check-in
    staff_confirmed_by = actor.id if is_staff else None
    staff_confirmed_at = now if is_staff else None

    report = ConditionReport(
        organization_id=actor.organization_id,
        booking_id=booking.id,
        stage="CHECK_IN",
        condition=payload.condition,
        accessories=payload.accessories or [],
        notes=payload.notes.strip(),
        attachment_ids=attachment_ids,
        attachment_hashes=attachment_hashes,
        acknowledged_rules=True,
        reporter_id=actor.id,
        reporter_name=actor.name,
        actual_timestamp=now,
        staff_confirmed_by=staff_confirmed_by,
        staff_confirmed_at=staff_confirmed_at,
    )
    session.add(report)

    booking.status = BookingStatus.CHECKED_OUT_TO_USER
    if is_staff:
        booking.handover_confirmed_by = actor.id
        booking.handover_confirmed_at = now

    # Update physical asset status
    ast_stmt = select(Asset).where(Asset.resource_id == booking.resource_id)
    ast_res = await session.execute(ast_stmt)
    asset = ast_res.scalar_one_or_none()
    if asset:
        asset.status = AssetStatus.IN_USE

    await session.flush()

    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action="BOOKING_CHECKED_OUT",
        entity_type=LedgerEntityType.BOOKING,
        entity_id=booking.id,
        reason=payload.notes.strip() or "Resource checked out to user.",
        metadata={
            "resourceId": booking.resource_id,
            "condition": payload.condition.value,
            "attachmentSha256": attachment_hashes,
        },
    )

    return booking


async def return_booking(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    payload: ConditionReportCreate,
) -> Booking:
    """Submit final condition report on return, handle supervision and optional incident."""
    stmt = select(Booking).where(Booking.id == booking_id)
    res = await session.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if booking.user_id != actor.id and not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only the booking holder or authorised staff can return this resource."},
        )

    # Check resource supervision level
    res_stmt = select(Resource).where(Resource.id == booking.resource_id)
    res_res = await session.execute(res_stmt)
    resource = res_res.scalar_one()

    requires_staff_confirmation = (
        resource.supervision in [SupervisionLevel.STAFF_CONFIRMATION, SupervisionLevel.STAFF_PRESENT]
        and not is_staff
    )

    target_status = BookingStatus.RETURN_PENDING_CONFIRMATION if requires_staff_confirmation else BookingStatus.CLOSED
    validate_transition(booking.status, target_status)

    now = datetime.now(UTC)
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
            linked_entity_type="CONDITION_REPORT",
            confirmed=True,
        )
        session.add(att)
        await session.flush()
        att.linked_entity_id = att.id
        attachment_ids.append(att.id)
        attachment_hashes.append(sha256_hash)

    staff_confirmed_by = actor.id if is_staff else None
    staff_confirmed_at = now if is_staff else None

    report = ConditionReport(
        organization_id=actor.organization_id,
        booking_id=booking.id,
        stage="RETURN",
        condition=payload.condition,
        accessories=payload.accessories or [],
        notes=payload.notes.strip(),
        attachment_ids=attachment_ids,
        attachment_hashes=attachment_hashes,
        acknowledged_rules=True,
        reporter_id=actor.id,
        reporter_name=actor.name,
        actual_timestamp=now,
        staff_confirmed_by=staff_confirmed_by,
        staff_confirmed_at=staff_confirmed_at,
    )
    session.add(report)

    # If incident reported alongside return
    if payload.incident_category and payload.incident_description:
        incident = Incident(
            organization_id=actor.organization_id,
            booking_id=booking.id,
            resource_id=booking.resource_id,
            reporter_id=actor.id,
            reporter_name=actor.name,
            category=payload.incident_category,
            reported_stage="Return inspection",
            description=payload.incident_description.strip(),
            attachment_ids=attachment_ids,
            attachment_hashes=attachment_hashes,
            status=IncidentStatus.REPORTED,
            requires_human_review=True,
        )
        session.add(incident)
        await session.flush()

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
                "attachmentSha256": attachment_hashes,
            },
        )

    booking.status = target_status
    if not requires_staff_confirmation:
        booking.return_confirmed_by = actor.id if is_staff else "SYSTEM"
        booking.return_confirmed_at = now

        ast_stmt = select(Asset).where(Asset.resource_id == booking.resource_id)
        ast_res = await session.execute(ast_stmt)
        asset = ast_res.scalar_one_or_none()
        if asset:
            asset.status = AssetStatus.AVAILABLE

    await session.flush()

    action_label = "BOOKING_RETURN_PENDING_CONFIRMATION" if requires_staff_confirmation else "BOOKING_CLOSED"
    await append_ledger_event(
        session=session,
        organization_id=actor.organization_id,
        actor_id=actor.id,
        actor_name=actor.name,
        actor_role=actor_roles[0] if actor_roles else "USER",
        action=action_label,
        entity_type=LedgerEntityType.BOOKING,
        entity_id=booking.id,
        reason=payload.notes.strip() or "Resource return condition recorded.",
        metadata={
            "resourceId": booking.resource_id,
            "status": booking.status.value,
            "condition": payload.condition.value,
            "attachmentSha256": attachment_hashes,
        },
    )

    if not requires_staff_confirmation:
        await promote_next_waitlisted_if_slot_open(
            session=session,
            resource_id=booking.resource_id,
            freed_start=booking.start_at,
            freed_end=booking.end_at,
            actor=actor,
        )

    return booking


async def confirm_staff_handover_or_return(
    session: AsyncSession,
    actor: User,
    booking_id: str,
    stage: str,
    notes: str,
) -> Booking:
    """Authorised staff confirmation of handover or return for supervised equipment."""
    actor_roles = [r.value if hasattr(r, "value") else str(r) for r in actor.roles]
    is_staff = any(r in [Role.OWNER.value, Role.MANAGER.value, Role.ADMIN.value] for r in actor_roles)
    if not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only authorised staff can confirm handover or return."},
        )

    stmt = select(Booking).where(Booking.id == booking_id)
    res = await session.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BOOKING_NOT_FOUND", "message": "Booking not found."},
        )

    now = datetime.now(UTC)
    if stage == "HANDOVER":
        booking.handover_confirmed_by = actor.id
        booking.handover_confirmed_at = now

        cr_stmt = select(ConditionReport).where(
            ConditionReport.booking_id == booking.id,
            ConditionReport.stage == "CHECK_IN",
        )
        cr_res = await session.execute(cr_stmt)
        check_in_rep = cr_res.scalar_one_or_none()
        if check_in_rep:
            check_in_rep.staff_confirmed_by = actor.id
            check_in_rep.staff_confirmed_at = now

        await append_ledger_event(
            session=session,
            organization_id=actor.organization_id,
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor_roles[0] if actor_roles else "MANAGER",
            action="HANDOVER_STAFF_CONFIRMED",
            entity_type=LedgerEntityType.BOOKING,
            entity_id=booking.id,
            reason=notes.strip() or "Technician verified initial handover condition.",
            metadata={"bookingId": booking.id},
        )
    else:
        booking.status = BookingStatus.CLOSED
        booking.return_confirmed_by = actor.id
        booking.return_confirmed_at = now

        cr_stmt = select(ConditionReport).where(
            ConditionReport.booking_id == booking.id,
            ConditionReport.stage == "RETURN",
        )
        cr_res = await session.execute(cr_stmt)
        return_rep = cr_res.scalar_one_or_none()
        if return_rep:
            return_rep.staff_confirmed_by = actor.id
            return_rep.staff_confirmed_at = now

        ast_stmt = select(Asset).where(Asset.resource_id == booking.resource_id)
        ast_res = await session.execute(ast_stmt)
        asset = ast_res.scalar_one_or_none()
        if asset:
            asset.status = AssetStatus.AVAILABLE

        await append_ledger_event(
            session=session,
            organization_id=actor.organization_id,
            actor_id=actor.id,
            actor_name=actor.name,
            actor_role=actor_roles[0] if actor_roles else "MANAGER",
            action="RETURN_STAFF_CONFIRMED",
            entity_type=LedgerEntityType.BOOKING,
            entity_id=booking.id,
            reason=notes.strip() or "Technician inspected returned resource and confirmed operational closure.",
            metadata={"bookingId": booking.id, "status": "CLOSED"},
        )

        await promote_next_waitlisted_if_slot_open(
            session=session,
            resource_id=booking.resource_id,
            freed_start=booking.start_at,
            freed_end=booking.end_at,
            actor=actor,
        )

    await session.flush()
    return booking
