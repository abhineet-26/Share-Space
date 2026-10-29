# SHARESPACE Implementation Status

**Generated**: 2026-10-29  
**Phase**: 0 — Repository, Documentation, Frontend, and Skill Audit  
**Status Format**: `Implemented` | `Partial` | `Mocked` | `Planned` | `Blocked`

---

## Legend
- **Implemented** — Working in live backend with tests, persists across restarts
- **Partial** — Core logic exists but missing integration, tests, or edge cases
- **Mocked** — Only works in frontend mock mode (`VITE_API_MODE=mock`)
- **Planned** — Designed in docs, not yet started
- **Blocked** — Cannot proceed without external decision/credential

---

## Tier 1 — Must Build (48-Hour Build)

### FR-01: Authentication and Roles
| Requirement | Status | Evidence |
|-------------|--------|----------|
| User authentication required for protected actions | Mocked | `src/mocks/server.ts:getAuthenticatedActor()` uses localStorage session |
| Roles: USER, OWNER, MANAGER, ADMIN | Mocked | `types.ts:Role` enum, `requireRole()` in mock |
| Multiple roles per user | Mocked | `User.roles: Role[]` in seed data |
| Backend enforces permissions (not just frontend) | Mocked | `requireRole()`, `enforceTenantMatch()` in mock server |
| Demo login behind non-production flag | Mocked | `ENABLE_DEMO_LOGIN` in `.env.example`, mock `demoLogin()` |
| OIDC sign-in (auth code + PKCE) | Planned | Tier 2 — requires provider selection |

### FR-02: Resource Listing
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Owner create/edit/publish/pause/archive resources | Mocked | `api.createResource`, `updateResource`, `publishResource` |
| Listing fields: name, category, description, location, availability, condition, requirements, training, supervision, return rules, owner | Mocked | `Resource` type + seed data has all fields |
| Resource status: DRAFT, PUBLISHED, PAUSED, MAINTENANCE, ARCHIVED | Mocked | `ResourceStatus` enum, seed resources use these |
| Visibility ≠ permission | Mocked | `enforceTenantMatch()` + role checks in mock |

### FR-03: Discovery
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Search by text, filter by category, date/time, location, availability | Mocked | `api.getResources()` with filters |
| Resource detail shows requirements before request | Mocked | `ResourceDetailPage` + `api.getResource()` |
| Natural-language search → structured filters (AI assistive) | Mocked | `api.parseNaturalLanguageQuery()` with Gemini + deterministic fallback |

### FR-04: Eligibility
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Deterministic checks: PASS, FAIL, REVIEW_REQUIRED with reason | Mocked | `evaluateEligibilitySync()` returns `EligibilityEvaluationResult` |
| Checks: account verified, institution membership, training, resource status, time validity, conflict, usage limits | Mocked | 9 check keys implemented in mock |
| AI output not trusted for training/identity | Mocked | AI only for query parsing/incident drafting; eligibility is deterministic |
| Failed mandatory requirement blocks approval | Mocked | `ELIGIBILITY_BLOCKED` status, approval rechecks eligibility |

### FR-05: Booking Request
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Request: resource, requester, start/end, purpose, status | Mocked | `Booking` type + `api.createBooking()` |
| Validate start < end, allowed window, resource bookable | Mocked | `time_validity`, `resource_status`, `time_conflict` checks |
| Snapshot policy versions on booking | Mocked | `Booking.policyVersionIds` + `eligibilityChecks` stored |

### FR-06: Review and Decision
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Only authorised owner/manager approve/reject | Mocked | `requireRole(['OWNER','MANAGER','ADMIN'])` in `decideBooking` |
| Decisions require reason (rejection, override) | Mocked | `reason` required, `MockApiError 422 REASON_REQUIRED` |
| Explicit statuses, backend validates transitions | Mocked | `ALLOWED_TRANSITIONS` + `validateTransition()` |
| Manager sees eligibility + conflicts before deciding | Mocked | `ReviewWorkspacePage` shows eligibility, competing requests |

### FR-07: Fair Allocation and Waitlist
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Published configurable policy for competing requests | Mocked | `pol_priority_fairness` + `pol_3d_cap`, `pol_cam_cap` |
| Waitlist with transparent queue ordering | Mocked | `WAITLISTED` status, `waitlistPosition`, `getResourceWaitlist()` |
| Rolling usage limits for high-demand resources | Mocked | `usage_limit` check with `windowDays`, `maxHoursPerUser` |
| Manager override with recorded reason | Mocked | `isPolicyOverride` flag + reason on decision |

