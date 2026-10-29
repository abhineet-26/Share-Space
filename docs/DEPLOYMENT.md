# SHARESPACE Production Deployment Guide

This guide details deployment options for **SHARESPACE** across multiple environments, from single-node Docker VPS setups to fully managed cloud infrastructure.

---

## Architecture Overview

SHARESPACE comprises three runtime components:

1. **Frontend (Vite / React 19 / TailwindCSS / Bun)**: Single-page application served via Nginx with reverse proxy to `/api/v1` or deployed to a CDN (Vercel, Cloudflare Pages, S3+CloudFront).
2. **Backend (FastAPI / Python 3.11 / Uvicorn)**: Asynchronous REST API enforcing domain invariants, role-based access control, tamper-evident hash chaining, and PostgreSQL session configuration.
3. **Database (PostgreSQL 16 or 17)**: Requires `btree_gist` extension for time-overlap exclusion constraints and Row-Level Security (RLS) policies for fail-closed cross-organisation isolation.

---

## Option 1: Docker Compose (VPS / Cloud VM)

Recommended for quick self-hosted staging or production on a single VPS (DigitalOcean Droplet, Hetzner Cloud, AWS EC2, GCP Compute Engine).

### 1. Prerequisites
- Linux host (Ubuntu 22.04 LTS or 24.04 LTS)
- Docker Engine 24+ and Docker Compose v2+
- Public domain pointing to the host's IP (e.g. `sharespace.example.edu`)

### 2. Clone Repository & Setup Environment
```bash
git clone https://github.com/abhineet-26/Share-Space.git /opt/sharespace
cd /opt/sharespace

# Generate secure secrets
openssl rand -hex 32  # Use for SECRET_KEY
openssl rand -hex 16  # Use for POSTGRES_PASSWORD

# Create production environment file
cat <<EOF > .env
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_USER=sharespace
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=sharespace
CORS_ORIGINS=https://sharespace.example.edu
VITE_API_URL=https://sharespace.example.edu/api/v1
ENABLE_DEMO_LOGIN=false
DEMO_DEFAULT_ORG_ID=org_nit
EOF
```

### 3. Launch Services with Docker Compose
```bash
# Build and start all containers in background
docker compose up -d --build

# Verify all containers are healthy
docker compose ps

# Apply database migrations
docker compose exec backend alembic -c migrations/alembic.ini upgrade head

# (Optional) Seed demo institution data
docker compose exec backend python scripts/seed.py
```

### 4. Configure Reverse Proxy & Automatic SSL (Caddy)
Install Caddy for zero-config automatic Let's Encrypt TLS:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y

# Configure /etc/caddy/Caddyfile:
cat <<EOF | sudo tee /etc/caddy/Caddyfile
sharespace.example.edu {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```

---

## Option 2: Managed PaaS (Render / Railway / Fly.io)

Ideal for managed cloud deployments with zero server maintenance.

### Step 1: Managed PostgreSQL
1. Create a PostgreSQL 16+ instance.
2. Enable `btree_gist`:
   Connect via `psql` and execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

### Step 2: Backend Web Service
1. Set Repository root to `backend/` or build from root with `backend/Dockerfile`.
2. Configure **Environment Variables**:
   - `DATABASE_URL`: `postgresql+asyncpg://user:pass@host:5432/dbname`
   - `SYNC_DATABASE_URL`: `postgresql://user:pass@host:5432/dbname`
   - `SECRET_KEY`: `<min-32-chars-random-secret>`
   - `ENVIRONMENT`: `production`
   - `DEBUG`: `false`
   - `LOG_LEVEL`: `INFO`
   - `CORS_ORIGINS`: `https://frontend-url.com`
   - `ENABLE_DEMO_LOGIN`: `false` (or `true` for demo sandbox)
3. Set **Start Command**:
   ```bash
   alembic -c migrations/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### Step 3: Frontend Deployment (Vercel / Cloudflare / Netlify)
1. Build Command: `bun run build` (or `npm run build`)
2. Output Directory: `dist`
3. Environment Variables:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com/api/v1`

---

## Option 3: Enterprise AWS Architecture (ECS + RDS + CloudFront)

```
       [ Route 53 / DNS ]
                │
         [ CloudFront CDN ]
         ├── Static Assets ───────> [ S3 Bucket: Vite React SPA ]
         └── /api/v1/* ───────────> [ Application Load Balancer (ALB) ]
                                                │
                                    [ AWS ECS Fargate ]
                               (FastAPI Backend Service)
                                                │
                                    [ AWS RDS PostgreSQL 16 ]
                             (Multi-AZ, btree_gist, Automated Backups)
```

1. **Database**: AWS RDS PostgreSQL 16 (Multi-AZ with automated snapshots).
   - Ensure the parameter group or initial database script creates `btree_gist`.
2. **Backend**: AWS ECS Fargate task running `backend/Dockerfile` behind an ALB.
   - Use AWS Secrets Manager for `SECRET_KEY` and DB credentials.
   - Run Alembic migration tasks in an ECS standalone task or CI pipeline before deploying new task definitions.
3. **Frontend**: S3 static website hosting bucket behind CloudFront with custom error response routing 404 to `/index.html` (for SPA client-side routing).

---

## Critical Production Checklist

| Category | Requirement | Verified |
| :--- | :--- | :---: |
| **Database** | PostgreSQL 16+ with `btree_gist` extension | [x] |
| **Security** | Row-Level Security (RLS) enabled on all tenant tables | [x] |
| **Secrets** | `SECRET_KEY` is a 256-bit cryptographically secure random string | [ ] |
| **Environment** | `ENVIRONMENT=production`, `DEBUG=false` | [ ] |
| **Auth** | Secure HTTP-only cookies (`Secure`, `SameSite=Lax`, `HttpOnly`) | [x] |
| **Ledger** | PostgreSQL triggers active to prevent `UPDATE`/`DELETE` on `ledgerevent` | [x] |
| **Migrations** | Alembic migrations executed (`alembic upgrade head`) | [ ] |
| **Seed** | Institutional production users & resources populated | [ ] |
| **Monitoring** | Health check endpoints active at `/api/v1/health` and `/` | [x] |
