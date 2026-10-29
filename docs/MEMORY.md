# SHARESPACE — Persistent Project Memory

> Purpose: compact, durable context for future AI coding sessions. Read this file before changing scope, architecture, rules, or product flows. Update it when a decision materially changes.

## Project identity

- Working name: SHARESPACE
- Tagline: "Access more. Waste less. Build together."
- Problem: unlock underused institutional equipment and spaces through trusted, safe, accountable sharing.
- Initial setting: college campus, especially technical equipment, media/computing resources, and supervised spaces.
- Core differentiator: a complete resource-sharing lifecycle with eligibility, approval, fair allocation, condition records, return, incident handling, and an auditable Trust Ledger.
- The name is provisional; check for conflicts before public branding.
- Product ambition (decided 2026-10-28): build as a professional product, not only a hackathon demo. Positioning: accountability infrastructure for shared assets (policy-driven, auditable, multi-tenant). See `ROADMAP.md`.

## Hackathon constraints

- One continuous 48-hour build round.
- The submitted product must be developed during the official build window.
- Planning/research may happen before the build window, subject to the organiser's rules.
- Required submission includes working product link, source repository, project document, test instructions/credentials, team details, member contributions, and disclosure of templates/libraries/pre-existing code.
- Use fictional, anonymised, or authorised data.
- Judges may inspect repository and development history.
- Product must remain accessible during judging.

## Evaluation rubric

- Understanding problem: 15 points.
- Core solution: 20 points.
- End-to-end product: 20 points.
- Technical depth/reliability: 15 points.
- Trust/safety/accountability: 10 points.
- Fair allocation/accessibility: 10 points.
- Originality/real-world potential: 10 points.

Prioritise a reliable end-to-end workflow. AI is not a substitute for core functionality.

## Recommended stack (provisional)

- Next.js + TypeScript frontend. → **ACTUAL: React 19 + TypeScript + Vite** (preserved from AI Studio)
- Tailwind CSS + accessible component primitives. → **ACTUAL: Tailwind 4 + CSS variables** (preserved)
- FastAPI backend. → **PLANNED: Phase 01**
- PostgreSQL database. → **PLANNED: Phase 02**
- SQLAlchemy/Alembic or one consistent equivalent. → **PLANNED: Phase 02**
- Managed auth or a secure, documented session/JWT design. → **PLANNED: Phase 03**
- Optional LLM API for natural-language discovery or incident-report drafting. → **MOCKED: Gemini 4 Argon High Thinking + deterministic fallback**
- OIDC sign-in; S3-compatible object storage for evidence; worker with transactional outbox; GitHub Actions CI; Sentry-style error tracking. → **TIER 2**
- In-app notifications are sufficient for MVP. → **MOCKED**

Do not switch stacks without a clear reason. If implementation has already selected a different stack, update this file and preserve existing conventions.

## MVP must prove

1. Owner lists a resource with availability and conditions.
2. User discovers it and reads requirements.
3. User submits a booking request.
4. Deterministic eligibility checks return explicit reasons.
5. Authorised manager approves, rejects, or waitlists with a reason.
6. User checks in and records initial condition.
7. User returns and records final condition.
8. Delay/damage can be reported and reviewed by a human.
9. Booking and decision history is visible and persisted.
10. Conflicting confirmed bookings are prevented.
11. Server-side permission checks prevent unauthorised actions.
12. Tenant isolation holds under row-level security (cross-tenant test passes).
13. A policy edit changes new outcomes without a deploy and does not alter past decisions.
14. The ledger hash chain verifies, and detects a deliberate modification.

## Domain rules that must not drift

- Visibility does not imply access permission.
- Eligibility and owner approval are separate.
- The backend owns status transitions.
- Confirmed overlapping bookings for the same resource are forbidden.
- Mandatory requirements are deterministic and explainable.
- Waitlisting and fairness policies must be published and understandable.
- Rejections and overrides require a reason.
- Check-in/return conditions are structured records.
- Incident reports are allegations until reviewed; no automatic blame or penalty.
- Audit history is append-only at application level; corrections become new events.
- AI never makes final restricted-access, safety, liability, or penalty decisions.
- AI service failure must not break the core booking workflow.
- Do not claim cryptographic immutability, live verification, real payments, or production compliance unless implemented and verified. The ledger is **tamper-evident** (hash-chained), not immutable.
- Every tenant table has `organization_id` and RLS; the app DB role has no `BYPASSRLS`.
- Eligibility and allocation parameters come from versioned policies; bookings store `policy_version_ids`.
- Notifications and other side effects go through the outbox, never inside the booking decision path.
- QR scans and uploads never grant access by themselves.

