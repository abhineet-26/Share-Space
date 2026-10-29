# SHARESPACE API Contract (OpenAPI 3.1)

**Version**: 1.0.0  
**Base Path**: `/api/v1`  
**Generated**: 2026-10-29  
**Source**: Frontend `src/lib/api.ts` + `src/lib/types.ts` + Documentation Pack

---

## Common Definitions

### Error Response (All Endpoints)
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### HTTP Status Codes
- `200` — Success (read/update)
- `201` — Created
- `400` — Invalid request / invalid state transition
- `401` — Unauthenticated
- `403` — Authenticated but not authorised
- `404` — Not found (or deliberately undisclosed for privacy)
- `409` — Conflict (scheduling, idempotency, concurrency)
- `422` — Validation failure
- `500` — Unexpected server error (safe generic message)
- `503` — AI service unavailable (graceful degradation)

### Date Format
All timestamps: ISO 8601 UTC (e.g., `2026-10-29T10:30:00.000Z`)

### Pagination (Live Mode)
```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

---

## Authentication & Profile

### GET /me
**Description**: Get current authenticated user, their organisation, and demo directory (for account switching in demo).

**Auth**: Required (session/JWT)

**Response 200**:
```json
{
  "user": { "User" },
  "organization": { "Organization" },
  "allDemoUsers": [{ "User" }],
  "allOrganizations": [{ "Organization" }]
}
```

### POST /auth/demo-login
**Description**: Demo login — sets session for a demo user. Only available when `ENABLE_DEMO_LOGIN=true`.

**Auth**: None (demo only)

**Request**:
```json
{ "userId": "usr_aarav" }
```

**Response 200**:
```json
{ "user": { "User" }, "organization": { "Organization" } }
```

**Errors**: `404 USER_NOT_FOUND`

---

## Resources

### GET /resources
**Description**: List resources with filters.

**Auth**: Required

**Query Parameters**:
- `search` (string) — Text search across name, description, location, department, modelNumber
- `category` (string) — `ELECTRONICS` | `MEDIA_COMPUTING` | `SPACE` | `ALL`
- `status` (string) — `DRAFT` | `PUBLISHED` | `PAUSED` | `MAINTENANCE` | `ARCHIVED` | `ALL`
- `supervision` (string) — `NONE` | `STAFF_CONFIRMATION` | `STAFF_PRESENT` | `ALL`
- `trainingRequired` (boolean) — Filter by whether resource has TRAINING requirements

**Response 200**: `[{ "Resource" }]`

### GET /resources/{resourceId}
**Description**: Get resource detail with assets, active policies, and waitlist count.

**Auth**: Required

**Response 200**:
```json
{
  "resource": { "Resource" },
  "assets": [{ "Asset" }],
  "activePolicies": [{ "policy": { "Policy" }, "version": { "PolicyVersion" } }],
  "waitlistCount": 3
}
```

**Errors**: `404 RESOURCE_NOT_FOUND` (or cross-tenant)

### POST /resources
**Description**: Create a new resource. Creates a default asset unit with QR token.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**: `{ "Resource" }` (omit `id`, `organizationId`, `ownerId`, `ownerName`)

**Response 201**: `{ "Resource" }`

**Errors**: `422 VALIDATION_ERROR`, `403 FORBIDDEN`

### PATCH /resources/{resourceId}
**Description**: Update resource configuration.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN` (for resources they own/manage)

**Request**:
```json
{
  "name": "Updated Name",
  "status": "PUBLISHED",
  "reason": "Updated resource configuration and usage conditions."
}
```

**Response 200**: `{ "Resource" }`

**Errors**: `404`, `403`, `422`

### POST /resources/{resourceId}/publish
**Description**: Change resource status (PUBLISHED, PAUSED, MAINTENANCE, ARCHIVED).

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**:
```json
{ "status": "PUBLISHED", "reason": "Published for Fall semester access." }
```

**Response 200**: `{ "Resource" }`

**Errors**: `404`, `403`, `422 REASON_REQUIRED`

### GET /resources/{resourceId}/availability
**Description**: Get bookings for a resource (excluding CANCELLED/REJECTED) for calendar display.

**Auth**: Required

**Response 200**: `{ "bookings": [{ "Booking" }] }`

### GET /resources/{resourceId}/waitlist
**Description**: Get waitlisted bookings for a resource, sorted by position.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Response 200**: `[{ "Booking" } & { "userName": "string" }]`

---

## Eligibility & Bookings

