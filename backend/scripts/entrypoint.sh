#!/bin/sh
set -e

echo "==> [SHARESPACE] Running Alembic database migrations..."
alembic upgrade head

PORT="${PORT:-8000}"
echo "==> [SHARESPACE] Starting Uvicorn server on port $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips "*"
