# Architecture and Technical Design

## 1. Architecture principles

1. Build a coherent monolithic backend for the hackathon; avoid premature microservices.
2. PostgreSQL is the source of truth for booking, eligibility, and audit records.
3. Enforce permissions and state transitions on the server.
4. Use deterministic business rules for access and allocation.
5. Keep AI outside critical state transitions.
6. Treat audit events as append-only at the application level.
7. Prefer a complete, testable vertical slice over disconnected feature modules.
8. Isolate tenants in the database (row-level security), not only in application code.
9. Treat policies as versioned data, not hardcoded rules; every decision records the policy versions applied.
10. Make the audit ledger tamper-evident and say exactly that, no more.
11. Do slow or failure-prone work (notifications, reminders, AI) through a transactional outbox and worker, never inside a booking transaction.
12. Design for operations from day one: CI, structured logs, health checks, migrations.

## 2. Recommended stack

- Web: Next.js, TypeScript
- Styling/components: Tailwind CSS and accessible component primitives
- API: FastAPI, Pydantic
- Persistence: PostgreSQL
- ORM/migrations: SQLAlchemy + Alembic, or a consistent alternative selected by the team
- Authentication: managed provider or securely implemented signed session/JWT flow
- Testing: pytest for API/domain logic; frontend tests for critical interactions; API smoke tests
- Identity: OIDC (authorization code + PKCE) through a managed provider such as Google, Microsoft Entra, Auth0, or Keycloak; demo login behind a non-production flag
- Object storage: S3-compatible bucket for condition photos and incident evidence (signed URLs)
- Background work: worker process (Celery + Redis, or a Postgres `FOR UPDATE SKIP LOCKED` job table to avoid extra infrastructure) fed by a transactional outbox
- Observability: structured JSON logs, Sentry (or equivalent) for errors, `/healthz` and `/readyz`
- CI/CD: GitHub Actions (lint, types, pytest with a PostgreSQL service, migration check, frontend build), pre-commit with secret scanning
- Optional AI: LLM API for query parsing or incident-report draft extraction
- Deployment: frontend and API hosting plus managed PostgreSQL, or one provider supporting all required pieces

Do not switch stacks mid-build without a blocking reason.

## 3. Logical components

```text
Browser
  └── Next.js UI
       ├── Authentication/session
       ├── Resource discovery
       ├── Booking request/status
       ├── Owner/manager workspace
       └── Check-in/return/incident forms
             │ HTTPS + JSON
             ▼
        FastAPI application
          ├── AuthN/AuthZ dependency
          ├── Resource service
          ├── Eligibility service
          ├── Booking service
          ├── Allocation/waitlist service
          ├── Condition/return service
          ├── Incident service
          ├── Audit service
          ├── Policy engine (versioned, declarative rules)
          ├── Notification service (writes to outbox)
          ├── Asset/QR service
          ├── Attachment service (signed URLs)
          └── Optional AI adapter
             │                    │
             ▼                    ▼
          PostgreSQL         Object storage (S3-compatible)
          ├── RLS tenant isolation
          ├── hash-chained audit ledger
          └── outbox table ──► Worker (reminders, overdue,
                               waitlist promotion, notifications,
                               nightly ledger verification)
```

For the MVP, modules may live in one deployable API. Separate them by domain in code, not by deploying many services.

## 4. Suggested repository structure

```text
sharespace/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── RULES.md
│   ├── PHASES.md
│   └── MEMORY.md
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   └── tests/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── migrations/
│   └── tests/
├── infra/
│   └── deployment notes/config (no secrets)
├── .github/workflows/ci.yml
├── .pre-commit-config.yaml
├── .env.example
└── .gitignore
```

If the repository is already structured differently, preserve its conventions and update this document instead of forcing a disruptive restructure.

## 5. Domain model

### Core entities

- `Organization` (also called Institution in earlier drafts): tenant boundary. Every tenant-owned table below carries `organization_id`.
- `User`: identity, institution membership, role assignments, verification status.
- `Resource`: resource identity, owner, category, location, condition, status, policies.
- `ResourceRequirement`: qualification/training/membership requirement.
- `TrainingRecord`: user training evidence and validity.
- `AvailabilityWindow`: allowed availability.
- `Booking`: requester, resource, requested period, lifecycle status, purpose.
- `EligibilityCheck`: individual check result and explanation.
- `ApprovalDecision`: reviewer, decision, reason, timestamp.
- `ConditionReport`: initial/return report, actor, notes, condition, evidence reference.
- `Incident`: issue, status, reviewer, resolution.
- `AuditEvent`: actor, action, target, timestamp, metadata.
- `Notification`: recipient, type, content, read state.
- `Policy` / `PolicyVersion`: scope, kind, status, versioned declarative definition, effective dates, author.
- `Asset`: individual unit of a resource, asset tag, QR token, condition, status.
- `Attachment`: storage key, SHA-256, MIME type, size, uploader, linked entity.
- `OutboxEvent`: pending side effects (notifications, reminders) written in the same transaction as the state change.

