import {
  Organization,
  User,
  TrainingRecord,
  Resource,
  Asset,
  Policy,
  PolicyVersion,
  Booking,
  BookingStatus,
  ConditionReport,
  Incident,
  Notification,
  Attachment,
  LedgerEvent,
  LedgerVerificationResult,
  EligibilityEvaluationResult,
  EligibilityCheck,
  Role,
  ConditionLevel,
} from '../lib/types';
import {
  SEED_ORGANIZATIONS,
  SEED_USERS,
  SEED_TRAININGS,
  SEED_POLICIES,
  SEED_POLICY_VERSIONS,
  SEED_RESOURCES,
  SEED_ASSETS,
  SEED_BOOKINGS,
  SEED_ATTACHMENTS,
  SEED_CONDITION_REPORTS,
  SEED_INCIDENTS,
  SEED_NOTIFICATIONS,
  INITIAL_RAW_LEDGER_EVENTS,
} from './seed';
import { computeLedgerEventHash, getDurationHours, sha256Hex } from '../lib/utils';

const STORAGE_KEY = 'sharespace_db_v1';
const SESSION_KEY = 'sharespace_session_user_id_v1';

export class MockApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface DatabaseState {
  organizations: Organization[];
  users: User[];
  trainings: TrainingRecord[];
  policies: Policy[];
  policyVersions: PolicyVersion[];
  resources: Resource[];
  assets: Asset[];
  bookings: Booking[];
  attachments: Attachment[];
  conditionReports: ConditionReport[];
  incidents: Incident[];
  notifications: Notification[];
  ledgerEvents: LedgerEvent[];
  lastLedgerVerifiedAt: Record<string, string>;
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ['PENDING_REVIEW', 'ELIGIBILITY_BLOCKED', 'CANCELLED', 'APPROVED'],
  NEEDS_INFORMATION: ['PENDING_REVIEW', 'CANCELLED', 'REJECTED'],
  ELIGIBILITY_BLOCKED: ['CANCELLED', 'PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'WAITLISTED', 'NEEDS_INFORMATION', 'CANCELLED'],
  WAITLISTED: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED', 'CHECKED_OUT_TO_USER', 'OVERDUE'],
  REJECTED: [],
  CANCELLED: [],
  CHECKED_OUT_TO_USER: ['RETURN_PENDING_CONFIRMATION', 'RETURNED', 'OVERDUE'],
  OVERDUE: ['RETURN_PENDING_CONFIRMATION', 'RETURNED'],
  RETURN_PENDING_CONFIRMATION: ['RETURNED', 'CLOSED'],
  RETURNED: ['CLOSED'],
  CLOSED: [],
};

const CONFIRMED_OCCUPYING_STATES: BookingStatus[] = [
  'APPROVED',
  'CHECKED_OUT_TO_USER',
  'RETURN_PENDING_CONFIRMATION',
  'OVERDUE',
];

let memoryDb: DatabaseState | null = null;
let initPromise: Promise<DatabaseState> | null = null;

async function buildInitialDatabase(): Promise<DatabaseState> {
  const ledgerEvents: LedgerEvent[] = [];
  const seqByOrg: Record<string, number> = {};
  const prevHashByOrg: Record<string, string> = {};

  for (const raw of INITIAL_RAW_LEDGER_EVENTS) {
    const orgId = raw.organizationId;
    const seq = (seqByOrg[orgId] || 0) + 1;
    const prevHash = prevHashByOrg[orgId] || '0'.repeat(64);
    const hash = await computeLedgerEventHash({
      prevHash,
      organizationId: orgId,
      seq,
      actorId: raw.actorId,
      action: raw.action,
      entityType: raw.entityType,
      entityId: raw.entityId,
      occurredAt: raw.occurredAt,
      reason: raw.reason,
      metadata: raw.metadata,
    });
    seqByOrg[orgId] = seq;
    prevHashByOrg[orgId] = hash;
    ledgerEvents.push({
      ...raw,
      seq,
      prevHash,
      hash,
    });
  }

  const nowIso = new Date().toISOString();
  return {
    organizations: structuredClone(SEED_ORGANIZATIONS),
    users: structuredClone(SEED_USERS),
    trainings: structuredClone(SEED_TRAININGS),
    policies: structuredClone(SEED_POLICIES),
    policyVersions: structuredClone(SEED_POLICY_VERSIONS),
    resources: structuredClone(SEED_RESOURCES),
    assets: structuredClone(SEED_ASSETS),
    bookings: structuredClone(SEED_BOOKINGS),
    attachments: structuredClone(SEED_ATTACHMENTS),
    conditionReports: structuredClone(SEED_CONDITION_REPORTS),
    incidents: structuredClone(SEED_INCIDENTS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    ledgerEvents,
    lastLedgerVerifiedAt: {
      org_nit: nowIso,
      org_harbour: nowIso,
    },
  };
}

export async function getDb(): Promise<DatabaseState> {
  if (memoryDb) return memoryDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DatabaseState;
        if (
          parsed &&
          Array.isArray(parsed.organizations) &&
          Array.isArray(parsed.users) &&
          Array.isArray(parsed.resources) &&
          Array.isArray(parsed.bookings) &&
          Array.isArray(parsed.ledgerEvents)
        ) {
          memoryDb = parsed;
          return memoryDb;
        }
      }
    } catch {
      // Fallback to fresh seed if localStorage is corrupt
    }
    memoryDb = await buildInitialDatabase();
    saveDb(memoryDb);
    return memoryDb;
  })();

  return initPromise;
}