### POST /bookings/eligibility-check
**Description**: Preview eligibility for a hypothetical booking request.

**Auth**: Required

**Request**:
```json
{
  "resourceId": "res_oscilloscope",
  "start": "2026-10-30T10:00:00.000Z",
  "end": "2026-10-30T13:00:00.000Z",
  "userId": "usr_diya"  // optional, defaults to current user
}
```

**Response 200**: `{ "EligibilityEvaluationResult" }`

### POST /bookings
**Description**: Create a booking request with idempotency key.

**Auth**: Required

**Request**:
```json
{
  "resourceId": "res_oscilloscope",
  "start": "2026-10-30T10:00:00.000Z",
  "end": "2026-10-30T13:00:00.000Z",
  "purpose": "Characterise buck-converter PWM switching for EE-402 capstone.",
  "projectCode": "EE402-CAPSTONE-14",
  "teamMembers": ["Aarav Menon", "Vikram S."],
  "idempotencyKey": "idem_abc123",
  "joinWaitlistIfConflict": true
}
```

**Response 201**: `{ "Booking" }` (status: `PENDING_REVIEW` | `ELIGIBILITY_BLOCKED` | `WAITLISTED`)

**Errors**: `404 RESOURCE_NOT_FOUND`, `422 VALIDATION_ERROR`, `409 SCHEDULE_CONFLICT`, `409 IDEMPOTENCY_CONFLICT` (returns existing booking)

### GET /bookings/mine
**Description**: Get current user's bookings with resource enrichment.

**Auth**: Required

**Response 200**: `[{ "Booking" } & { "resourceName", "resourceLocation", "resourceSupervision" }]`

### GET /bookings/org
**Description**: Get all organisation bookings (manager/admin/owner view).

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Response 200**: `[{ "Booking" } & { "resourceName", "resourceLocation", "resourceSupervision", "requesterName", "requesterEmail", "requesterDepartment" }]`

### GET /bookings/{bookingId}
**Description**: Get full booking detail with timeline, conditions, incidents, ledger, competing requests.

**Auth**: Required

**Response 200**:
```json
{
  "booking": { "Booking" },
  "resource": { "Resource" },
  "requester": { "User" },
  "conditionReports": [{ "ConditionReport" }],
  "incidents": [{ "Incident" }],
  "ledgerEvents": [{ "LedgerEvent" }],
  "attachments": [{ "Attachment" }],
  "competingRequests": [{ "Booking" } & { "requesterName": "string" }]
}
```

**Errors**: `404 BOOKING_NOT_FOUND`, `403 FORBIDDEN` (not participant/staff)

### POST /bookings/{bookingId}/cancel
**Description**: Cancel a booking. Promotes waitlist if was APPROVED.

**Auth**: Required

**Request**:
```json
{ "reason": "Project scope changed; no longer need the oscilloscope." }
```

**Response 200**: `{ "Booking" }` (status: `CANCELLED`)

**Errors**: `404`, `403`, `400 INVALID_STATE_TRANSITION`

### POST /bookings/{bookingId}/decision
**Description**: Manager decision on a booking request.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**:
```json
{
  "decision": "APPROVED",  // APPROVED | REJECTED | WAITLISTED | NEEDS_INFORMATION
  "reason": "All safety trainings verified. Bench 04 reserved for EE-402 Capstone.",
  "isPolicyOverride": false
}
```

**Response 200**: `{ "Booking" }`

**Errors**: `404`, `403`, `400 INVALID_STATE_TRANSITION`, `409 OVERLAP_CONFLICT`, `400 ELIGIBILITY_FAILED`, `422 REASON_REQUIRED`

### POST /bookings/{bookingId}/check-in
**Description**: Submit initial condition report at handover.

**Auth**: Required

**Request**:
```json
{
  "condition": "EXCELLENT",
  "accessories": [{ "name": "4x TPP0200 Probes", "present": true }, ...],
  "notes": "All probes present and compensated.",
  "acknowledgedRules": true,
  "photos": [{ "fileName": "checkin.svg", "mimeType": "image/svg+xml", "dataUrl": "data:image/svg+xml;..." }]
}
```

**Response 200**:
```json
{ "booking": { "Booking" }, "report": { "ConditionReport" } }
```
Booking status → `CHECKED_OUT_TO_USER`

**Errors**: `404`, `403`, `400 INVALID_STATE_TRANSITION`, `422 ACKNOWLEDGEMENT_REQUIRED`

