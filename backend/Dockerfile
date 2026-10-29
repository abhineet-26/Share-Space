# Multi-stage Dockerfile for SHARESPACE FastAPI Backend
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONPATH="/app"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Runtime Stage
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONPATH="/app"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python site-packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create unprivileged application user
RUN groupadd -g 10001 sharespace && \
    useradd -u 10001 -g sharespace -s /bin/bash -m sharespace

COPY . /app
RUN chmod +x /app/scripts/entrypoint.sh && chown -R sharespace:sharespace /app

USER sharespace

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

CMD ["python", "scripts/run.py"]
