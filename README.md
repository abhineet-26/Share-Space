# SHARESPACE — Accountability Infrastructure for Shared Institutional Assets

> "Access more. Waste less. Build together."

SHARESPACE is an institutional resource-sharing platform for college laboratories, makerspaces, media studios, and shared project spaces. Every reservation is managed as an accountable transaction from deterministic eligibility checks and fair allocation through handover condition records, return verification, human-reviewed incident reports, and a SHA-256 hash-chained **Trust Ledger**.

## Quick Start

```bash
npm install
npm run dev
```

The application starts on `http://localhost:3000`.

## Operating Modes (`VITE_API_MODE`)

- `mock` (default): Uses the deterministic in-memory + `localStorage` backend (`src/mocks/server.ts`) that enforces role-based access control (`USER`, `OWNER`, `MANAGER`, `ADMIN`), booking state-machine transitions, time-overlap conflict prevention (`409 Conflict`), versioned policy evaluation, rolling 7-day usage caps, waitlist promotion on cancellation, cross-organisation tenant isolation, and SHA-256 ledger chaining.
- `live`: Routes all `/api/v1/*` requests to `VITE_API_BASE_URL` for FastAPI integration.

## Seeded Demo Accounts

### Organisation A: Nilgiri Institute of Technology (`org_nit`)
- **Aarav Menon (`USER`)**: Verified student; Electronics Induction & 3D-Printer Safety Training COMPLETED; holds an `APPROVED` Digital Oscilloscope booking ready for check-in and a `CHECKED_OUT_TO_USER` Bench Power Supply ready for return.
- **Diya Rao (`USER`)**: Verified student; Electronics Induction COMPLETED, 3D-Printer Safety Training NOT completed (`ELIGIBILITY_BLOCKED` on 3D Printer); `#1` on the Mirrorless Camera Kit waitlist.
- **Kabir Shah (`USER`)**: Heavy user; already at `4.5h / 6.0h` rolling 7-day usage on the Mirrorless Camera Kit and `4.0h / 6.0h` on the 3D Printer.
- **Dr. Meera Iyer (`OWNER`)**: Electronics Department Head; manages lab resources.
- **Ravi Kulkarni (`MANAGER`)**: Lab Technician; reviews pending requests, confirms handovers/returns, and resolves incidents.
- **Priya Nair (`ADMIN`)**: Institutional Administrator; manages versioned policies, role assignments, training verifications, and ledger integrity.

### Organisation B: Harbour Community Makerspace (`org_harbour`)
- **Rohan Deshmukh (`ADMIN`)**: Demonstrates strict multi-tenant RLS isolation (zero records from Organisation A are visible in Organisation B).
