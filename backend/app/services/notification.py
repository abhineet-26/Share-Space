from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationType, OutboxEvent, OutboxStatus, User


async def create_notification(  # noqa: PLR0913
    session: AsyncSession,
    *,
    organization_id: str,
    user_id: str,
    type: NotificationType,
    title: str,
    message: str,
    related_entity_id: str | None = None,
    related_path: str | None = None,
    outbox_status: OutboxStatus = OutboxStatus.DELIVERED,
) -> Notification:
    """Create in-app notification and write corresponding outbox record."""
    notif = Notification(
        organization_id=organization_id,
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_entity_id=related_entity_id,
        related_path=related_path,
        outbox_status=outbox_status,
    )
    session.add(notif)

    outbox_event = OutboxEvent(
        organization_id=organization_id,
        event_type=f"NOTIFICATION_{type.value}",
        payload={
            "userId": user_id,
            "title": title,
            "message": message,
            "relatedEntityId": related_entity_id,
            "relatedPath": related_path,
        },
        status=outbox_status,
    )
    session.add(outbox_event)
    await session.flush()
    return notif


async def list_user_notifications(
    session: AsyncSession,
    user: User,
) -> list[Notification]:
    """Retrieve all notifications for the authenticated user ordered by most recent."""
    stmt = (
        select(Notification)
        .where(
            Notification.organization_id == user.organization_id,
            Notification.user_id == user.id,
        )
        .order_by(Notification.created_at.desc())
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def mark_notification_read(
    session: AsyncSession,
    user: User,
    notification_id: str,
) -> Notification:
    """Mark a specific notification as read by timestamp."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.organization_id == user.organization_id,
        Notification.user_id == user.id,
    )
    res = await session.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOTIFICATION_NOT_FOUND", "message": "Notification not found."},
        )

    if not notif.read_at:
        notif.read_at = datetime.now(UTC)
        await session.flush()
    return notif


async def mark_all_notifications_read(
    session: AsyncSession,
    user: User,
) -> int:
    """Mark all unread notifications for the user as read."""
    now = datetime.now(UTC)
    stmt = (
        update(Notification)
        .where(
            Notification.organization_id == user.organization_id,
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    res = await session.execute(stmt)
    await session.flush()
    return res.rowcount or 0


async def process_outbox_events(
    session: AsyncSession,
    organization_id: str,
) -> int:
    """Process pending outbox delivery events (worker outbox pattern)."""
    now = datetime.now(UTC)
    stmt = (
        select(OutboxEvent)
        .where(
            OutboxEvent.organization_id == organization_id,
            OutboxEvent.status == OutboxStatus.PENDING,
        )
        .limit(50)
    )
    res = await session.execute(stmt)
    pending_events = list(res.scalars().all())
    for ev in pending_events:
        ev.status = OutboxStatus.DELIVERED
        ev.attempts += 1
        ev.processed_at = now
    await session.flush()
    return len(pending_events)
