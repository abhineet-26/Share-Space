# SHARESPACE — Accountability Infrastructure for Shared Institutional Assets

> *"Access more. Waste less. Build together."*

SHARESPACE is a production-grade institutional resource-sharing and accountability platform designed for college laboratories, research centres, makerspaces, and shared technical spaces. Every reservation is managed as an accountable, policy-driven lifecycle from deterministic eligibility evaluation and fair queue allocation through handover condition records, return inspection, human-reviewed incident resolution, and a SHA-256 hash-chained **Trust Ledger**.

---

## 🚀 Quick Start

### Option 1: Docker Compose (Full Stack with Database)

Launch the entire stack (PostgreSQL with `btree_gist`, FastAPI backend, and Nginx/React frontend) with one command:

```bash
docker compose up --build
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/healthz](http://localhost:8000/healthz)
- **Readiness Check**: [http://localhost:8000/readyz](http://localhost:8000/readyz)

Database migrations and deterministic institutional seed data are executed automatically on startup.

---

### Option 2: Local Developer Setup

#### 1. Backend (FastAPI + PostgreSQL)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Run migrations and seed data
alembic upgrade head
python scripts/seed.py

# Launch FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend (React 19 + TypeScript + Vite)
```bash
# In repository root
bun install   # or npm install
VITE_API_MODE=live bun run dev
```

Visit [http://localhost:5173](http://localhost:5173).

---

## 🏛️ Core Architecture & Security Invariants

1. **Fail-Closed Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) forced across all 17 tenant tables. The application runs as non-superuser role `sharespace_app` (`NOBYPASSRLS`). The session tenant is bound locally per transaction using `set_tenant_context(session, org_id)`.
2. **Deterministic 8-Check Eligibility Engine**: Server-authoritative evaluation enforcing account verification, institutional membership, resource operational status, verified induction training records, booking window validity, calendar schedule conflicts, single-session duration limits, and rolling weekly usage caps. Every check provides clear institutional reasons and actionable next steps.
3. **Double-Booking Prevention Under Concurrency**: Database-level PostgreSQL `btree_gist` exclusion constraint prevents overlapping confirmed bookings under high concurrent load.
4. **Tamper-Evident Trust Ledger**: Every administrative role change, resource publication, booking decision, condition report, incident allegation, and ledger verification is recorded in a chronological SHA-256 hash chain (`hash = SHA256(seq + prev_hash + occurred_at + action + payload)`). Database triggers prevent application-level `UPDATE` and `DELETE`.
5. **Human-in-the-Loop Incident Resolution**: Incident reports remain unproven allegations until reviewed by authorized staff. Zero automated financial penalties or academic grade deductions.
6. **Defense-in-Depth Security Hardening**: Strict Content Security Policy (`default-src 'self'`), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, CORS validation, and sliding-window rate limiting on authentication and sensitive endpoints.

---

## 👥 Seed Personas & Demo Accounts

SHARESPACE includes deterministic synthetic test data for two distinct institutional tenants:

### Organisation A: National Institute of Technology (`org_nit`)
- **Aarav Menon (`USER`)**: Verified student; Electronics induction COMPLETED. Holds an `APPROVED` Digital Oscilloscope booking ready for check-in.
- **Diya Rao (`USER`)**: Verified student; 3D-printer safety training incomplete (`ELIGIBILITY_BLOCKED` on 3D Printer). `#1` on the waitlist.
- **Kabir Shah (`USER`)**: Heavy user; near weekly quota cap on Camera Kit and 3D Printer.
- **Ravi Kulkarni (`MANAGER`)**: Lab Manager; reviews pending requests, confirms handovers/returns, and resolves incidents.
- **Priya Nair (`ADMIN`)**: Institutional Administrator; manages versioned policies, role assignments, training verifications, and ledger oversight.
- **Dr. Meera Iyer (`OWNER`)**: Electronics Department Head; manages lab resources and specifications.

### Organisation B: Harbour Community Makerspace (`org_harbour`)
- **Rohan Gupta (`MANAGER`)**: Proves strict multi-tenant RLS isolation (zero records from Organisation A are accessible in Organisation B).

*Click any persona pill on the bottom-right demo banner to switch authenticated sessions instantaneously.*

---

## 🧪 Verification & Testing

Run the full automated test suite from the repository root:

```bash
# 1. Run complete pytest test suite (78 tests)
backend/venv/bin/pytest backend/tests/ -v

# 2. Run Ruff code quality & linting check
backend/venv/bin/ruff check backend/

# 3. Verify Frontend TypeScript compilation & production build
bun run build    # or npm run build
```

- Production Deployment Guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Comprehensive Judge Demonstration Walkthrough: [docs/TESTING.md](docs/TESTING.md)
- Complete Functional Requirements Audit (FR-01 to FR-22): [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)
- Project Memory & Architectural Decisions: [docs/MEMORY.md](docs/MEMORY.md)
