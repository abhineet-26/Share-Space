# Product Requirements Document (PRD)

## 1. Summary

SHARESPACE helps colleges and similar institutions safely share underused equipment, spaces, and technical resources. It combines discovery and booking with eligibility requirements, owner approval, fair allocation, check-in/check-out, condition records, incident handling, notifications, and an auditable transaction history.

**Core value proposition:** make institutional resources easier to access without removing the owner's control or compromising safety and accountability.

## 2. Problem statement

Institutions may own resources that sit unused for substantial periods while students, researchers, creators, and teams cannot afford to purchase equivalent equipment. Ordinary booking systems generally focus on calendar availability and do not sufficiently manage qualification requirements, restricted access, handover evidence, condition documentation, fair access, damage reporting, or reviewable decisions.

## 3. Product goals

1. Enable an owner to list a resource with clear availability and usage conditions.
2. Let users discover suitable resources and understand eligibility before requesting them.
3. Support request review, approval, rejection, and waiting lists.
4. Prevent conflicting confirmed bookings.
5. Record handover, initial condition, return, and final condition.
6. Support incident reporting and human-reviewed resolution.
7. Apply transparent fair-use rules to high-demand resources.
8. Provide an auditable history of important actions.
9. Give owners and authorised managers control over their resources.
10. Deliver a complete, usable demonstration within a 48-hour build.

## 4. Non-goals for the 48-hour build (several are on the product roadmap)

- Full public marketplace for every institution and resource category.
- Real payments, escrow, insurance, or legally binding liability decisions (payments/credits are a roadmap item; liability decisions stay human-only permanently).
- Automated identity-document verification without an authorised integration.
- IoT locks, physical access-control integrations, or hardware telemetry.
- Blockchain-based audit logging.
- AI making final access, safety, liability, or penalty decisions.
- Enterprise SSO beyond one OIDC provider, and institution-wide deployment integrations (see `ROADMAP.md`).
- Native mobile apps; responsive web is sufficient.

## 5. Target users and personas

### Student / requester
Needs affordable access to equipment for a class, research, or project. Wants clear requirements, predictable decisions, and reminders.

### Resource owner
A department, laboratory, makerspace, or authorised staff member that controls a resource. Needs accurate availability, rules, and visibility into requests.

### Manager / technician
Reviews requests, checks handovers, verifies return condition, and handles incidents. Needs a clear queue and reliable records.

### Institution administrator
Manages roles, policies, verification status, and oversight. Needs audit history and usage insights.

## 6. Primary use case

A verified student requests an available oscilloscope for a defined time slot. The system checks account status, institutional membership, required training, time conflicts, and usage limits. A laboratory manager reviews the request and approves it. At handover, the student and/or technician record initial condition. On return, they record final condition. If a problem is reported, an incident is opened for authorised human review. The transaction timeline retains the decision and lifecycle events.

## 7. Functional requirements

### FR-01 — Authentication and roles
- Users must be authenticated to request resources or perform protected actions.
- Supported roles: `USER`, `OWNER`, `MANAGER`, `ADMIN`.
- A user may hold more than one role if explicitly assigned.
- The backend, not only the frontend, enforces permissions.

### FR-02 — Resource listing
- An owner can create, edit, publish, pause, and archive resources they control.
- A listing includes name, category, description, location, availability, condition, eligibility requirements, training, supervision, return rules, and owner.
- Resource status includes at minimum `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`, `MAINTENANCE`.
- Resource visibility does not imply permission to access it.

### FR-03 — Discovery
- Users can search by text and filter by category, date/time, location, and availability.
- The resource details page must display requirements and restrictions before the request action.
- Natural-language search may translate user intent into structured filters, but results must be verified against canonical database data.

### FR-04 — Eligibility
- Eligibility checks are deterministic and return `PASS`, `FAIL`, or `REVIEW_REQUIRED` with a reason.
- Checks may include account verification, institution membership, required training, booking time validity, resource status, and usage limits.
- AI output must not be trusted as authoritative evidence of training or identity.
- A failed mandatory requirement prevents a request from becoming approved; the product may allow a request to be saved as blocked/pending remediation if clearly explained.

### FR-05 — Booking request
- A request contains resource, requester, start/end time, purpose, and status.
- Validate that start is before end, the requested time is in an allowed window, and the resource is bookable.
- Store a snapshot of relevant requirements/policy or version identifiers where practical so later changes do not erase the context of an earlier decision.

### FR-06 — Review and decision
- Only an authorised owner/manager may approve or reject a request.
- Decisions require a reason, including rejection and manual override.
- Statuses must be explicit and transitions validated by the backend.
- A manager must see eligibility outcomes and relevant conflicts before deciding.

