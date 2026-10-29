from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ALEMBIC_BIN = shutil.which("alembic") or str(Path(sys.executable).parent / "alembic")
_PYTHON_BIN = sys.executable


@pytest.mark.integration
def test_alembic_migrations_downgrade_and_upgrade() -> None:
    """Verifies that Alembic migrations run cleanly down to base and back up to head."""
    # Downgrade to base
    downgrade_proc = subprocess.run(
        [_ALEMBIC_BIN, "-c", "migrations/alembic.ini", "downgrade", "base"],
        cwd=_BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert downgrade_proc.returncode == 0, f"Downgrade failed: {downgrade_proc.stderr}"

    # Upgrade back to head
    upgrade_proc = subprocess.run(
        [_ALEMBIC_BIN, "-c", "migrations/alembic.ini", "upgrade", "head"],
        cwd=_BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert upgrade_proc.returncode == 0, f"Upgrade failed: {upgrade_proc.stderr}"

    # Re-run seed to restore database state for other tests
    seed_proc = subprocess.run(
        [_PYTHON_BIN, "scripts/seed.py"],
        cwd=_BACKEND_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert seed_proc.returncode == 0, f"Re-seed failed: {seed_proc.stderr}"