### POST /bookings/{bookingId}/return
**Description**: Submit final condition report on return. Optionally open incident.

**Auth**: Required

**Request**:
```json
{
  "condition": "GOOD",
  "accessories": [{ "name": "Probes", "present": true }, ...],
  "notes": "Returned in good condition.",
  "photos": [{ "fileName": "return.svg", "mimeType": "image/svg+xml", "dataUrl": "..." }],
  "openIncidentCategory": "Damage / suspected damage",
  "openIncidentDescription": "Probe tip slightly bent."
}
```

**Response 200**:
```json
{ "booking": { "Booking" }, "report": { "ConditionReport" }, "incident?: { "Incident" } }
```
Booking status → `RETURN_PENDING_CONFIRMATION` (supervised) or `CLOSED` (unsupervised)

**Errors**: `404`, `403`, `400 INVALID_STATE_TRANSITION`

### POST /bookings/{bookingId}/return-confirmation
**Description**: Staff confirmation of handover or return (supervised resources).

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**:
```json
{ "stage": "HANDOVER", "notes": "Technician verified initial condition." }  // or "RETURN"
```

**Response 200**: `{ "Booking" }`

**Errors**: `404`, `403`, `400 INVALID_STATE_TRANSITION`

---

## Incidents

### GET /incidents
**Description**: List incidents scoped to current user (reporter) or staff (reviewer).

**Auth**: Required

**Response 200**: `[{ "Incident" } & { "resourceName": "string" }]`

### GET /incidents/{incidentId}
**Description**: Get incident detail with resource, booking, attachments.

**Auth**: Required

**Response 200**:
```json
{ "incident": { "Incident" }, "resource": { "Resource" }, "booking": { "Booking" }, "attachments": [{ "Attachment" }] }
```

**Errors**: `404`, `403`

### POST /bookings/{bookingId}/incidents
**Description**: Create an incident report.

**Auth**: Required

**Request**:
```json
{
  "category": "Damage / suspected damage",
  "reportedStage": "Return inspection",
  "affectedPart": "Probe tip",
  "description": "Probe tip bent during use.",
  "assistedDraftUsed": false,
  "photos": [{ "fileName": "damage.jpg", "mimeType": "image/jpeg", "dataUrl": "..." }]
}
```

**Response 201**: `{ "Incident" }`

**Errors**: `404`, `422 VALIDATION_ERROR`

### POST /incidents/{incidentId}/comments
**Description**: Add comment to incident.

**Auth**: Required

**Request**: `{ "message": "Inspected probe; tip bent 15 degrees." }`

**Response 200**: `{ "Incident" }` (updated with new comment)

### POST /incidents/{incidentId}/resolution
**Description**: Resolve an incident (human reviewer only).

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**:
```json
{
  "status": "RESOLVED",
  "resolutionOutcome": "ACCESSORY_REPLACED",
  "resolution": "Replaced probe tip from spares. Normal wear, no user fault.",
  "markResourceMaintenance": false
}
```

**Response 200**: `{ "Incident" }`

**Errors**: `404`, `403`, `422 REASON_REQUIRED`

---

## Trust Ledger

### GET /audit-events
**Description**: Filterable audit event list for current organisation.

**Auth**: Required

**Query Parameters**:
- `entity_type` (string) — `RESOURCE` | `BOOKING` | `CONDITION_REPORT` | `INCIDENT` | `POLICY` | `USER_ROLE` | `TRAINING` | `LEDGER`
- `entity_id` (string) — Partial match on entityId or metadata.bookingId
- `actor_id` (string) — Filter by actor
- `action` (string) — Partial match on action name

**Response 200**:
```json
{
  "events": [{ "LedgerEvent" }],
  "lastVerifiedAt": "2026-10-29T10:00:00.000Z",
  "headSeq": 42,
  "headHash": "abc123..."
}
```

### GET /audit-events/verify
**Description**: Verify the hash chain for current organisation.

**Auth**: Required

**Roles**: `ADMIN`, `MANAGER`

**Response 200**: `{ "LedgerVerificationResult" }`

### POST /audit-events/simulate-tamper
**Description**: Demo only — mutate a historical event to demonstrate tamper detection.

**Auth**: Required

**Roles**: `ADMIN`, `MANAGER`

**Response 200**: `{ "tamperedSeq": 5 }`

### POST /audit-events/repair
**Description**: Demo only — recompute the chain after tampering.

**Auth**: Required

**Roles**: `ADMIN`, `MANAGER`

**Response 200**: `{ "LedgerVerificationResult" }`

