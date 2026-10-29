from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db, migration_session_factory
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.security import create_access_token
from app.models import Organization, User
from app.schemas.auth import (
    DemoLoginRequest,
    DemoLoginResponse,
    MeResponse,
    OrganizationRead,
    UserRead,
)

settings = get_settings()
router = APIRouter(tags=["Authentication"])


@router.post(
    "/auth/demo-login",
    response_model=DemoLoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in as a seeded demo persona",
)
async def demo_login(
    payload: DemoLoginRequest,
    response: Response,
) -> DemoLoginResponse:
    if settings.is_production:
        raise ForbiddenError(
            action="Demo login",
            required_roles=["SSO"],
            current_roles=[],
        )

    # Use migration session to find demo user across tenants before setting tenant context
    async with migration_session_factory() as session:
        user = await session.get(User, payload.user_id)
        if not user:
            raise NotFoundError("User", payload.user_id)

        org = await session.get(Organization, user.organization_id)
        if not org:
            raise NotFoundError("Organization", user.organization_id)

        token = create_access_token(
            {
                "user_id": user.id,
                "organization_id": user.organization_id,
                "roles": [r.value if hasattr(r, "value") else str(r) for r in user.roles],
            }
        )

    response.set_cookie(
        key="sharespace_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path="/",
    )

    return DemoLoginResponse(
        user=UserRead.model_validate(user),
        organization=OrganizationRead.model_validate(org),
        token=token,
    )


@router.post(
    "/auth/logout",
    status_code=status.HTTP_200_OK,
    summary="Sign out and clear session cookie",
)
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key="sharespace_session", path="/")
    return {"message": "Logged out successfully"}


@router.get(
    "/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user and session context",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MeResponse:
    org = await session.get(Organization, current_user.organization_id)
    if not org:
        raise NotFoundError("Organization", current_user.organization_id)

    all_demo_users: list[UserRead] = []
    all_organizations: list[OrganizationRead] = []

    if not settings.is_production:
        async with migration_session_factory() as admin_session:
            user_res = await admin_session.execute(
                select(User).where(User.demo_persona_note.is_not(None)).order_by(User.id)
            )
            all_demo_users = [UserRead.model_validate(u) for u in user_res.scalars().all()]

            org_res = await admin_session.execute(
                select(Organization).order_by(Organization.id)
            )
            all_organizations = [OrganizationRead.model_validate(o) for o in org_res.scalars().all()]
    else:
        all_organizations = [OrganizationRead.model_validate(org)]

    return MeResponse(
        user=UserRead.model_validate(current_user),
        organization=OrganizationRead.model_validate(org),
        all_demo_users=all_demo_users,
        all_organizations=all_organizations,
    )