### FR-08: Check-in and Condition Report
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Check-in only for approved booking in time window | Mocked | `validateTransition(APPROVED → CHECKED_OUT_TO_USER)` |
| Record actor, timestamp, condition, notes, evidence refs | Mocked | `ConditionReport` with all fields |
| Staff confirmation for supervised resources | Mocked | `supervision: STAFF_CONFIRMATION` → `staffConfirmedBy` required |
| Condition reports append-only; corrections = new events | Mocked | `ConditionReport` immutable; ledger records changes |

### FR-09: Return / Check-out
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Return initiation, actual time, final condition, accessories, notes | Mocked | `submitReturn()` creates `RETURN` ConditionReport |
| Staff confirmation where policy requires | Mocked | `RETURN_PENDING_CONFIRMATION` → `CLOSED` on staff confirm |
| Transaction closed only when all return steps complete | Mocked | Status machine enforces `CLOSED` only after confirmation |
| Damage/dispute → incident open, booking closes operationally | Mocked | `openIncidentCategory` on return creates `Incident` |

### FR-10: Incident Management
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Report damage, delay, missing accessory, safety, conflict | Mocked | `Incident.category` enum with 6 values |
| Incident: status, reporter, description, evidence, reviewer, resolution, timestamps | Mocked | `Incident` type has all fields |
| Only authorised reviewers resolve | Mocked | `resolveIncident()` requires `OWNER/MANAGER/ADMIN` |
| No automatic penalties/liability | Mocked | `requiresHumanReview: true`, resolution outcomes are non-punitive |

### FR-11: Audit History
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Key actions recorded: listing changes, requests, eligibility, decisions, cancellations, waitlist, check-in, conditions, checkout, incidents, policy overrides | Mocked | `INITIAL_RAW_LEDGER_EVENTS` + `appendLedgerEvent()` called on all mutations |
| Event fields: actor, action, target, timestamp, metadata, reason | Mocked | `LedgerEvent` type matches |
| Users cannot edit/delete history via app | Mocked | No UPDATE/DELETE endpoints for ledger |
| No secrets/sensitive data in audit metadata | Mocked | Metadata allowlisted in `appendLedgerEvent()` |

### FR-12: Notifications
| Requirement | Status | Evidence |
|-------------|--------|----------|
| In-app notifications for MVP | Mocked | `Notification` type, `getNotifications()`, `markNotificationRead()` |
| Notify: decision, waitlist change, upcoming, cancellation, overdue, incident update | Mocked | `Notification.type` enum has all 6 |
| Notification failure ≠ booking corruption | Mocked | `addOutboxNotification()` separate from booking transaction |

### FR-13: Analytics
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Basic counts: active resources, requests, approvals, waitlisted, utilisation, incidents | Mocked | `getAnalyticsData()` returns resourceMetrics, fairnessByUser, demandByHourBlock, outcomeCounts |
| Explain calculation, avoid false precision | Mocked | `plainSummary` in policies, utilisation shows formula |

---

## Professional Product Foundations (Tier 1)

### FR-14: Multi-tenancy [Foundation]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Every tenant row has `organization_id` | Mocked | All seed entities have `organizationId` |
| PostgreSQL RLS enforces tenant isolation | Planned | Design documented in BACKEND_PLAN.md §7; not implemented in mock |
| App DB role not superuser, no BYPASSRLS | Planned | Design documented; separate migration role planned |
| Automated test: Org A cannot read/write Org B data | Planned | CI test planned in Phase 02 |

### FR-15: Policy Engine [Foundation]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Eligibility, usage caps, priority, approval, cancellation, return windows as versioned declarative data | Partial | `Policy`/`PolicyVersion` types + seed data; only ELIGIBILITY, USAGE_CAP, PRIORITY implemented |
| Scope resolution: resource → category → org; most restrictive safety wins | Mocked | `resolveActivePoliciesForResource()` implements this |
| Each booking stores policy version IDs applied | Mocked | `Booking.policyVersionIds` + `eligibilityChecks` |
| Policy create/change/activate/retire are audit events | Mocked | `POLICY_VERSION_CREATED`, `POLICY_VERSION_ACTIVATED` in ledger |
| Changing usage cap changes new requests, old bookings keep original policy | Mocked | `evaluateEligibilitySync` uses `effectiveVersions` from policy versions |

