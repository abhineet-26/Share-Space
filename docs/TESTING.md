# SHARESPACE — Judge & Evaluator Verification Guide

Welcome to **SHARESPACE** (v0.1.0 MVP) — the institutional resource-sharing and accountability platform.

This guide provides evaluators, judges, and developers with clear, reproducible instructions for verifying the full end-to-end lifecycle, security invariants, PostgreSQL Row-Level Security (RLS) isolation, and the tamper-evident Trust Ledger.

---

## 1. Quickstart & Deployment Options

### Option A: Complete Docker Compose Stack (Recommended)

Run the full stack (PostgreSQL with `btree_gist`, FastAPI backend, and Nginx/React frontend) with a single command:

```bash
docker compose up --build
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/healthz](http://localhost:8000/healthz)
- **Readiness Check**: [http://localhost:8000/readyz](http://localhost:8000/readyz)

Database migrations and deterministic institutional seed data are executed automatically on startup.

---

### Option B: Local Development Setup

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

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 2. Seed Personas & Demo Accounts

SHARESPACE includes deterministic synthetic test data for two distinct institutional tenants:
1. **National Institute of Technology (org_nit)**
2. **Harbour Space University (org_harbour)**

| Name | Role | Email | Persona Notes |
|------|------|-------|---------------|
| **Aarav Menon** | Student (`USER`) | `aarav.menon@nit.edu.in` | Electronics induction completed. Eligible for lab equipment. |
| **Diya Rao** | Student (`USER`) | `diya.rao@nit.edu.in` | 3D-printer safety training incomplete. Triggers actionable guidance. |
| **Kabir Shah** | Student (`USER`) | `kabir.shah@nit.edu.in` | Near weekly quota cap on Camera Kit and 3D Printer. |
| **Ravi Kulkarni** | Lab Manager (`MANAGER`) | `ravi.kulkarni@nit.edu.in` | Reviews requests, confirms handovers, resolves incidents. |
| **Priya Nair** | Administrator (`ADMIN`) | `priya.nair@nit.edu.in` | Governs versioned policies, user roles, and ledger oversight. |
| **Dr. Meera Iyer** | Resource Owner (`OWNER`) | `meera.iyer@nit.edu.in` | Publishes lab equipment, manages department assets. |
| **Rohan Gupta** | Cross-Tenant Manager | `rohan.gupta@harbour.edu` | Belongs to Harbour Space (`org_harbour`) — proves RLS isolation. |

*Click any persona pill on the bottom-right demo banner to switch authenticated sessions instantaneously.*

---

## 3. Step-by-Step Lifecycle Demonstration

Follow this 10-step sequence to verify the core product lifecycle per the PRD:

### Step 1: Discover Equipment
1. Authenticate as **Aarav Menon** (Student).
2. Open the **Catalogue** (`/resources`).
3. Search for `"Oscilloscope"` or filter by Category: *Electronics & Robotics*.
4. Click on **Tektronix 4-Channel Digital Storage Oscilloscope**.
5. Observe published specifications, location (Lab 204), requirements, and active institutional policy versions.

### Step 2: Deterministic 8-Check Eligibility Evaluation
1. Select a 3-hour time slot 2 days in the future.
2. The server-authoritative **Eligibility Engine** evaluates 8 distinct criteria:
   - Account verification (`PASS`)
   - Institutional membership (`PASS`)
   - Resource operational status (`PASS`)
   - Induction and safety training certifications (`PASS`)
   - Requested time window validity (`PASS`)
   - Calendar schedule conflicts (`PASS`)
   - Session duration limit (`PASS`)
   - Rolling weekly usage cap (`PASS`)
3. Note: If switching to **Diya Rao** and attempting to book the 3D Printer, the induction check fails with a clear institutional explanation and next step.

### Step 3: Request Booking (Idempotent)
1. Provide a project purpose: `"Final Year Capstone Project Oscilloscope Testing"`.
2. Add project code: `"FYP-2026"`.
3. Submit the request.
4. Booking is created with status `PENDING_REVIEW` and a tamper-evident audit event is chained to the Trust Ledger.

### Step 4: Authorised Human Decision (Staff Review)
1. Switch persona to **Ravi Kulkarni** (Lab Manager).
2. Navigate to **Bookings** (`/bookings`).
3. Open Aarav's submitted request.
4. Observe competing requests (if any) and historical usage.
5. Click **Approve**. Provide the required governance reason: `"Approved for Capstone project validation under Dr. Rao guidance."`.
6. Booking transitions to `APPROVED`. An in-app notification is delivered to Aarav.

### Step 5: Handover & Check-in (Condition Baseline)
1. Switch back to **Aarav Menon**.
2. Navigate to **My Bookings** and click **Check-in**.
3. Acknowledge institutional usage and safety rules.
4. Confirm presence of standard accessories (probes, power cable).
5. Upload an initial condition photo (or use demo baseline).
6. Submit check-in. The SHA-256 hash of the photo is recorded in the condition report and locked on the Trust Ledger. Status transitions to `CHECKED_OUT_TO_USER`.

### Step 6: Return Inspection & Supervised Workflow
1. At session conclusion, click **Return Equipment**.
2. Complete the final condition report checklist.
3. If unsupervised, the resource returns to `CLOSED` directly and frees the asset.
4. If supervised, it transitions to `RETURN_PENDING_CONFIRMATION` awaiting staff verification.

### Step 7: Report & Resolve Incident (Zero Automated Penalties)
1. In the return form or on the booking detail, click **Report Incident**.
2. Category: `MINOR_DAMAGE`.
3. Description: `"Minor cosmetic hairline scratch observed on outer chassis base plate during lab session."`.
4. Submit report. Status is `REPORTED` (treated as an unproven allegation).
5. Switch to **Ravi Kulkarni** (Manager) to inspect the incident:
   - Add a follow-up comment: `"Inspected by lab technician. No functional defect."`.
   - Click **Resolve Incident**.
   - Select Outcome: `NO_FAULT_FOUND`.
   - Resolution reason: `"Cosmetic hairline scratch on outer base plate. No impact on calibration. No financial or academic penalty assessed."`.
   - Submit. Resolves the incident with zero automated penalties.

### Step 8: Tamper-Evident Trust Ledger Verification
1. Switch to **Priya Nair** (Administrator).
2. Open the **Trust Ledger** (`/ledger`).
3. Review the chronological cryptographic event chain:
   - `BOOKING_REQUESTED`
   - `BOOKING_APPROVED`
   - `BOOKING_CHECKED_OUT`
   - `BOOKING_RETURNED`
   - `INCIDENT_REPORTED`
   - `INCIDENT_RESOLVED`
4. Click **Verify Ledger Integrity**.
5. The server recalculates SHA-256 hashes across all historical events and validates that `prev_hash` links match continuously. Output confirms: `Ledger valid: 100% intact`.

### Step 9: Simulate Ledger Tampering & Instant Repair
1. Click **Simulate Tamper (Demo)**.
2. The server simulates an out-of-band mutation to an event payload.
3. Click **Verify Ledger Integrity**.
4. The verification engine immediately detects the broken cryptographic chain, highlighting the exact sequence index (`firstInvalidSeq`) where tampering occurred.
5. Click **Repair Ledger Chain**.
6. The chain is recalculated and restored to valid status.

### Step 10: Admin Analytics & Utilisation CSV Export
1. Navigate to **Analytics** (`/analytics`).
2. Inspect:
   - 40-hour operational benchmark utilisation % per resource.
   - Student fairness share % by academic tier.
   - Demand hour blocks.
3. Click **Export CSV Report**.
4. Downloads an RFC 4180-compliant CSV report containing resource utilization, bookings count, and incident metrics.

---

## 4. Automated Verification Commands

Run the comprehensive test suite from the repository root:

```bash
# 1. Run complete pytest test suite (78 tests)
backend/venv/bin/pytest backend/tests/ -v

# 2. Run Ruff code quality & linting check
backend/venv/bin/ruff check backend/

# 3. Verify Frontend TypeScript compilation & production build
bun run build    # or npm run build
```

Expected result:
- **78 tests passing** (100% pass rate).
- **Zero Ruff errors**.
- **Vite production build succeeds** in `dist/`.
