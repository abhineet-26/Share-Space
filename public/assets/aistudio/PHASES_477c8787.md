# Delivery Phases — 48-Hour Build Plan (with product foundations)

## Operating principle

The product must have a working end-to-end core before optional AI, advanced analytics, or visual polish consumes substantial time. Deploy early. Integrate continuously. Keep the judge journey reproducible.

## Foundation tiers

The build targets a professional product, but the 48-hour clock is real. Work is tiered so the judge journey is never put at risk.

- **Tier 1 (build in the 48 hours, in the phases below):** tenant `organization_id` + RLS, versioned policies as data, hash-chained ledger, CI with core tests, idempotent booking, structured logging.
- **Tier 2 (build if the MVP gate at H24 is met):** asset QR labels, evidence photo attachments, OIDC sign-in, transactional-outbox notifications, ledger verify endpoint.
- **Tier 3 (document on the roadmap, do not build now):** payments/credits, calendar sync, cross-institution agreements, webhooks/public API, ledger anchoring.

Cut order if time slips: Tier 2 items (AI first, then analytics, then OIDC) before any Tier 1 item. Never cut the full lifecycle, the ledger, or the fairness rules.

## Phase 0 — Before the official build window

Only do work allowed by event rules. The rules permit research, planning, and discussion before the window but require the submitted product to be developed during the official build period. Confirm event rules before creating project code or reusable implementation assets in advance.

Allowed preparation may include:
- Agreeing on the problem scope and product name.
- Reviewing the problem statement and rubric.
- Discussing architecture and roles.
- Preparing a task board and test scenarios.
- Reviewing permitted frameworks and official documentation.

Document any pre-existing assets or code used.

## Phase 1 — Scope and foundation (Hours 0–4)

### Tasks
- Confirm MVP and defer non-essential features.
- Create repository and project structure.
- Set up frontend/backend run commands.
- Create database connection and first migration.
- Add environment-variable example and Git ignore rules.
- Agree API contracts and status enums.
- Build app shell and health endpoint.
- Add `organization_id` to every tenant table; create the non-superuser app role and enable RLS with fail-closed policies.
- Set up CI (lint, types, pytest with PostgreSQL service, migrations) and pre-commit secret scanning.
- Add structured logging with request IDs and `/healthz` and `/readyz`.

### Exit criteria
- Frontend runs.
- Backend runs.
- Database connection works.
- A simple frontend-to-backend request succeeds.
- No secrets are committed.
- CI is green on the first commit and a cross-tenant isolation test passes.

## Phase 2 — Resource discovery (Hours 4–10)

### Tasks
- Resource model and CRUD endpoints.
- Owner-scoped create/edit operations.
- Resource listing and details UI.
- Search/filter endpoint and UI.
- Availability representation.
- Fictional seed data (two organisations, to demonstrate tenant isolation).
- Loading, empty, and error states.
- Policy tables and schemas (`policies`, `policy_versions`) with one seeded organisation policy.

### Exit criteria
- User can discover a resource and read its access conditions.
- Owner can create/edit a resource within their permission scope.
- Data persists after refresh.

## Phase 3 — Booking and eligibility (Hours 10–17)

### Tasks
- Booking request schema and API.
- Eligibility checks with reason codes.
- Request status transitions.
- Manager review queue.
- Approve/reject/waitlist action with reason.
- Prevent overlapping confirmed reservations.
- Add conflict/error handling.
- Read eligibility parameters (usage cap, lead time, duration limits) from active policy versions and store `policy_version_ids` on the booking.
- Add an idempotency key to booking creation.
- Add the PostgreSQL exclusion constraint and a concurrent-approval test.

### Exit criteria
- A request is persisted.
- Eligibility result is visible.
- Authorised manager can decide.
- Invalid or unauthorised transitions are denied.
- Conflicting confirmed bookings cannot coexist.

## Phase 4 — Handover, return, audit (Hours 17–24)

### Tasks
- Check-in endpoint and UI.
- Initial condition report.
- Return endpoint and final condition report.
- Staff confirmation where configured.
- Booking timeline / Trust Ledger.
- Audit events in the same transaction as important state changes where practical.
- Hash-chained ledger (`seq`, `prev_hash`, `hash`), INSERT/SELECT-only grants, and a trigger rejecting UPDATE/DELETE.
- `GET /audit-events/verify` returns chain status.

### Exit criteria — MVP gate
- A judge can complete request → eligibility → decision → check-in → return.
- Every stage persists.
- Timeline reflects the actual events.
- No manual database changes are needed for the primary journey.

**If this gate is missed, defer AI and advanced analytics.**

## Phase 5 — Trust and fairness (Hours 24–31)

### Tasks
- Configurable usage cap for a selected resource.
- Waitlist ordering and next-request promotion.
- Explicit allocation reasons.
- Cancellation and slot-release handling.
- Incident creation and human review/resolution.
- Role/ownership tests.
- Audit history protections.
- Minimal admin policy editor (create version, preview, activate) so a usage cap can be changed live in the demo.
- Tier 2, if the MVP gate was met: asset QR labels and scan flow; evidence photo upload with SHA-256 recorded in the ledger.