### Relationship sketch

```text
Institution 1 ── * User
Institution 1 ── * Resource
User 1 ── * Resource (owner)
User 1 ── * Booking (requester)
Resource 1 ── * Booking
Booking 1 ── * EligibilityCheck
Booking 1 ── * ApprovalDecision
Booking 1 ── * ConditionReport
Booking 1 ── * Incident
User 1 ── * AuditEvent (actor)
Booking/Resource/User 1 ── * AuditEvent (target)
User 1 ── * Notification
```

### Important database constraints

- `start_at < end_at`.
- Foreign keys for all relationships.
- Resource owner and manager permissions checked in service logic.
- Prevent overlapping confirmed bookings for the same resource. PostgreSQL range/exclusion constraints are ideal when available; otherwise use a transaction and row-level locking with a recheck before confirming.
- Use unique identifiers and timestamps; use UTC in storage and convert to local time in the UI.
- Index resource status/category, booking resource/time/status, requester/time, and audit target/time.
- Do not store authentication secrets in ordinary domain tables or logs.
- Add an idempotency key (unique per user and key) on booking creation.

### Overlap prevention (reference implementation)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_confirmed
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status IN ('APPROVED','CHECKED_OUT_TO_USER','RETURN_PENDING_CONFIRMATION','OVERDUE'));
```

Map the resulting constraint violation to `409 Conflict`. Verify with a test that fires concurrent approvals for overlapping slots.

### Tenant isolation with row-level security

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bookings
  USING (organization_id = current_setting('app.org_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id')::uuid);
```

Rules:
- Apply to every tenant-owned table, including `audit_events`, `attachments`, `policies`, and `outbox_events`.
- The API sets `SET LOCAL app.org_id = '<uuid>'` at the start of each transaction from the authenticated session (never from client input).
- Run the API as a role that is not a superuser and has no `BYPASSRLS`; use a separate migration role.
- Fail closed: if `app.org_id` is unset, queries return no rows.
- A CI test must prove cross-tenant reads and writes are denied.

## 6. Booking lifecycle state machine

Suggested states:

- `REQUESTED`
- `NEEDS_INFORMATION` (optional)
- `ELIGIBILITY_BLOCKED`
- `PENDING_REVIEW`
- `WAITLISTED`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `CHECKED_OUT_TO_USER` (resource handed over)
- `RETURN_PENDING_CONFIRMATION`
- `RETURNED`
- `OVERDUE`
- `CLOSED`

Implementation may simplify states, but the chosen state machine must be documented and consistently enforced.

Example allowed transitions:

```text
REQUESTED -> PENDING_REVIEW | ELIGIBILITY_BLOCKED | CANCELLED
PENDING_REVIEW -> APPROVED | REJECTED | WAITLISTED | NEEDS_INFORMATION
WAITLISTED -> PENDING_REVIEW | APPROVED | CANCELLED
APPROVED -> CANCELLED | CHECKED_OUT_TO_USER | OVERDUE
CHECKED_OUT_TO_USER -> RETURN_PENDING_CONFIRMATION | RETURNED | OVERDUE
RETURN_PENDING_CONFIRMATION -> RETURNED
RETURNED -> CLOSED
```

Not every deployment needs every state. Implement transitions through a domain service; do not accept arbitrary client-supplied status changes.

## 7. API contract outline

Use `/api/v1` prefix and consistent JSON errors. These are recommended routes, not an assertion that they already exist.

### Auth / profile
- `GET /api/v1/me`
- `GET /api/v1/users/{user_id}` — only where authorised

### Resources
- `GET /api/v1/resources`
- `GET /api/v1/resources/{resource_id}`
- `POST /api/v1/resources`
- `PATCH /api/v1/resources/{resource_id}`
- `POST /api/v1/resources/{resource_id}/publish`
- `GET /api/v1/resources/{resource_id}/availability`