### FR-07 — Fair allocation and waiting list
- Support a published, configurable policy for competing eligible requests.
- At minimum, provide a waitlist and transparent queue ordering.
- Enforce configurable rolling usage limits for selected high-demand resources.
- Do not claim that an allocation policy is fair merely because it uses a score; document the policy and test its outcomes.
- A manager may override automated queue recommendations only with a recorded reason.

### FR-08 — Check-in and condition report
- Check-in is allowed only for an approved booking in the permitted time window, subject to resource policy.
- Record actor, timestamp, condition, notes, and optional evidence references.
- Require staff confirmation for resources configured as supervised.
- Condition reports are append-only records; corrections create a new record or amendment event.

### FR-09 — Return / check-out
- Record return initiation, actual return time, final condition, accessories, and notes.
- Staff confirmation is required where policy says so.
- A transaction is closed only when all required return steps are complete.
- If the final report indicates damage or a dispute, the booking may close operationally while the incident remains open; the UI must make this distinction clear.

### FR-10 — Incident management
- A user or authorised staff member can report damage, delay, missing accessories, unsafe condition, or other issue.
- An incident has status, reporter, description, evidence references, assigned reviewer, resolution, and timestamps.
- Only authorised reviewers can resolve incidents or apply any permitted consequence.
- No automatic penalties or liability conclusions.

### FR-11 — Audit history
- Record key actions: listing changes, request creation, eligibility checks, approval/rejection, cancellation, waitlist movement, check-in, condition reports, checkout, incident creation/update/resolution, and policy overrides.
- Each event includes actor, action, entity, timestamp, and relevant metadata/reason.
- Ordinary users cannot edit or delete historical events through the application.
- Never store secrets or unnecessary sensitive information in audit metadata.

### FR-12 — Notifications
- MVP may use in-app notifications.
- Notify users of decisions, waitlist changes, upcoming booking, cancellation, and overdue status.
- Notification failure must not corrupt booking state.

### FR-13 — Analytics
- Show basic counts for active resources, requests, approvals, waitlisted requests, utilisation, and incident status.
- Explain how utilisation is calculated and avoid presenting estimates as precise real-world facts.

## 8. User stories and acceptance criteria

### Story A — List a resource
As an owner, I want to publish a resource with rules so users know whether they can use it.
- Given an authorised owner, when required fields are valid and the listing is saved, then the resource is persisted and visible according to its status.
- An unauthorised user cannot modify the listing through the UI or API.

### Story B — Request a resource
As a student, I want to request an available slot and understand my eligibility.
- Given an active resource, when I choose a valid time and submit, then a request is stored.
- The response shows each eligibility check and its reason.
- The system does not confirm overlapping reservations.

### Story C — Review request
As a manager, I want to approve, reject, or waitlist a request with a reason.
- Only an authorised reviewer can make the decision.
- A decision and reason are persisted and appear in the timeline.
- A stale or invalid state transition is rejected by the backend.

### Story D — Handover and return
As a user and technician, we want a record of resource condition before and after use.
- Approved bookings can be checked in only within policy.
- Initial and final reports include actor and timestamp.
- Return confirmation and relevant audit events are persisted.

### Story E — Report incident
As a participant, I want to report damage or a delay.
- Incident creation records reporter and time.
- An authorised reviewer can update and resolve it with a recorded outcome.
- No automated penalty is applied.

### Story F — Fair access
As a manager, I want a transparent queue for high-demand resources.
- Competing eligible requests are handled using the configured policy.
- Users can see their status and a human-readable reason.
- Usage limits are checked server-side.

## 9. Quality requirements

- **Reliability:** primary journey must work repeatedly using the judge instructions.
- **Security:** server-side role checks, input validation, safe secret handling, least privilege.
- **Integrity:** booking conflict prevention and transactional state updates.
- **Accessibility:** keyboard navigation, clear labels, sufficient contrast, visible focus, status not conveyed by colour alone.
- **Privacy:** collect the minimum information required; demo data is fictional or authorised.
- **Observability:** useful server logs without secrets; actionable error messages.
- **Performance:** ordinary searches and booking operations should feel responsive under expected demo load.
- **Portability:** provide environment-variable examples and repeatable setup instructions.

## 10. Success metrics for the prototype

- A judge can complete the primary journey from listing to return without manual database edits.
- All required lifecycle transitions persist across refresh.
- Overlapping confirmed bookings are prevented under concurrent requests.
- Unauthorised approval and cross-user modification attempts are denied.
- At least one fair-allocation/waitlist scenario is reproducible.
- Every major decision has a recorded reason and audit event.
- No critical bugs remain in the documented demo path.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope expands beyond 48 hours | Freeze MVP; defer payments, hardware, advanced AI |
| Booking race conditions | Database constraints/transactions and concurrency tests |
| Fake verification claims | Label demo verification clearly; use fictional data |
| AI hallucination | AI assists discovery/drafting only; backend validates all decisions |
| Audit log tampering | Restricted append-only application access; corrections as new events |
| Deployment failure | Deploy early and test continuously |
| Unclear fairness | Publish deterministic rules and show reasons |
| Privacy leakage | Minimal data, role-scoped access, no secrets in logs |

