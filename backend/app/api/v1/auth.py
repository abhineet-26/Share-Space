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
from app.models import AcademicGroup, Organization, Role, User, VerificationStatus
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

SYNTHETIC_ORGANIZATIONS = [
    OrganizationRead(
        id="org_nit",
        name="Nilgiri Institute of Technology",
        domain="nit.edu.in",
        department_code="NIT-CAMPUS-OPS",
        timezone="Asia/Kolkata",
        retention_days=365,
    ),
    OrganizationRead(
        id="org_harbour",
        name="Harbour Community Makerspace",
        domain="harbourmakers.org",
        department_code="HCM-FABLAB",
        timezone="Asia/Kolkata",
        retention_days=180,
    ),
]

SYNTHETIC_DEMO_PERSONAS = [
    DemoPersonaRead(
        id="usr_aarav",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Aarav Menon",
        email="aarav.menon@nit.edu.in",
        roles=[Role.USER],
        department="Electrical & Electronics Engineering",
        academic_group=AcademicGroup.UNDERGRAD_CAPSTONE,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Student — Electronics induction COMPLETED, 3D-printer safety COMPLETED",
    ),
    DemoPersonaRead(
        id="usr_diya",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Diya Rao",
        email="diya.rao@nit.edu.in",
        roles=[Role.USER],
        department="Mechanical & Product Design",
        academic_group=AcademicGroup.COURSEWORK,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Student — Electronics induction COMPLETED, 3D-printer safety NOT completed",
    ),
    DemoPersonaRead(
        id="usr_kabir",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Kabir Shah",
        email="kabir.shah@nit.edu.in",
        roles=[Role.USER],
        department="Media Arts & Embedded Systems",
        academic_group=AcademicGroup.COURSEWORK,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Heavy user — Near weekly usage cap on Camera Kit and 3D Printer",
    ),
    DemoPersonaRead(
        id="usr_meera",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Dr. Meera Iyer",
        email="meera.iyer@nit.edu.in",
        roles=[Role.OWNER, Role.USER],
        department="Electronics Department",
        academic_group=AcademicGroup.STAFF,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Resource Owner — Controls Electronics Department labs and instruments",
    ),
    DemoPersonaRead(
        id="usr_ravi",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Ravi Kulkarni",
        email="ravi.kulkarni@nit.edu.in",
        roles=[Role.MANAGER, Role.USER],
        department="Central Technical Operations",
        academic_group=AcademicGroup.STAFF,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Lab Manager — Reviews requests, confirms handovers/returns, resolves incidents",
    ),
    DemoPersonaRead(
        id="usr_priya",
        organization_id="org_nit",
        organization_name="Nilgiri Institute of Technology",
        name="Priya Nair",
        email="priya.nair@nit.edu.in",
        roles=[Role.ADMIN, Role.OWNER, Role.MANAGER, Role.USER],
        department="Institutional Governance & Safety",
        academic_group=AcademicGroup.STAFF,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Administrator — Manages versioned policies and ledger oversight",
    ),
    DemoPersonaRead(
        id="usr_rohan",
        organization_id="org_harbour",
        organization_name="Harbour Community Makerspace",
        name="Rohan Deshmukh",
        email="rohan@harbourmakers.org",
        roles=[Role.ADMIN, Role.OWNER, Role.MANAGER, Role.USER],
        department="Harbour Operations",
        academic_group=AcademicGroup.COMMUNITY,
        verification=VerificationStatus.VERIFIED,
        demo_persona_note="Harbour Community Admin — Demonstrates complete cross-tenant isolation",
    ),
]


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

    try:
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
                personas=personas if personas else SYNTHETIC_DEMO_PERSONAS,
                organizations=[OrganizationRead.model_validate(o) for o in orgs]
                if orgs
                else SYNTHETIC_ORGANIZATIONS,
            )
    except Exception:
        # Fallback to deterministic synthetic fixtures if migrations are pending
        return DemoPersonasResponse(
            enabled=True,
            reset_enabled=settings.ENABLE_DEMO_RESET,
            personas=SYNTHETIC_DEMO_PERSONAS,
            organizations=SYNTHETIC_ORGANIZATIONS,
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

    user = None
    org = None
    try:
        # Use migration session to find demo user across tenants before setting tenant context
        async with migration_session_factory() as session:
            user = await session.get(User, payload.user_id)
            if not user:
                from scripts.seed import safe_bootstrap_demo

                bootstrapped = await safe_bootstrap_demo(session)
                if bootstrapped:
                    user = await session.get(User, payload.user_id)
            if user:
                org = await session.get(Organization, user.organization_id)
    except Exception:
        user = None
        org = None

    if user and org:
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

    # Fallback for demo persona if database tables are in migration phase
    synth_user = next((p for p in SYNTHETIC_DEMO_PERSONAS if p.id == payload.user_id), None)
    synth_org = next(
        (
            o
            for o in SYNTHETIC_ORGANIZATIONS
            if o.id == (synth_user.organization_id if synth_user else "")
        ),
        None,
    )
    if not synth_user or not synth_org:
        raise NotFoundError("User", payload.user_id)

    token = create_access_token(
        {
            "user_id": synth_user.id,
            "organization_id": synth_user.organization_id,
            "roles": [r.value if hasattr(r, "value") else str(r) for r in synth_user.roles],
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
        user=UserRead(
            id=synth_user.id,
            organization_id=synth_user.organization_id,
            name=synth_user.name,
            email=synth_user.email,
            roles=synth_user.roles,
            department=synth_user.department,
            academic_group=synth_user.academic_group,
            verification=synth_user.verification,
            demo_persona_note=synth_user.demo_persona_note,
        ),
        organization=synth_org,
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
