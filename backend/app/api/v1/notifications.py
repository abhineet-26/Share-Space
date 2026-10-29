from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models import Role, User
from app.schemas.notification import NotificationRead
from app.services.notification import (
    list_user_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    process_outbox_events,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[NotificationRead]:
    """Retrieve all notifications for the authenticated user, ordered newest first."""
    notifications = await list_user_notifications(session=session, user=current_user)
    return [NotificationRead.model_validate(n) for n in notifications]


@router.post("/{notification_id}/read", response_model=NotificationRead)
@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> NotificationRead:
    """Mark a specific notification as read."""
    notification = await mark_notification_read(
        session=session,
        user=current_user,
        notification_id=notification_id,
    )
    return NotificationRead.model_validate(notification)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Mark all unread notifications for current user as read."""
    await mark_all_notifications_read(session=session, user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/process-outbox")
async def process_outbox(
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
    session: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Trigger background delivery worker to flush pending outbox events."""
    count = await process_outbox_events(session=session, organization_id=current_user.organization_id)
    return {"processed": count}
