from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Booking,
    BookingStatus,
    CheckStatus,
    EligibilityOverallStatus,
    Policy,
    PolicyStatus,
    PolicyVersion,
    RequirementType,
    Resource,
    ResourceRequirement,
    ResourceStatus,
    SupervisionLevel,
    TrainingRecord,
    User,
    VerificationStatus,
)
from app.schemas.policy import EligibilityCheck, EligibilityEvaluationResult

CONFIRMED_OCCUPYING_STATES = [
    BookingStatus.APPROVED,
    BookingStatus.CHECKED_OUT_TO_USER,
    BookingStatus.RETURN_PENDING_CONFIRMATION,
    BookingStatus.OVERDUE,
]
DEFAULT_UNLIMITED_HOURS = 999.0


async def resolve_active_policies_for_resource(
    session: AsyncSession,
    resource: Resource,
) -> list[PolicyVersion]:
    """Resolve all active policy versions applicable to a resource."""
    stmt = select(Policy).where(
        Policy.organization_id == resource.organization_id,
        Policy.status == PolicyStatus.ACTIVE,
    )
    res = await session.execute(stmt)
    active_policies = res.scalars().all()

    effective_versions: list[PolicyVersion] = []
    for pol in active_policies:
        scope_type = (
            pol.scope_type.value if hasattr(pol.scope_type, "value") else str(pol.scope_type)
        )
        scope_id = pol.scope_id
        matches = (
            scope_type == "ORG"
            or (scope_type == "RESOURCE" and scope_id == resource.id)
            or (scope_type == "CATEGORY" and scope_id == resource.category.value)
            or pol.id in (resource.policy_ids or [])
        )
        if matches and pol.active_version is not None:
            v_stmt = select(PolicyVersion).where(
                PolicyVersion.policy_id == pol.id,
                PolicyVersion.version == pol.active_version,
            )
            v_res = await session.execute(v_stmt)
            p_ver = v_res.scalar_one_or_none()
            if p_ver:
                effective_versions.append(p_ver)

    return effective_versions