---

## Policies

### GET /policies
**Description**: List all policies and versions for current organisation.

**Auth**: Required

**Roles**: `OWNER`, `ADMIN`

**Response 200**:
```json
{ "policies": [{ "Policy" }], "versions": [{ "PolicyVersion" }] }
```

### POST /policies/{policyId}/versions
**Description**: Create a new policy version, optionally activate immediately.

**Auth**: Required

**Roles**: `OWNER`, `ADMIN`

**Request**:
```json
{
  "definition": {
    "windowDays": 7,
    "maxHoursPerUser": 4,
    "appliesToRoles": ["USER"],
    "maxBookingDurationHours": 3,
    "requireVerifiedAccount": true,
    "requireTrainingKey": "PRINTER_3D_SAFETY",
    "plainSummary": "Max 4h/week, 3h/session, 3D printer safety required."
  },
  "reason": "Tightened cap due to increased demand.",
  "activateImmediately": true
}
```

**Response 201**:
```json
{ "policy": { "Policy" }, "version": { "PolicyVersion" } }
```

**Errors**: `404 POLICY_NOT_FOUND`, `403`, `422 REASON_REQUIRED`

### POST /policies/preview
**Description**: Dry-run a draft policy against a sample request.

**Auth**: Required

**Roles**: `OWNER`, `ADMIN`

**Request**:
```json
{
  "policyId": "pol_3d_cap",
  "draftDefinition": { "maxHoursPerUser": 4, "windowDays": 7, "plainSummary": "..." },
  "sampleUserId": "usr_diya",
  "sampleResourceId": "res_3dprinter",
  "sampleDurationHours": 3
}
```

**Response 200**:
```json
{
  "beforeResult": { "EligibilityEvaluationResult" },
  "afterResult": { "EligibilityEvaluationResult" },
  "sampleUser": { "User" },
  "sampleResource": { "Resource" }
}
```

---

## Assets & QR

### GET /assets/scan/{qrToken}
**Description**: Scan a QR token — returns asset, resource, and contextual allowed actions.

**Auth**: Required

**Response 200**:
```json
{
  "asset": { "Asset" },
  "resource": { "Resource" },
  "allowedActions": [
    { "type": "CHECK_IN", "label": "Start check-in", "bookingId": "bkg_123", "description": "..." },
    { "type": "VIEW_RESOURCE", "label": "View resource", "description": "..." }
  ],
  "explanation": "Authenticated as Aarav Menon (USER). Showing contextual actions..."
}
```

**Errors**: `404 QR_TOKEN_NOT_FOUND`, `403` (cross-tenant)

### POST /resources/{resourceId}/assets
**Description**: Register an additional physical asset unit for a resource.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Request**:
```json
{ "assetTag": "NIT-EL-OSC-002", "serialNumber": "C042919" }
```

**Response 201**: `{ "Asset" }`

---

## Notifications

### GET /notifications
**Description**: Get current user's notifications.

**Auth**: Required

**Response 200**: `[{ "Notification" }]`

### POST /notifications/{notificationId}/read
**Description**: Mark notification as read.

**Auth**: Required

**Response 200**: `{ "Notification" }`

### POST /notifications/read-all
**Description**: Mark all notifications as read.

**Auth**: Required

**Response 204**: No content

---

## Admin: Users, Roles, Training

### GET /admin/users
**Description**: Get organisation user directory with training records.

**Auth**: Required

**Roles**: `ADMIN`, `MANAGER`, `OWNER`

**Response 200**:
```json
{ "users": [{ "User" }], "trainings": [{ "TrainingRecord" }], "organization": { "Organization" } }
```

### GET /profile/data
**Description**: Get current user's profile, trainings, and usage by resource.

**Auth**: Required

**Response 200**:
```json
{
  "user": { "User" },
  "organization": { "Organization" },
  "trainings": [{ "TrainingRecord" }],
  "usageByResource": [{ "resourceId", "resourceName", "hoursUsed7d" }]
}
```

### PATCH /admin/users/{userId}/roles
**Description**: Update user role assignments (admin only).

**Auth**: Required

**Roles**: `ADMIN`

**Request**:
```json
{ "roles": ["USER", "MANAGER"], "reason": "Promoted to lab manager for Electronics Dept." }
```

**Response 200**: `{ "User" }`

**Errors**: `404`, `403`, `422 REASON_REQUIRED`

### POST /admin/users/{userId}/training
**Description**: Verify or update a user's training record.

**Auth**: Required