export function saveDb(db: DatabaseState): void {
  memoryDb = db;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore storage quota errors in restricted environments
  }
}

export async function resetDemoDatabase(): Promise<DatabaseState> {
  initPromise = null;
  memoryDb = await buildInitialDatabase();
  saveDb(memoryDb);
  return memoryDb;
}

export function getSessionUserId(): string {
  try {
    return localStorage.getItem(SESSION_KEY) || 'usr_aarav';
  } catch {
    return 'usr_aarav';
  }
}

export function setSessionUserId(userId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, userId);
  } catch {
    // ignore
  }
}

export async function getAuthenticatedActor(): Promise<User> {
  const db = await getDb();
  const userId = getSessionUserId();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    throw new MockApiError(401, 'UNAUTHENTICATED', 'Please sign in with a valid account.');
  }
  return user;
}

export function requireRole(actor: User, allowedRoles: Role[], actionLabel: string): void {
  const hasRole = actor.roles.some((r) => allowedRoles.includes(r));
  if (!hasRole) {
    throw new MockApiError(
      403,
      'FORBIDDEN',
      `Permission denied: ${actionLabel} requires one of [${allowedRoles.join(', ')}]. Your active role is [${actor.roles.join(', ')}].`
    );
  }
}

export function enforceTenantMatch(actor: User, recordOrgId: string): void {
  if (actor.organizationId !== recordOrgId) {
    // Return 404 to avoid leaking cross-tenant record existence per RULES.md Section 2.9
    throw new MockApiError(
      404,
      'NOT_FOUND',
      'The requested record does not exist in your organisation boundary.'
    );
  }
}

export function validateTransition(from: BookingStatus, to: BookingStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new MockApiError(
      400,
      'INVALID_STATE_TRANSITION',
      `Cannot transition booking from ${from} to ${to}. Allowed next states: ${allowed.join(', ') || 'none'}.`
    );
  }
}

export function hasTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && sB < eA;
}

