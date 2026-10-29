from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_context
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.models import Role, User


def get_token_from_request(request: Request) -> str:
    """Extract JWT token from session cookie or Authorization header."""
    cookie_token = request.cookies.get("sharespace_session")
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    raise UnauthorizedError("Authentication required. Please sign in.")


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate token, apply tenant RLS context to the database session, and return the user."""
    token = get_token_from_request(request)
    token_data = decode_token(token)

    # Set local tenant context for RLS enforcement
    await set_tenant_context(session, token_data.organization_id)

    user = await session.get(User, token_data.user_id)
    if not user:
        raise UnauthorizedError("User account not found or has been deactivated.")

    return user


def require_roles(
    required_roles: list[Role | str],
    action: str = "Access restricted resource",
) -> Callable[..., User]:
    """Dependency factory that enforces server-side role-based access control."""
    required_str_list = [r.value if isinstance(r, Role) else str(r) for r in required_roles]

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        user_roles_str = [r.value if isinstance(r, Role) else str(r) for r in current_user.roles]
        if not any(r in required_str_list for r in user_roles_str):
            raise ForbiddenError(
                action=action,
                required_roles=required_str_list,
                current_roles=user_roles_str,
            )
        return current_user

    return role_checker
