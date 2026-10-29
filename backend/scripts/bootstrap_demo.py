"""Explicit one-time non-destructive demo bootstrap script for SHARESPACE.

This script executes safe_bootstrap_demo, which checks if institutional users exist.
If any user exists (user_count > 0), it aborts without deleting or overwriting any data.
"""

from __future__ import annotations

import asyncio
import sys

from app.core.database import migration_session_factory
from scripts.seed import safe_bootstrap_demo


async def run_bootstrap() -> None:
    async with migration_session_factory() as session:
        success = await safe_bootstrap_demo(session)
        if success:
            print("SHARESPACE demo environment bootstrapped successfully.")
        else:
            print("SHARESPACE database already contains data. Bootstrap skipped.")


def main() -> None:
    try:
        asyncio.run(run_bootstrap())
    except Exception as exc:
        print(f"Error during bootstrap: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
