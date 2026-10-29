# Product Rules, Permissions, and Safety Guardrails

This document defines expected product behaviour. Institutional policies may vary; all configurable examples must be labelled as demonstration policies, not universal standards.

## 1. Identity and roles

### Roles
- `USER`: discover resources, request access, manage own requests, submit required reports.
- `OWNER`: manage resources they own/control and review requests where policy grants authority.
- `MANAGER`: review assigned resources, confirm supervised handovers/returns, manage incidents within scope.
- `ADMIN`: manage roles/policies and oversee the system. Admin status does not automatically justify unrestricted access to all personal details.

Use explicit role assignments and resource/institution scope. A user may have multiple roles.

## 1A. Tenant rules

1. Every tenant-owned record belongs to exactly one organisation.
2. Tenant isolation is enforced by the database (row-level security) and also checked in application code.
3. The organisation context comes from the authenticated session, never from a client-supplied value.
4. Cross-organisation sharing, if introduced later, requires an explicit, auditable agreement object; it is never implied.
5. A user switching organisation context re-authenticates for privileged actions.

## 2. Authorisation rules

1. Every protected API action checks the authenticated actor and permission on the server.
2. Users can view and edit only their own profile fields, subject to policy.
3. Users can view their own bookings; owners/managers can view bookings for resources within their authorised scope.
4. Only authorised owners/managers can create or modify controlled resources.
5. Only authorised reviewers can approve, reject, waitlist, or override a request.
6. Only authorised participants/reviewers can access detailed condition reports and incidents.
7. Audit events cannot be edited or deleted through ordinary application routes.
8. Frontend route guards are UX only; backend checks are mandatory.
9. Avoid leaking whether a protected record exists when a `404` response is safer for privacy.
10. Every privileged action should be attributable to an actor.

## 3. Resource listing rules

Required listing fields:
- Name and category.
- Location/access instructions appropriate for authorised users.
- Owner or responsible unit.
- Availability.
- Condition/status.
- Eligibility requirements.
- Training and supervision rules.
- Return conditions and cancellation rules.

A resource cannot be booked if it is `DRAFT`, `PAUSED`, `ARCHIVED`, or `MAINTENANCE`. A visible listing may still require approval or additional verification.

Resource owner changes and policy changes should be recorded in the audit history.

## 4. Eligibility rules

Eligibility is evaluated by deterministic checks:
- Account verified/active.
- Institution membership, if required.
- Training/qualification valid for the requested period.
- Resource active and available.
- Requested duration and time within allowed bounds.
- No prohibited conflict.
- Usage limits satisfied.
- Additional human review completed where required.

Possible outcomes:
- `PASS`: requirement satisfied.
- `FAIL`: mandatory requirement not satisfied.
- `REVIEW_REQUIRED`: authorised human review needed.
- `NOT_APPLICABLE`: requirement does not apply.

The UI must display reasons and next steps. Do not present a `REVIEW_REQUIRED` outcome as approved.

Training and qualification records must have a clear verification source/status. An uploaded file or AI-extracted text alone does not establish validity.

## 5. Booking rules

1. Start time must precede end time.
2. Requests must fall within published availability.
3. Confirmed bookings for the same resource must not overlap.
4. Availability must be rechecked during approval, not only at request creation.
5. The backend controls all status transitions.
6. Decision reasons are required for rejection, manual override, and policy exception.
7. Cancellation follows the resource's published policy and is recorded.
8. A booking request is not a confirmed booking.
9. A resource's status and eligibility conditions are checked again before handover.
10. Where a state conflict occurs, return a clear conflict response and ask the user to refresh/reselect.

## 6. Fair allocation rules

The institution must publish the allocation policy for high-demand resources. Recommended MVP policy order:

1. Apply mandatory safety and eligibility requirements.
2. Respect explicit institutional priority categories, if configured and justified.
3. Apply per-user or per-team rolling usage limits.
4. Apply any documented recency/under-served consideration that is suitable for the institution.
5. Use request time as a tie-breaker where allowed.
6. If no slot can be allocated, keep the eligible request waitlisted and explain its status.

### Fairness guardrails
- Do not let users reserve unlimited high-demand slots.
- Do not use hidden or unexplained rankings.
- Do not treat AI scores as authoritative allocation decisions.
- Do not use sensitive personal characteristics for prioritisation.
- Show a human-readable reason for waitlisting or denial.
- Let an authorised manager override with a recorded reason.
- Periodically review whether the rules create persistent exclusion.
- Avoid promising that a queue position is guaranteed if priority rules can change it; explain the policy.

A simple usage cap such as “maximum six hours per week” is only an example. It must be configurable and resource-specific.

## 7. Check-in and handover rules

- Only approved bookings can proceed to handover.
- Handover is allowed only within the configured time window unless a manager records an exception.
- Initial condition and accessory state must be recorded.
- Supervised resources require confirmation by an authorised staff member.
- Record the actual time and actor for each step.
- A missing initial condition report should be visible and may block completion according to policy.
- Do not assume a user is responsible for a problem solely because it was discovered during their booking.

## 8. Return rules

- Record actual return time.
- Record final condition and accessory checklist.
- Require staff confirmation where configured.
- Mark overdue status based on a defined deadline and timezone-safe timestamp comparison.
- A returned item with an open incident must not appear as fully issue-free.
- Operational closure and incident resolution may be separate states.
- Extensions require approval where the resource policy requires it and must trigger conflict revalidation.

