# SHARESPACE Backend Implementation Plan

**Generated**: 2026-10-29  
**Phase**: 0 — Repository, Documentation, Frontend, and Skill Audit

---

## 1. Repository Map and Detected Toolchain

### Current Repository Structure
```
Share-Space/
├── .agents/skills/          # 221 Agency Agents skills (installed)
├── docs/                    # Documentation pack (PRD, ARCHITECTURE, DESIGN, RULES, PHASES, MEMORY, ROADMAP, README)
├── src/                     # React 19 + TypeScript + Vite frontend
│   ├── app/                 # App context, providers
│   ├── components/          # Shared UI components
│   ├── features/            # Feature modules (auth, dashboard, resources, bookings, handover, incidents, ledger, owner, policies, review, assets, analytics, admin)
│   ├── lib/                 # API client (api.ts), types (types.ts), utilities (utils.ts)
│   ├── mocks/               # Mock backend (server.ts, seed.ts) — full deterministic engine
│   ├── App.tsx              # Router with role guards
│   ├── main.tsx             # Entry point
│   └── index.css            # Design tokens (CSS variables)
├── server.ts                # Express + Vite dev server + 3 Gemini AI endpoints
├── package.json             # bun lockfile, React 19, Tailwind 4, Express, Gemini AI
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── .gitignore
```

### Frontend Stack (Existing)
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4 + CSS variables (design tokens)
- **Routing**: React Router DOM 7
- **State**: Custom AppContext (localStorage session + mock DB)
- **Charts**: Recharts 3
- **Animation**: Motion (framer-motion successor)
- **Icons**: Lucide React
- **Date**: date-fns 4
- **AI**: @google/genai (Gemini 4 Argon, High Thinking mode)
- **Package Manager**: bun (bun.lock present)

### Backend Stack (Target — Not Yet Implemented)
Per ARCHITECTURE.md and PRD.md:
- **API**: FastAPI (Python) + Pydantic v2
- **Database**: PostgreSQL + SQLAlchemy 2 + Alembic
- **Auth**: OIDC (authorization code + PKCE) via managed provider; demo login behind `ENABLE_DEMO_LOGIN=false`
- **Migrations**: Alembic
- **Testing**: pytest (backend), Playwright/Vitest (frontend)
- **CI**: GitHub Actions (lint, type-check, pytest with PostgreSQL service, migration check, frontend build)
- **Observability**: Structured JSON logs, `/healthz` + `/readyz`, request/correlation IDs

### Existing Backend (Mock Only)
The repository currently has **no real FastAPI backend**. The entire backend is implemented as a TypeScript mock engine in `src/mocks/server.ts` + `src/mocks/seed.ts` with:
- Full in-memory database with localStorage persistence
- Deterministic eligibility engine (`evaluateEligibilitySync`)
- Booking state machine with validated transitions (`ALLOWED_TRANSITIONS`)
- Hash-chained Trust Ledger (`verifyOrganizationLedgerChain`, `simulateLedgerTamper`)
- Policy engine with versioned policies (`SEED_POLICIES`, `SEED_POLICY_VERSIONS`)
- Waitlist promotion logic (`promoteNextWaitlistedIfSlotOpen`)
- AI-assisted endpoints (3 Gemini endpoints in `server.ts` Express server)
- Row-level security simulation via `enforceTenantMatch`
- Idempotency keys on booking creation
- Overlap detection via `hasTimeOverlap` + `CONFIRMED_OCCUPYING_STATES`

---

## 2. Frontend Route/Screen Inventory