**Roles**: `ADMIN`, `MANAGER`, `OWNER`

**Request**:
```json
{
  "trainingType": "PRINTER_3D_SAFETY",
  "label": "Additive Manufacturing & Thermal Safety Induction (AM-201)",
  "status": "VERIFIED",
  "source": "Makerspace Practical Checkoff · Cert #AM-2026-320",
  "reason": "Completed 45-min induction and practical assessment."
}
```

**Response 200**: `{ "TrainingRecord" }`

**Errors**: `404`, `403`, `422`

### POST /profile/training/request
**Description**: Request training enrollment/verification (self-service).

**Auth**: Required

**Request**:
```json
{ "trainingType": "PRINTER_3D_SAFETY", "label": "Additive Manufacturing & Thermal Safety Induction (AM-201)" }
```

**Response 200**: `{ "TrainingRecord" }` (status: `PENDING`)

---

## Analytics

### GET /analytics/utilisation
**Description**: Get utilisation and fairness metrics for current organisation.

**Auth**: Required

**Roles**: `OWNER`, `MANAGER`, `ADMIN`

**Response 200**:
```json
{
  "resourceMetrics": [{
    "resourceId": "res_oscilloscope",
    "name": "Digital Oscilloscope",
    "category": "ELECTRONICS",
    "bookedHours": 24.5,
    "availableHours": 40,
    "utilisationPct": 61,
    "waitlistedCount": 2,
    "incidentCount": 1
  }],
  "fairnessByUser": [{
    "userId": "usr_aarav",
    "name": "Aarav Menon",
    "academicGroup": "UNDERGRAD_CAPSTONE",
    "bookedHours": 8.0,
    "sharePct": 35,
    "requestsCount": 3
  }],
  "demandByHourBlock": [{
    "block": "14:00–17:00",
    "electronics": 11,
    "mediaComputing": 9,
    "spaces": 5
  }],
  "outcomeCounts": [{ "status": "APPROVED", "count": 12 }, { "status": "WAITLISTED", "count": 3 }]
}
```

---

## AI Assistive (Optional — Tier 2)

### POST /api/ai/parse-query
**Description**: Natural-language resource discovery → structured filters (Gemini 4 Argon High Thinking).

**Auth**: Optional (works without auth for public catalog)

**Request**:
```json
{
  "query": "I need an oscilloscope to measure PWM switching on a buck converter",
  "resourcesSummary": [{ "id": "res_oscilloscope", "name": "Digital Oscilloscope", "category": "ELECTRONICS", "description": "...", "location": "Lab B-102" }]
}
```

**Response 200**:
```json
{
  "category": "ELECTRONICS",
  "keywords": ["oscilloscope", "PWM", "buck converter", "switching"],
  "matches": [{ "resourceId": "res_oscilloscope", "reason": "Measures time-domain voltage waveforms and PWM switching transients" }],
  "reasoningSummary": "User needs time-domain measurement of switching power supply signals...",
  "source": "Gemini 4 Argon (High Thinking · Reconciled against DB)"
}
```

**Errors**: `503 AI_UNAVAILABLE` (client falls back to deterministic parser)

### POST /api/ai/structure-incident
**Description**: Structure raw incident notes into draft fields (Gemini 4 Argon High Thinking).

**Auth**: Required

**Request**:
```json
{ "rawNotes": "The probe tip got bent when I was packing up", "resourceName": "Digital Multimeter Kit" }
```

**Response 200**:
```json
{
  "category": "Damage / suspected damage",
  "reportedStage": "Return inspection",
  "affectedPart": "TL75 Red Test Lead probe tip",
  "structuredDescription": "Reported observation on Digital Multimeter Kit (Return inspection): The probe tip got bent when I was packing up. Logged as an unverified allegation for technician review.",
  "suggestedCheckpoints": ["Inspect probe tip physically...", "Compare against prior check-in..."],
  "requiresHumanReview": true,
  "source": "gemini-4-argon (High Thinking)"
}
```

**Errors**: `503 AI_UNAVAILABLE` (client falls back to deterministic structurer)

---

## Core Schemas (Reference)

### User
```json
{
  "id": "usr_aarav",
  "organizationId": "org_nit",
  "name": "Aarav Menon",
  "email": "aarav.menon@nit.edu.in",
  "roles": ["USER"],
  "department": "Electrical & Electronics Engineering",
  "academicGroup": "UNDERGRAD_CAPSTONE",
  "verification": "VERIFIED",
  "demoPersonaNote": "Student — Electronics induction COMPLETED..."
}
```

