from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LedgerEntityType
from app.services.ledger import append_ledger_event, verify_ledger_chain


@pytest.mark.integration
async def test_seeded_ledger_chains_verify(admin_session: AsyncSession) -> None:
    """Seeded hash chains for both organizations verify successfully."""
    res_nit = await verify_ledger_chain(admin_session, "org_nit")
    assert res_nit["valid"] is True
    assert res_nit["checked_count"] >= 4
    assert res_nit["first_invalid_seq"] is None

    res_harbour = await verify_ledger_chain(admin_session, "org_harbour")
    assert res_harbour["valid"] is True
    assert res_harbour["checked_count"] >= 1
    assert res_harbour["first_invalid_seq"] is None


@pytest.mark.integration
async def test_ledger_append_increments_seq_and_links_hash(admin_session: AsyncSession) -> None:
    """Appending a new event correctly links to preceding hash and increments sequence."""
    before_status = await verify_ledger_chain(admin_session, "org_nit")
    initial_count = before_status["checked_count"]
    prev_head_hash = before_status["head_hash"]

    new_event = await append_ledger_event(
        admin_session,
        organization_id="org_nit",
        actor_id="usr_priya",
        actor_name="Priya Nair",
        actor_role="ADMIN",
        action="AUDIT_VERIFIED",
        entity_type=LedgerEntityType.LEDGER,
        entity_id="audit_check_01",
        reason="Periodic safety committee audit verification",
        metadata={"verifiedBy": "Priya Nair"},
    )
    await admin_session.commit()

    assert new_event.seq == initial_count + 1
    assert new_event.prev_hash == prev_head_hash

    after_status = await verify_ledger_chain(admin_session, "org_nit")
    assert after_status["valid"] is True
    assert after_status["checked_count"] == initial_count + 1
    assert after_status["head_hash"] == new_event.hash


@pytest.mark.integration
async def test_tamper_detection_flags_first_invalid_seq(admin_session: AsyncSession) -> None:
    """A deliberate modification of event reason or metadata in the chain is detected at the exact sequence."""
    # Deliberately tamper with seq=2 in org_nit using raw SQL
    await admin_session.execute(
        text("ALTER TABLE ledgerevent DISABLE TRIGGER trg_protect_ledger_events;")
    )
    await admin_session.execute(
        text(
            "UPDATE ledgerevent SET reason = 'Unauthorized tampered reason text' "
            "WHERE organization_id = 'org_nit' AND seq = 2;"
        )
    )
    await admin_session.execute(
        text("ALTER TABLE ledgerevent ENABLE TRIGGER trg_protect_ledger_events;")
    )
    await admin_session.commit()

    # Verification must now FAIL and pinpoint seq=2 as the first invalid sequence
    tamper_result = await verify_ledger_chain(admin_session, "org_nit")
    assert tamper_result["valid"] is False
    assert tamper_result["first_invalid_seq"] == 2
    assert "Hash integrity failure" in tamper_result["error_details"]

    # Re-run seed to restore clean state for other tests
    from scripts.seed import seed_database

    await seed_database(admin_session)


@pytest.mark.integration
async def test_database_trigger_blocks_ledger_update_and_delete(
    admin_session: AsyncSession,
) -> None:
    """The database trigger trg_protect_ledger_events strictly blocks application-level UPDATE and DELETE."""
    # Attempting to update a ledger event must raise an exception
    with pytest.raises(DBAPIError) as exc_update:
        await admin_session.execute(
            text(
                "UPDATE ledgerevent SET reason = 'Attempted overwrite' "
                "WHERE organization_id = 'org_nit' AND seq = 1;"
            )
        )
    assert "strictly prohibited" in str(exc_update.value).lower()
    await admin_session.rollback()

    # Attempting to delete a ledger event must raise an exception
    with pytest.raises(DBAPIError) as exc_delete:
        await admin_session.execute(
            text("DELETE FROM ledgerevent " "WHERE organization_id = 'org_nit' AND seq = 1;")
        )
    assert "strictly prohibited" in str(exc_delete.value).lower()
    await admin_session.rollback()