async def get_rolling_usage_hours(
    session: AsyncSession,
    user_id: str,
    resource_id: str,
    window_days: int = 7,
    exclude_booking_id: str | None = None,
) -> float:
    """Calculate total usage hours consumed by a user on a resource in a rolling window."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=window_days)

    active_and_completed_states = [
        BookingStatus.APPROVED,
        BookingStatus.CHECKED_OUT_TO_USER,
        BookingStatus.RETURN_PENDING_CONFIRMATION,
        BookingStatus.RETURNED,
        BookingStatus.CLOSED,
    ]

    stmt = select(Booking).where(
        Booking.user_id == user_id,
        Booking.resource_id == resource_id,
        Booking.status.in_(active_and_completed_states),
        Booking.end_at >= cutoff,
    )
    if exclude_booking_id:
        stmt = stmt.where(Booking.id != exclude_booking_id)

    res = await session.execute(stmt)
    bookings = res.scalars().all()

    total_seconds = sum(
        (b.end_at - b.start_at).total_seconds() for b in bookings if b.end_at and b.start_at
    )
    return round(total_seconds / 3600.0, 2)


async def evaluate_eligibility(  # noqa: PLR0912, PLR0913, PLR0915
    session: AsyncSession,
    user: User,
    resource: Resource,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
    draft_policy_override: PolicyVersion | None = None,
) -> EligibilityEvaluationResult:
    """Deterministic, explainable eligibility evaluation engine matching RULES.md."""
    checks: list[EligibilityCheck] = []

    # 1. Resolve applicable active policy versions
    active_versions = await resolve_active_policies_for_resource(session, resource)
    effective_versions = list(active_versions)
    if draft_policy_override:
        idx = next(
            (
                i
                for i, v in enumerate(effective_versions)
                if v.policy_id == draft_policy_override.policy_id
            ),
            None,
        )
        if idx is not None:
            effective_versions[idx] = draft_policy_override
        else:
            effective_versions.append(draft_policy_override)

    # 2. Account Verification Check
    if user.verification == VerificationStatus.VERIFIED:
        checks.append(
            EligibilityCheck(
                key="account_verified",
                label="Account verification",
                status=CheckStatus.PASS,
                reason=f"Verified institutional identity ({user.email}).",
            )
        )
    else:
        checks.append(
            EligibilityCheck(
                key="account_verified",
                label="Account verification",
                status=CheckStatus.FAIL,
                reason=f"Your account verification status is {user.verification.value if hasattr(user.verification, 'value') else user.verification}.",
                next_step="Contact your institution administrator to complete identity verification.",
            )
        )

    # 3. Institution Membership Check
    if user.organization_id == resource.organization_id:
        checks.append(
            EligibilityCheck(
                key="institution_membership",
                label="Institution membership",
                status=CheckStatus.PASS,
                reason=f"Active member of {resource.organization_id}.",
            )
        )
    else:
        checks.append(
            EligibilityCheck(
                key="institution_membership",
                label="Institution membership",
                status=CheckStatus.FAIL,
                reason="Cross-organisation resource requests are not permitted without an inter-institutional agreement.",
                next_step="Switch to a resource within your home organisation.",
            )
        )

    # 4. Resource Operational Status Check
    if resource.status == ResourceStatus.PUBLISHED:
        checks.append(
            EligibilityCheck(
                key="resource_status",
                label="Resource operational status",
                status=CheckStatus.PASS,
                reason=f"Resource is PUBLISHED and condition is {resource.condition.value if hasattr(resource.condition, 'value') else resource.condition}.",
            )
        )
    else:
        checks.append(
            EligibilityCheck(
                key="resource_status",
                label="Resource operational status",
                status=CheckStatus.FAIL,
                reason=f"Resource is currently {resource.status.value if hasattr(resource.status, 'value') else resource.status} and cannot accept bookings.",
                next_step="Wait for the owner or lab manager to republish the resource.",
            )
        )

    # 5. Resource-specific Training Requirements Check
    # Ensure requirements are loaded
    req_stmt = select(ResourceRequirement).where(ResourceRequirement.resource_id == resource.id)
    req_res = await session.execute(req_stmt)
    requirements = req_res.scalars().all()

    for req in requirements:
        if req.type == RequirementType.TRAINING:
            tr_stmt = select(TrainingRecord).where(
                TrainingRecord.user_id == user.id,
                TrainingRecord.type == req.value,
            )
            tr_res = await session.execute(tr_stmt)
            tr = tr_res.scalar_one_or_none()

            now = datetime.now(UTC)
            if tr and tr.status.value == "VERIFIED":
                is_expired = tr.expires_at is not None and tr.expires_at < now
                if not is_expired:
                    checks.append(
                        EligibilityCheck(
                            key=req.key,
                            label=req.label,
                            status=CheckStatus.PASS,
                            reason=f"Verified record on file ({tr.source}).",
                        )
                    )
                else:
                    checks.append(
                        EligibilityCheck(
                            key=req.key,
                            label=req.label,
                            status=CheckStatus.FAIL,
                            reason=f"Training certificate expired on {tr.expires_at.strftime('%Y-%m-%d') if tr.expires_at else 'unknown'}.",
                            next_step="Complete refresher induction and ask a manager/admin to verify renewal.",
                        )
                    )
            else:
                current_status = tr.status.value if tr else "NONE"
                checks.append(
                    EligibilityCheck(
                        key=req.key,
                        label=req.label,
                        status=CheckStatus.FAIL,
                        reason=f'Mandatory training "{req.label}" is not verified on your profile (current status: {current_status}).',
                        next_step="Enroll in the safety induction session or request verification in your Profile.",
                    )
                )

    # 6. Time Window Validity & Conflict Check
    requested_hours = round((end_at - start_at).total_seconds() / 3600.0, 2)
    if requested_hours <= 0:
        checks.append(
            EligibilityCheck(
                key="time_validity",
                label="Requested time window",
                status=CheckStatus.FAIL,
                reason="End time must be after start time.",
                next_step="Select a valid start and end time.",
            )
        )
    else:
        checks.append(
            EligibilityCheck(
                key="time_validity",
                label="Requested time window",
                status=CheckStatus.PASS,
                reason=f"Valid booking window ({requested_hours} hours).",
            )
        )
        # Check concurrency conflict with confirmed bookings
        conf_stmt = select(Booking).where(
            Booking.resource_id == resource.id,
            Booking.status.in_(CONFIRMED_OCCUPYING_STATES),
            Booking.start_at < end_at,
            Booking.end_at > start_at,
        )
        if exclude_booking_id:
            conf_stmt = conf_stmt.where(Booking.id != exclude_booking_id)

        conf_res = await session.execute(conf_stmt)
        conflicting = conf_res.scalars().all()

        if conflicting:
            first_conflict = conflicting[0]
            checks.append(
                EligibilityCheck(
                    key="time_conflict",
                    label="Schedule availability",
                    status=CheckStatus.REVIEW_REQUIRED,
                    reason=f"Overlaps an existing confirmed reservation ({first_conflict.id}). Request can be waitlisted or re-timed.",
                    next_step="Choose an open slot or submit to join the priority waitlist.",
                )
            )
        else:
            checks.append(
                EligibilityCheck(
                    key="time_conflict",
                    label="Schedule availability",
                    status=CheckStatus.PASS,
                    reason=f"No conflicting confirmed bookings for the requested {requested_hours}h window.",
                )
            )

    # 7. Policy-driven Duration & Rolling Usage Cap Check
    max_session_hours = 8.0
    max_rolling_hours = DEFAULT_UNLIMITED_HOURS
    window_days = 7
    cap_policy_label = "Baseline Policy"

    for pv in effective_versions:
        definition = pv.definition or {}
        max_duration = definition.get("maxBookingDurationHours") or definition.get(
            "max_booking_duration_hours"
        )
        if max_duration is not None and float(max_duration) < max_session_hours:
            max_session_hours = float(max_duration)

        max_hours = definition.get("maxHoursPerUser") or definition.get("max_hours_per_user")
        if max_hours is not None and float(max_hours) < max_rolling_hours:
            max_rolling_hours = float(max_hours)
            window_days = int(definition.get("windowDays") or definition.get("window_days") or 7)
            cap_policy_label = f"{pv.policy_id} v{pv.version}"

    usage_hours_in_window = await get_rolling_usage_hours(
        session,
        user.id,
        resource.id,
        window_days=window_days,
        exclude_booking_id=exclude_booking_id,
    )

    if requested_hours > max_session_hours:
        checks.append(
            EligibilityCheck(
                key="session_duration",
                label="Single session duration limit",
                status=CheckStatus.FAIL,
                reason=f"Requested {requested_hours}h exceeds maximum single-session limit of {max_session_hours}h.",
                next_step=f"Shorten your booking duration to {max_session_hours} hours or less.",
            )
        )

    if max_rolling_hours < DEFAULT_UNLIMITED_HOURS:
        projected_total = round(usage_hours_in_window + requested_hours, 2)
        if projected_total <= max_rolling_hours:
            checks.append(
                EligibilityCheck(
                    key="usage_limit",
                    label=f"Rolling {window_days}-day usage cap",
                    status=CheckStatus.PASS,
                    reason=f"{usage_hours_in_window}h used this week + {requested_hours}h requested = {projected_total}h of {max_rolling_hours}h cap ({cap_policy_label}).",
                )
            )
        else:
            remaining = max(0.0, round(max_rolling_hours - usage_hours_in_window, 2))
            checks.append(
                EligibilityCheck(
                    key="usage_limit",
                    label=f"Rolling {window_days}-day usage cap",
                    status=CheckStatus.FAIL,
                    reason=f"{usage_hours_in_window}h already used in rolling {window_days} days + {requested_hours}h requested = {projected_total}h, exceeding the {max_rolling_hours}h cap ({cap_policy_label}).",
                    next_step=f"Reduce requested duration to {remaining}h or wait until earlier usage rolls off.",
                )
            )
    else:
        checks.append(
            EligibilityCheck(
                key="usage_limit",
                label="Session duration & usage policy",
                status=CheckStatus.PASS,
                reason=f"Requested {requested_hours}h is within the {max_session_hours}h session limit ({usage_hours_in_window}h used in last 7 days).",
            )
        )

    # 8. Human Review / Supervision Check
    requires_approval_req = next(
        (r for r in requirements if r.type == RequirementType.APPROVAL), None
    )
    if requires_approval_req or resource.supervision != SupervisionLevel.NONE:
        checks.append(
            EligibilityCheck(
                key="human_review",
                label=requires_approval_req.label
                if requires_approval_req
                else "Owner / Manager Review",
                status=CheckStatus.REVIEW_REQUIRED,
                reason="Eligibility does not auto-approve access; an authorised owner or manager must review and confirm your request.",
                next_step="Submit request to route to the manager review queue.",
            )
        )

    has_fail = any(c.status == CheckStatus.FAIL for c in checks)
    has_review = any(c.status == CheckStatus.REVIEW_REQUIRED for c in checks)

    overall_status = (
        EligibilityOverallStatus.NOT_ELIGIBLE
        if has_fail
        else (
            EligibilityOverallStatus.REVIEW_REQUIRED
            if has_review
            else EligibilityOverallStatus.ELIGIBLE
        )
    )

    return EligibilityEvaluationResult(
        eligible=not has_fail,
        overall_status=overall_status,
        checks=checks,
        applied_policy_version_ids=[v.id for v in effective_versions],
        usage_hours_in_window=usage_hours_in_window,
        max_hours_allowed=max_rolling_hours
        if max_rolling_hours < DEFAULT_UNLIMITED_HOURS
        else max_session_hours,
        requested_hours=requested_hours,
    )
