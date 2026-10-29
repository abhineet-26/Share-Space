"""Production entrypoint runner for SHARESPACE.

Executes Alembic database migrations before starting Uvicorn.
Supports Render-assigned PORT environment variable and graceful signal handling.
"""

from __future__ import annotations

import os
import subprocess
import sys


def run_migrations() -> None:
    print("==> [SHARESPACE] Running database migrations (alembic upgrade head)...", flush=True)
    res = subprocess.run(["alembic", "upgrade", "head"], check=False)
    if res.returncode != 0:
        print(
            f"==> [SHARESPACE] ERROR: Alembic migrations failed with exit code {res.returncode}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(res.returncode)
    print("==> [SHARESPACE] Database migrations applied successfully.", flush=True)


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