| Route | Screen | Purpose | Auth Required | Roles |
|-------|--------|---------|---------------|-------|
| `/login` | LoginPage | Demo account selector + sign-in | No | — |
| `/` | DashboardPage | Next booking, request summary, manager queue counts | Yes | All |
| `/discover` | DiscoverPage | Search/filter resources | Yes | All |
| `/resources/:id` | ResourceDetailPage | Resource specs, availability, eligibility preview, request CTA | Yes | All |
| `/resources/:id/request` | BookingRequestPage | Time picker, purpose, eligibility preview, idempotency key | Yes | USER |
| `/bookings` | MyBookingsPage | List own bookings with status badges | Yes | USER |
| `/bookings/:id` | BookingDetailPage | Timeline, condition reports, incidents, ledger events, competing requests | Yes | USER/OWNER/MANAGER/ADMIN |
| `/bookings/:id/check-in` | CheckInPage | Initial condition report, accessories, photos, acknowledgment | Yes | USER/OWNER/MANAGER/ADMIN |
| `/bookings/:id/return` | ReturnPage | Final condition, accessories, incident option, staff confirm | Yes | USER/OWNER/MANAGER/ADMIN |
| `/bookings/:id/incident` | IncidentReportPage | Category, description, evidence, AI-assisted structuring | Yes | USER/OWNER/MANAGER/ADMIN |
| `/review` | ReviewWorkspacePage | Manager queue: pending, waitlisted, eligibility, conflicts | Yes | OWNER/MANAGER/ADMIN |
| `/review/:bookingId` | ReviewWorkspacePage | Decision detail: approve/reject/waitlist/needs-info + reason | Yes | OWNER/MANAGER/ADMIN |
| `/handover` | StaffHandoverPage | Staff confirm handover/return | Yes | OWNER/MANAGER/ADMIN |
| `/owner/resources` | OwnerResourcesPage | List/create/edit owned resources | Yes | OWNER/MANAGER/ADMIN |
| `/owner/resources/new` | OwnerResourcesPage | Create resource form | Yes | OWNER/MANAGER/ADMIN |
| `/owner/resources/:id/edit` | OwnerResourcesPage | Edit resource form | Yes | OWNER/MANAGER/ADMIN |
| `/analytics` | AnalyticsPage | Utilisation, fairness, demand, outcomes | Yes | OWNER/MANAGER/ADMIN |
| `/incidents` | IncidentsListAndDetailPage | List incidents (reporter/reviewer scope) | Yes | All (scoped) |
| `/incidents/:id` | IncidentsListAndDetailPage | Incident detail, comments, resolution | Yes | All (scoped) |
| `/ledger` | TrustLedgerPage | Filterable audit events, chain verification, tamper demo | Yes | All (scoped) |
| `/admin/policies` | PoliciesPage | List policies, create version, preview, activate | Yes | OWNER/ADMIN |
| `/admin/policies/:id` | PoliciesPage | Policy version detail, preview against sample | Yes | OWNER/ADMIN |
| `/admin/users` | AdminUsersPage | Directory, role changes (reason required), training verification | Yes | ADMIN/MANAGER/OWNER |
| `/admin/settings` | AdminSettingsPage | Org settings, demo login toggle | Yes | ADMIN |
| `/assets/scan/:token` | AssetScanLandingPage | QR scan → contextual actions (check-in, return, staff confirm, view) | Yes | All |
| `/labels/:resourceId` | PrintableQrLabelSheetPage | Printable QR label sheet per resource | Yes | OWNER/MANAGER/ADMIN |
| `/notifications` | NotificationsPage | In-app notifications, mark read | Yes | All |
| `/profile` | ProfilePage | User profile, trainings, usage by resource | Yes | All |
| `/about` | AboutPage | Project info, demo credentials | No | — |

---

## 3. API Contract Inventory (from `src/lib/api.ts`)

### Authentication
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getMe()` | `GET /me` | Returns current user + org + all demo users/orgs | Required | All |
| `demoLogin(userId)` | `POST /auth/demo-login` | Sets session, returns user+org | No (demo) | All |
| `resetDemoData()` | — | Resets localStorage DB | No (demo) | All |

### Resources
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getResources(filters?)` | `GET /resources` | Filter by org, category, status, supervision, training, search | Required | All |
| `getResource(resourceId)` | `GET /resources/:id` | Resource + assets + active policies + waitlist count | Required | All (tenant-scoped) |
| `createResource(payload)` | `POST /resources` | Owner/Manager/Admin only, creates default asset + QR token | Required | OWNER/MANAGER/ADMIN |
| `updateResource(id, updates, reason)` | `PATCH /resources/:id` | Owner/Manager/Admin, ledger event | Required | OWNER/MANAGER/ADMIN |
| `publishResource(id, status, reason)` | `POST /resources/:id/publish` | Status change with reason, ledger | Required | OWNER/MANAGER/ADMIN |
| `getResourceAvailability(id)` | `GET /resources/:id/availability` | Bookings excluding CANCELLED/REJECTED | Required | All (tenant-scoped) |
| `getResourceWaitlist(id)` | `GET /resources/:id/waitlist` | Waitlisted bookings sorted by position | Required | OWNER/MANAGER/ADMIN |

### Eligibility & Bookings
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `checkEligibilityPreview(params)` | `POST /bookings/eligibility-check` | `evaluateEligibilitySync` with policy versions | Required | USER |
| `createBooking(payload)` | `POST /bookings` | Idempotency key, eligibility eval, status: PENDING_REVIEW/ELIGIBILITY_BLOCKED/WAITLISTED | Required | USER |
| `getMyBookings()` | `GET /bookings/mine` | Own bookings + resource enrichment | Required | USER |
| `getAllOrganizationBookings()` | `GET /bookings/org` | All org bookings + requester enrichment | Required | OWNER/MANAGER/ADMIN |
| `getBookingDetail(id)` | `GET /bookings/:id` | Full detail: resource, requester, conditions, incidents, ledger, competing | Required | USER (own) / OWNER/MANAGER/ADMIN (org) |
| `cancelBooking(id, reason)` | `POST /bookings/:id/cancel` | Validate transition, promote waitlist if was APPROVED | Required | USER (own) / OWNER/MANAGER/ADMIN |
| `decideBooking(id, payload)` | `POST /bookings/:id/decision` | Owner/Manager/Admin, recheck overlap, eligibility, reason required | Required | OWNER/MANAGER/ADMIN |
| `submitCheckIn(id, payload)` | `POST /bookings/:id/check-in` | Condition, accessories, photos, rules ack → CHECKED_OUT_TO_USER | Required | USER (own) / OWNER/MANAGER/ADMIN |
| `submitReturn(id, payload)` | `POST /bookings/:id/return` | Final condition, accessories, photos, optional incident | Required | USER (own) / OWNER/MANAGER/ADMIN |
| `confirmStaffHandoverOrReturn(id, stage, notes)` | `POST /bookings/:id/return-confirmation` | Staff confirmation for supervised resources | Required | OWNER/MANAGER/ADMIN |