### Organization
```json
{
  "id": "org_nit",
  "name": "Nilgiri Institute of Technology",
  "domain": "nit.edu.in",
  "departmentCode": "NIT-CAMPUS-OPS",
  "timezone": "Asia/Kolkata",
  "retentionDays": 365
}
```

### Resource
```json
{
  "id": "res_oscilloscope",
  "organizationId": "org_nit",
  "ownerId": "usr_meera",
  "ownerName": "Dr. Meera Iyer (Electronics Dept)",
  "department": "Electrical & Electronics Engineering",
  "name": "Digital Oscilloscope (Tektronix TBS2000B)",
  "modelNumber": "TEK-TBS2104B-200MHz",
  "category": "ELECTRONICS",
  "illustrationType": "oscilloscope",
  "location": "Electronics Lab B-102 · Bench 04",
  "accessInstructions": "Present approved booking ID to Technician Ravi Kulkarni...",
  "description": "200 MHz bandwidth, 4-channel digital storage oscilloscope...",
  "condition": "EXCELLENT",
  "status": "PUBLISHED",
  "requirements": [
    { "key": "req_osc_training", "type": "TRAINING", "label": "Electronics Lab Safety & Bench Induction (EL-101)", "value": "ELECTRONICS_INDUCTION" },
    { "key": "req_osc_membership", "type": "MEMBERSHIP", "label": "Verified Nilgiri Institute of Technology Membership", "value": "org_nit" },
    { "key": "req_osc_approval", "type": "APPROVAL", "label": "Technician / Owner Review Required", "value": "MANAGER_REVIEW" }
  ],
  "supervision": "STAFF_CONFIRMATION",
  "accessories": ["4x TPP0200 200MHz Passive Voltage Probes", "..."],
  "usageRules": "Do not exceed 300V RMS CAT II...",
  "returnRules": "Coil all four probes...",
  "cancellationPolicy": "Cancel at least 2 hours before start time...",
  "availability": [{ "id": "av_osc_1", "resourceId": "res_oscilloscope", "dayOfWeek": "Mon–Sat", "start": "08:00", "end": "20:00", "recurrence": "WEEKLY" }],
  "policyIds": ["pol_org_elig", "pol_priority_fairness"]
}
```

### Booking
```json
{
  "id": "bkg_approved_aarav",
  "organizationId": "org_nit",
  "resourceId": "res_oscilloscope",
  "userId": "usr_aarav",
  "start": "2026-10-29T10:00:00.000Z",
  "end": "2026-10-29T13:00:00.000Z",
  "purpose": "Characterise buck-converter PWM switching...",
  "projectCode": "EE402-CAPSTONE-14",
  "teamMembers": ["Aarav Menon", "Vikram S."],
  "status": "APPROVED",
  "idempotencyKey": "idem_seed_approved_aarav",
  "policyVersionIds": ["pol_org_elig_v1", "pol_priority_fairness_v1"],
  "eligibilityChecks": [
    { "key": "account_verified", "label": "Account verification", "status": "PASS", "reason": "Verified institutional account..." },
    { "key": "req_osc_training", "label": "Electronics Lab Safety...", "status": "PASS", "reason": "Verified certificate #EL-2026-884." },
    { "key": "time_conflict", "label": "Schedule availability", "status": "PASS", "reason": "No overlapping confirmed reservations." },
    { "key": "usage_limit", "label": "Rolling usage limit", "status": "PASS", "reason": "Within allowed duration limits." },
    { "key": "req_osc_approval", "label": "Technician / Owner Review Required", "status": "REVIEW_REQUIRED", "reason": "Approved by Lab Manager Ravi Kulkarni." }
  ],
  "decisionReason": "All safety trainings verified. Bench 04 reserved for EE-402 Capstone.",
  "decidedBy": "usr_ravi",
  "decidedAt": "2026-10-29T04:00:00.000Z",
  "createdAt": "2026-10-28T22:00:00.000Z"
}
```

### EligibilityEvaluationResult
```json
{
  "eligible": true,
  "overallStatus": "REVIEW_REQUIRED",
  "checks": [{ "EligibilityCheck" }],
  "appliedPolicyVersionIds": ["pol_org_elig_v1", "pol_priority_fairness_v1"],
  "usageHoursInWindow": 2.0,
  "maxHoursAllowed": 6,
  "requestedHours": 3
}
```