export async function appendLedgerEvent(
  db: DatabaseState,
  params: {
    organizationId: string;
    actor: User | null;
    action: string;
    entityType: LedgerEvent['entityType'];
    entityId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<LedgerEvent> {
  const orgEvents = db.ledgerEvents
    .filter((e) => e.organizationId === params.organizationId)
    .sort((a, b) => a.seq - b.seq);
  const lastEvent = orgEvents[orgEvents.length - 1];
  const seq = lastEvent ? lastEvent.seq + 1 : 1;
  const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
  const occurredAt = new Date().toISOString();
  const metadata = params.metadata || {};

  const hash = await computeLedgerEventHash({
    prevHash,
    organizationId: params.organizationId,
    seq,
    actorId: params.actor ? params.actor.id : null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    occurredAt,
    reason: params.reason,
    metadata,
  });

  const event: LedgerEvent = {
    id: `led_${params.organizationId}_${seq}_${Date.now().toString(36)}`,
    organizationId: params.organizationId,
    seq,
    actorId: params.actor ? params.actor.id : null,
    actorName: params.actor ? params.actor.name : 'System Worker',
    actorRole: params.actor ? params.actor.roles[0] : 'SYSTEM',
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    occurredAt,
    reason: params.reason,
    metadata,
    prevHash,
    hash,
  };

  db.ledgerEvents.push(event);
  return event;
}

export function addOutboxNotification(
  db: DatabaseState,
  params: {
    organizationId: string;
    userId: string;
    type: Notification['type'];
    title: string;
    message: string;
    relatedEntityId?: string;
    relatedPath?: string;
  }
): Notification {
  const notif: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedEntityId: params.relatedEntityId,
    relatedPath: params.relatedPath,
    outboxStatus: 'DELIVERED',
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(notif);
  return notif;
}

export function getRollingUsageHours(
  db: DatabaseState,
  userId: string,
  resourceId: string,
  windowDays = 7,
  excludeBookingId?: string
): number {
  const cutoff = Date.now() - windowDays * 24 * 3600 * 1000;
  const countedStates: BookingStatus[] = [
    'APPROVED',
    'CHECKED_OUT_TO_USER',
    'RETURN_PENDING_CONFIRMATION',
    'RETURNED',
    'OVERDUE',
    'CLOSED',
  ];

  const relevant = db.bookings.filter(
    (b) =>
      b.userId === userId &&
      b.resourceId === resourceId &&
      b.id !== excludeBookingId &&
      countedStates.includes(b.status) &&
      new Date(b.end).getTime() >= cutoff
  );

  const total = relevant.reduce((acc, b) => acc + getDurationHours(b.start, b.end), 0);
  return Math.round(total * 100) / 100;
}

export function resolveActivePoliciesForResource(
  db: DatabaseState,
  resource: Resource
): { policies: Policy[]; versions: PolicyVersion[] } {
  const orgPolicies = db.policies.filter(
    (p) =>
      p.organizationId === resource.organizationId &&
      p.status === 'ACTIVE' &&
      (p.scope.type === 'ORG' ||
        (p.scope.type === 'CATEGORY' && p.scope.id === resource.category) ||
        (p.scope.type === 'RESOURCE' && p.scope.id === resource.id) ||
        resource.policyIds.includes(p.id))
  );

  const versions: PolicyVersion[] = [];
  for (const pol of orgPolicies) {
    if (pol.activeVersion !== undefined) {
      const pv = db.policyVersions.find(
        (v) => v.policyId === pol.id && v.version === pol.activeVersion
      );
      if (pv) versions.push(pv);
    }
  }
  return { policies: orgPolicies, versions };
}

export function evaluateEligibilitySync(
  db: DatabaseState,
  user: User,
  resource: Resource,
  startIso: string,
  endIso: string,
  excludeBookingId?: string,
  draftPolicyOverride?: { policy: Policy; version: PolicyVersion }
): EligibilityEvaluationResult {
  const checks: EligibilityCheck[] = [];
  const { versions } = resolveActivePoliciesForResource(db, resource);

  const effectiveVersions = [...versions];
  if (draftPolicyOverride) {
    const idx = effectiveVersions.findIndex(
      (v) => v.policyId === draftPolicyOverride.policy.id
    );
    if (idx >= 0) {
      effectiveVersions[idx] = draftPolicyOverride.version;
    } else {
      effectiveVersions.push(draftPolicyOverride.version);
    }
  }

  // 1. Account Verification Check
  if (user.verification === 'VERIFIED') {
    checks.push({
      key: 'account_verified',
      label: 'Account verification',
      status: 'PASS',
      reason: `Verified institutional identity (${user.email}).`,
    });
  } else {
    checks.push({
      key: 'account_verified',
      label: 'Account verification',
      status: 'FAIL',
      reason: `Your account verification status is ${user.verification}.`,
      nextStep: 'Contact your institution administrator to complete identity verification.',
    });
  }

  // 2. Institution Membership Check
  if (user.organizationId === resource.organizationId) {
    const org = db.organizations.find((o) => o.id === resource.organizationId);
    checks.push({
      key: 'institution_membership',
      label: 'Institution membership',
      status: 'PASS',
      reason: `Active member of ${org?.name || resource.organizationId}.`,
    });
  } else {
    checks.push({
      key: 'institution_membership',
      label: 'Institution membership',
      status: 'FAIL',
      reason: 'Cross-organisation resource requests are not permitted without an inter-institutional agreement.',
      nextStep: 'Switch to a resource within your home organisation.',
    });
  }

  // 3. Resource Operational Status Check
  if (resource.status === 'PUBLISHED') {
    checks.push({
      key: 'resource_status',
      label: 'Resource operational status',
      status: 'PASS',
      reason: `Resource is PUBLISHED and condition is ${resource.condition}.`,
    });
  } else {
    checks.push({
      key: 'resource_status',
      label: 'Resource operational status',
      status: 'FAIL',
      reason: `Resource is currently ${resource.status} and cannot accept bookings.`,
      nextStep: 'Wait for the owner or lab manager to republish the resource.',
    });
  }

  // 4. Resource-specific Training & Qualification Requirements
  for (const req of resource.requirements) {
    if (req.type === 'TRAINING') {
      const tr = db.trainings.find(
        (t) => t.userId === user.id && t.type === req.value
      );
      if (tr && tr.status === 'VERIFIED') {
        const isExpired = tr.expiresAt && new Date(tr.expiresAt).getTime() < Date.now();
        if (!isExpired) {
          checks.push({
            key: req.key,
            label: req.label,
            status: 'PASS',
            reason: `Verified record on file (${tr.source}).`,
          });
        } else {
          checks.push({
            key: req.key,
            label: req.label,
            status: 'FAIL',
            reason: `Training certificate expired on ${tr.expiresAt?.slice(0, 10)}.`,
            nextStep: 'Complete refresher induction and ask a manager/admin to verify renewal.',
          });
        }
      } else {
        checks.push({
          key: req.key,
          label: req.label,
          status: 'FAIL',
          reason: `Mandatory training "${req.label}" is not verified on your profile (current status: ${tr?.status || 'NONE'}).`,
          nextStep: 'Enroll in the safety induction session or request verification in your Profile.',
        });
      }
    }
  }

  // 5. Time Window & Conflict Check
  const requestedHours = getDurationHours(startIso, endIso);
  if (requestedHours <= 0) {
    checks.push({
      key: 'time_validity',
      label: 'Requested time window',
      status: 'FAIL',
      reason: 'End time must be after start time.',
      nextStep: 'Select a valid start and end time.',
    });
  } else {
    const conflictingConfirmed = db.bookings.filter(
      (b) =>
        b.resourceId === resource.id &&
        b.id !== excludeBookingId &&
        CONFIRMED_OCCUPYING_STATES.includes(b.status) &&
        hasTimeOverlap(startIso, endIso, b.start, b.end)
    );

    if (conflictingConfirmed.length > 0) {
      checks.push({
        key: 'time_conflict',
        label: 'Schedule availability',
        status: 'REVIEW_REQUIRED',
        reason: `Overlaps an existing confirmed reservation (${conflictingConfirmed[0].id}). Request can be waitlisted or re-timed.`,
        nextStep: 'Choose an open slot or submit to join the priority waitlist.',
      });
    } else {
      checks.push({
        key: 'time_conflict',
        label: 'Schedule availability',
        status: 'PASS',
        reason: `No conflicting confirmed bookings for the requested ${requestedHours}h window.`,
      });
    }
  }

  // 6. Policy-driven Duration & Rolling Usage Cap Check
  // Most restrictive applicable rule wins per RULES.md Section 10A.5
  let maxSessionHours = 8;
  let maxRollingHours = 999;
  let windowDays = 7;
  let capPolicyLabel = 'Baseline Policy';

  for (const pv of effectiveVersions) {
    if (
      pv.definition.maxBookingDurationHours !== undefined &&
      pv.definition.maxBookingDurationHours < maxSessionHours
    ) {
      maxSessionHours = pv.definition.maxBookingDurationHours;
    }
    if (
      pv.definition.maxHoursPerUser !== undefined &&
      pv.definition.maxHoursPerUser < maxRollingHours
    ) {
      maxRollingHours = pv.definition.maxHoursPerUser;
      windowDays = pv.definition.windowDays || 7;
      capPolicyLabel = `${pv.policyId} v${pv.version}`;
    }
  }

  const usageHoursInWindow = getRollingUsageHours(
    db,
    user.id,
    resource.id,
    windowDays,
    excludeBookingId
  );

  if (requestedHours > maxSessionHours) {
    checks.push({
      key: 'session_duration',
      label: 'Single session duration limit',
      status: 'FAIL',
      reason: `Requested ${requestedHours}h exceeds maximum single-session limit of ${maxSessionHours}h.`,
      nextStep: `Shorten your booking duration to ${maxSessionHours} hours or less.`,
    });
  }

  if (maxRollingHours < 999) {
    const projectedTotal = Math.round((usageHoursInWindow + requestedHours) * 100) / 100;
    if (projectedTotal <= maxRollingHours) {
      checks.push({
        key: 'usage_limit',
        label: `Rolling ${windowDays}-day usage cap`,
        status: 'PASS',
        reason: `${usageHoursInWindow}h used this week + ${requestedHours}h requested = ${projectedTotal}h of ${maxRollingHours}h cap (${capPolicyLabel}).`,
      });
    } else {
      checks.push({
        key: 'usage_limit',
        label: `Rolling ${windowDays}-day usage cap`,
        status: 'FAIL',
        reason: `${usageHoursInWindow}h already used in rolling ${windowDays} days + ${requestedHours}h requested = ${projectedTotal}h, exceeding the ${maxRollingHours}h cap (${capPolicyLabel}).`,
        nextStep: `Reduce requested duration to ${Math.max(0, Math.round((maxRollingHours - usageHoursInWindow) * 100) / 100)}h or wait until earlier usage rolls off.`,
      });
    }
  } else {
    checks.push({
      key: 'usage_limit',
      label: 'Session duration & usage policy',
      status: 'PASS',
      reason: `Requested ${requestedHours}h is within the ${maxSessionHours}h session limit (${usageHoursInWindow}h used in last 7 days).`,
    });
  }

  // 7. Manual Approval / Supervision Check
  const requiresApprovalReq = resource.requirements.find((r) => r.type === 'APPROVAL');
  if (requiresApprovalReq || resource.supervision !== 'NONE') {
    checks.push({
      key: 'human_review',
      label: requiresApprovalReq ? requiresApprovalReq.label : 'Owner / Manager Review',
      status: 'REVIEW_REQUIRED',
      reason: 'Eligibility does not auto-approve access; an authorised owner or manager must review and confirm your request.',
      nextStep: 'Submit request to route to the manager review queue.',
    });
  }

  const hasFail = checks.some((c) => c.status === 'FAIL');
  const hasReview = checks.some((c) => c.status === 'REVIEW_REQUIRED');

  return {
    eligible: !hasFail,
    overallStatus: hasFail ? 'NOT_ELIGIBLE' : hasReview ? 'REVIEW_REQUIRED' : 'ELIGIBLE',
    checks,
    appliedPolicyVersionIds: effectiveVersions.map((v) => v.id),
    usageHoursInWindow,
    maxHoursAllowed: maxRollingHours < 999 ? maxRollingHours : maxSessionHours,
    requestedHours,
  };
}

// Deterministic Waitlist Promotion when a slot is freed
export async function promoteNextWaitlistedIfSlotOpen(
  db: DatabaseState,
  resourceId: string,
  freedStart: string,
  freedEnd: string,
  actor: User
): Promise<Booking | null> {
  const waitlisted = db.bookings
    .filter(
      (b) =>
        b.resourceId === resourceId &&
        b.status === 'WAITLISTED' &&
        hasTimeOverlap(freedStart, freedEnd, b.start, b.end)
    )
    .sort((a, b) => (a.waitlistPosition || 99) - (b.waitlistPosition || 99));

  if (waitlisted.length === 0) return null;

  const promoted = waitlisted[0];
  promoted.status = 'PENDING_REVIEW';
  promoted.waitlistPosition = undefined;
  promoted.waitlistReason = 'Promoted from #1 on waitlist after conflicting reservation was released.';

  // Re-number remaining waitlisted requests for this resource
  waitlisted.slice(1).forEach((w, idx) => {
    w.waitlistPosition = idx + 1;
  });

  await appendLedgerEvent(db, {
    organizationId: promoted.organizationId,
    actor,
    action: 'WAITLIST_PROMOTED',
    entityType: 'BOOKING',
    entityId: promoted.id,
    reason: 'Slot released; top waitlisted request promoted to PENDING_REVIEW.',
    metadata: { resourceId, promotedUserId: promoted.userId },
  });

  addOutboxNotification(db, {
    organizationId: promoted.organizationId,
    userId: promoted.userId,
    type: 'WAITLIST_CHANGE',
    title: 'Promoted from waitlist',
    message: `A time slot opened for your waitlisted request (${promoted.id}). Your request is now first in the manager review queue.`,
    relatedEntityId: promoted.id,
    relatedPath: `/bookings/${promoted.id}`,
  });

  return promoted;
}

// Verify hash chain for an organisation
export async function verifyOrganizationLedgerChain(
  organizationId: string
): Promise<LedgerVerificationResult> {
  const db = await getDb();
  const events = db.ledgerEvents
    .filter((e) => e.organizationId === organizationId)
    .sort((a, b) => a.seq - b.seq);

  let expectedPrevHash = '0'.repeat(64);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = i + 1;
    if (ev.seq !== expectedSeq) {
      return {
        organizationId,
        valid: false,
        checkedCount: i + 1,
        headSeq: events[events.length - 1]?.seq || 0,
        headHash: events[events.length - 1]?.hash || '',
        verifiedAt: new Date().toISOString(),
        firstInvalidSeq: ev.seq,
        errorDetails: `Sequence gap detected at event #${ev.seq} (expected #${expectedSeq}).`,
      };
    }

    if (ev.prevHash !== expectedPrevHash) {
      return {
        organizationId,
        valid: false,
        checkedCount: i + 1,
        headSeq: events[events.length - 1]?.seq || 0,
        headHash: events[events.length - 1]?.hash || '',
        verifiedAt: new Date().toISOString(),
        firstInvalidSeq: ev.seq,
        errorDetails: `Previous-hash link mismatch at sequence #${ev.seq}.`,
      };
    }

    const recomputed = await computeLedgerEventHash({
      prevHash: ev.prevHash,
      organizationId: ev.organizationId,
      seq: ev.seq,
      actorId: ev.actorId,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      occurredAt: ev.occurredAt,
      reason: ev.reason,
      metadata: ev.metadata,
    });

    if (recomputed !== ev.hash) {
      return {
        organizationId,
        valid: false,
        checkedCount: i + 1,
        headSeq: events[events.length - 1]?.seq || 0,
        headHash: events[events.length - 1]?.hash || '',
        verifiedAt: new Date().toISOString(),
        firstInvalidSeq: ev.seq,
        errorDetails: `SHA-256 content hash mismatch at sequence #${ev.seq} (${ev.id}). Stored payload was modified after creation.`,
      };
    }

    expectedPrevHash = ev.hash;
  }

  const nowIso = new Date().toISOString();
  db.lastLedgerVerifiedAt[organizationId] = nowIso;
  saveDb(db);

  return {
    organizationId,
    valid: true,
    checkedCount: events.length,
    headSeq: events[events.length - 1]?.seq || 0,
    headHash: events[events.length - 1]?.hash || '0'.repeat(64),
    verifiedAt: nowIso,
  };
}

// Simulate tampering with a historical event in the ledger (Admin demo capability)
export async function simulateLedgerTamper(organizationId: string): Promise<{ tamperedSeq: number }> {
  const db = await getDb();
  const orgEvents = db.ledgerEvents
    .filter((e) => e.organizationId === organizationId)
    .sort((a, b) => a.seq - b.seq);

  const target = orgEvents[Math.min(3, orgEvents.length - 1)];
  if (!target) {
    throw new MockApiError(400, 'EMPTY_LEDGER', 'No ledger events to tamper with.');
  }

  target.reason = `[TAMPERED IN MEMORY] ${target.reason || ''} (unauthorised edit)`;
  saveDb(db);
  return { tamperedSeq: target.seq };
}

export async function repairOrganizationLedgerChain(organizationId: string): Promise<LedgerVerificationResult> {
  const db = await getDb();
  const orgEvents = db.ledgerEvents
    .filter((e) => e.organizationId === organizationId)
    .sort((a, b) => a.seq - b.seq);

  let prevHash = '0'.repeat(64);
  for (let i = 0; i < orgEvents.length; i++) {
    const ev = orgEvents[i];
    ev.seq = i + 1;
    if (ev.reason?.startsWith('[TAMPERED IN MEMORY] ')) {
      ev.reason = ev.reason
        .replace('[TAMPERED IN MEMORY] ', '')
        .replace(' (unauthorised edit)', '');
    }
    ev.prevHash = prevHash;
    ev.hash = await computeLedgerEventHash({
      prevHash: ev.prevHash,
      organizationId: ev.organizationId,
      seq: ev.seq,
      actorId: ev.actorId,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      occurredAt: ev.occurredAt,
      reason: ev.reason,
      metadata: ev.metadata,
    });
    prevHash = ev.hash;
  }

  saveDb(db);
  return verifyOrganizationLedgerChain(organizationId);
}

// Deterministic fallback for natural-language resource discovery query parsing
export function deterministicParseDiscoveryQuery(
  query: string,
  resources: Resource[]
): {
  category: string;
  keywords: string[];
  matches: Array<{ resourceId: string; reason: string }>;
  reasoningSummary: string;
  source: string;
} {
  const q = query.toLowerCase().trim();
  const stopWords = new Set(['the', 'and', 'for', 'with', 'need', 'want', 'can', 'use', 'project', 'our', 'some', 'about']);
  const tokens = q
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  let category = 'ALL';
  if (/voltage|current|circuit|solder|pcb|oscilloscope|probe|signal|waveform|pwm|ringing|transient|multimeter|dmm|power\s*supply|rigol|fluke|keysight/.test(q)) {
    category = 'ELECTRONICS';
  } else if (/camera|video|photo|film|light|tripod|lens|shoot|interview|gpu|render|cuda|compute|rtx|print|3d|printer|enclosure|filament|pla|petg|prusa|extruder|fdm/.test(q)) {
    category = 'MEDIA_COMPUTING';
  } else if (/room|meeting|space|team|whiteboard|presentation|discuss|conference|collab/.test(q)) {
    category = 'SPACE';
  }

  interface ScoredMatch {
    resourceId: string;
    score: number;
    reason: string;
  }

  const scored: ScoredMatch[] = [];

  for (const r of resources) {
    const rawType = (r.illustrationType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const haystack = `${r.name} ${r.description} ${r.category} ${r.location} ${(r.accessories || []).join(' ')} ${rawType}`.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // Specific intent patterns
    // 1. PWM, Waveform, Signal, Oscilloscope
    if (/pwm|waveform|ringing|transient|signal\s*analysis|bandwidth|nanosecond|duty\s*cycle/.test(q)) {
      if (rawType.includes('oscilloscope') || r.id === 'res_scope' || r.id === 'res_oscilloscope' || r.name.toLowerCase().includes('oscilloscope')) {
        score += 130;
        reasons.push('Measures time-domain waveforms, PWM duty cycles, ringing transients, and signal integrity');
      } else if (rawType.includes('multimeter') || r.id === 'res_dmm' || r.id === 'res_multimeter' || r.name.toLowerCase().includes('multimeter')) {
        score += 40;
        reasons.push('Can measure True-RMS voltage, frequency, and duty cycle (secondary instrument)');
      } else if (rawType.includes('power') || r.id === 'res_psu' || r.id === 'res_powersupply') {
        score += 25;
        reasons.push('Supplies DC bench power to test PWM circuits under load');
      }
    }

    // 2. Voltage, Current, Continuity, Multimeter
    if (/voltage|current|continuity|true-rms|multimeter|resistance|dmm/.test(q) && !/pwm|waveform|ringing/.test(q)) {
      if (rawType.includes('multimeter') || r.id === 'res_dmm' || r.id === 'res_multimeter') {
        score += 120;
        reasons.push('Measures True-RMS AC/DC voltage, current, continuity, and resistance');
      } else if (rawType.includes('oscilloscope') || r.id === 'res_scope' || r.id === 'res_oscilloscope') {
        score += 80;
        reasons.push('Visualizes voltage waveforms and peak-to-peak amplitude over time');
      } else if (rawType.includes('power') || r.id === 'res_psu' || r.id === 'res_powersupply') {
        score += 55;
        reasons.push('Supplies programmable voltage and current limits');
      }
    }

    // 3. Tripod & Camera Stabilization
    if (/tripod|fluid\s*head|carbon\s*fiber|mount|stabiliz/.test(q)) {
      if (rawType.includes('tripod') || r.id === 'res_tripod' || r.name.toLowerCase().includes('tripod')) {
        score += 160;
        reasons.push('Carbon fiber video tripod with 504HD fluid head for stable pan/tilt and smooth video framing');
      } else if (rawType.includes('camera') || r.id === 'res_camera') {
        score += 35;
        reasons.push('Compatible cinema camera for tripod mounting');
      }
    }

    // 4. Video, Cinema Camera, 4K, Interview, Photography
    if (/camera|video|shoot|film|interview|lens|4k|cinema|record|photo/.test(q) && !/tripod/.test(q)) {
      if (rawType.includes('camera') || r.id === 'res_camera' || r.name.toLowerCase().includes('camera')) {
        score += 140;
        reasons.push('Full-frame 4K cinema camera with 24-70mm f/2.8 lens for high-definition video capture and interviews');
      } else if (rawType.includes('tripod') || r.id === 'res_tripod') {
        score += 45;
        reasons.push('Essential video accessory for stable studio and location camera setups');
      }
    }

    // 5. 3D Print, Enclosure, Prototype, PLA, PETG
    if (/print|3d|enclosure|prototype|pla|petg|filament|extruder|prusa/.test(q)) {
      if (rawType.includes('printer') || r.id === 'res_3dprint' || r.id === 'res_3dprinter' || r.name.toLowerCase().includes('printer')) {
        score += 150;
        reasons.push('FDM 3D printer for rapid prototyping of enclosures, brackets, and mechanical fixtures');
      }
    }

    // 6. Solder, PCB, Rework, Station
    if (/solder|rework|smd|flux|iron|hakko|desolder|pcb/.test(q)) {
      if (rawType.includes('solder') || r.id === 'res_soldering' || r.name.toLowerCase().includes('soldering')) {
        score += 150;
        reasons.push('Temperature-controlled soldering station with ESD safe iron for PCB assembly and repair');
      }
    }

    // 7. GPU, AI, ML, Deep Learning, Compute
    if (/gpu|cuda|ml|ai|deep\s*learning|train|compute|rtx|workstation|model/.test(q)) {
      if (rawType.includes('workstation') || r.id === 'res_gpu' || r.name.toLowerCase().includes('gpu')) {
        score += 150;
        reasons.push('Dual RTX 4090 GPUs with CUDA 12 support for training models and intensive scientific compute');
      }
    }

    // 8. Meeting Room, Space, Whiteboard, Team Review, Collaboration
    if (/room|meeting|space|whiteboard|team\s*review|discuss|collab|conference/.test(q)) {
      if (rawType.includes('project') || r.id === 'res_room204' || r.name.toLowerCase().includes('room 204')) {
        score += 120;
        reasons.push('Hardware project room with magnetic whiteboards, breakout seating, and ESD benches');
      } else if (rawType.includes('meeting') || r.id === 'res_meeting_b' || r.id === 'res_room_b' || r.name.toLowerCase().includes('conference')) {
        score += 110;
        reasons.push('Conference room equipped with 4K video display and hybrid collaboration facilities');
      }
    }

    // Keyword tokens matching in haystack
    for (const tok of tokens) {
      if (r.name.toLowerCase().includes(tok)) {
        score += 25;
      } else if (haystack.includes(tok)) {
        score += 10;
      }
    }

    // Match category alignment boost
    if (category !== 'ALL') {
      if (r.category === category) {
        score += 15;
      } else {
        score -= 25;
      }
    }

    if (score > 30) {
      const topReason = reasons[0] || `Technical match for "${q}" across specifications and equipment profile`;
      scored.push({
        resourceId: r.id,
        score,
        reason: `Assisted match: ${topReason}. Final availability and eligibility are evaluated by deterministic rules.`,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    category,
    keywords: tokens.slice(0, 6),
    matches: scored.map((s) => ({ resourceId: s.resourceId, reason: s.reason })),
    reasoningSummary: scored.length > 0
      ? `Identified ${scored.length} matching resources for "${query}". Top recommendation: ${scored[0].resourceId}.`
      : `No direct equipment matches found for "${query}". Try searching by category or equipment type.`,
    source: 'Deterministic Keyword Parser (Assisted Search)',
  };
}

// Deterministic fallback for structuring free-text incident notes
export function deterministicStructureIncident(
  rawNotes: string,
  resourceName: string
): {
  category: Incident['category'];
  reportedStage: string;
  affectedPart: string;
  structuredDescription: string;
  suggestedCheckpoints: string[];
  requiresHumanReview: true;
  source: string;
} {
  const lower = rawNotes.toLowerCase();
  let category: Incident['category'] = 'Damage / suspected damage';
  if (/missing|lost|absent|forgot|cap|cable not/.test(lower)) {
    category = 'Missing accessory';
  } else if (/late|delay|overdue|traffic|overrun/.test(lower)) {
    category = 'Late return';
  } else if (/smoke|spark|hot|burn|shock|unsafe|fume|smell/.test(lower)) {
    category = 'Safety concern';
  } else if (/occupied|locked|conflict|someone else/.test(lower)) {
    category = 'Booking conflict';
  }

  let reportedStage = 'Return inspection';
  if (/check-in|before|initial|when i arrived|start/.test(lower)) {
    reportedStage = 'Pre-use check-in';
  } else if (/during|while using|mid-print|operating/.test(lower)) {
    reportedStage = 'During operation';
  }

  let affectedPart = 'Primary assembly / accessory';
  const partMatch = rawNotes.match(/(probe|lead|cable|nozzle|bed|lens|battery|tripod|screen|fan|tip|connector|fuse|enclosure|keycard)/i);
  if (partMatch) {
    affectedPart = `${partMatch[1].charAt(0).toUpperCase() + partMatch[1].slice(1)} assembly on ${resourceName}`;
  } else {
    affectedPart = `${resourceName} unit / included accessory`;
  }

  return {
    category,
    reportedStage,
    affectedPart,
    structuredDescription: `Reported observation on ${resourceName} (${reportedStage}): ${rawNotes.trim()}. Logged as an unverified allegation for technician review.`,
    suggestedCheckpoints: [
      `Inspect ${affectedPart} physically before next scheduled handover.`,
      'Compare against the prior check-in condition report and attached photo hashes.',
      'Record human reviewer finding before changing resource operational status.',
    ],
    requiresHumanReview: true,
    source: 'Assisted Report Structurer (Requires User Confirmation)',
  };
}

export { sha256Hex };
