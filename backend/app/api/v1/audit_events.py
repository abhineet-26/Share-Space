from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models import LedgerEntityType, LedgerEvent, Role, User
from app.schemas.ledger import (
    LedgerEventRead,
    LedgerEventsListResponse,
    LedgerSimulateTamperResponse,
    LedgerVerificationResult,
)
from app.services.ledger import (
    get_last_verified_at,
    repair_ledger_chain,
    simulate_ledger_tamper,
    verify_ledger_chain,
)

router = APIRouter(prefix="/audit-events", tags=["audit-events"])


@router.get("", response_model=LedgerEventsListResponse)
async def list_audit_events(  # noqa: PLR0913
    entity_type: str | None = Query(default=None, alias="entity_type"),
    entity_id: str | None = Query(default=None, alias="entity_id"),
    actor_id: str | None = Query(default=None, alias="actor_id"),
    action: str | None = Query(default=None, alias="action"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> LedgerEventsListResponse:
    """List audit events in the current tenant's tamper-evident Trust Ledger chain."""
    stmt = (
        select(LedgerEvent)
        .where(LedgerEvent.organization_id == current_user.organization_id)
        .order_by(LedgerEvent.seq.desc())
    )

    if entity_type and entity_type.upper() != "ALL":
        try:
            matched_enum = LedgerEntityType(entity_type.upper())
            stmt = stmt.where(LedgerEvent.entity_type == matched_enum)
        except ValueError:
            stmt = stmt.where(LedgerEvent.entity_type == entity_type)

    if entity_id:
        clean_id = entity_id.strip()
        stmt = stmt.where(
            or_(
                LedgerEvent.entity_id.ilike(f"%{clean_id}%"),
                LedgerEvent.event_metadata["bookingId"].astext.ilike(f"%{clean_id}%"),
                LedgerEvent.event_metadata["resourceId"].astext.ilike(f"%{clean_id}%"),
            )
        )

    if actor_id:
        stmt = stmt.where(LedgerEvent.actor_id == actor_id.strip())

    if action:
        stmt = stmt.where(LedgerEvent.action.ilike(f"%{action.strip()}%"))

    res = await session.execute(stmt)
    events = list(res.scalars().all())

    event_reads = [LedgerEventRead.model_validate(ev) for ev in events]
    head_seq = events[0].seq if events else 0
    head_hash = events[0].hash if events else "0" * 64
    last_verified = get_last_verified_at(current_user.organization_id)

    return LedgerEventsListResponse(
        events=event_reads,
        last_verified_at=last_verified,
        head_seq=head_seq,
        head_hash=head_hash,
    )


@router.get("/verify", response_model=LedgerVerificationResult)
async def verify_chain(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> LedgerVerificationResult:
    """Verify SHA-256 hash chain integrity for the authenticated user's organization."""
    result = await verify_ledger_chain(session, current_user.organization_id)
    return LedgerVerificationResult(**result)


@router.post("/simulate-tamper", response_model=LedgerSimulateTamperResponse)
async def simulate_tamper(
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
) -> LedgerSimulateTamperResponse:
    """Demo only: Mutate a historical record to demonstrate instantaneous tamper detection."""
    tampered_seq = await simulate_ledger_tamper(current_user.organization_id)
    return LedgerSimulateTamperResponse(tampered_seq=tampered_seq)


@router.post("/repair", response_model=LedgerVerificationResult)
async def repair_chain(
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
) -> LedgerVerificationResult:
    """Demo only: Recompute the SHA-256 chain and restore clean verification state."""
    result = await repair_ledger_chain(current_user.organization_id)
    return LedgerVerificationResult(**result)