## Core roles

- USER: discover and request; manage own bookings; submit required reports.
- OWNER: manage resources within scope; review requests when authorised.
- MANAGER: review assigned requests, supervised handovers/returns, and incidents.
- ADMIN: manage roles/policies and oversight with least privilege.

All permissions must be enforced on the backend.

## Key data entities

Organization (Institution), User, Resource, Asset, Policy, PolicyVersion, Attachment, OutboxEvent, ResourceRequirement, TrainingRecord, AvailabilityWindow, Booking, EligibilityCheck, ApprovalDecision, ConditionReport, Incident, AuditEvent, Notification.

Use foreign keys, server-side validation, timestamps, and appropriate indexes. Store timestamps in UTC and display in local time.

## Preferred fairness policy for MVP

1. Enforce mandatory eligibility/safety requirements.
2. Apply published institutional priorities if configured.
3. Enforce rolling usage caps for selected high-demand resources.
4. Apply documented recency/under-served considerations if justified.
5. Use request timestamp as tie-breaker where policy permits.
6. Place eligible unallocated requests on a waitlist.
7. Explain decisions; manager overrides require a reason.

Any numeric limit is configurable demonstration policy, not a universal rule.

## AI boundary

Allowed: natural-language query parsing, resource recommendations from non-sensitive criteria, incident report draft extraction, aggregated usage summaries.

Not allowed: autonomous identity/training verification, restricted-resource approval, safety clearance, liability decisions, penalties, or unreviewable allocation. Validate output and require user confirmation for extracted incident details.

## UI direction

- Clear, trustworthy campus operations interface.
- Emphasise availability, requirements, owner, supervision, and return conditions.
- Status always has text, not colour alone.
- Every form has validation/loading/success/error states.
- Explain disabled actions and decisions.
- Main user nav: Dashboard, Discover, My bookings, Notifications/Profile.
- Manager nav: Overview, Resources, Requests, Handover/Return, Incidents, Audit, Analytics.

## Foundation tiers

- Tier 1 (must build): RLS tenancy, versioned policies, hash-chained ledger, CI + core tests, idempotent booking, structured logs.
- Tier 2 (if H24 gate met): asset QR, evidence upload, OIDC, outbox notifications, ledger verify endpoint.
- Tier 3 (roadmap only): payments/credits, calendar sync, cross-institution agreements, webhooks/API, ledger anchoring.

## 48-hour milestones

- H0–4: foundation, DB, `organization_id` + RLS, CI, logging.
- H4–10: resource listing/discovery.
- H10–17: booking, policy-driven eligibility, exclusion constraint, idempotency.
- H17–24: check-in/return, hash-chained Trust Ledger, verify endpoint; MVP gate.
- H24–31: fairness, waitlist, incidents, minimal policy editor; Tier 2 QR/evidence if gate met.
- H31–36: one AI feature, notifications (outbox if possible), OIDC if time allows.
- H36–42: testing and deployment.
- H42–48: documentation, demo, submission.

If the core lifecycle is incomplete at H24, defer AI and analytics.

## Coding-agent working rules

1. Inspect the current repository before proposing large changes.
2. Read this file and `PRD.md`, `ARCHITECTURE.md`, and `RULES.md` before implementing domain logic.
3. Do not overwrite working code or restructure the repository without explaining the impact.
4. Make small, verifiable changes and run relevant tests after each vertical slice.
5. Use migrations for schema changes; do not rely on manual production database edits.
6. Never put secrets in source control, docs, logs, or client bundles.
7. Use fictional seed data and never introduce private institutional records.
8. Enforce permission and state-transition checks on the backend.
9. Keep AI optional and outside the critical transaction path.
10. Update this file when the stack, product scope, status machine, allocation policy, or major design decisions change.
11. Distinguish implemented, partially implemented, mocked, and planned features in documentation.
12. Do not invent test results, deployment URLs, credentials, or completed features.

## Decision log

- Initial scope: college campus resource-sharing MVP.
- Initial product differentiator: Trust Ledger plus eligibility and fair allocation.
- Initial architecture: modular monolith, relational source of truth.
- Initial AI strategy: one optional assistive feature after core workflow is stable.
- Initial deployment strategy: deploy early and verify the primary journey continuously.