### Booking
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/mine`
- `GET /api/v1/bookings/{booking_id}`
- `POST /api/v1/bookings/{booking_id}/cancel`
- `POST /api/v1/bookings/{booking_id}/decision` — body includes decision + reason
- `POST /api/v1/bookings/{booking_id}/check-in`
- `POST /api/v1/bookings/{booking_id}/condition-reports`
- `POST /api/v1/bookings/{booking_id}/return`
- `POST /api/v1/bookings/{booking_id}/return-confirmation`

### Policies (admin/owner scoped)
- `GET /api/v1/policies`
- `POST /api/v1/policies` — creates a draft
- `POST /api/v1/policies/{policy_id}/versions`
- `POST /api/v1/policies/{policy_id}/activate`
- `POST /api/v1/policies/preview` — dry-run a policy against a sample request without persisting

### Assets, QR, attachments
- `GET /api/v1/assets/scan/{qr_token}` — authenticated; returns only context the actor is allowed to act on
- `POST /api/v1/resources/{resource_id}/assets`
- `POST /api/v1/attachments/upload-url` — returns a short-lived signed upload URL after type/size checks
- `POST /api/v1/attachments/{attachment_id}/confirm` — records SHA-256 and links to a report or incident

### Eligibility / queue
- `POST /api/v1/bookings/{booking_id}/eligibility-check`
- `GET /api/v1/resources/{resource_id}/waitlist`

### Incidents / audit / notifications
- `POST /api/v1/bookings/{booking_id}/incidents`
- `GET /api/v1/incidents`
- `POST /api/v1/incidents/{incident_id}/resolution`
- `GET /api/v1/audit-events?entity_type=&entity_id=`
- `GET /api/v1/audit-events/verify` — recomputes the hash chain for the caller's organisation (admin)
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{notification_id}/read`

### Response conventions
- `200` successful read/update
- `201` created
- `400` invalid request/state transition
- `401` unauthenticated
- `403` authenticated but not authorised
- `404` absent or deliberately undisclosed entity
- `409` scheduling conflict / concurrent state conflict
- `422` schema validation failure
- `500` unexpected server failure, with safe generic client message

Never return stack traces, secret values, or unnecessary personal information to the client.

## 8. Eligibility service

Suggested interface:

```python
EligibilityResult(
    eligible: bool,
    checks=[
        {"key": "account_verified", "status": "PASS", "reason": "..."},
        {"key": "required_training", "status": "FAIL", "reason": "..."},
        {"key": "time_available", "status": "PASS", "reason": "..."},
    ],
    requires_human_review: bool
)
```

Use explicit requirement types, not free-form LLM interpretation as the source of truth. A `REVIEW_REQUIRED` result should route to an authorised reviewer and never silently become `PASS`.

### Policy-driven evaluation

Eligibility checks read their parameters from active policy versions instead of constants. The evaluator is deterministic and runs only declarative rule types (it never executes stored code).

```json
{
  "kind": "USAGE_CAP",
  "scope": {"type": "RESOURCE", "id": "res_3dprinter_01"},
  "definition": {
    "window": "rolling_7_days",
    "max_hours_per_user": 6,
    "applies_to_roles": ["USER"]
  }
}
```

Resolution order: resource policy, then category policy, then organisation policy. For safety and eligibility rules the most restrictive applicable rule wins. The stored booking records `policy_version_ids` and the evaluation output, so a decision can be explained later even after policies change. Policy definitions are validated against Pydantic schemas on save, and a preview endpoint lets admins test a policy before activating it.

## 9. Fair allocation

For the MVP:
1. Filter out requests that fail mandatory requirements.
2. Group requests that compete for the same resource and overlapping time.
3. Apply published institutional priority rules.
4. Apply usage caps and recent-use policy if configured.
5. Use request timestamp as a tie-breaker where policy permits.
6. Record the applied policy version and explanation.
7. Place unallocated eligible requests on a waitlist.
8. Re-evaluate the next eligible request when a slot is released.

Avoid a mysterious composite score unless each factor, weight, and consequence is visible and justified. Managers may override with a mandatory reason.

## 10. Audit event design and the tamper-evident ledger

Recommended fields:
- `id`
- `organization_id`
- `actor_user_id` (nullable only for documented system events)
- `action`
- `entity_type`
- `entity_id`
- `occurred_at`
- `request_id` / correlation ID
- `reason`
- `metadata` (allowlisted, non-sensitive JSON)
- `seq` (monotonic per organisation), `prev_hash`, `hash`

Chain definition:

```text
hash = SHA-256( prev_hash || canonical_json(organization_id, seq, actor_user_id, action,
                entity_type, entity_id, occurred_at, reason, metadata) )
```

