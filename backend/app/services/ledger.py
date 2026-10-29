from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LedgerEntityType, LedgerEvent


def canonical_json(obj: Any) -> str:  # noqa: PLR0911
    """Deterministic JSON serialization matching frontend canonicalJson."""
    if obj is None:
        return "null"
    if isinstance(obj, bool):
        return "true" if obj else "false"
    if isinstance(obj, int | float):
        return str(obj)
    if isinstance(obj, str):
        return json.dumps(obj, ensure_ascii=False)
    if isinstance(obj, list | tuple):
        return "[" + ",".join(canonical_json(x) for x in obj) + "]"
    if isinstance(obj, dict):
        sorted_keys = sorted(obj.keys())
        return "{" + ",".join(
            json.dumps(k, ensure_ascii=False) + ":" + canonical_json(obj[k])
            for k in sorted_keys
        ) + "}"
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def compute_ledger_event_hash(  # noqa: PLR0913
    *,
    prev_hash: str,
    organization_id: str,
    seq: int,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    occurred_at: str,
    reason: str | None,
    metadata: dict[str, Any],
) -> str:
    """Compute SHA-256 hash for ledger event matching frontend hash-chain calculation."""
    payload = canonical_json({
        "organizationId": organization_id,
        "seq": seq,
        "actorId": actor_id,
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "occurredAt": occurred_at,
        "reason": reason or "",
        "metadata": metadata or {},
    })
    msg = f"{prev_hash}||{payload}".encode()
    return hashlib.sha256(msg).hexdigest()


async def append_ledger_event(  # noqa: PLR0913
    session: AsyncSession,
    *,
    organization_id: str,
    actor_id: str | None,
    actor_name: str,
    actor_role: str,
    action: str,
    entity_type: LedgerEntityType,
    entity_id: str,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
) -> LedgerEvent:
    """Append a new ledger event to the organization's hash chain."""
    if occurred_at is None:
        occurred_at = datetime.now(UTC)

    # Find highest seq in this organization
    stmt = (
        select(LedgerEvent)
        .where(LedgerEvent.organization_id == organization_id)
        .order_by(LedgerEvent.seq.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    last_event = result.scalar_one_or_none()

    seq = (last_event.seq + 1) if last_event else 1
    prev_hash = last_event.hash if last_event else "0" * 64
    event_metadata = metadata or {}
    occurred_at_str = occurred_at.isoformat()

    event_hash = compute_ledger_event_hash(
        prev_hash=prev_hash,
        organization_id=organization_id,
        seq=seq,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type.value if hasattr(entity_type, "value") else str(entity_type),
        entity_id=entity_id,
        occurred_at=occurred_at_str,
        reason=reason,
        metadata=event_metadata,
    )

    event = LedgerEvent(
        organization_id=organization_id,
        seq=seq,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        occurred_at=occurred_at,
        reason=reason,
        event_metadata=event_metadata,
        prev_hash=prev_hash,
        hash=event_hash,
    )
    session.add(event)
    await session.flush()
    return event


async def verify_ledger_chain(
    session: AsyncSession,
    organization_id: str,
) -> dict[str, Any]:
    """Verify integrity of the tamper-evident hash chain for an organization."""
    stmt = (
        select(LedgerEvent)
        .where(LedgerEvent.organization_id == organization_id)
        .order_by(LedgerEvent.seq.asc())
    )
    result = await session.execute(stmt)
    events = list(result.scalars().all())

    expected_prev = "0" * 64
    for idx, ev in enumerate(events):
        expected_seq = idx + 1
        if ev.seq != expected_seq:
            return {
                "organization_id": organization_id,
                "valid": False,
                "checked_count": idx + 1,
                "head_seq": events[-1].seq if events else 0,
                "head_hash": events[-1].hash if events else "",
                "first_invalid_seq": ev.seq,
                "error_details": f"Sequence gap detected at event #{ev.seq} (expected #{expected_seq}).",
            }
        if ev.prev_hash != expected_prev:
            return {
                "organization_id": organization_id,
                "valid": False,
                "checked_count": idx + 1,
                "head_seq": events[-1].seq if events else 0,
                "head_hash": events[-1].hash if events else "",
                "first_invalid_seq": ev.seq,
                "error_details": f"Previous-hash mismatch at sequence #{ev.seq}.",
            }

        recomputed = compute_ledger_event_hash(
            prev_hash=ev.prev_hash,
            organization_id=ev.organization_id,
            seq=ev.seq,
            actor_id=ev.actor_id,
            action=ev.action,
            entity_type=ev.entity_type.value if hasattr(ev.entity_type, "value") else str(ev.entity_type),
            entity_id=ev.entity_id,
            occurred_at=ev.occurred_at.isoformat(),
            reason=ev.reason,
            metadata=ev.event_metadata,
        )
        if recomputed != ev.hash:
            return {
                "organization_id": organization_id,
                "valid": False,
                "checked_count": idx + 1,
                "head_seq": events[-1].seq if events else 0,
                "head_hash": events[-1].hash if events else "",
                "first_invalid_seq": ev.seq,
                "error_details": f"Hash integrity failure at sequence #{ev.seq}.",
            }
        expected_prev = ev.hash

    return {
        "organization_id": organization_id,
        "valid": True,
        "checked_count": len(events),
        "head_seq": events[-1].seq if events else 0,
        "head_hash": events[-1].hash if events else "",
        "first_invalid_seq": None,
        "error_details": None,
    }
