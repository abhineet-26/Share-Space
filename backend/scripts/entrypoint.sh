#!/bin/sh
set -e

echo "==> [SHARESPACE] Running Alembic database migrations..."
if [ -f "alembic.ini" ]; then
    alembic upgrade head
elif [ -f "migrations/alembic.ini" ]; then
    alembic -c migrations/alembic.ini upgrade head
elif [ -f "/app/alembic.ini" ]; then
    alembic -c /app/alembic.ini upgrade head
elif [ -f "/app/migrations/alembic.ini" ]; then
    alembic -c /app/migrations/alembic.ini upgrade head
else
    alembic upgrade head
fi

PORT="${PORT:-8000}"
echo "==> [SHARESPACE] Starting Uvicorn server on port $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --proxy-headers --forwarded-allow-ips "*"