Implementation notes:
- Compute `seq`, `prev_hash`, and `hash` inside the insert path under `pg_advisory_xact_lock(hashtext(organization_id::text))` so concurrent writers in one organisation produce a single linear chain.
- Insert events in the same database transaction as the state change.
- Grant the application role INSERT and SELECT only on `audit_events`; add a trigger that rejects UPDATE and DELETE.
- `GET /audit-events/verify` recomputes the chain and returns the first sequence number that fails.
- Run verification nightly in the worker and alert on failure.
- Store attachment SHA-256 values in event metadata so evidence is bound to the ledger.
- Use correction events instead of modifying history.

Honest claims:
- This design is **tamper-evident**: accidental or casual modification is detectable.
- It is **not** immutable. A database superuser who rewrites every later row could rebuild a consistent chain.
- Roadmap hardening: periodically export the chain head hash to an external write-once location or a third-party timestamp, and show the last anchored head in the admin console.
- Do not describe the ledger as blockchain, immutable, or legally certified.

## 11. Security and privacy

- Server-side authorisation for every protected endpoint.
- Validate ownership and institution boundary on reads and writes.
- Parameterised database access/ORM.
- CSRF protection if cookie-based sessions are used.
- Secure, HttpOnly, SameSite cookies where applicable; TLS in deployment.
- Rate-limit sensitive endpoints where feasible.
- Validate upload types and size if evidence uploads are implemented; allowlist MIME types (for example JPEG, PNG, PDF), cap size, serve only via short-lived signed URLs, store the SHA-256, and never serve user uploads from the application origin.
- QR tokens are random, unguessable, rotatable, and carry no data; a scan never grants access by itself.
- OIDC with authorization code and PKCE; map verified email domain to organisation; assign roles by admin action, not by claim alone; demo login disabled unless an explicit non-production flag is set.
- Session cookies: Secure, HttpOnly, SameSite; short lifetime with re-authentication for privileged actions.
- Secret scanning in pre-commit and CI; dependency update automation.
- Keep secrets in environment variables or a secret manager; `.env` must be ignored by Git.
- Use synthetic demo accounts and data.
- Minimise collection and retention of personal data.
- Never rely on frontend role labels as proof of permission.
- AI requests should exclude unnecessary personal data; treat model output as untrusted input.

## 12. AI integration boundary

Optional use cases:
- Parse natural-language search into structured search filters.
- Draft structured incident fields from user-written notes.
- Summarise aggregated usage trends.

AI must not:
- Verify identity or training by assertion.
- Approve restricted access autonomously.
- Decide liability, damage responsibility, penalties, or suspension.
- Alter booking status directly.
- See personal information that is not required for the task.

Validate model output against a schema and require user confirmation for extracted incident details.

## 13. Background jobs, observability, and delivery

### Transactional outbox
Notifications, reminders, and similar side effects are written to `outbox_events` in the same transaction as the booking change. A worker polls (`FOR UPDATE SKIP LOCKED`), delivers, marks success, and retries with backoff. Delivery failure never rolls back or corrupts a booking.

### Scheduled jobs
- Upcoming-booking reminders.
- Overdue detection and escalation.
- Waitlist promotion when a slot is released.
- Nightly ledger verification.
- Expiry sweep for training records.

### Observability
- Structured JSON logs with `request_id`, `organization_id`, and actor ID; never log secrets or free-text personal data.
- Error tracking with PII scrubbing.
- `/healthz` (process up) and `/readyz` (database reachable, migrations current).

### CI/CD pipeline (every push)
1. Lint and format (Ruff, ESLint/Prettier).
2. Type check (mypy or pyright where feasible, `tsc`).
3. Backend tests against a real PostgreSQL service, including: overlap race, RLS cross-tenant denial, permission matrix, state-machine transitions, ledger chain verification, policy-driven outcomes.
4. Migration check: apply from empty and from previous release.
5. Frontend build and basic interaction tests.
6. Secret scan.

## 14. Deployment and environment

Provide `.env.example` with placeholder names only, e.g.:

```text
DATABASE_URL=
DATABASE_MIGRATION_URL=
AUTH_SECRET=
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
ENABLE_DEMO_LOGIN=false
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
REDIS_URL=
SENTRY_DSN=
AI_API_KEY=
NEXT_PUBLIC_API_BASE_URL=
```

Never commit real credentials. Deployment checklist:
- Apply migrations.
- Seed only fictional demo data.
- Create judge accounts or a clearly documented demo-login flow.
- Verify public routes and protected routes.
- Run the primary end-to-end test against the deployed environment.
- Verify data persists after refresh and service restart.
- Check logs for secrets and personal data.
- Confirm all submission links remain accessible.

- Run the nightly ledger verification and confirm the readiness endpoint reports healthy.
- Confirm demo login is disabled in any environment holding non-demo data.