### FR-16: Tamper-evident Ledger [Foundation]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Each audit event chained to previous by hash (per org) | Mocked | `computeLedgerEventHash()` + `seq`, `prevHash`, `hash` |
| Authorized endpoint recomputes chain, reports first mismatch | Mocked | `verifyOrganizationLedgerChain()` returns `LedgerVerificationResult` |
| App DB role: INSERT + SELECT only on ledger | Planned | Trigger design documented; not enforced in mock |
| Described as tamper-evident, not immutable/blockchain | Mocked | `DESIGN.md` Screen P, `RULES.md` §10B, `MEMORY.md` §82 |

### FR-17: Asset QR Identity [Pilot — Tier 2]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Individual assets with printable QR labels (unguessable token) | Mocked | `Asset.qrToken`, `PrintableQrLabelSheetPage`, `createAssetForResource()` |
| Scan requires auth, shows contextual actions, grants no access | Mocked | `scanAssetQr()` returns `allowedActions` based on bookings/role |

### FR-18: Evidence Attachments [Pilot — Tier 2]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Photos/files in S3-compatible storage | Mocked | `Attachment.dataUrl` (base64 in mock); `sha256` recorded |
| Type/size restricted, signed URLs, SHA-256 in ledger | Partial | MIME/size checks in mock upload; SHA-256 in ledger metadata |

### FR-19: Identity and Sessions [Pilot — Tier 2]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| OIDC sign-in (auth code + PKCE) | Planned | Tier 2 — provider selection needed |
| Email-domain → org mapping, roles by admin | Planned | Tier 2 |
| Demo login only with explicit non-production flag | Mocked | `ENABLE_DEMO_LOGIN` in `.env.example` |

### FR-20: Reliable Background Work [Pilot — Tier 2]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| Notifications, reminders, overdue, waitlist promotion, ledger verification via outbox + worker | Partial | `addOutboxNotification()` exists; worker + `FOR UPDATE SKIP LOCKED` is Tier 2 |
| Delivery failure never corrupts booking state | Mocked | Outbox separate from booking transaction |

### FR-21: Operability [Foundation for CI/logging; rest Pilot]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| CI on every push: lint, type check, backend tests + PostgreSQL, migration check, frontend build | Planned | GitHub Actions workflow design in BACKEND_PLAN.md |
| Structured logs with request IDs, no secrets/PII | Planned | FastAPI middleware design planned |
| `/healthz` (process up) and `/readyz` (DB reachable, migrations current) | Partial | Express server has both; FastAPI not yet built |
| Idempotency keys on booking creation | Mocked | `idempotencyKey` unique per user in mock |

### FR-22: Accessibility and Inclusion [Foundation]
| Requirement | Status | Evidence |
|-------------|--------|----------|
| WCAG 2.1 AA for core journeys | Partial | Frontend uses semantic HTML, focus styles; full audit needed in Phase 13 |
| Mobile-first check-in/return | Mocked | `CheckInPage`, `ReturnPage` responsive; `AssetScanLandingPage` for phone |

---

## Tier 2 — If MVP Gate Met (H24)

| Feature | Status | Notes |
|---------|--------|-------|
| Asset QR labels + scan flow | Mocked | Frontend complete; backend endpoints needed |
| Evidence photo uploads + SHA-256 in ledger | Partial | Mock has dataUrl + sha256; needs S3 + signed URLs |
| OIDC sign-in | Planned | Provider selection required |
| Transactional outbox + worker | Planned | `outbox_events` table + `FOR UPDATE SKIP LOCKED` worker |
| Ledger verification endpoint | Mocked | `verifyLedger()` exists in mock |
| AI-assisted search (Option A) | Mocked | `parseNaturalLanguageQuery` with Gemini + fallback |
| AI-assisted incident drafting (Option B) | Mocked | `structureIncidentDraft` with Gemini + fallback |
| In-app notifications → outbox | Partial | Mock has in-app; outbox is Tier 2 |

---

## Tier 3 — Roadmap Only (Not in v0.1)

| Feature | Status | Notes |
|---------|--------|-------|
| Payments/credits | Planned | Roadmap v1.0+ |
| Calendar sync (ICS, Google, Microsoft) | Planned | Roadmap v1.0 |
| Cross-institution agreements | Planned | Roadmap v1.0 |
| Public API / webhooks | Planned | Roadmap v1.0 |
| Ledger anchoring to external write-once store | Planned | Roadmap v1.0 |
| Mobile native app / PWA | Planned | Roadmap later |
| Hardware integrations (smart locks, telemetry) | Planned | Roadmap later |