### Exit criteria
- Competing requests have predictable outcomes.
- A waitlist can be demonstrated.
- Incident can be reported and resolved by an authorised reviewer.
- No automated penalty is imposed.

## Phase 6 — AI and notifications (Hours 31–36)

### Choose one AI feature first
Option A: natural-language resource discovery converted into structured filters.
Option B: incident text converted into a draft structured report requiring user confirmation.

### Tasks
- Implement one feature behind a service adapter.
- Validate output schema.
- Reconcile output against database records.
- Provide fallback if AI is unavailable.
- Add in-app notifications for booking decision and reminder.
- Add overdue indicator if time permits.
- Move notifications to a transactional outbox and worker if Tier 2 time allows; otherwise keep in-app notifications and document the outbox as the next step.
- Add OIDC sign-in behind the existing auth interface if time allows; keep demo login behind `ENABLE_DEMO_LOGIN`.

### Exit criteria
- AI output is visibly assistive, not authoritative.
- Core workflow works when AI is disabled.
- Notification failure cannot corrupt booking state.

## Phase 7 — Testing and deployment (Hours 36–42)

### Tests
- Eligible request.
- Missing training.
- Approval and rejection reason.
- Overlapping booking race.
- Waitlist/cancellation.
- Check-in and return records.
- Damage incident and review.
- Unauthorised approval attempt.
- Cross-user booking access attempt.
- Persistence after refresh/restart.
- Responsive layout and form validation.
- Cross-tenant read/write denial (RLS).
- Policy change alters the outcome of a new request without redeploy; old booking keeps its original policy version.
- Ledger tamper test: modify a row with a privileged connection in a test database and confirm verification reports the first bad sequence number.
- Duplicate booking submission with the same idempotency key creates one booking.
- Keyboard-only run of the primary journey.

### Tasks
- Deploy frontend, backend, and database.
- Run migrations and seed fictional demo data.
- Configure demo credentials securely.
- Run primary journey against deployed product.
- Check server logs and browser console.
- Fix P0 bugs only before considering visual polish.

### Exit criteria
- Public/judge-accessible URL works.
- Repository access works.
- Demo account instructions are clear.
- Primary workflow succeeds in the deployed environment.

## Phase 8 — Submission and presentation (Hours 42–48)

### Tasks
- Complete project document.
- Verify source repository and commit history.
- Add setup/testing instructions.
- Add architecture and workflow diagrams if useful.
- Document actual AI/API/framework usage.
- List each member's role and contribution.
- Disclose templates, libraries, and pre-existing components.
- Prepare a 3–5 minute demo path.
- Prepare backup screenshots/video if permitted.
- Submit before deadline and recheck links.

### Exit criteria
- All required submission fields are complete.
- Product and repository links are accessible.
- No unsupported feature claims.
- Product remains available through judging.

## Suggested role split for four people

- Member A: frontend, accessibility, visual consistency.
- Member B: backend APIs, database, migrations.
- Member C: booking domain, eligibility, fairness, audit.
- Member D: integration, tests, deployment, documentation, optional AI.

For smaller teams, combine responsibilities and reduce optional features. Every team member should review the end-to-end workflow.

## Priority order

### P0 — Required
Resource listing/discovery, booking, eligibility, owner decision, conflict prevention, check-in, initial/final condition reports, return, audit timeline, server-side permissions, deployed product.

### P1 — Strongly recommended
Waitlist, usage limits, incident reporting, human resolution, in-app notifications, responsive accessibility.

### P2 — Only if stable
AI-assisted discovery/report drafting, richer analytics, evidence upload, advanced recommendations.

## Demo script

1. Owner creates or opens a resource.
2. Student discovers it and views requirements.
3. Student submits a request.
4. Show eligibility result.
5. Manager approves/rejects/waitlists with reason.
6. Student checks in and records condition.
7. Student submits return report; staff confirms if required.
8. Open Trust Ledger and inspect event history.
9. Demonstrate a competing request/waitlist.
10. Report a sample incident and show human review.
11. Finish with a simple utilisation insight.

## Submission checklist

- [ ] Working public/judge-accessible product
- [ ] Documentation states exactly which Tier 1/2/3 items are implemented (no unverified claims)
- [ ] Ledger described as tamper-evident, not immutable
- [ ] Demo login flag and credentials documented; production-style config disables it
- [ ] Source repository and correct access
- [ ] Project document with use case, architecture, workflow, features, stack, AI disclosure, privacy/fairness, limitations, future work
- [ ] Setup and test instructions
- [ ] Judge credentials / demo path
- [ ] Team and participant details
- [ ] Team member contributions
- [ ] Existing components/templates/code disclosures
- [ ] Links verified after deployment
- [ ] Demo records are fictional or authorised