### Incidents
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getIncidents()` | `GET /incidents` | Scoped: reporter or staff | Required | All (scoped) |
| `getIncidentDetail(id)` | `GET /incidents/:id` | Incident + resource + booking + attachments | Required | Reporter / OWNER/MANAGER/ADMIN |
| `createIncident(bookingId, payload)` | `POST /bookings/:id/incidents` | Reporter, category, description, photos, AI-assisted draft | Required | USER/OWNER/MANAGER/ADMIN |
| `addIncidentComment(id, message)` | `POST /incidents/:id/comments` | Comment + ledger event | Required | Participants / Reviewers |
| `resolveIncident(id, payload)` | `POST /incidents/:id/resolution` | Reviewer only, status, outcome, resolution, resource maintenance flag | Required | OWNER/MANAGER/ADMIN |

### Trust Ledger
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getLedgerEvents(filters?)` | `GET /audit-events` | Filter by entity_type, entity_id, actor_id, action | Required | All (tenant-scoped) |
| `verifyLedger()` | `GET /audit-events/verify` | Full chain verification, returns `LedgerVerificationResult` | Required | ADMIN/MANAGER |
| `simulateTamper()` | `POST /audit-events/simulate-tamper` | Admin demo: mutates a historical event | Required | ADMIN/MANAGER |
| `repairLedger()` | `POST /audit-events/repair` | Admin demo: recomputes chain | Required | ADMIN/MANAGER |

### Policies
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getPolicies()` | `GET /policies` | Policies + versions for org | Required | OWNER/ADMIN |
| `createPolicyVersionAndActivate(id, payload)` | `POST /policies/:id/versions` | New version, optional immediate activation, ledger | Required | ADMIN/OWNER |
| `previewPolicyOutcome(payload)` | `POST /policies/preview` | Dry-run draft policy against sample user/resource | Required | ADMIN/OWNER |

### Assets & QR
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `scanAssetQr(qrToken)` | `GET /assets/scan/:token` | Asset + resource + contextual allowed actions | Required | All |
| `createAssetForResource(id, assetTag, serialNumber)` | `POST /resources/:id/assets` | Owner/Manager/Admin, generates QR token | Required | OWNER/MANAGER/ADMIN |

### Notifications
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getNotifications()` | `GET /notifications` | User's notifications | Required | All |
| `markNotificationRead(id)` | `POST /notifications/:id/read` | Mark single read | Required | All |
| `markAllNotificationsRead()` | `POST /notifications/read-all` | Mark all read | Required | All |