## 9. Incident and dispute rules

Incident categories may include:
- Damage / suspected damage.
- Missing accessory.
- Late return.
- Safety concern.
- Booking or access conflict.
- Other.

Rules:
1. Reports include reporter, timestamp, description, and evidence reference where available.
2. The system distinguishes allegation/report from verified finding.
3. A designated human reviewer assesses the report.
4. Resolution includes reviewer, decision, explanation, and timestamp.
5. Users can provide additional information through a documented workflow.
6. No automatic fine, liability finding, suspension, or blame assignment.
7. Preserve relevant records according to the institution's authorised retention policy.
8. Avoid collecting irrelevant personal information or excessive evidence.

## 10. Audit rules

Audit event fields should include:
- Actor or documented system actor.
- Action.
- Target entity and ID.
- Timestamp.
- Reason/decision explanation when relevant.
- Correlation/request ID where useful.
- Minimal metadata required to reconstruct the action.

Log at least:
- Resource created/updated/published/paused.
- Booking requested/cancelled.
- Eligibility result.
- Approval/rejection/waitlist/override.
- Check-in and condition report.
- Return and staff confirmation.
- Incident opened/updated/resolved.
- Policy changes and role changes.

Do not log passwords, tokens, API keys, unnecessary identity documents, or full sensitive payloads. Corrections should be new events, not edits to past events.

## 10A. Policy governance rules

1. Eligibility, usage caps, priority rules, approval chains, cancellation, and return windows are versioned policy data.
2. Only authorised admins (or owners for their own resources, within organisation limits) can create or activate a policy version.
3. A new version applies to requests made after its effective time; it never rewrites earlier decisions.
4. Each decision stores the policy version IDs and evaluation output used.
5. For safety and eligibility rules, the most restrictive applicable rule wins; a resource policy can tighten but not relax an organisation safety rule.
6. Policies are declarative and schema-validated; stored code is never executed.
7. Admins can preview a policy against a sample request before activation.
8. Policy creation, edits, activation, and retirement are audit events with a reason.

## 10B. Ledger integrity rules

1. Each audit event is chained to the previous event in the organisation by hash.
2. The application role has INSERT and SELECT only on the ledger; UPDATE and DELETE are rejected.
3. Verification can be run on demand and runs nightly; a failure raises an alert and is itself recorded.
4. Describe the ledger as tamper-evident. Do not describe it as immutable, blockchain, or legally certified unless independently established.
5. Evidence files are bound to the ledger by SHA-256 hash.

## 10C. Asset QR and evidence rules

1. QR tokens are random, unguessable, rotatable, and contain no personal or booking data.
2. Scanning requires authentication and never grants access by itself; it only shows actions the scanner is already permitted to take.
3. Evidence uploads are restricted by type and size, scanned for allowed MIME types, and delivered by short-lived signed URLs.
4. Evidence is visible only to participants and authorised reviewers, and is subject to the retention policy.
5. Remove unnecessary metadata (for example location data) from images where feasible.

## 11. Privacy and security rules

- Collect only data needed for the resource-sharing workflow.
- Use fictional or authorised demo data.
- Do not use confidential institutional records without permission.
- Restrict detailed reports to authorised users.
- Use HTTPS in deployed environments.
- Store secrets outside source control.
- Validate inputs and uploaded evidence.
- Define a retention/deletion policy before real deployment. Suggested starting defaults, to be set by the institution: completed booking records and ledger kept for a defined period, evidence files for a shorter period after incident closure, user data deletable on departure subject to ledger integrity (replace personal fields with a pseudonymous ID rather than breaking the chain).
- Provide data export and deletion workflows before a pilot; review applicable data-protection law with the institution.
- Sign-in uses OIDC; demo login is disabled in any environment holding non-demo data.
- Follow applicable institutional and legal requirements before production use.
- Do not claim compliance certification unless independently established.

## 12. AI rules

Permitted assistive uses:
- Natural-language query parsing.
- Resource recommendations based on non-sensitive requirements.
- Draft structuring/summarisation of incident reports.
- Aggregated usage insight summaries.

Prohibited autonomous decisions:
- Final approval for restricted resources.
- Identity or qualification verification.
- Safety clearance.
- Liability/damage responsibility.
- Penalties or suspensions.
- Unreviewable allocation decisions.

AI output is untrusted input:
- Validate against a schema.
- Reconcile resource IDs and availability against the database.
- Ask the user to confirm extracted incident details.
- Record when AI assistance was used where relevant.
- Handle AI service failure gracefully.
- Avoid sending unnecessary personal data to external services.

## 13. Notification rules

- In-app notifications are sufficient for the MVP; production delivery (email and others) goes through the transactional outbox and worker.
- Notify on decision, waitlist change, cancellation, upcoming reservation, overdue return, and incident update.
- Notification failure must not roll back a valid booking transaction.
- Avoid exposing sensitive details in notification previews.
- Avoid sending repeated reminders in a tight loop.

## 14. Demo and submission integrity

- Use fictional or authorised demonstration records.
- Clearly label simulated verification or payment.
- Do not represent a mock integration as a live integration.
- Disclose AI assistance, libraries, templates, and existing code.
- Do not claim features are complete unless tested.
- Keep the public/judge-accessible product and repository available during judging.