- 2026-10-28: Team of four, AI-assisted development; reviewing generated code for state machine, eligibility, allocation, permissions, RLS, and ledger.
- 2026-10-28: Adopted professional-product foundations (tenancy via RLS, policy-as-data, hash-chained ledger, CI) as Tier 1 inside the 48-hour build; QR, evidence, OIDC, outbox are Tier 2; the rest is roadmap.
- 2026-10-28: Ledger is described as tamper-evident, not immutable, with external anchoring on the roadmap.

- 2026-10-29: Phase 0 completed — repository, documentation, frontend, and skill audit complete. Phase 0 deliverables created: BACKEND_PLAN.md, CONTRACT.md, AGENT_USAGE.md, IMPLEMENTATION_STATUS.md.
- 2026-10-29: Phase 01 completed — FastAPI foundation, lifespan, JSON structured logging, error handlers, /healthz and /readyz endpoints, CI workflow, Makefile.
- 2026-10-29: Phase 02 completed — PostgreSQL domain models, Alembic migrations (tables, check constraints, btree_gist exclusion constraint on booking, ledger modification trigger, fail-closed RLS on all 17 tenant tables), transaction-local tenant context binding, deterministic seed script for 2 orgs (org_nit, org_harbour), 7 users, 11 resources, policies, bookings across all states, condition reports, incidents, outbox events, and tamper-evident Trust Ledger hash chains. 15 automated integration tests pass under the restricted runtime DB role (sharespace_app).

Append dated decisions below as the project evolves.

## Current implementation status

**Phase 0: COMPLETE** — Documentation and audit phase done.
**Phase 01: COMPLETE** — FastAPI foundation, health/readiness endpoints, structured logging, CI.
**Phase 02: COMPLETE** — Tenant-safe schema, Alembic migrations, PostgreSQL RLS, exclusion constraints, tamper-evident ledger, deterministic seed data, 15 integration tests passing.
**Phase 03: COMPLETE** — Authentication, sessions, JWT, cookies, tenant RLS binding on auth, server-side role permissions (`require_roles`), demo login, admin role updates with required governance reasons, tamper-evident ledger auditing of role modifications, 26 integration tests passing.

**Implemented (Backend & Database):**
- PostgreSQL 18 schema with 18 tables and Alembic migrations from empty to head
- Row-Level Security (RLS) enabled and forced on all 17 tenant-scoped tables with fail-closed policies
- Non-superuser application role `sharespace_app` (NOBYPASSRLS) and migration role `sharespace_migrate` (BYPASSRLS)
- Transaction-local tenant context binding via `set_tenant_context` (`SET LOCAL app.org_id`) in `get_current_user`
- JWT session management via HTTP-only `sharespace_session` cookie and `Authorization: Bearer` fallback
- Role-based server access control dependency `require_roles([Role...])`
- Endpoints: `POST /api/v1/auth/demo-login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`, `PATCH/PUT /api/v1/admin/users/{user_id}/roles`
- Tamper-evident Trust Ledger audit event generation on administrative role updates
- PostgreSQL exclusion constraint (`btree_gist`) preventing overlapping confirmed bookings
- Check constraint `start_at < end_at`
- Database trigger `trg_protect_ledger_events` preventing application-level UPDATE and DELETE on historical ledger events
- Canonical deterministic JSON serialization and SHA-256 hash chaining for Trust Ledger
- Deterministic seed script `scripts/seed.py` matching frontend demo scenarios across 2 institutions
- 26 automated integration tests covering RLS isolation, fail-closed behavior, cross-tenant denial, overlap rejection, migration downgrade/upgrade, ledger tamper detection, seed repeatability, authentication, role enforcement matrix, governance reason requirement, and audit logging

**Implemented (in mock/frontend):**
- Complete React 19 frontend with 25+ screens, role guards, responsive design
- Full TypeScript domain types matching PRD/ARCHITECTURE
- Comprehensive mock backend with deterministic eligibility, booking state machine, policy engine, waitlist, ledger, incidents
- Demo seed data: 2 orgs, 7 users, 12 resources, 5 policies, 15 bookings across all states, condition reports, incidents, ledger chain
- AI assistive endpoints (Gemini 4 Argon High Thinking) with deterministic fallbacks
- QR asset scan flow with contextual actions
- All API contracts defined in `src/lib/api.ts` and `CONTRACT.md`

**Next task:** Phase 04 — Resource Catalogue, Search, Filters, Availability, Assets, and QR Resolution