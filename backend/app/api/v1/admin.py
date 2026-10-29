from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ReasonRequiredError
from app.models import LedgerEntityType, Role, User
from app.schemas.auth import UpdateUserRolesRequest, UserRead
from app.services.ledger import append_ledger_event

MIN_REASON_LENGTH = 5

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.patch(
    "/users/{user_id}/roles",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Update user role assignments (Admin only)",
)
@router.put(
    "/users/{user_id}/roles",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Update user role assignments (Admin only)",
)
async def update_user_roles(
    user_id: str,
    payload: UpdateUserRolesRequest,
    current_user: Annotated[
        User,
        Depends(require_roles([Role.ADMIN], "Modify user role assignments")),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    reason_clean = (payload.reason or "").strip()
    if len(reason_clean) < MIN_REASON_LENGTH:
        raise ReasonRequiredError("Modify user role assignments", min_length=MIN_REASON_LENGTH)

    target_user = await session.get(User, user_id)
    if not target_user:
        raise NotFoundError("User", user_id)

    prev_roles = [r.value if hasattr(r, "value") else str(r) for r in target_user.roles]
    new_roles = [
        r.value if hasattr(r, "value") else str(r)
        for r in (payload.roles or [Role.USER])
    ]
    target_user.roles = new_roles

    # Append audit event to tamper-evident Trust Ledger
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
        action="USER_ROLES_UPDATED",
        entity_type=LedgerEntityType.USER_ROLE,
        entity_id=target_user.id,
        reason=reason_clean,
        metadata={
            "previousRoles": prev_roles,
            "newRoles": new_roles,
            "targetEmail": target_user.email,
        },
    )

    await session.flush()
    return UserRead.model_validate(target_user)
