from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import ulid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.api.v1.resources import _to_resource_read
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ReasonRequiredError, RequestValidationError
from app.models import (
    LedgerEntityType,
    Policy,
    PolicyStatus,
    PolicyVersion,
    Resource,
    Role,
    User,
)
from app.schemas.auth import UserRead
from app.schemas.policy import (
    PolicyActivateRequest,
    PolicyCreate,
    PolicyPreviewPayload,
    PolicyPreviewResponse,
    PolicyRead,
    PolicyScope,
    PolicyVersionCreate,
    PolicyVersionRead,
)
from app.services.ledger import append_ledger_event
from app.services.policy import evaluate_eligibility

MIN_REASON_LENGTH = 5

router = APIRouter(prefix="/policies", tags=["Policies & Rules"])


def _to_policy_read(pol: Policy, versions: list[PolicyVersion] | None = None) -> PolicyRead:
    version_items = [
        PolicyVersionRead.model_validate(v)
        for v in (versions or (pol.versions if hasattr(pol, "versions") and pol.versions else []))
    ]
    return PolicyRead(
        id=pol.id,
        organization_id=pol.organization_id,
        name=pol.name,
        description=pol.description,
        scope=PolicyScope(
            type=pol.scope_type,
            id=pol.scope_id,
            label=pol.scope_label or "",
        ),
        kind=pol.kind,
        status=pol.status,
        active_version=pol.active_version,
        versions=version_items,
    )


@router.get(
    "",
    response_model=list[PolicyRead],
    status_code=status.HTTP_200_OK,
    summary="List institutional policies for authenticated tenant",
)
async def list_policies(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[PolicyRead]:
    stmt = (
        select(Policy)
        .options(selectinload(Policy.versions))
        .where(Policy.organization_id == current_user.organization_id)
        .order_by(Policy.created_at.desc())
    )
    res = await session.execute(stmt)
    policies = res.scalars().all()
    return [_to_policy_read(p) for p in policies]


@router.get(
    "/{policy_id}",
    response_model=PolicyRead,
    status_code=status.HTTP_200_OK,
    summary="Get policy specifications and version history",
)
async def get_policy(
    policy_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PolicyRead:
    stmt = select(Policy).options(selectinload(Policy.versions)).where(Policy.id == policy_id)
    res = await session.execute(stmt)
    policy = res.scalar_one_or_none()
    if not policy:
        raise NotFoundError("Policy", policy_id)
    return _to_policy_read(policy)


@router.post(
    "",
    response_model=PolicyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft policy (Manager, Admin)",
)
async def create_policy(
    payload: PolicyCreate,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.MANAGER, Role.ADMIN], "Create institutional policy")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PolicyRead:
    if not payload.name.strip():
        raise RequestValidationError("Policy name is required.")

    policy_id = f"pol_{ulid.new().str.lower()}"
    new_policy = Policy(
        id=policy_id,
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        scope_type=payload.scope.type,
        scope_id=payload.scope.id,
        scope_label=payload.scope.label,
        kind=payload.kind,
        status=PolicyStatus.DRAFT,
        active_version=1,
    )
    session.add(new_policy)
    await session.flush()

    # Create initial version v1
    v1_id = f"pv_{ulid.new().str.lower()}"
    initial_v1 = PolicyVersion(
        id=v1_id,
        organization_id=current_user.organization_id,
        policy_id=new_policy.id,
        version=1,
        definition=payload.initial_definition,
        effective_from=datetime.now(UTC),
        created_by=current_user.id,
        created_by_name=current_user.name,
        reason=f'Initial version for policy "{new_policy.name}".',
    )
    session.add(initial_v1)

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
        action="POLICY_CREATED",
        entity_type=LedgerEntityType.POLICY,
        entity_id=new_policy.id,
        reason=f'Created draft policy "{new_policy.name}" (v1).',
        metadata={
            "scopeType": new_policy.scope_type.value,
            "kind": new_policy.kind.value,
            "initialVersion": 1,
        },
    )

    await session.flush()
    return _to_policy_read(new_policy, [initial_v1])


@router.post(
    "/{policy_id}/versions",
    response_model=PolicyVersionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new version draft for an existing policy (Manager, Admin)",
)
async def create_policy_version(
    policy_id: str,
    payload: PolicyVersionCreate,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.MANAGER, Role.ADMIN], "Create policy version")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PolicyVersionRead:
    policy = await session.get(Policy, policy_id)
    if not policy:
        raise NotFoundError("Policy", policy_id)

    # Find highest existing version
    v_stmt = (
        select(PolicyVersion)
        .where(PolicyVersion.policy_id == policy_id)
        .order_by(PolicyVersion.version.desc())
    )
    highest_v = (await session.execute(v_stmt)).scalars().first()
    next_version = (highest_v.version + 1) if highest_v else 1

    pv_id = f"pv_{ulid.new().str.lower()}"
    new_version = PolicyVersion(
        id=pv_id,
        organization_id=current_user.organization_id,
        policy_id=policy.id,
        version=next_version,
        definition=payload.definition,
        effective_from=datetime.now(UTC),
        created_by=current_user.id,
        created_by_name=current_user.name,
        reason=payload.reason.strip(),
    )
    session.add(new_version)

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
        action="POLICY_VERSION_CREATED",
        entity_type=LedgerEntityType.POLICY,
        entity_id=policy.id,
        reason=payload.reason.strip(),
        metadata={"version": next_version, "policyName": policy.name},
    )

    await session.flush()
    return PolicyVersionRead.model_validate(new_version)


