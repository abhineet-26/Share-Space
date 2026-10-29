from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db, migration_session_factory
from app.core.exceptions import NotFoundError
from app.core.security import create_access_token
from app.models import Organization, Role, User
from app.schemas.auth import (
    DemoLoginRequest,
    DemoLoginResponse,
    DemoPersonaRead,
    DemoPersonasResponse,
    MeResponse,
    OrganizationRead,
    UserRead,
)

settings = get_settings()
router = APIRouter(tags=["Authentication"])


@router.get(
    "/auth/demo-personas",
    response_model=DemoPersonasResponse,
    status_code=status.HTTP_200_OK,
    summary="List available synthetic demo personas and organizations for demo sign-in",
)
async def list_demo_personas() -> DemoPersonasResponse:
    if not settings.ENABLE_DEMO_LOGIN:
        return DemoPersonasResponse(
            enabled=False,
            reset_enabled=False,
            personas=[],
            organizations=[],
        )

    async with migration_session_factory() as session:
        res = await session.execute(
            select(User).where(User.demo_persona_note.is_not(None)).order_by(User.id)
        )
        users = list(res.scalars().all())
        if not users:
            from scripts.seed import safe_bootstrap_demo

            await safe_bootstrap_demo(session)
            res = await session.execute(
                select(User).where(User.demo_persona_note.is_not(None)).order_by(User.id)
            )
            users = list(res.scalars().all())

        org_res = await session.execute(select(Organization).order_by(Organization.id))
        orgs = list(org_res.scalars().all())
        org_map = {o.id: o.name for o in orgs}

        personas = [
            DemoPersonaRead(
                id=u.id,
                organization_id=u.organization_id,
                organization_name=org_map.get(u.organization_id, u.organization_id),
                name=u.name,
                email=u.email,
                roles=u.roles,
                department=u.department,
                academic_group=u.academic_group,
                verification=u.verification,
                demo_persona_note=u.demo_persona_note,
            )
            for u in users
        ]

        return DemoPersonasResponse(
            enabled=True,
            reset_enabled=settings.ENABLE_DEMO_RESET,
            personas=personas,
            organizations=[OrganizationRead.model_validate(o) for o in orgs],
        )


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
    if not settings.ENABLE_DEMO_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEMO_DISABLED",
                "message": "Demo login is disabled in this environment.",
            },
        )

    # Use migration session to find demo user across tenants before setting tenant context
    async with migration_session_factory() as session:
        user = await session.get(User, payload.user_id)
        if not user:
            from scripts.seed import safe_bootstrap_demo

            bootstrapped = await safe_bootstrap_demo(session)
            if bootstrapped:
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
        samesite="none" if settings.is_production else "lax",
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


@router.post(
    "/auth/reset-demo",
    status_code=status.HTTP_200_OK,
    summary="Reset demo database to canonical seed fixtures (demo mode only)",
)
async def reset_demo_database_endpoint(request: Request) -> dict[str, str]:
    if not settings.ENABLE_DEMO_RESET and not (
        settings.is_development or settings.ENVIRONMENT == "test"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEMO_RESET_DISABLED",
                "message": "Demo data reset is disabled in production.",
            },
        )

    if settings.is_production:
        token = request.headers.get("Authorization") or request.cookies.get("sharespace_session")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to reset demo data.",
            )
        from app.core.security import decode_token

        try:
            token_str = token[7:] if token.startswith("Bearer ") else token
            token_data = decode_token(token_str)
            roles = [r.value if isinstance(r, Role) else str(r) for r in token_data.roles]
            if "ADMIN" not in roles and "FACULTY_HEAD" not in roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin or Faculty Head role required to reset demo data.",
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid authorization for demo reset.",
            )

    from app.core.database import migration_session_factory
    from scripts.seed import seed_database

    async with migration_session_factory() as session:
        await seed_database(session, clear_existing=True)
    return {"status": "ok", "message": "Demo database successfully reset"}


@router.get(
    "/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user and session context",
)
@router.get(
    "/auth/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user and session context (alias)",
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

    if settings.ENABLE_DEMO_LOGIN:
        async with migration_session_factory() as admin_session:
            user_res = await admin_session.execute(
                select(User).where(User.demo_persona_note.is_not(None)).order_by(User.id)
            )
            all_demo_users = [UserRead.model_validate(u) for u in user_res.scalars().all()]

            org_res = await admin_session.execute(select(Organization).order_by(Organization.id))
            all_organizations = [
                OrganizationRead.model_validate(o) for o in org_res.scalars().all()
            ]
    else:
        all_organizations = [OrganizationRead.model_validate(org)]

    return MeResponse(
        user=UserRead.model_validate(current_user),
        organization=OrganizationRead.model_validate(org),
        all_demo_users=all_demo_users,
        all_organizations=all_organizations,
    )