---

## Frontend Integration Status

| Screen/Flow | Mock Mode | Live Mode Ready | Notes |
|-------------|-----------|-----------------|-------|
| Login / Demo account switch | ✅ Working | ❌ Needs `/me`, `/auth/demo-login` | |
| Dashboard | ✅ Working | ❌ Needs live API | |
| Discover / Search / Filters | ✅ Working | ❌ Needs live `/resources` | |
| Resource Detail | ✅ Working | ❌ Needs live `/resources/:id` | |
| Booking Request + Eligibility Preview | ✅ Working | ❌ Needs live `/bookings`, `/bookings/eligibility-check` | |
| My Bookings | ✅ Working | ❌ Needs live `/bookings/mine` | |
| Booking Detail (timeline, conditions, incidents, ledger) | ✅ Working | ❌ Needs live `/bookings/:id` | |
| Check-in (condition, accessories, photos) | ✅ Working | ❌ Needs live `/bookings/:id/check-in` | |
| Return (final condition, incident option) | ✅ Working | ❌ Needs live `/bookings/:id/return` | |
| Staff Handover/Return Confirmation | ✅ Working | ❌ Needs live `/bookings/:id/return-confirmation` | |
| Review Workspace (manager queue + decisions) | ✅ Working | ❌ Needs live `/review`, `/bookings/:id/decision` | |
| Owner Resources (CRUD) | ✅ Working | ❌ Needs live `/resources` CRUD | |
| Analytics | ✅ Working | ❌ Needs live `/analytics/utilisation` | |
| Incidents List/Detail/Report/Resolve | ✅ Working | ❌ Needs live `/incidents` endpoints | |
| Trust Ledger (filter, verify, tamper demo) | ✅ Working | ❌ Needs live `/audit-events` | |
| Policies (list, version, preview, activate) | ✅ Working | ❌ Needs live `/policies` | |
| Admin Users/Roles/Training | ✅ Working | ❌ Needs live `/admin/users` | |
| QR Scan Landing | ✅ Working | ❌ Needs live `/assets/scan/:token` | |
| QR Label Printing | ✅ Working | ❌ Needs live `/resources/:id/assets` | |
| Notifications | ✅ Working | ❌ Needs live `/notifications` | |
| Profile / Training Request | ✅ Working | ❌ Needs live `/profile/data`, `/profile/training/request` | |

---

## Backend Implementation Status

| Component | Status | Evidence |
|-----------|--------|----------|
| FastAPI app factory, lifespan, routing | Planned | Phase 01 |
| Settings, env validation, CORS | Planned | Phase 01 |
| Structured JSON logging + request IDs | Planned | Phase 01 |
| `/healthz`, `/readyz` | Partial | Express has them; FastAPI needs them |
| PostgreSQL connectivity, session management | Planned | Phase 01 |
| Alembic migrations | Planned | Phase 02 |
| Domain models (SQLAlchemy 2) | Planned | Phase 02 |
| RLS policies + app role (no BYPASSRLS) | Planned | Phase 02 |
| Exclusion constraint (overlap prevention) | Planned | Phase 02 |
| Deterministic seed script | Planned | Phase 02 |
| Demo login endpoint | Planned | Phase 03 |
| Session/JWT handling | Planned | Phase 03 |
| Permission service + middleware | Planned | Phase 03 |
| Resource CRUD + availability | Planned | Phase 04 |
| Asset registration + QR tokens | Planned | Phase 04 |
| Policy engine (versioned, declarative) | Planned | Phase 05 |
| Eligibility service | Planned | Phase 05 |
| Booking state machine service | Planned | Phase 06 |
| Idempotency enforcement | Planned | Phase 06 |
| Fair allocation + waitlist service | Planned | Phase 07 |
| Condition report service | Planned | Phase 08 |
| Incident service (human review) | Planned | Phase 08 |
| Trust Ledger (hash chain, verification) | Planned | Phase 09 |
| Notification outbox + worker | Planned | Phase 10 (Tier 2) |
| Admin/Analytics endpoints | Planned | Phase 11 |
| AI assistive endpoints (proxy) | Planned | Phase 10 (Tier 2) |

---

## Test Status