### EligibilityCheck
```json
{
  "key": "req_osc_training",
  "label": "Electronics Lab Safety & Bench Induction (EL-101)",
  "status": "PASS",
  "reason": "Verified certificate #EL-2026-884 on file.",
  "nextStep": "Complete the 45-minute induction and ask a Lab Manager to verify."
}
```

### ConditionReport
```json
{
  "id": "cr_psu_checkin",
  "organizationId": "org_nit",
  "bookingId": "bkg_checked_out_aarav",
  "stage": "CHECK_IN",
  "condition": "EXCELLENT",
  "accessories": [{ "name": "3x Silicone Banana-to-Alligator Test Lead Pairs", "present": true }],
  "notes": "All three channels zeroed accurately; banana leads intact and clean.",
  "attachmentIds": ["att_seed_psu_checkin"],
  "attachmentHashes": ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  "acknowledgedRules": true,
  "reporterId": "usr_aarav",
  "reporterName": "Aarav Menon",
  "actualTimestamp": "2026-10-29T08:00:00.000Z",
  "staffConfirmedBy": "usr_aarav",
  "staffConfirmedAt": "2026-10-29T08:00:00.000Z",
  "createdAt": "2026-10-29T08:00:00.000Z"
}
```

### Incident
```json
{
  "id": "inc_open_01",
  "organizationId": "org_nit",
  "bookingId": "bkg_return_pending_diya",
  "resourceId": "res_multimeter",
  "reporterId": "usr_diya",
  "reporterName": "Diya Rao",
  "category": "Damage / suspected damage",
  "reportedStage": "Return inspection",
  "affectedPart": "TL75 Red Test Lead strain relief jacket",
  "description": "Outer silicone insulation on the red TL75 test lead has a 4mm superficial nick...",
  "attachmentIds": ["att_seed_dmm_return"],
  "attachmentHashes": ["8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"],
  "status": "UNDER_REVIEW",
  "reviewerId": "usr_ravi",
  "reviewerName": "Ravi Kulkarni",
  "resolutionOutcome": null,
  "resolution": null,
  "resolvedAt": null,
  "requiresHumanReview": true,
  "assistedDraftUsed": true,
  "comments": [{ "IncidentComment" }],
  "createdAt": "2026-10-29T09:00:00.000Z"
}
```

### LedgerEvent
```json
{
  "id": "led_nit_42_abc123",
  "organizationId": "org_nit",
  "seq": 42,
  "actorId": "usr_ravi",
  "actorName": "Ravi Kulkarni",
  "actorRole": "MANAGER",
  "action": "BOOKING_APPROVED",
  "entityType": "BOOKING",
  "entityId": "bkg_approved_aarav",
  "occurredAt": "2026-10-29T04:00:00.000Z",
  "reason": "All safety trainings verified. Bench 04 reserved for EE-402 Capstone.",
  "metadata": { "resourceId": "res_oscilloscope", "policyVersionIds": ["pol_org_elig_v1", "pol_priority_fairness_v1"] },
  "prevHash": "0000...abc123",
  "hash": "def456...7890ab"
}
```

### LedgerVerificationResult
```json
{
  "organizationId": "org_nit",
  "valid": true,
  "checkedCount": 42,
  "headSeq": 42,
  "headHash": "def456...7890ab",
  "verifiedAt": "2026-10-29T10:00:00.000Z"
}
```

### Policy
```json
{
  "id": "pol_3d_cap",
  "organizationId": "org_nit",
  "name": "3D Printer Weekly Rolling Usage Cap",
  "description": "Limits rolling 7-day booking hours per user on enclosed additive manufacturing equipment...",
  "scope": { "type": "RESOURCE", "id": "res_3dprinter", "label": "Resource: Prusa MK4S 3D Printer" },
  "kind": "USAGE_CAP",
  "status": "ACTIVE",
  "activeVersion": 1
}
```

### PolicyVersion
```json
{
  "id": "pol_3d_cap_v1",
  "organizationId": "org_nit",
  "policyId": "pol_3d_cap",
  "version": 1,
  "definition": {
    "windowDays": 7,
    "maxHoursPerUser": 6,
    "appliesToRoles": ["USER"],
    "maxBookingDurationHours": 4,
    "plainSummary": "Maximum 6 hours per user per rolling 7 days (max 4 hours per single session)."
  },
  "effectiveFrom": "2026-09-29T10:00:00.000Z",
  "createdBy": "usr_priya",
  "createdByName": "Priya Nair",
  "reason": "Ensure fair access across 45 enrolled capstone and design students."
}
```