### Admin: Users, Roles, Training
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getAdminDirectory()` | `GET /admin/users` | Users + trainings + org | Required | ADMIN/MANAGER/OWNER |
| `getMyProfileData()` | `GET /profile/data` | Current user + org + trainings + usage | Required | All |
| `updateUserRoles(userId, roles, reason)` | `PATCH /admin/users/:id/roles` | ADMIN only, reason required, ledger | Required | ADMIN |
| `verifyUserTraining(userId, type, label, status, source, reason)` | `POST /admin/users/:id/training` | ADMIN/MANAGER/OWNER, ledger | Required | ADMIN/MANAGER/OWNER |
| `requestTrainingEnrollment(type, label)` | `POST /profile/training/request` | USER requests verification | Required | USER |

### Analytics
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `getAnalyticsData()` | `GET /analytics/utilisation` | Resource metrics, fairness, demand, outcomes | Required | OWNER/MANAGER/ADMIN |

### AI Assistive (Optional, Tier 2)
| Function | Method/Path (Live) | Mock Implementation | Auth | Roles |
|----------|-------------------|---------------------|------|-------|
| `parseNaturalLanguageQuery(query)` | `POST /api/ai/parse-query` | Gemini 4 Argon High Thinking → deterministic fallback | Optional | All |
| `structureIncidentDraft(rawNotes, resourceName)` | `POST /api/ai/structure-incident` | Gemini 4 Argon High Thinking → deterministic fallback | Optional | All |

---

## 4. Contract Reconciliation Table

| Area | Frontend Contract (`api.ts` + types) | Documentation (PRD/ARCHITECTURE/RULES) | Existing Backend (Mock) | Decision & Rationale |
|------|--------------------------------------|----------------------------------------|-------------------------|---------------------|
| **Auth** | `GET /me`, `POST /auth/demo-login` | OIDC + demo login behind flag | Mock: localStorage session | **Preserve frontend contract**. Build FastAPI `/me` and demo login behind `ENABLE_DEMO_LOGIN`. OIDC is Tier 2. |
| **Resource Status Enum** | `DRAFT \| PUBLISHED \| PAUSED \| MAINTENANCE \| ARCHIVED` | Same + `ACTIVE` mentioned in PRD | Mock uses documented values | **Use frontend enum** (`PUBLISHED` not `ACTIVE`). Document mapping. |
| **Booking Status Enum** | 13 states (REQUESTED...CLOSED) | ARCHITECTURE.md lists same 13 | Mock implements full state machine | **Preserve exactly**. Backend must enforce transitions via `ALLOWED_TRANSITIONS`. |
| **Eligibility Check Keys** | `account_verified`, `institution_membership`, `resource_status`, `req_*_training`, `time_conflict`, `time_validity`, `session_duration`, `usage_limit`, `human_review` | RULES.md §4 lists same categories | Mock returns exact keys + `reason` + `nextStep` | **Preserve exactly**. Backend eligibility service must return identical shape. |
| **Eligibility Statuses** | `PASS \| FAIL \| REVIEW_REQUIRED \| NOT_APPLICABLE` | RULES.md §4 same | Mock uses all four | **Preserve exactly**. |
| **Policy Scope Types** | `ORG \| CATEGORY \| RESOURCE` | ARCHITECTURE.md §5 same | Mock uses all three | **Preserve exactly**. Resolution order: RESOURCE → CATEGORY → ORG. |
| **Policy Kinds** | `ELIGIBILITY \| USAGE_CAP \| PRIORITY \| APPROVAL_CHAIN \| CANCELLATION \| RETURN_WINDOW` | ARCHITECTURE.md §8 lists similar | Mock implements ELIGIBILITY, USAGE_CAP, PRIORITY | **Implement all six** as declarative schema. CANCELLATION/RETURN_WINDOW are Tier 2. |
| **Ledger Event Fields** | `id, orgId, seq, actorId, actorName, actorRole, action, entityType, entityId, occurredAt, reason, metadata, prevHash, hash` | ARCHITECTURE.md §10 same | Mock computes SHA-256 chain | **Preserve exactly**. Use `pg_advisory_xact_lock` for serialization. |
| **Idempotency** | `idempotencyKey` on booking create | ARCHITECTURE.md §5.161, PRD FR-21 | Mock enforces per-user uniqueness | **Preserve exactly**. DB unique index on `(user_id, idempotency_key)`. |
| **Overlap Prevention** | `CONFIRMED_OCCUPYING_STATES` = APPROVED, CHECKED_OUT_TO_USER, RETURN_PENDING_CONFIRMATION, OVERDUE | ARCHITECTURE.md §5.163-173 same | Mock checks in eligibility + approval | **Preserve exactly**. PostgreSQL exclusion constraint with `btree_gist` + `tstzrange`. |
| **Error Shape** | `{ error: { code, message, details? } }` | ARCHITECTURE.md §7 same | Mock uses `MockApiError` with same shape | **Preserve exactly**. Centralized exception handler in FastAPI. |
| **Date Format** | ISO 8601 strings (UTC in storage, local display) | ARCHITECTURE.md §5.158 | Mock uses `.toISOString()` | **Preserve exactly**. |
| **Pagination** | Not yet in frontend (returns full arrays) | ARCHITECTURE.md §7 implies pagination | Mock returns full arrays | **Add pagination** to live endpoints: `limit`, `offset`, `total` in response. |
| **QR Scan Actions** | Returns `allowedActions` array with type, label, bookingId, description | DESIGN.md Screen N, RULES.md §10C | Mock computes contextual actions | **Preserve exactly**. Scan never grants access. |
| **Incident Resolution Outcomes** | `NO_ISSUE_FOUND \| MAINTENANCE_SCHEDULED \| WEAR_AND_TEAR_LOGGED \| TRAINING_REFRESH_RECOMMENDED \| ACCESSORY_REPLACED` | RULES.md §9 doesn't enumerate | Mock uses all five | **Preserve exactly**. No automatic penalties. |
| **Notification Types** | `DECISION \| WAITLIST_CHANGE \| CANCELLATION \| UPCOMING_BOOKING \| OVERDUE_RETURN \| INCIDENT_UPDATE` | PRD FR-12, RULES.md §13 | Mock uses all six | **Preserve exactly**. In-app MVP; outbox is Tier 2. |
| **Analytics Shape** | Resource metrics, fairness by user, demand by hour block, outcome counts | PRD FR-13, DESIGN.md Screen L | Mock computes from seeded data | **Preserve exactly**. State formula/window in response metadata. |

### Key Discrepancies & Resolutions

1. **Resource Status: `PUBLISHED` vs `ACTIVE`** — Frontend uses `PUBLISHED`; PRD mentions `ACTIVE`. **Resolution**: Use `PUBLISHED` everywhere; document that `ACTIVE` is a synonym in PRD.

2. **Policy Kind `APPROVAL_CHAIN`, `CANCELLATION`, `RETURN_WINDOW`** — Defined in types but not implemented in mock. **Resolution**: Add schema support in backend; Tier 2 for full implementation.

3. **Pagination** — Frontend currently receives full arrays. **Resolution**: Add pagination to live endpoints; keep mock returning full arrays for dev.

4. **AI Endpoints** — Frontend calls `/api/ai/...` on Express server. **Resolution**: In live mode, these can proxy to FastAPI or remain on Express. Document as optional Tier 2.

5. **Booking `decisionReason` vs `rejectionReason`** — Frontend uses `decisionReason` for all decisions. **Resolution**: Single field is correct per RULES.md §5.6.

---

## 5. Domain Inventory

### Roles
- `USER` — Discover, request, manage own bookings, submit reports
- `OWNER` — Manage owned resources, review requests where authorised
- `MANAGER` — Review assigned requests, confirm supervised handovers/returns, manage incidents
- `ADMIN` — Manage roles/policies, oversight, ledger verification

### Organisations
- `org_nit` — Nilgiri Institute of Technology (primary demo)
- `org_harbour` — Harbour Community Makerspace (tenant isolation demo)

### Resources (10 in Org A, 2 in Org B)
| ID | Name | Category | Supervision | Key Requirements |
|----|------|----------|-------------|------------------|
| `res_oscilloscope` | Digital Oscilloscope | ELECTRONICS | STAFF_CONFIRMATION | EL-101 training, membership, approval |
| `res_3dprinter` | Prusa MK4S 3D Printer | ELECTRONICS | STAFF_CONFIRMATION | AM-201 training, membership, approval, **usage cap 6h/7d** |
| `res_camera` | Mirrorless Camera Kit | MEDIA_COMPUTING | STAFF_CONFIRMATION | MD-105 training, membership, approval, **usage cap 6h/7d** |
| `res_soldering` | Soldering Station x3 | ELECTRONICS | STAFF_PRESENT | EL-101 training, membership |
| `res_powersupply` | Bench Power Supply | ELECTRONICS | NONE | EL-101 training, membership |
| `res_multimeter` | Digital Multimeter Kit | ELECTRONICS | STAFF_CONFIRMATION | EL-101 training, membership |
| `res_lighting` | Tripod & Lighting Set | MEDIA_COMPUTING | NONE | MD-105 training, membership |
| `res_gpu` | GPU Workstation (2x RTX 4090) | MEDIA_COMPUTING | NONE | Membership, approval |
| `res_room204` | Project Room 204 | SPACE | STAFF_CONFIRMATION | Membership |
| `res_room_b` | Meeting Room B | SPACE | NONE | Membership |
| `res_laser_b` | CO2 Laser Cutter | ELECTRONICS | STAFF_PRESENT | Harbour membership |
| `res_cnc_b` | CNC Router | ELECTRONICS | STAFF_CONFIRMATION | Harbour membership |

### Policies (5 seeded)
| ID | Name | Kind | Scope | Active Version |
|----|------|------|-------|----------------|
| `pol_org_elig` | Institutional Baseline Eligibility | ELIGIBILITY | ORG (nit) | v1 |
| `pol_3d_cap` | 3D Printer Weekly Rolling Cap | USAGE_CAP | RESOURCE (res_3dprinter) | v1 |
| `pol_cam_cap` | Camera Kit Rolling Cap | USAGE_CAP | RESOURCE (res_camera) | v1 |
| `pol_priority_fairness` | Fair Allocation Priority Order | PRIORITY | ORG (nit) | v1 |
| `pol_harbour_elig` | Harbour Standard Access | USAGE_CAP | ORG (harbour) | v1 |

### Booking State Machine (13 states)
```
REQUESTED → PENDING_REVIEW | ELIGIBILITY_BLOCKED | CANCELLED
PENDING_REVIEW → APPROVED | REJECTED | WAITLISTED | NEEDS_INFORMATION | CANCELLED
WAITLISTED → PENDING_REVIEW | APPROVED | REJECTED | CANCELLED
APPROVED → CANCELLED | CHECKED_OUT_TO_USER | OVERDUE
CHECKED_OUT_TO_USER → RETURN_PENDING_CONFIRMATION | RETURNED | OVERDUE
OVERDUE → RETURN_PENDING_CONFIRMATION | RETURNED
RETURN_PENDING_CONFIRMATION → RETURNED | CLOSED
RETURNED → CLOSED
CLOSED → (terminal)
REJECTED → (terminal)
CANCELLED → (terminal)
ELIGIBILITY_BLOCKED → CANCELLED | PENDING_REVIEW
NEEDS_INFORMATION → PENDING_REVIEW | CANCELLED | REJECTED
```

### Eligibility Check Keys (9 implemented)
1. `account_verified` — VERIFIED status
2. `institution_membership` — Same org as resource
3. `resource_status` — PUBLISHED only
4. `req_*_training` — Per-resource training requirements
5. `time_validity` — start < end
6. `time_conflict` — No overlap with CONFIRMED_OCCUPYING_STATES
7. `session_duration` — ≤ maxBookingDurationHours from policy
8. `usage_limit` — Rolling window cap from policy
9. `human_review` — APPROVAL requirement or supervision ≠ NONE

### Condition Reports
- `CHECK_IN` + `RETURN` stages
- Condition level: `EXCELLENT \| GOOD \| MINOR_WEAR \| NEEDS_ATTENTION`
- Accessories checklist, notes, photos (attachments), rules acknowledgment
- Staff confirmation for supervised resources

### Incidents
- Categories: Damage, Missing accessory, Late return, Safety concern, Booking conflict, Other
- Status: `REPORTED \| UNDER_REVIEW \| AWAITING_INFO \| RESOLVED`
- Resolution outcomes: 5 defined (no penalties)
- Comments thread, attachments, human reviewer required

### Trust Ledger
- Per-organisation hash chain: `seq`, `prev_hash`, `hash` (SHA-256)
- Event types: RESOURCE, BOOKING, CONDITION_REPORT, INCIDENT, POLICY, USER_ROLE, TRAINING, LEDGER
- Verification endpoint returns first invalid sequence
- Tamper detection test required

### Attachments
- Metadata only in MVP (dataUrl in mock)
- SHA-256 hash recorded in ledger metadata
- MIME allowlist: image/*, application/pdf
- Size cap: 5MB per file, max 4 per report

---

## 6. Initial Schema and Migration Plan

### Tables (with `organization_id` on all tenant-scoped tables)

```sql
-- Core
organizations (id, name, domain, department_code, timezone, retention_days, created_at)
users (id, organization_id, name, email, roles[], department, academic_group, verification, demo_persona_note, created_at)
role_assignments (id, user_id, organization_id, role, resource_id?, granted_by, granted_at, reason)