@router.post(
    "/{policy_id}/activate",
    response_model=PolicyRead,
    status_code=status.HTTP_200_OK,
    summary="Activate a policy version with mandatory governance reason (Manager, Admin)",
)
async def activate_policy_version(
    policy_id: str,
    payload: PolicyActivateRequest,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.MANAGER, Role.ADMIN], "Activate policy version")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PolicyRead:
    reason_clean = (payload.reason or "").strip()
    if len(reason_clean) < MIN_REASON_LENGTH:
        raise ReasonRequiredError("Activate policy version", min_length=MIN_REASON_LENGTH)

    policy = await session.get(Policy, policy_id)
    if not policy:
        raise NotFoundError("Policy", policy_id)

    # Verify version exists
    v_stmt = select(PolicyVersion).where(
        PolicyVersion.policy_id == policy_id,
        PolicyVersion.version == payload.version,
    )
    target_ver = (await session.execute(v_stmt)).scalar_one_or_none()
    if not target_ver:
        raise NotFoundError(f"PolicyVersion v{payload.version}", policy_id)

    prev_version = policy.active_version
    policy.active_version = payload.version
    policy.status = PolicyStatus.ACTIVE

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
        action="POLICY_ACTIVATED",
        entity_type=LedgerEntityType.POLICY,
        entity_id=policy.id,
        reason=reason_clean,
        metadata={
            "previousActiveVersion": prev_version,
            "newActiveVersion": payload.version,
            "policyName": policy.name,
        },
    )

    await session.flush()
    stmt = select(Policy).options(selectinload(Policy.versions)).where(Policy.id == policy_id)
    loaded = (await session.execute(stmt)).scalar_one()
    return _to_policy_read(loaded)


@router.post(
    "/preview",
    response_model=PolicyPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate policy activation dry-run comparing before vs after against sample resource",
)
@router.post(
    "/{policy_id}/preview",
    response_model=PolicyPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate policy activation dry-run comparing before vs after against sample resource",
)
async def preview_policy_activation(
    payload: PolicyPreviewPayload,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.MANAGER, Role.ADMIN], "Preview policy simulation")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
    policy_id: str | None = None,
) -> PolicyPreviewResponse:
    target_policy_id = policy_id or payload.policy_id
    policy = None
    if target_policy_id:
        policy = await session.get(Policy, target_policy_id)

    draft_ver = None
    if policy and payload.version:
        # Find candidate draft version
        v_stmt = select(PolicyVersion).where(
            PolicyVersion.policy_id == policy.id,
            PolicyVersion.version == payload.version,
        )
        draft_ver = (await session.execute(v_stmt)).scalar_one_or_none()
    elif payload.draft_definition:
        draft_ver = PolicyVersion(
            id="pv_simulated_draft",
            organization_id=current_user.organization_id,
            policy_id=policy.id if policy else "pol_simulated",
            version=payload.version or 99,
            definition=payload.draft_definition,
            effective_from=datetime.now(UTC),
            created_by=current_user.id,
            created_by_name=current_user.name,
            reason="Simulation dry run",
        )

    # Pick a representative sample resource and user within this organization
    org_id = policy.organization_id if policy else current_user.organization_id

    sample_res = None
    if payload.sample_resource_id:
        sample_res = await session.get(Resource, payload.sample_resource_id)

    if not sample_res:
        res_stmt = (
            select(Resource)
            .options(
                selectinload(Resource.requirements),
                selectinload(Resource.availability),
            )
            .where(Resource.organization_id == org_id)
            .limit(1)
        )
        sample_res = (await session.execute(res_stmt)).scalar_one_or_none()
    if not sample_res:
        raise NotFoundError("Resource for simulation", org_id)

    sample_user = None
    if payload.sample_user_id:
        sample_user = await session.get(User, payload.sample_user_id)

    if not sample_user:
        user_stmt = select(User).where(User.organization_id == org_id).limit(1)
        sample_user = (await session.execute(user_stmt)).scalar_one_or_none()
    if not sample_user:
        raise NotFoundError("User for simulation", org_id)

    now = datetime.now(UTC)
    sim_start = now + timedelta(days=1, hours=2)
    duration_hrs = float(payload.sample_duration_hours or 4.0)
    sim_end = sim_start + timedelta(hours=duration_hrs)

    # 1. Evaluate with current active policies (before)
    before_result = await evaluate_eligibility(
        session=session,
        user=sample_user,
        resource=sample_res,
        start_at=sim_start,
        end_at=sim_end,
    )

    # 2. Evaluate with draft policy version override (after)
    after_result = await evaluate_eligibility(
        session=session,
        user=sample_user,
        resource=sample_res,
        start_at=sim_start,
        end_at=sim_end,
        draft_policy_override=draft_ver,
    )

    return PolicyPreviewResponse(
        before_result=before_result,
        after_result=after_result,
        sample_user=UserRead.model_validate(sample_user),
        sample_resource=_to_resource_read(sample_res),
    )
