"""Production entrypoint runner for SHARESPACE.

Executes Alembic database migrations before starting Uvicorn.
Supports Render-assigned PORT environment variable and graceful signal handling.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def run_migrations() -> None:
    print("==> [SHARESPACE] Running database migrations (alembic upgrade head)...", flush=True)
    config_args: list[str] = []
    for candidate in [
        "alembic.ini",
        "migrations/alembic.ini",
        "/app/alembic.ini",
        "/app/migrations/alembic.ini",
    ]:
        if Path(candidate).exists():
            config_args = ["-c", candidate]
            break

    cmd = ["alembic", *config_args, "upgrade", "head"]
    print(f"==> [SHARESPACE] Executing: {' '.join(cmd)}", flush=True)
    res = subprocess.run(cmd, check=False)
    if res.returncode != 0:
        print(
            f"==> [SHARESPACE] ERROR: Alembic migrations failed with exit code {res.returncode}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(res.returncode)
    print("==> [SHARESPACE] Database migrations applied successfully.", flush=True)

    # Safe initial bootstrap if database is empty and demo mode is active
    if os.environ.get("AUTO_BOOTSTRAP_DEMO", "true").lower() == "true":
        try:
            import asyncio

            from scripts.bootstrap_demo import run_bootstrap

            print("==> [SHARESPACE] Checking institutional demo bootstrap state...", flush=True)
            asyncio.run(run_bootstrap())
        except Exception as exc:
            print(f"==> [SHARESPACE] Notice: Bootstrap check: {exc}", flush=True)


def start_server() -> None:
    port_str = os.environ.get("PORT", "8000")
    try:
        port = int(port_str)
    except ValueError:
        port = 8000

    host = os.environ.get("HOST", "0.0.0.0")
    print(f"==> [SHARESPACE] Starting Uvicorn on {host}:{port}...", flush=True)

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


def main() -> None:
    run_migrations()
    start_server()


if __name__ == "__main__":
    main()
