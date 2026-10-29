# SHARESPACE Backend

FastAPI backend for SHARESPACE — Trusted Institutional Resource Sharing Platform.

## Quick Start

```bash
cd backend
pip install -e ".[dev]"
cp .env.example .env
# Edit .env with your database URL
alembic upgrade head
uvicorn app.main:app --reload
```

## Project Structure

```
backend/
├── app/
│   ├── api/           # API route modules
│   ├── core/          # Config, security, logging, exceptions
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas (request/response)
│   └── services/      # Business logic services
├── migrations/        # Alembic migrations
└── tests/             # Pytest tests
```