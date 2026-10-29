from __future__ import annotations

import subprocess

import pytest


@pytest.mark.integration
def test_alembic_migrations_downgrade_and_upgrade() -> None:
    """Verifies that Alembic migrations run cleanly down to base and back up to head."""
    # Downgrade to base
    downgrade_proc = subprocess.run(
        ["venv/bin/alembic", "-c", "migrations/alembic.ini", "downgrade", "base"],
        cwd=".",
        capture_output=True,
        text=True,
        check=False,
    )
    assert downgrade_proc.returncode == 0, f"Downgrade failed: {downgrade_proc.stderr}"

    # Upgrade back to head
    upgrade_proc = subprocess.run(
        ["venv/bin/alembic", "-c", "migrations/alembic.ini", "upgrade", "head"],
        cwd=".",
        capture_output=True,
        text=True,
        check=False,
    )
    assert upgrade_proc.returncode == 0, f"Upgrade failed: {upgrade_proc.stderr}"

    # Re-run seed to restore database state for other tests
    seed_proc = subprocess.run(
        ["venv/bin/python", "scripts/seed.py"],
        cwd=".",
        capture_output=True,
        text=True,
        check=False,
    )
    assert seed_proc.returncode == 0, f"Re-seed failed: {seed_proc.stderr}"