-- Resources
resources (id, organization_id, owner_id, owner_name, department, name, model_number, category, illustration_type, location, access_instructions, description, condition, status, supervision, accessories[], usage_rules, return_rules, cancellation_policy, policy_ids[], created_at, updated_at)
resource_requirements (id, resource_id, key, type, label, value, created_at)
availability_windows (id, resource_id, day_of_week, start_time, end_time, recurrence, exceptions[], created_at)
assets (id, organization_id, resource_id, asset_tag, serial_number, qr_token_hash, condition, status, last_calibrated_at, created_at)

-- Policies
policies (id, organization_id, name, description, scope_type, scope_id, scope_label, kind, status, active_version, created_at, updated_at)
policy_versions (id, organization_id, policy_id, version, definition_json, effective_from, created_by, created_by_name, reason, created_at)

-- Bookings & Lifecycle
bookings (id, organization_id, resource_id, user_id, start_at, end_at, purpose, project_code, team_members[], status, idempotency_key, policy_version_ids[], eligibility_checks_json, waitlist_position, waitlist_reason, priority_factors_json, decision_reason, decided_by, decided_at, is_policy_override, handover_confirmed_by, handover_confirmed_at, return_confirmed_by, return_confirmed_at, created_at, updated_at)
-- EXCLUSION CONSTRAINT: no overlapping confirmed bookings for same resource
-- UNIQUE INDEX: (user_id, idempotency_key)