### Asset
```json
{
  "id": "ast_osc_01",
  "organizationId": "org_nit",
  "resourceId": "res_oscilloscope",
  "assetTag": "NIT-EL-OSC-001",
  "serialNumber": "C042918",
  "qrToken": "qr_nit_osc_001_9f8a7b",
  "condition": "EXCELLENT",
  "status": "AVAILABLE",
  "lastCalibratedAt": "2026-10-14T10:00:00.000Z"
}
```

### Notification
```json
{
  "id": "notif_aarav_1",
  "organizationId": "org_nit",
  "userId": "usr_aarav",
  "type": "DECISION",
  "title": "Booking request approved",
  "message": "Your request for Digital Oscilloscope has been approved by Ravi Kulkarni. Ready for check-in.",
  "relatedEntityId": "bkg_approved_aarav",
  "relatedPath": "/bookings/bkg_approved_aarav",
  "outboxStatus": "DELIVERED",
  "createdAt": "2026-10-29T04:00:00.000Z",
  "readAt": null
}
```

### Attachment
```json
{
  "id": "att_seed_psu_checkin",
  "organizationId": "org_nit",
  "fileName": "rigol_dp832_front_panel_checkin.svg",
  "mimeType": "image/svg+xml",
  "sizeBytes": 18420,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "dataUrl": "data:image/svg+xml;utf8,...",
  "uploadedBy": "usr_aarav",
  "linkedEntityType": "CONDITION_REPORT",
  "linkedEntityId": "cr_psu_checkin",
  "confirmed": true,
  "createdAt": "2026-10-29T08:00:00.000Z"
}
```

---

## Enums Reference

### Role
`USER` | `OWNER` | `MANAGER` | `ADMIN`

### BookingStatus
`REQUESTED` | `NEEDS_INFORMATION` | `ELIGIBILITY_BLOCKED` | `PENDING_REVIEW` | `WAITLISTED` | `APPROVED` | `REJECTED` | `CANCELLED` | `CHECKED_OUT_TO_USER` | `RETURN_PENDING_CONFIRMATION` | `RETURNED` | `OVERDUE` | `CLOSED`

### ResourceStatus
`DRAFT` | `PUBLISHED` | `PAUSED` | `MAINTENANCE` | `ARCHIVED`

### ResourceCategory
`ELECTRONICS` | `MEDIA_COMPUTING` | `SPACE`

### SupervisionLevel
`NONE` | `STAFF_CONFIRMATION` | `STAFF_PRESENT`

### ConditionLevel
`EXCELLENT` | `GOOD` | `MINOR_WEAR` | `NEEDS_ATTENTION`

### IncidentStatus
`REPORTED` | `UNDER_REVIEW` | `AWAITING_INFO` | `RESOLVED`

### IncidentCategory
`Damage / suspected damage` | `Missing accessory` | `Late return` | `Safety concern` | `Booking conflict` | `Other`

### ResolutionOutcome
`NO_ISSUE_FOUND` | `MAINTENANCE_SCHEDULED` | `WEAR_AND_TEAR_LOGGED` | `TRAINING_REFRESH_RECOMMENDED` | `ACCESSORY_REPLACED`

### PolicyScopeType
`ORG` | `CATEGORY` | `RESOURCE`

### PolicyKind
`ELIGIBILITY` | `USAGE_CAP` | `PRIORITY` | `APPROVAL_CHAIN` | `CANCELLATION` | `RETURN_WINDOW`

### PolicyStatus
`DRAFT` | `ACTIVE` | `RETIRED`

### CheckStatus
`PASS` | `FAIL` | `REVIEW_REQUIRED` | `NOT_APPLICABLE`

### NotificationType
`DECISION` | `WAITLIST_CHANGE` | `CANCELLATION` | `UPCOMING_BOOKING` | `OVERDUE_RETURN` | `INCIDENT_UPDATE`

### LedgerEntityType
`RESOURCE` | `BOOKING` | `CONDITION_REPORT` | `INCIDENT` | `POLICY` | `USER_ROLE` | `TRAINING` | `LEDGER`

### AssetStatus
`AVAILABLE` | `IN_USE` | `MAINTENANCE`

### TrainingStatus
`VERIFIED` | `PENDING` | `EXPIRED` | `NONE`

---

*This contract is derived from the frontend TypeScript types and mock implementation. The live FastAPI backend must implement all endpoints with matching request/response shapes, error codes, and authentication/authorization semantics.*