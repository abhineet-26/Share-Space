# SHARESPACE Backend Makefile
# Common development commands

.PHONY: help install test lint format typecheck migrate upgrade downgrade seed run clean

help:
	@echo "SHARESPACE Backend - Available Commands:"
	@echo "  install      - Install dependencies (with dev extras)"
	@echo "  test         - Run all tests"
	@echo "  test-unit    - Run unit tests only"
	@echo "  test-integration - Run integration tests (requires DB)"
	@echo "  lint         - Run ruff linter"
	@echo "  format       - Format code with ruff"
	@echo "  typecheck    - Run mypy type checking"
	@echo "  migrate      - Run alembic migrations (upgrade head)"
	@echo "  upgrade      - Create new migration (usage: make upgrade MSG='description')"
	@echo "  downgrade    - Downgrade one migration"
	@echo "  seed         - Run deterministic seed script"
	@echo "  run          - Start development server"
	@echo "  clean        - Clean build artifacts"

install:
	pip install -e ".[dev]"

test:
	pytest

test-unit:
	pytest -m "unit"

test-integration:
	pytest -m "integration"

lint:
	ruff check .

format:
	ruff format .

typecheck:
	mypy

migrate:
	alembic -c migrations/alembic.ini upgrade head

upgrade:
	alembic -c migrations/alembic.ini revision --autogenerate -m "$(MSG)"

downgrade:
	alembic -c migrations/alembic.ini downgrade -1

seed:
	python -m scripts.seed

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

clean:
	rm -rf __pycache__ .pytest_cache .mypy_cache .ruff_cache *.egg-info dist build
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true