eligibility_checks (id, booking_id, check_key, label, status, reason, next_step, policy_version_id, evaluated_at)

condition_reports (id, organization_id, booking_id, stage, condition, accessories_json, notes, attachment_ids[], attachment_hashes[], acknowledged_rules, reporter_id, reporter_name, actual_timestamp, staff_confirmed_by, staff_confirmed_at, created_at)

incidents (id, organization_id, booking_id, resource_id, reporter_id, reporter_name, category, reported_stage, affected_part, description, attachment_ids[], attachment_hashes[], status, reviewer_id, reviewer_name, resolution_outcome, resolution, resolved_at, requires_human_review, assisted_draft_used, created_at)
incident_comments (id, incident_id, author_id, author_name, author_role, message, created_at)

-- Trust Ledger
audit_events (id, organization_id, seq, actor_id, actor_name, actor_role, action, entity_type, entity_id, occurred_at, reason, metadata_json, prev_hash, hash)
-- TRIGGER: REJECT UPDATE/DELETE on audit_events for app role
-- INDEX: (organization_id, seq)

-- Notifications
notifications (id, organization_id, user_id, type, title, message, related_entity_id, related_path, outbox_status, read_at, created_at)

-- Outbox (Tier 2)
outbox_events (id, organization_id, event_type, payload_json, status, attempts, next_retry_at, created_at, processed_at)

-- Idempotency (alternative to unique index on bookings)
idempotency_keys (id, organization_id, user_id, key, response_json, created_at)

-- Attachments (Tier 2 - object storage metadata)
attachments (id, organization_id, file_name, mime_type, size_bytes, sha256, storage_key, uploaded_by, linked_entity_type, linked_entity_id, confirmed, created_at)
```

### Migration Sequence
1. `001_initial_schema` — Core tables, enums, FKs, indexes
2. `002_rls_policies` — Enable RLS, create policies, create app role (no BYPASSRLS)
3. `003_exclusion_constraint` — `btree_gist` + booking overlap constraint
4. `004_ledger_triggers` — Insert-only trigger on audit_events
5. `005_seed_data` — Deterministic seed (idempotent, uses fixed UUIDs)

---

## 7. RLS Design

### Application Database Role
```sql
CREATE ROLE sharespace_app WITH LOGIN PASSWORD '...' NOINHERIT;
GRANT CONNECT ON DATABASE sharespace TO sharespace_app;
GRANT USAGE ON SCHEMA public TO sharespace_app;
-- SELECT, INSERT, UPDATE, DELETE on tenant tables (via RLS policies)
-- SELECT, INSERT ONLY on audit_events (trigger blocks UPDATE/DELETE)
```

### Migration Role (Separate)
```sql
CREATE ROLE sharespace_migrate WITH LOGIN PASSWORD '...' BYPASSRLS;
-- Used only for Alembic migrations
```

### RLS Policy Pattern (per tenant table)
```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bookings
  USING (organization_id = current_setting('app.org_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id')::uuid);
```

### Tenant Context Setting (per transaction)
```python
# In FastAPI dependency / middleware
async def set_tenant_context(org_id: str):
    await db.execute(text("SET LOCAL app.org_id = :org_id"), {"org_id": org_id})