| Test Layer | Status | Command (Planned) |
|------------|--------|-------------------|
| Unit: Policy schema validation | Planned | `pytest tests/unit/test_policy_schema.py -v` |
| Unit: Eligibility rule outcomes | Planned | `pytest tests/unit/test_eligibility.py -v` |
| Unit: Usage cap calculations | Planned | `pytest tests/unit/test_usage_caps.py -v` |
| Unit: State machine transitions | Planned | `pytest tests/unit/test_state_machine.py -v` |
| Unit: Allocation ordering/tie-breaks | Planned | `pytest tests/unit/test_allocation.py -v` |
| Unit: Ledger canonicalisation/hash | Planned | `pytest tests/unit/test_ledger.py -v` |
| Unit: Error mapping/permissions | Planned | `pytest tests/unit/test_permissions.py -v` |
| Integration: Migrations from empty | Planned | `pytest tests/integration/test_migrations.py -v` |
| Integration: RLS cross-tenant denial | Planned | `pytest tests/integration/test_rls.py -v` |
| Integration: Overlap exclusion constraint | Planned | `pytest tests/integration/test_overlap.py -v` |
| Integration: Concurrent approval race | Planned | `pytest tests/integration/test_concurrency.py -v` |
| Integration: Idempotency | Planned | `pytest tests/integration/test_idempotency.py -v` |
| Integration: Domain + ledger atomicity | Planned | `pytest tests/integration/test_atomicity.py -v` |
| Integration: Ledger tamper detection | Planned | `pytest tests/integration/test_ledger_tamper.py -v` |
| API: Auth/role/org/resource/participant permissions | Planned | `pytest tests/api/test_permissions.py -v` |
| API: Validation, transitions, 401/403/404/409/422 | Planned | `pytest tests/api/test_errors.py -v` |
| API: Policy activation + historical preservation | Planned | `pytest tests/api/test_policy_versioning.py -v` |
| API: Resource visibility vs bookability | Planned | `pytest tests/api/test_resource_access.py -v` |
| E2E: 11-step demo journey | Planned | `playwright test tests/e2e/demo_journey.spec.ts` |
| E2E: Cross-tenant isolation demo | Planned | `playwright test tests/e2e/cross_tenant.spec.ts` |
| E2E: Keyboard-only primary journey | Planned | `playwright test tests/e2e/accessibility.spec.ts` |
| Frontend: Type check | Planned | `bun run lint` (tsc --noEmit) |
| Frontend: Build | Planned | `bun run build` |
| CI: Full pipeline | Planned | GitHub Actions workflow |

---

## Known Gaps / Decisions Needed

| Gap | Impact | Resolution Target |
|-----|--------|-------------------|
| No real FastAPI backend exists | Blocks all live mode | Phase 01 |
| PostgreSQL not configured | Blocks Phases 02-14 | Phase 01 (local) / Phase 14 (deployed) |
| OIDC provider not selected | Blocks Tier 2 auth | Phase 10 (user decision) |
| Object storage (S3/MinIO) not configured | Blocks Tier 2 evidence uploads | Phase 10 (user decision) |
| Deployment target/URL not confirmed | Blocks judge access | Phase 14 (user decision) |
| GitHub Actions secrets not configured | Blocks CI | Phase 01 (user provides) |
| Demo credentials for judge | Blocks submission | Phase 14 (document in TESTING.md) |

---

## Phase 0 Gate Status

| Gate Criterion | Status | Evidence |
|----------------|--------|----------|
| Latest documentation pack identified and read | ✅ | All 7 docs read and referenced |
| Actual frontend and existing backend inspected | ✅ | Full inventory in BACKEND_PLAN.md §2-3 |
| Every frontend API operation mapped to endpoint | ✅ | BACKEND_PLAN.md §3 + CONTRACT.md |
| Domain and security conflicts explicitly recorded | ✅ | BACKEND_PLAN.md §4 |
| Installed skills inventoried without invented names | ✅ | AGENT_USAGE.md |
| Phase 0 deliverables exist and pass completeness review | ✅ | BACKEND_PLAN.md, CONTRACT.md, AGENT_USAGE.md, this file |

---

## Next Phase: Phase 01 — Backend Foundation and CI

**Target**: Establish FastAPI foundation with health checks, logging, CI, and PostgreSQL connectivity.

**Deliverables**:
- `backend/` directory with FastAPI app
- `pyproject.toml` / `requirements.txt` + lockfile
- Alembic configuration
- GitHub Actions CI workflow
- `.env.example` with all required variables
- `/healthz`, `/readyz` endpoints
- Structured logging with request IDs

**Commit**: `feat(phase-01): establish FastAPI foundation and CI`

---

*This status will be updated at each phase boundary per MASTER_PROMPT Section 6.*