## 12. Release gates

### P0 — Must work
- Authentication/demo access, resource listing, search, request, eligibility, approval/rejection/waitlist, check-in, condition reports, return, audit history, permissions, deployment.
- Product foundations that are expensive to retrofit: `organization_id` on every tenant table with row-level security, policies stored as versioned data, hash-chained audit ledger, CI running the core tests.

### P1 — Important
- Incident workflow, usage limits, notifications, conflict handling, responsive accessibility.
- Asset QR identity, evidence attachments, OIDC sign-in, transactional-outbox notifications, ledger verification endpoint, structured logging and error tracking.

### P2 — If time remains
- AI-assisted search, incident drafting, richer analytics, advanced filters, calendar (ICS) export, admin policy editor polish.

## 13. Professional product requirements

These requirements move SHARESPACE from a hackathon prototype toward a deployable product. Items marked **[Foundation]** are cheap now and costly to retrofit, so they are built during the 48 hours. Others are **[Pilot]** (first real institution) or **[Scale]** (see `ROADMAP.md`).

### FR-14 — Multi-tenancy [Foundation]
- Every tenant-owned row carries `organization_id`.
- PostgreSQL row-level security (RLS) enforces tenant isolation independently of application code.
- The application database role must not be a superuser and must not bypass RLS.
- Acceptance: an automated test proves a user in organisation A cannot read or write organisation B data, even through a deliberately faulty query.

### FR-15 — Policy engine [Foundation]
- Eligibility rules, usage caps, priority rules, approval chains, cancellation rules, and return windows are stored as versioned, declarative policy data, editable by authorised admins/owners.
- Policies resolve by scope (resource, then category, then organisation); the most restrictive safety rule wins.
- Each booking stores the policy version IDs applied, so later policy edits never rewrite history.
- Policy creation, change, activation, and retirement are audit events.
- Acceptance: changing a usage cap changes the outcome of a new request without a code change or deploy, and old bookings still show the policy they were decided under.

### FR-16 — Tamper-evident ledger [Foundation]
- Each audit event stores the hash of the previous event in its organisation chain and its own hash.
- An authorised endpoint recomputes the chain and reports the first mismatch, if any.
- The application database role has INSERT and SELECT only on the ledger.
- Documentation must describe this as tamper-evident, not immutable or blockchain-grade (see `ARCHITECTURE.md` section 10).

### FR-17 — Asset identity and QR handover [Pilot, minimal version P1]
- A resource may have individual assets, each with a printable QR label carrying an unguessable token.
- Scanning requires sign-in and shows the context relevant to the scanner (for example, start check-in if they hold an approved booking now). A scan alone grants no access.

### FR-18 — Evidence attachments [Pilot, minimal version P1]
- Condition reports and incidents can carry photos/files stored in S3-compatible object storage.
- Files are type- and size-restricted, served by short-lived signed URLs, and linked to the ledger by SHA-256 hash.

### FR-19 — Identity and sessions [Pilot]
- OIDC sign-in (authorization code with PKCE) with email-domain to organisation mapping and role assignment by admins.
- Demo login exists only when an explicit non-production flag is set.

### FR-20 — Reliable background work [Pilot, minimal version P1]
- Notifications, reminders, overdue detection, waitlist promotion, and nightly ledger verification run through a job worker using a transactional outbox, so a delivery failure never corrupts booking state.

### FR-21 — Operability [Foundation for CI/logging; rest Pilot]
- CI on every push: lint, type check, backend tests against real PostgreSQL, migration check, frontend build.
- Structured logs with request IDs and no secrets or personal data; error tracking; `/healthz` and `/readyz`.
- Idempotency keys on booking creation so a retried request cannot double-book.

### FR-22 — Accessibility and inclusion [Foundation]
- Target WCAG 2.1 AA for core journeys: keyboard operation, visible focus, labelled forms, non-colour status.
- Mobile-first check-in and return screens.

## 14. Product positioning

SHARESPACE is accountability infrastructure for shared assets, not a booking calendar. Its differentiators are enforceable eligibility, explainable and configurable fair allocation, evidence-backed handover and return, and a tamper-evident history that owners and users can both rely on. The first market is campuses, makerspaces, and community labs. See `ROADMAP.md` for sequencing, risks, and success metrics beyond the prototype.