```
- Set from **server-side authenticated session only** (never client input)
- Fail closed: if `app.org_id` unset, queries return 0 rows
- Test: pooled connections must not leak context between transactions

### Cross-Tenant Threat Model
| Attack Vector | Mitigation |
|---------------|------------|
| Client sends `organization_id` in request | Ignored; context from session only |
| SQL injection bypassing RLS | Parameterized queries + app role no BYPASSRLS |
| Connection pool context leakage | `SET LOCAL` (transaction-scoped), verify in CI |
| Admin accessing other org data | Admin role still scoped to their org; super-admin is separate Tier 2 |

---

## 8. Endpoint/Permission Matrix

| Endpoint | Method | USER | OWNER | MANAGER | ADMIN | Tenant Scoped |
|----------|--------|------|-------|---------|-------|---------------|
| `/me` | GET | ✓ | ✓ | ✓ | ✓ | Yes (returns own org) |
| `/auth/demo-login` | POST | ✓ | ✓ | ✓ | ✓ | Yes (sets session org) |
| `/resources` | GET | ✓ | ✓ | ✓ | ✓ | Yes (filter by org) |
| `/resources` | POST | ✗ | ✓ | ✓ | ✓ | Yes (sets org_id) |
| `/resources/:id` | GET | ✓ | ✓ | ✓ | ✓ | Yes (404 if other org) |
| `/resources/:id` | PATCH | ✗ | ✓* | ✓* | ✓ | Yes (owner/manager of resource) |
| `/resources/:id/publish` | POST | ✗ | ✓* | ✓* | ✓ | Yes |
| `/resources/:id/availability` | GET | ✓ | ✓ | ✓ | ✓ | Yes |
| `/resources/:id/waitlist` | GET | ✗ | ✓* | ✓* | ✓ | Yes |
| `/bookings/eligibility-check` | POST | ✓ | ✓ | ✓ | ✓ | Yes |
| `/bookings` | POST | ✓ | ✓ | ✓ | ✓ | Yes (sets org_id, user_id) |
| `/bookings/mine` | GET | ✓ | ✓ | ✓ | ✓ | Yes (filter user_id) |
| `/bookings/org` | GET | ✗ | ✓ | ✓ | ✓ | Yes |
| `/bookings/:id` | GET | ✓** | ✓ | ✓ | ✓ | Yes (403 if not participant/staff) |
| `/bookings/:id/cancel` | POST | ✓** | ✓ | ✓ | ✓ | Yes |
| `/bookings/:id/decision` | POST | ✗ | ✓* | ✓* | ✓ | Yes |
| `/bookings/:id/check-in` | POST | ✓** | ✓ | ✓ | ✓ | Yes |
| `/bookings/:id/return` | POST | ✓** | ✓ | ✓ | ✓ | Yes |
| `/bookings/:id/return-confirmation` | POST | ✗ | ✓* | ✓* | ✓ | Yes |
| `/incidents` | GET | ✓** | ✓ | ✓ | ✓ | Yes (reporter or staff) |
| `/incidents/:id` | GET | ✓** | ✓ | ✓ | ✓ | Yes |
| `/bookings/:id/incidents` | POST | ✓** | ✓ | ✓ | ✓ | Yes |
| `/incidents/:id/comments` | POST | ✓** | ✓ | ✓ | ✓ | Yes (participants) |
| `/incidents/:id/resolution` | POST | ✗ | ✓* | ✓* | ✓ | Yes |
| `/audit-events` | GET | ✓ | ✓ | ✓ | ✓ | Yes (filter by org) |
| `/audit-events/verify` | GET | ✗ | ✗ | ✓ | ✓ | Yes |
| `/audit-events/simulate-tamper` | POST | ✗ | ✗ | ✓ | ✓ | Yes |
| `/policies` | GET | ✗ | ✓ | ✗ | ✓ | Yes |
| `/policies/:id/versions` | POST | ✗ | ✓ | ✗ | ✓ | Yes |
| `/policies/preview` | POST | ✗ | ✓ | ✗ | ✓ | Yes |
| `/assets/scan/:token` | GET | ✓ | ✓ | ✓ | ✓ | Yes (asset org) |
| `/resources/:id/assets` | POST | ✗ | ✓* | ✓* | ✓ | Yes |
| `/notifications` | GET | ✓ | ✓ | ✓ | ✓ | Yes (user_id) |
| `/notifications/:id/read` | POST | ✓ | ✓ | ✓ | ✓ | Yes |
| `/admin/users` | GET | ✗ | ✓ | ✓ | ✓ | Yes |
| `/admin/users/:id/roles` | PATCH | ✗ | ✗ | ✗ | ✓ | Yes |
| `/admin/users/:id/training` | POST | ✗ | ✓ | ✓ | ✓ | Yes |
| `/profile/data` | GET | ✓ | ✓ | ✓ | ✓ | Yes |
| `/profile/training/request` | POST | ✓ | ✓ | ✓ | ✓ | Yes |
| `/analytics/utilisation` | GET | ✗ | ✓ | ✓ | ✓ | Yes |

* = Only for resources they own/manage  
** = Only for own bookings/incidents

---

## 9. Test Plan Mapped to Product Requirements

| PRD Requirement | Test Type | Test Description |
|-----------------|-----------|------------------|
| FR-01 Auth & Roles | Unit + Integration | Permission matrix for all roles on all endpoints |
| FR-02 Resource Listing | Integration | CRUD + publish/pause/archive, owner scope |
| FR-03 Discovery | Integration | Search, filters, empty/loading/error states |
| FR-04 Eligibility | Unit + Integration | All 9 check keys: PASS/FAIL/REVIEW_REQUIRED branches |
| FR-05 Booking Request | Integration | Validation, idempotency, policy snapshot |
| FR-06 Review & Decision | Integration | All 4 decisions + reason required, transition validation |
| FR-07 Fair Allocation | Integration | Usage cap, waitlist ordering, promotion, manager override |
| FR-08 Check-in | Integration | Time window, condition report, staff confirm, asset status |
| FR-09 Return | Integration | Final condition, staff confirm, incident option, closure |
| FR-10 Incident | Integration | Create, comment, resolve (human only), no auto-penalty |
| FR-11 Audit History | Integration | All mutation events recorded, ledger chain valid |
| FR-12 Notifications | Integration | In-app delivery, read state, outbox (Tier 2) |
| FR-13 Analytics | Unit + Integration | Calculations match seeded fixtures, tenant scoping |
| FR-14 Multi-tenancy (RLS) | Integration | Cross-tenant read/write denied under app role |
| FR-15 Policy Engine | Unit + Integration | Versioning, preview, activation, historical preservation |
| FR-16 Ledger | Unit + Integration | Hash chain, tamper detection, app role INSERT/SELECT only |
| FR-17 Asset QR | Integration (Tier 2) | QR token lookup, contextual actions, no access grant |
| FR-18 Evidence (Tier 2) | Integration | Upload flow, type/size checks, SHA-256 in ledger |
| FR-19 OIDC (Tier 2) | Integration | Auth code + PKCE, email-domain mapping |
| FR-20 Outbox (Tier 2) | Integration | Worker processes outbox, failure doesn't corrupt booking |
| FR-21 CI/Observability | CI | Lint, types, pytest+PostgreSQL, migration check, secret scan |
| FR-22 Accessibility | E2E | Keyboard journey, focus, contrast, responsive |

---

## 10. Delivery Tiers and Ordered Implementation Plan

### Tier 1 (Must Build — 48 Hours)
1. **Phase 01**: FastAPI foundation, CI, health checks, logging, config
2. **Phase 02**: Schema, RLS, migrations, deterministic seed, app role
3. **Phase 03**: Auth (demo login), sessions, permissions, role resolution
4. **Phase 04**: Resources CRUD, availability, assets, QR token generation
5. **Phase 05**: Policy engine (versioned, declarative), eligibility service
6. **Phase 06**: Booking lifecycle, state machine, idempotency, overlap constraint
7. **Phase 07**: Fair allocation, usage caps, waitlist promotion
8. **Phase 08**: Check-in, return, condition reports, incidents (human review)
9. **Phase 09**: Trust Ledger (hash chain, verification, tamper test)
10. **Phase 12**: Frontend live integration, E2E tests, cross-org demo

### Tier 2 (If MVP Gate Met at H24)
1. **Phase 10**: Notifications (in-app → outbox + worker), QR asset identity, evidence upload
2. **Phase 11**: Admin analytics polish, OIDC sign-in

### Tier 3 (Roadmap Only)
- Payments/credits, calendar sync, cross-institution agreements, webhooks, ledger anchoring, mobile app

---

## 11. Risks, Assumptions, Blockers, Decisions Needing Follow-up

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PostgreSQL exclusion constraint not available (no `btree_gist`) | Low | High | Fallback: advisory lock + recheck in transaction; document |
| RLS context leakage in connection pool | Medium | Critical | Test rollback/failure scenarios; use `SET LOCAL` |
| Frontend mock/live mode divergence | Medium | High | Shared TypeScript types; contract tests; never silent fallback |
| AI service unavailable in demo | Medium | Low | Deterministic fallbacks already implemented; Tier 2 |
| Timezone handling bugs | Medium | Medium | Store UTC, convert in frontend; test DST boundaries |

### Assumptions
- Frontend TypeScript types (`src/lib/types.ts`) are the authoritative contract
- Mock server behavior (`src/mocks/server.ts`) defines expected live behavior
- Demo data in `seed.ts` is the canonical seed scenario
- bun is the package manager (lockfile present)
- GitHub remote `origin` is configured and accessible

### Blockers Requiring User Decision
1. **Database hosting**: Local PostgreSQL vs managed (Neon, Supabase, RDS) — affects connection string in `.env`
2. **OIDC provider**: Which provider (Google, Microsoft, Auth0, Keycloak)? — Tier 2, but need to know for config
3. **Object storage**: MinIO local vs S3-compatible — Tier 2, needed for evidence uploads
4. **Deployment target**: Where to deploy for judge access? — Need URL for submission

### Decisions Recorded
- **Stack**: FastAPI + PostgreSQL + React/Vite (existing frontend preserved)
- **RLS**: Mandatory, fail-closed, app role no BYPASSRLS
- **Ledger**: SHA-256 hash chain, tamper-evident (not immutable)
- **AI**: Optional, assistive only, deterministic fallback
- **Demo login**: Behind `ENABLE_DEMO_LOGIN=false` default

---

## 12. Phase 0 Gate Checklist

- [x] Latest documentation pack identified and read (all 7 files)
- [x] Actual frontend inspected (routes, types, api.ts, mocks, components)
- [x] Existing backend (mock) audited — no real FastAPI backend exists
- [x] Every frontend API operation mapped to planned endpoint (Section 3)
- [x] Domain and security conflicts explicitly recorded (Section 4)
- [x] Installed skills inventoried (221 skills in `.agents/skills/`, relevant ones identified)
- [x] Phase 0 deliverables created: BACKEND_PLAN.md, CONTRACT.md, AGENT_USAGE.md, IMPLEMENTATION_STATUS.md

---

*Next: Phase 01 — Backend Foundation and CI*