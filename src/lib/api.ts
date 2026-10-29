import {
  User,
  Organization,
  TrainingRecord,
  Resource,
  Asset,
  Booking,
  BookingStatus,
  ConditionReport,
  Incident,
  LedgerEvent,
  LedgerVerificationResult,
  Policy,
  PolicyVersion,
  Notification,
  Attachment,
  EligibilityEvaluationResult,
  Role,
  ConditionLevel,
} from './types';
import {
  getDb,
  saveDb,
  resetDemoDatabase,
  getAuthenticatedActor,
  setSessionUserId,
  requireRole,
  enforceTenantMatch,
  validateTransition,
  hasTimeOverlap,
  appendLedgerEvent,
  addOutboxNotification,
  evaluateEligibilitySync,
  promoteNextWaitlistedIfSlotOpen,
  verifyOrganizationLedgerChain,
  simulateLedgerTamper,
  repairOrganizationLedgerChain,
  deterministicParseDiscoveryQuery,
  deterministicStructureIncident,
  getRollingUsageHours,
  MockApiError,
  sha256Hex,
} from '../mocks/server';
import { getDurationHours } from './utils';

const API_MODE = import.meta.env.VITE_API_MODE || 'mock';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function liveFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sharespace_token') : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errDetail = typeof data?.detail === 'object' && !Array.isArray(data?.detail)
      ? data.detail
      : {
          code: `HTTP_${res.status}`,
          message: typeof data?.detail === 'string' ? data.detail : (res.statusText || 'Request failed'),
        };
    const errObj = data?.error || errDetail;
    throw new MockApiError(res.status, errObj.code || `HTTP_${res.status}`, errObj.message || 'Request failed', errObj.details);
  }
  return data as T;
}

export const api = {
  getMode(): 'mock' | 'live' {
    return API_MODE === 'live' ? 'live' : 'mock';
  },

  // --- AUTH ---
  async getMe(): Promise<{ user: User; organization: Organization; allDemoUsers: User[]; allOrganizations: Organization[] }> {
    if (API_MODE === 'live') {
      return liveFetch('/me');
    }
    const db = await getDb();
    const user = await getAuthenticatedActor();
    const organization = db.organizations.find((o) => o.id === user.organizationId)!;
    return {
      user: structuredClone(user),
      organization: structuredClone(organization),
      allDemoUsers: structuredClone(db.users),
      allOrganizations: structuredClone(db.organizations),
    };
  },

  async demoLogin(userId: string): Promise<{ user: User; organization: Organization }> {
    if (API_MODE === 'live') {
      const res = await liveFetch<{ user: User; organization: Organization; token?: string }>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      if (res.token && typeof window !== 'undefined') {
        localStorage.setItem('sharespace_token', res.token);
      }
      return res;
    }
    const db = await getDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new MockApiError(404, 'USER_NOT_FOUND', 'Demo account not found.');
    }
    setSessionUserId(user.id);
    const organization = db.organizations.find((o) => o.id === user.organizationId)!;
    return {
      user: structuredClone(user),
      organization: structuredClone(organization),
    };
  },

  async resetDemoData(): Promise<void> {
    if (API_MODE === 'live') {
      await liveFetch('/auth/reset-demo', { method: 'POST' });
      return;
    }
    await resetDemoDatabase();
  },

  // --- RESOURCES ---
  async getResources(filters?: {
    search?: string;
    category?: string;
    status?: string;
    supervision?: string;
    trainingRequired?: boolean;
  }): Promise<Resource[]> {
    if (API_MODE === 'live') {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.category && filters.category !== 'ALL') params.set('category', filters.category);
      return liveFetch(`/resources?${params.toString()}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    let list = db.resources.filter((r) => r.organizationId === actor.organizationId);

    if (filters?.category && filters.category !== 'ALL') {
      list = list.filter((r) => r.category === filters.category);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters?.supervision && filters.supervision !== 'ALL') {
      list = list.filter((r) => r.supervision === filters.supervision);
    }
    if (filters?.trainingRequired !== undefined) {
      list = list.filter((r) =>
        filters.trainingRequired
          ? r.requirements.some((req) => req.type === 'TRAINING')
          : !r.requirements.some((req) => req.type === 'TRAINING')
      );
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          (r.modelNumber || '').toLowerCase().includes(q)
      );
    }
    return structuredClone(list);
  },

  async getResource(resourceId: string): Promise<{
    resource: Resource;
    assets: Asset[];
    activePolicies: { policy: Policy; version?: PolicyVersion }[];
    waitlistCount: number;
  }> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    }
    enforceTenantMatch(actor, resource.organizationId);

    const assets = db.assets.filter(
      (a) => a.resourceId === resource.id && a.organizationId === actor.organizationId
    );
    const activePolicies = db.policies
      .filter(
        (p) =>
          p.organizationId === actor.organizationId &&
          p.status === 'ACTIVE' &&
          (p.scope.type === 'ORG' ||
            (p.scope.type === 'RESOURCE' && p.scope.id === resource.id) ||
            resource.policyIds.includes(p.id))
      )
      .map((policy) => ({
        policy,
        version: db.policyVersions.find(
          (v) => v.policyId === policy.id && v.version === policy.activeVersion
        ),
      }));

    const waitlistCount = db.bookings.filter(
      (b) => b.resourceId === resource.id && b.status === 'WAITLISTED'
    ).length;

    return structuredClone({
      resource,
      assets,
      activePolicies,
      waitlistCount,
    });
  },

  async createResource(payload: Omit<Resource, 'id' | 'organizationId' | 'ownerId' | 'ownerName'>): Promise<Resource> {
    if (API_MODE === 'live') {
      return liveFetch('/resources', { method: 'POST', body: JSON.stringify(payload) });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Create resource');

    if (!payload.name?.trim() || !payload.location?.trim()) {
      throw new MockApiError(422, 'VALIDATION_ERROR', 'Resource name and location are required.');
    }

    const newRes: Resource = {
      ...payload,
      id: `res_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      ownerId: actor.id,
      ownerName: `${actor.name} (${actor.department})`,
    };

    db.resources.unshift(newRes);

    // Create default unit asset with QR token
    const assetTag = `NIT-${newRes.category.slice(0, 2)}-${Math.floor(100 + Math.random() * 899)}`;
    db.assets.push({
      id: `ast_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      resourceId: newRes.id,
      assetTag,
      serialNumber: `SN-${Date.now().toString().slice(-6)}`,
      qrToken: `qr_${actor.organizationId}_${Date.now().toString(36)}`,
      condition: newRes.condition,
      status: 'AVAILABLE',
      lastCalibratedAt: new Date().toISOString(),
    });

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'RESOURCE_CREATED',
      entityType: 'RESOURCE',
      entityId: newRes.id,
      reason: `Created resource listing "${newRes.name}" in status ${newRes.status}.`,
      metadata: { category: newRes.category, supervision: newRes.supervision, status: newRes.status },
    });

    saveDb(db);
    return structuredClone(newRes);
  },

  async updateResource(
    resourceId: string,
    updates: Partial<Resource>,
    reason = 'Updated resource configuration and usage conditions.'
  ): Promise<Resource> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updates, reason }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Update resource');

    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    }
    enforceTenantMatch(actor, resource.organizationId);

    Object.assign(resource, updates, {
      id: resource.id,
      organizationId: resource.organizationId,
    });

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'RESOURCE_UPDATED',
      entityType: 'RESOURCE',
      entityId: resource.id,
      reason,
      metadata: { status: resource.status, condition: resource.condition },
    });

    saveDb(db);
    return structuredClone(resource);
  },

  async publishResource(
    resourceId: string,
    status: Resource['status'],
    reason: string
  ): Promise<Resource> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      });
    }
    if (!reason || !reason.trim()) {
      throw new MockApiError(422, 'REASON_REQUIRED', 'A reason is required when changing resource status.');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Change resource status');

    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) {
      throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    }
    enforceTenantMatch(actor, resource.organizationId);

    const prevStatus = resource.status;
    resource.status = status;

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: `RESOURCE_${status}`,
      entityType: 'RESOURCE',
      entityId: resource.id,
      reason,
      metadata: { previousStatus: prevStatus, newStatus: status },
    });

    saveDb(db);
    return structuredClone(resource);
  },

  async getResourceAvailability(resourceId: string): Promise<{ bookings: Booking[] }> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}/availability`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    enforceTenantMatch(actor, resource.organizationId);

    const bookings = db.bookings.filter(
      (b) =>
        b.resourceId === resourceId &&
        b.organizationId === actor.organizationId &&
        !['CANCELLED', 'REJECTED'].includes(b.status)
    );
    return structuredClone({ bookings });
  },

  async getResourceWaitlist(resourceId: string): Promise<Array<Booking & { userName: string }>> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}/waitlist`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    enforceTenantMatch(actor, resource.organizationId);

    const list = db.bookings
      .filter((b) => b.resourceId === resourceId && b.status === 'WAITLISTED')
      .sort((a, b) => (a.waitlistPosition || 99) - (b.waitlistPosition || 99))
      .map((b) => {
        const u = db.users.find((usr) => usr.id === b.userId);
        return {
          ...b,
          userName: u?.name || b.userId,
        };
      });

    return structuredClone(list);
  },

  // --- ELIGIBILITY & BOOKINGS ---
  async checkEligibilityPreview(params: {
    resourceId: string;
    start: string;
    end: string;
    userId?: string;
  }): Promise<EligibilityEvaluationResult> {
    if (API_MODE === 'live') {
      return liveFetch('/bookings/eligibility-check', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const resource = db.resources.find((r) => r.id === params.resourceId);
    if (!resource) throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    enforceTenantMatch(actor, resource.organizationId);

    const targetUser = params.userId
      ? db.users.find((u) => u.id === params.userId && u.organizationId === actor.organizationId) || actor
      : actor;

    return evaluateEligibilitySync(db, targetUser, resource, params.start, params.end);
  },

  async createBooking(payload: {
    resourceId: string;
    start: string;
    end: string;
    purpose: string;
    projectCode?: string;
    teamMembers?: string[];
    idempotencyKey: string;
    joinWaitlistIfConflict?: boolean;
  }): Promise<Booking> {
    if (API_MODE === 'live') {
      return liveFetch('/bookings', { method: 'POST', body: JSON.stringify(payload) });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();

    // Idempotency check per ARCHITECTURE.md Section 5
    if (payload.idempotencyKey) {
      const existing = db.bookings.find(
        (b) => b.userId === actor.id && b.idempotencyKey === payload.idempotencyKey
      );
      if (existing) {
        return structuredClone(existing);
      }
    }

    const resource = db.resources.find((r) => r.id === payload.resourceId);
    if (!resource) throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    enforceTenantMatch(actor, resource.organizationId);

    if (!payload.purpose || payload.purpose.trim().length < 8) {
      throw new MockApiError(
        422,
        'VALIDATION_ERROR',
        'Please provide a clear academic, research, or project purpose (at least 8 characters).'
      );
    }

    const evalResult = evaluateEligibilitySync(db, actor, resource, payload.start, payload.end);
    const hasMandatoryFail = evalResult.checks.some((c) => c.status === 'FAIL');
    const hasConflict = evalResult.checks.some(
      (c) => c.key === 'time_conflict' && c.status !== 'PASS'
    );

    if (hasConflict && !payload.joinWaitlistIfConflict) {
      throw new MockApiError(
        409,
        'SCHEDULE_CONFLICT',
        'The requested time slot overlaps an existing confirmed reservation. You can select another slot or submit to join the priority waitlist.'
      );
    }

    let initialStatus: BookingStatus = 'PENDING_REVIEW';
    let waitlistPosition: number | undefined;
    let waitlistReason: string | undefined;

    if (hasMandatoryFail) {
      initialStatus = 'ELIGIBILITY_BLOCKED';
    } else if (hasConflict && payload.joinWaitlistIfConflict) {
      initialStatus = 'WAITLISTED';
      const currentWaitlisted = db.bookings.filter(
        (b) => b.resourceId === resource.id && b.status === 'WAITLISTED'
      );
      waitlistPosition = currentWaitlisted.length + 1;
      waitlistReason = `Joined waitlist at position #${waitlistPosition} under published Policy POL-PRI-01 v1 while overlapping confirmed slot is active.`;
    }

    const nowIso = new Date().toISOString();
    const priorityGroupLabel =
      actor.academicGroup === 'UNDERGRAD_CAPSTONE'
        ? 'Undergraduate Capstone (Priority Tier 1)'
        : actor.academicGroup === 'GRAD_RESEARCH'
        ? 'Graduate Research (Priority Tier 1)'
        : 'General Coursework (Priority Tier 2)';

    const booking: Booking = {
      id: `bkg_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      resourceId: resource.id,
      userId: actor.id,
      start: payload.start,
      end: payload.end,
      purpose: payload.purpose.trim(),
      projectCode: payload.projectCode?.trim() || undefined,
      teamMembers: payload.teamMembers,
      status: initialStatus,
      idempotencyKey: payload.idempotencyKey || `idem_${Date.now()}`,
      policyVersionIds: evalResult.appliedPolicyVersionIds,
      eligibilityChecks: evalResult.checks,
      waitlistPosition,
      waitlistReason,
      priorityFactors: {
        academicPriority: priorityGroupLabel,
        recentHoursUsed: evalResult.usageHoursInWindow,
        requestedAt: nowIso,
        explanation: `Evaluated under policies [${evalResult.appliedPolicyVersionIds.join(', ')}]: ${priorityGroupLabel}, ${evalResult.usageHoursInWindow}h used in rolling 7 days.`,
      },
      decisionReason: hasMandatoryFail
        ? `Blocked by mandatory requirement: ${evalResult.checks.find((c) => c.status === 'FAIL')?.reason}`
        : undefined,
      createdAt: nowIso,
    };

    db.bookings.unshift(booking);

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action:
        initialStatus === 'ELIGIBILITY_BLOCKED'
          ? 'BOOKING_ELIGIBILITY_BLOCKED'
          : initialStatus === 'WAITLISTED'
          ? 'BOOKING_WAITLISTED'
          : 'BOOKING_REQUESTED',
      entityType: 'BOOKING',
      entityId: booking.id,
      reason: booking.purpose,
      metadata: {
        resourceId: resource.id,
        status: booking.status,
        policyVersionIds: booking.policyVersionIds,
        requestedHours: evalResult.requestedHours,
      },
    });

    saveDb(db);
    return structuredClone(booking);
  },

  async getMyBookings(): Promise<Array<Booking & { resourceName: string; resourceLocation: string; resourceSupervision: string }>> {
    if (API_MODE === 'live') {
      return liveFetch('/bookings/mine');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const list = db.bookings
      .filter((b) => b.organizationId === actor.organizationId && b.userId === actor.id)
      .map((b) => {
        const res = db.resources.find((r) => r.id === b.resourceId);
        return {
          ...b,
          resourceName: res?.name || b.resourceId,
          resourceLocation: res?.location || '',
          resourceSupervision: res?.supervision || 'NONE',
        };
      });
    return structuredClone(list);
  },

  async getAllOrganizationBookings(): Promise<
    Array<
      Booking & {
        resourceName: string;
        resourceLocation: string;
        resourceSupervision: string;
        requesterName: string;
        requesterEmail: string;
        requesterDepartment: string;
      }
    >
  > {
    if (API_MODE === 'live') {
      return liveFetch('/bookings/org');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'View organisation bookings');

    const list = db.bookings
      .filter((b) => b.organizationId === actor.organizationId)
      .map((b) => {
        const res = db.resources.find((r) => r.id === b.resourceId);
        const usr = db.users.find((u) => u.id === b.userId);
        return {
          ...b,
          resourceName: res?.name || b.resourceId,
          resourceLocation: res?.location || '',
          resourceSupervision: res?.supervision || 'NONE',
          requesterName: usr?.name || b.userId,
          requesterEmail: usr?.email || '',
          requesterDepartment: usr?.department || '',
        };
      });
    return structuredClone(list);
  },

  async getBookingDetail(bookingId: string): Promise<{
    booking: Booking;
    resource: Resource;
    requester: User;
    conditionReports: ConditionReport[];
    incidents: Incident[];
    ledgerEvents: LedgerEvent[];
    attachments: Attachment[];
    competingRequests: Array<Booking & { requesterName: string }>;
  }> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking record not found.');
    }
    enforceTenantMatch(actor, booking.organizationId);

    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));
    if (booking.userId !== actor.id && !isStaff) {
      throw new MockApiError(
        403,
        'FORBIDDEN',
        'You do not have permission to view another user’s private booking details.'
      );
    }

    const resource = db.resources.find((r) => r.id === booking.resourceId)!;
    const requester = db.users.find((u) => u.id === booking.userId)!;
    const conditionReports = db.conditionReports.filter((cr) => cr.bookingId === booking.id);
    const incidents = db.incidents.filter((inc) => inc.bookingId === booking.id);
    const ledgerEvents = db.ledgerEvents
      .filter(
        (le) =>
          le.organizationId === actor.organizationId &&
          ((le.entityType === 'BOOKING' && le.entityId === booking.id) ||
            le.metadata?.bookingId === booking.id)
      )
      .sort((a, b) => a.seq - b.seq);

    const attachmentIds = new Set<string>();
    conditionReports.forEach((cr) => cr.attachmentIds.forEach((id) => attachmentIds.add(id)));
    incidents.forEach((inc) => inc.attachmentIds.forEach((id) => attachmentIds.add(id)));
    const attachments = db.attachments.filter((a) => attachmentIds.has(a.id));

    const competingRequests = db.bookings
      .filter(
        (b) =>
          b.resourceId === booking.resourceId &&
          b.id !== booking.id &&
          !['CANCELLED', 'REJECTED', 'CLOSED', 'RETURNED'].includes(b.status) &&
          hasTimeOverlap(booking.start, booking.end, b.start, b.end)
      )
      .map((b) => ({
        ...b,
        requesterName: db.users.find((u) => u.id === b.userId)?.name || b.userId,
      }));

    return structuredClone({
      booking,
      resource,
      requester,
      conditionReports,
      incidents,
      ledgerEvents,
      attachments,
      competingRequests,
    });
  },

  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));
    if (booking.userId !== actor.id && !isStaff) {
      throw new MockApiError(403, 'FORBIDDEN', 'Only the requester or an authorised manager can cancel this booking.');
    }

    validateTransition(booking.status, 'CANCELLED');
    const wasConfirmed = ['APPROVED'].includes(booking.status);
    booking.status = 'CANCELLED';
    booking.decisionReason = reason || 'Cancelled by user.';

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'BOOKING_CANCELLED',
      entityType: 'BOOKING',
      entityId: booking.id,
      reason: booking.decisionReason,
      metadata: { resourceId: booking.resourceId },
    });

    if (wasConfirmed) {
      await promoteNextWaitlistedIfSlotOpen(
        db,
        booking.resourceId,
        booking.start,
        booking.end,
        actor
      );
    }

    saveDb(db);
    return structuredClone(booking);
  },

  async decideBooking(
    bookingId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'NEEDS_INFORMATION';
      reason: string;
      isPolicyOverride?: boolean;
    }
  ): Promise<Booking> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/decision`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Review and decide booking requests');

    if (!payload.reason || payload.reason.trim().length < 5) {
      throw new MockApiError(
        422,
        'REASON_REQUIRED',
        'A clear decision reason (at least 5 characters) is required for the audit ledger.'
      );
    }

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    validateTransition(booking.status, payload.decision);

    if (payload.decision === 'APPROVED') {
      // Recheck overlapping confirmed reservations at approval time per RULES.md Section 5.4
      const conflicts = db.bookings.filter(
        (b) =>
          b.resourceId === booking.resourceId &&
          b.id !== booking.id &&
          ['APPROVED', 'CHECKED_OUT_TO_USER', 'RETURN_PENDING_CONFIRMATION', 'OVERDUE'].includes(b.status) &&
          hasTimeOverlap(booking.start, booking.end, b.start, b.end)
      );
      if (conflicts.length > 0) {
        throw new MockApiError(
          409,
          'OVERLAP_CONFLICT',
          `Cannot approve: time slot overlaps existing confirmed booking ${conflicts[0].id} (${conflicts[0].status}). Waitlist or reject instead.`
        );
      }

      const hasFailedMandatory = booking.eligibilityChecks.some((c) => c.status === 'FAIL');
      if (hasFailedMandatory && !payload.isPolicyOverride) {
        throw new MockApiError(
          400,
          'ELIGIBILITY_FAILED',
          'Cannot approve a request with a failed mandatory requirement unless an explicit Policy Override is selected and documented.'
        );
      }
      booking.waitlistPosition = undefined;
    }

    if (payload.decision === 'WAITLISTED') {
      const currentWaitlisted = db.bookings.filter(
        (b) => b.resourceId === booking.resourceId && b.status === 'WAITLISTED' && b.id !== booking.id
      );
      booking.waitlistPosition = currentWaitlisted.length + 1;
      booking.waitlistReason = payload.reason.trim();
    }

    booking.status = payload.decision;
    booking.decisionReason = payload.reason.trim();
    booking.decidedBy = actor.id;
    booking.decidedAt = new Date().toISOString();
    booking.isPolicyOverride = Boolean(payload.isPolicyOverride);

    const actionName = payload.isPolicyOverride
      ? `BOOKING_${payload.decision}_OVERRIDE`
      : `BOOKING_${payload.decision}`;

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: actionName,
      entityType: 'BOOKING',
      entityId: booking.id,
      reason: booking.decisionReason,
      metadata: {
        decision: payload.decision,
        isPolicyOverride: booking.isPolicyOverride,
        policyVersionIds: booking.policyVersionIds,
      },
    });

    const resource = db.resources.find((r) => r.id === booking.resourceId);
    addOutboxNotification(db, {
      organizationId: actor.organizationId,
      userId: booking.userId,
      type: payload.decision === 'WAITLISTED' ? 'WAITLIST_CHANGE' : 'DECISION',
      title: `Booking request ${payload.decision.toLowerCase().replace('_', ' ')}: ${resource?.name || booking.resourceId}`,
      message: `Decision by ${actor.name}: "${booking.decisionReason}"`,
      relatedEntityId: booking.id,
      relatedPath: `/bookings/${booking.id}`,
    });

    saveDb(db);
    return structuredClone(booking);
  },

  async submitCheckIn(
    bookingId: string,
    payload: {
      condition: ConditionLevel;
      accessories: { name: string; present: boolean }[];
      notes: string;
      acknowledgedRules: boolean;
      photos: Array<{ fileName: string; mimeType: string; dataUrl: string }>;
    }
  ): Promise<{ booking: Booking; report: ConditionReport }> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/check-in`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));
    if (booking.userId !== actor.id && !isStaff) {
      throw new MockApiError(403, 'FORBIDDEN', 'Only the booking holder or authorised staff can check in.');
    }

    if (!payload.acknowledgedRules) {
      throw new MockApiError(422, 'ACKNOWLEDGEMENT_REQUIRED', 'You must acknowledge the usage and safety rules before check-in.');
    }

    validateTransition(booking.status, 'CHECKED_OUT_TO_USER');

    const attachmentIds: string[] = [];
    const attachmentHashes: string[] = [];
    const nowIso = new Date().toISOString();

    for (const ph of payload.photos.slice(0, 4)) {
      const hash = await sha256Hex(ph.dataUrl + ph.fileName);
      const attId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      db.attachments.push({
        id: attId,
        organizationId: actor.organizationId,
        fileName: ph.fileName,
        mimeType: ph.mimeType || 'image/svg+xml',
        sizeBytes: ph.dataUrl.length,
        sha256: hash,
        dataUrl: ph.dataUrl,
        uploadedBy: actor.id,
        linkedEntityType: 'CONDITION_REPORT',
        confirmed: true,
        createdAt: nowIso,
      });
      attachmentIds.push(attId);
      attachmentHashes.push(hash);
    }

    const report: ConditionReport = {
      id: `cr_in_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      bookingId: booking.id,
      stage: 'CHECK_IN',
      condition: payload.condition,
      accessories: payload.accessories,
      notes: payload.notes.trim() || 'Checked in; operational state verified.',
      attachmentIds,
      attachmentHashes,
      acknowledgedRules: true,
      reporterId: actor.id,
      reporterName: actor.name,
      actualTimestamp: nowIso,
      staffConfirmedBy: isStaff ? actor.id : undefined,
      staffConfirmedAt: isStaff ? nowIso : undefined,
      createdAt: nowIso,
    };

    db.conditionReports.push(report);
    booking.status = 'CHECKED_OUT_TO_USER';
    booking.handoverConfirmedBy = actor.id;
    booking.handoverConfirmedAt = nowIso;

    // Update asset status
    const asset = db.assets.find((a) => a.resourceId === booking.resourceId);
    if (asset) asset.status = 'IN_USE';

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'BOOKING_CHECKED_IN',
      entityType: 'CONDITION_REPORT',
      entityId: report.id,
      reason: `Check-in condition recorded as ${payload.condition}: ${report.notes}`,
      metadata: {
        bookingId: booking.id,
        condition: payload.condition,
        attachmentSha256: attachmentHashes,
      },
    });

    saveDb(db);
    return structuredClone({ booking, report });
  },

  async submitReturn(
    bookingId: string,
    payload: {
      condition: ConditionLevel;
      accessories: { name: string; present: boolean }[];
      notes: string;
      photos: Array<{ fileName: string; mimeType: string; dataUrl: string }>;
      openIncidentCategory?: Incident['category'];
      openIncidentDescription?: string;
    }
  ): Promise<{ booking: Booking; report: ConditionReport; incident?: Incident }> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/return`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));
    if (booking.userId !== actor.id && !isStaff) {
      throw new MockApiError(403, 'FORBIDDEN', 'Only the booking holder or authorised staff can record a return.');
    }

    const resource = db.resources.find((r) => r.id === booking.resourceId)!;
    const requiresStaffConfirm = resource.supervision !== 'NONE';
    const nextStatus: BookingStatus =
      requiresStaffConfirm && !isStaff ? 'RETURN_PENDING_CONFIRMATION' : 'CLOSED';

    if (booking.status !== 'CHECKED_OUT_TO_USER' && booking.status !== 'OVERDUE') {
      throw new MockApiError(
        400,
        'INVALID_STATE_TRANSITION',
        `Booking in status ${booking.status} cannot submit a return report.`
      );
    }

    const nowIso = new Date().toISOString();
    const attachmentIds: string[] = [];
    const attachmentHashes: string[] = [];

    for (const ph of payload.photos.slice(0, 4)) {
      const hash = await sha256Hex(ph.dataUrl + ph.fileName);
      const attId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      db.attachments.push({
        id: attId,
        organizationId: actor.organizationId,
        fileName: ph.fileName,
        mimeType: ph.mimeType || 'image/svg+xml',
        sizeBytes: ph.dataUrl.length,
        sha256: hash,
        dataUrl: ph.dataUrl,
        uploadedBy: actor.id,
        linkedEntityType: 'CONDITION_REPORT',
        confirmed: true,
        createdAt: nowIso,
      });
      attachmentIds.push(attId);
      attachmentHashes.push(hash);
    }

    const report: ConditionReport = {
      id: `cr_out_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      bookingId: booking.id,
      stage: 'RETURN',
      condition: payload.condition,
      accessories: payload.accessories,
      notes: payload.notes.trim() || 'Returned; final condition recorded.',
      attachmentIds,
      attachmentHashes,
      acknowledgedRules: true,
      reporterId: actor.id,
      reporterName: actor.name,
      actualTimestamp: nowIso,
      staffConfirmedBy: isStaff ? actor.id : undefined,
      staffConfirmedAt: isStaff ? nowIso : undefined,
      createdAt: nowIso,
    };

    db.conditionReports.push(report);
    booking.status = nextStatus;
    if (nextStatus === 'CLOSED') {
      booking.returnConfirmedBy = actor.id;
      booking.returnConfirmedAt = nowIso;
      const asset = db.assets.find((a) => a.resourceId === booking.resourceId);
      if (asset) asset.status = 'AVAILABLE';
    }

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: nextStatus === 'CLOSED' ? 'BOOKING_RETURNED_AND_CLOSED' : 'BOOKING_RETURN_INITIATED',
      entityType: 'CONDITION_REPORT',
      entityId: report.id,
      reason: `Return condition recorded as ${payload.condition}: ${report.notes}`,
      metadata: {
        bookingId: booking.id,
        finalCondition: payload.condition,
        missingAccessories: payload.accessories.filter((a) => !a.present).map((a) => a.name),
        attachmentSha256: attachmentHashes,
      },
    });

    let createdIncident: Incident | undefined;
    if (payload.openIncidentDescription && payload.openIncidentDescription.trim()) {
      createdIncident = {
        id: `inc_${Date.now().toString(36)}`,
        organizationId: actor.organizationId,
        bookingId: booking.id,
        resourceId: booking.resourceId,
        reporterId: actor.id,
        reporterName: actor.name,
        category: payload.openIncidentCategory || 'Damage / suspected damage',
        reportedStage: 'Return inspection',
        description: payload.openIncidentDescription.trim(),
        attachmentIds,
        attachmentHashes,
        status: 'REPORTED',
        requiresHumanReview: true,
        comments: [],
        createdAt: nowIso,
      };
      db.incidents.unshift(createdIncident);

      await appendLedgerEvent(db, {
        organizationId: actor.organizationId,
        actor,
        action: 'INCIDENT_REPORTED',
        entityType: 'INCIDENT',
        entityId: createdIncident.id,
        reason: createdIncident.description,
        metadata: {
          bookingId: booking.id,
          category: createdIncident.category,
          attachmentSha256: attachmentHashes,
        },
      });
    }

    saveDb(db);
    return structuredClone({ booking, report, incident: createdIncident });
  },

  async confirmStaffHandoverOrReturn(
    bookingId: string,
    stage: 'HANDOVER' | 'RETURN',
    notes: string
  ): Promise<Booking> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/return-confirmation`, {
        method: 'POST',
        body: JSON.stringify({ stage, notes }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Confirm staff handover or return');

    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    const nowIso = new Date().toISOString();
    if (stage === 'HANDOVER') {
      booking.handoverConfirmedBy = actor.id;
      booking.handoverConfirmedAt = nowIso;
      const checkInReport = db.conditionReports.find(
        (cr) => cr.bookingId === booking.id && cr.stage === 'CHECK_IN'
      );
      if (checkInReport) {
        checkInReport.staffConfirmedBy = actor.id;
        checkInReport.staffConfirmedAt = nowIso;
      }
      await appendLedgerEvent(db, {
        organizationId: actor.organizationId,
        actor,
        action: 'HANDOVER_STAFF_CONFIRMED',
        entityType: 'BOOKING',
        entityId: booking.id,
        reason: notes.trim() || 'Technician verified initial handover condition.',
        metadata: { bookingId: booking.id },
      });
    } else {
      booking.status = 'CLOSED';
      booking.returnConfirmedBy = actor.id;
      booking.returnConfirmedAt = nowIso;
      const returnReport = db.conditionReports.find(
        (cr) => cr.bookingId === booking.id && cr.stage === 'RETURN'
      );
      if (returnReport) {
        returnReport.staffConfirmedBy = actor.id;
        returnReport.staffConfirmedAt = nowIso;
      }
      const asset = db.assets.find((a) => a.resourceId === booking.resourceId);
      if (asset) asset.status = 'AVAILABLE';

      await appendLedgerEvent(db, {
        organizationId: actor.organizationId,
        actor,
        action: 'RETURN_STAFF_CONFIRMED',
        entityType: 'BOOKING',
        entityId: booking.id,
        reason: notes.trim() || 'Technician inspected returned resource and confirmed operational closure.',
        metadata: { bookingId: booking.id, status: 'CLOSED' },
      });

      addOutboxNotification(db, {
        organizationId: actor.organizationId,
        userId: booking.userId,
        type: 'DECISION',
        title: 'Return confirmed & booking closed',
        message: `${actor.name} confirmed receipt of your returned resource (${booking.id}).`,
        relatedEntityId: booking.id,
        relatedPath: `/bookings/${booking.id}`,
      });
    }

    saveDb(db);
    return structuredClone(booking);
  },

  // --- INCIDENTS ---
  async getIncidents(): Promise<Array<Incident & { resourceName: string }>> {
    if (API_MODE === 'live') {
      return liveFetch('/incidents');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));

    const list = db.incidents
      .filter(
        (inc) =>
          inc.organizationId === actor.organizationId &&
          (isStaff || inc.reporterId === actor.id)
      )
      .map((inc) => {
        const res = db.resources.find((r) => r.id === inc.resourceId);
        return {
          ...inc,
          resourceName: res?.name || inc.resourceId,
        };
      });

    return structuredClone(list);
  },

  async getIncidentDetail(incidentId: string): Promise<{
    incident: Incident;
    resource: Resource;
    booking?: Booking;
    attachments: Attachment[];
  }> {
    if (API_MODE === 'live') {
      const incident = await liveFetch<Incident>(`/incidents/${incidentId}`);
      const res = await liveFetch<{ resource: Resource }>(`/resources/${incident.resourceId}`);
      let booking: Booking | undefined;
      try {
        const bkgRes = await liveFetch<{ booking: Booking }>(`/bookings/${incident.bookingId}`);
        booking = bkgRes.booking;
      } catch {
        // booking might be optional or inaccessible
      }
      return {
        incident,
        resource: res.resource,
        booking,
        attachments: [],
      };
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const incident = db.incidents.find((i) => i.id === incidentId);
    if (!incident) throw new MockApiError(404, 'INCIDENT_NOT_FOUND', 'Incident report not found.');
    enforceTenantMatch(actor, incident.organizationId);

    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));
    if (!isStaff && incident.reporterId !== actor.id) {
      throw new MockApiError(403, 'FORBIDDEN', 'You can only view incidents you reported or are authorised to review.');
    }

    const resource = db.resources.find((r) => r.id === incident.resourceId)!;
    const booking = db.bookings.find((b) => b.id === incident.bookingId);
    const attachments = db.attachments.filter((a) => incident.attachmentIds.includes(a.id));

    return structuredClone({ incident, resource, booking, attachments });
  },

  async createIncident(
    bookingId: string,
    payload: {
      category: Incident['category'];
      reportedStage?: string;
      affectedPart?: string;
      description: string;
      assistedDraftUsed?: boolean;
      photos?: Array<{ fileName: string; mimeType: string; dataUrl: string }>;
    }
  ): Promise<Incident> {
    if (API_MODE === 'live') {
      return liveFetch(`/bookings/${bookingId}/incidents`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new MockApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    enforceTenantMatch(actor, booking.organizationId);

    if (!payload.description || payload.description.trim().length < 10) {
      throw new MockApiError(422, 'VALIDATION_ERROR', 'Please provide a factual description (at least 10 characters).');
    }

    const nowIso = new Date().toISOString();
    const attachmentIds: string[] = [];
    const attachmentHashes: string[] = [];

    for (const ph of (payload.photos || []).slice(0, 4)) {
      const hash = await sha256Hex(ph.dataUrl + ph.fileName);
      const attId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      db.attachments.push({
        id: attId,
        organizationId: actor.organizationId,
        fileName: ph.fileName,
        mimeType: ph.mimeType || 'image/svg+xml',
        sizeBytes: ph.dataUrl.length,
        sha256: hash,
        dataUrl: ph.dataUrl,
        uploadedBy: actor.id,
        linkedEntityType: 'INCIDENT',
        confirmed: true,
        createdAt: nowIso,
      });
      attachmentIds.push(attId);
      attachmentHashes.push(hash);
    }

    const incident: Incident = {
      id: `inc_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      bookingId: booking.id,
      resourceId: booking.resourceId,
      reporterId: actor.id,
      reporterName: actor.name,
      category: payload.category,
      reportedStage: payload.reportedStage || 'User report',
      affectedPart: payload.affectedPart,
      description: payload.description.trim(),
      attachmentIds,
      attachmentHashes,
      status: 'REPORTED',
      requiresHumanReview: true,
      assistedDraftUsed: payload.assistedDraftUsed,
      comments: [],
      createdAt: nowIso,
    };

    db.incidents.unshift(incident);

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'INCIDENT_REPORTED',
      entityType: 'INCIDENT',
      entityId: incident.id,
      reason: incident.description,
      metadata: {
        bookingId: booking.id,
        resourceId: booking.resourceId,
        category: incident.category,
        assistedDraftUsed: Boolean(incident.assistedDraftUsed),
        attachmentSha256: attachmentHashes,
      },
    });

    saveDb(db);
    return structuredClone(incident);
  },

  async addIncidentComment(incidentId: string, message: string): Promise<Incident> {
    if (API_MODE === 'live') {
      await liveFetch(`/incidents/${incidentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      return liveFetch<Incident>(`/incidents/${incidentId}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const incident = db.incidents.find((i) => i.id === incidentId);
    if (!incident) throw new MockApiError(404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    enforceTenantMatch(actor, incident.organizationId);

    if (!message.trim()) {
      throw new MockApiError(422, 'VALIDATION_ERROR', 'Comment text cannot be empty.');
    }

    incident.comments.push({
      id: `cmt_${Date.now().toString(36)}`,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.roles[0],
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'INCIDENT_COMMENT_ADDED',
      entityType: 'INCIDENT',
      entityId: incident.id,
      reason: message.trim(),
      metadata: { bookingId: incident.bookingId },
    });

    saveDb(db);
    return structuredClone(incident);
  },

  async resolveIncident(
    incidentId: string,
    payload: {
      status: Incident['status'];
      resolutionOutcome?: Incident['resolutionOutcome'];
      resolution: string;
      markResourceMaintenance?: boolean;
    }
  ): Promise<Incident> {
    if (API_MODE === 'live') {
      return liveFetch(`/incidents/${incidentId}/resolution`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Review and resolve incidents');

    if (!payload.resolution || payload.resolution.trim().length < 8) {
      throw new MockApiError(422, 'REASON_REQUIRED', 'Please enter a human reviewer explanation (at least 8 characters).');
    }

    const incident = db.incidents.find((i) => i.id === incidentId);
    if (!incident) throw new MockApiError(404, 'INCIDENT_NOT_FOUND', 'Incident not found.');
    enforceTenantMatch(actor, incident.organizationId);

    incident.status = payload.status;
    incident.reviewerId = actor.id;
    incident.reviewerName = actor.name;
    incident.resolutionOutcome = payload.resolutionOutcome;
    incident.resolution = payload.resolution.trim();
    if (payload.status === 'RESOLVED') {
      incident.resolvedAt = new Date().toISOString();
    }

    if (payload.markResourceMaintenance) {
      const resource = db.resources.find((r) => r.id === incident.resourceId);
      if (resource) {
        resource.status = 'MAINTENANCE';
      }
    }

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: payload.status === 'RESOLVED' ? 'INCIDENT_RESOLVED' : `INCIDENT_${payload.status}`,
      entityType: 'INCIDENT',
      entityId: incident.id,
      reason: incident.resolution,
      metadata: {
        bookingId: incident.bookingId,
        outcome: payload.resolutionOutcome,
        resourceMarkedMaintenance: Boolean(payload.markResourceMaintenance),
      },
    });

    addOutboxNotification(db, {
      organizationId: actor.organizationId,
      userId: incident.reporterId,
      type: 'INCIDENT_UPDATE',
      title: `Incident ${incident.id} updated: ${payload.status}`,
      message: `Reviewed by ${actor.name}: "${incident.resolution}"`,
      relatedEntityId: incident.id,
      relatedPath: `/incidents/${incident.id}`,
    });

    saveDb(db);
    return structuredClone(incident);
  },

  // --- TRUST LEDGER ---
  async getLedgerEvents(filters?: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
  }): Promise<{
    events: LedgerEvent[];
    lastVerifiedAt?: string;
    headSeq: number;
    headHash: string;
  }> {
    if (API_MODE === 'live') {
      const params = new URLSearchParams();
      if (filters?.entityType) params.set('entity_type', filters.entityType);
      if (filters?.entityId) params.set('entity_id', filters.entityId);
      return liveFetch(`/audit-events?${params.toString()}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    let events = db.ledgerEvents
      .filter((e) => e.organizationId === actor.organizationId)
      .sort((a, b) => b.seq - a.seq);

    const headEvent = events[0];

    if (filters?.entityType && filters.entityType !== 'ALL') {
      events = events.filter((e) => e.entityType === filters.entityType);
    }
    if (filters?.entityId && filters.entityId.trim()) {
      const q = filters.entityId.trim().toLowerCase();
      events = events.filter(
        (e) =>
          e.entityId.toLowerCase().includes(q) ||
          String(e.metadata?.bookingId || '').toLowerCase().includes(q)
      );
    }
    if (filters?.actorId && filters.actorId !== 'ALL') {
      events = events.filter((e) => e.actorId === filters.actorId);
    }
    if (filters?.action && filters.action.trim()) {
      const act = filters.action.trim().toLowerCase();
      events = events.filter((e) => e.action.toLowerCase().includes(act));
    }

    return structuredClone({
      events,
      lastVerifiedAt: db.lastLedgerVerifiedAt[actor.organizationId],
      headSeq: headEvent?.seq || 0,
      headHash: headEvent?.hash || '0'.repeat(64),
    });
  },

  async verifyLedger(): Promise<LedgerVerificationResult> {
    if (API_MODE === 'live') {
      return liveFetch('/audit-events/verify');
    }
    const actor = await getAuthenticatedActor();
    return verifyOrganizationLedgerChain(actor.organizationId);
  },

  async simulateTamper(): Promise<{ tamperedSeq: number }> {
    if (API_MODE === 'live') {
      return liveFetch('/audit-events/simulate-tamper', { method: 'POST' });
    }
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN', 'MANAGER'], 'Simulate ledger tamper');
    return simulateLedgerTamper(actor.organizationId);
  },

  async repairLedger(): Promise<LedgerVerificationResult> {
    if (API_MODE === 'live') {
      return liveFetch('/audit-events/repair', { method: 'POST' });
    }
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN', 'MANAGER'], 'Repair demo ledger chain');
    return repairOrganizationLedgerChain(actor.organizationId);
  },

  // --- POLICIES ---
  async getPolicies(): Promise<{ policies: Policy[]; versions: PolicyVersion[] }> {
    if (API_MODE === 'live') {
      return liveFetch('/policies');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const policies = db.policies.filter((p) => p.organizationId === actor.organizationId);
    const versions = db.policyVersions.filter((v) => v.organizationId === actor.organizationId);
    return structuredClone({ policies, versions });
  },

  async createPolicyVersionAndActivate(
    policyId: string,
    payload: {
      definition: PolicyVersion['definition'];
      reason: string;
      activateImmediately: boolean;
    }
  ): Promise<{ policy: Policy; version: PolicyVersion }> {
    if (API_MODE === 'live') {
      return liveFetch(`/policies/${policyId}/versions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN', 'OWNER'], 'Create or activate policy versions');

    if (!payload.reason || payload.reason.trim().length < 5) {
      throw new MockApiError(422, 'REASON_REQUIRED', 'A governance reason is required to create or activate a policy version.');
    }

    const policy = db.policies.find((p) => p.id === policyId);
    if (!policy) throw new MockApiError(404, 'POLICY_NOT_FOUND', 'Policy not found.');
    enforceTenantMatch(actor, policy.organizationId);

    const existingVersions = db.policyVersions.filter((v) => v.policyId === policy.id);
    const nextVersionNum =
      existingVersions.reduce((max, v) => Math.max(max, v.version), 0) + 1;

    const nowIso = new Date().toISOString();
    const newVersion: PolicyVersion = {
      id: `${policy.id}_v${nextVersionNum}`,
      organizationId: actor.organizationId,
      policyId: policy.id,
      version: nextVersionNum,
      definition: payload.definition,
      effectiveFrom: nowIso,
      createdBy: actor.id,
      createdByName: actor.name,
      reason: payload.reason.trim(),
    };

    db.policyVersions.push(newVersion);

    if (payload.activateImmediately) {
      policy.activeVersion = nextVersionNum;
      policy.status = 'ACTIVE';
    }

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: payload.activateImmediately ? 'POLICY_VERSION_ACTIVATED' : 'POLICY_VERSION_CREATED',
      entityType: 'POLICY',
      entityId: policy.id,
      reason: payload.reason.trim(),
      metadata: {
        version: nextVersionNum,
        versionId: newVersion.id,
        definition: payload.definition,
      },
    });

    saveDb(db);
    return structuredClone({ policy, version: newVersion });
  },

  async previewPolicyOutcome(payload: {
    policyId: string;
    draftDefinition: PolicyVersion['definition'];
    sampleUserId: string;
    sampleResourceId: string;
    sampleDurationHours: number;
  }): Promise<{
    beforeResult: EligibilityEvaluationResult;
    afterResult: EligibilityEvaluationResult;
    sampleUser: User;
    sampleResource: Resource;
  }> {
    if (API_MODE === 'live') {
      return liveFetch('/policies/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const policy = db.policies.find((p) => p.id === payload.policyId);
    if (!policy) throw new MockApiError(404, 'POLICY_NOT_FOUND', 'Policy not found.');
    enforceTenantMatch(actor, policy.organizationId);

    const sampleUser = db.users.find(
      (u) => u.id === payload.sampleUserId && u.organizationId === actor.organizationId
    );
    const sampleResource = db.resources.find(
      (r) => r.id === payload.sampleResourceId && r.organizationId === actor.organizationId
    );
    if (!sampleUser || !sampleResource) {
      throw new MockApiError(404, 'SAMPLE_NOT_FOUND', 'Sample user or resource not found.');
    }

    // Pick a conflict-free future window (+72h) so policy rules are isolated
    const start = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const end = new Date(
      Date.now() + (72 + payload.sampleDurationHours) * 3600 * 1000
    ).toISOString();

    const beforeResult = evaluateEligibilitySync(db, sampleUser, sampleResource, start, end);

    const tempVersion: PolicyVersion = {
      id: `${policy.id}_vDraftPreview`,
      organizationId: actor.organizationId,
      policyId: policy.id,
      version: (policy.activeVersion || 1) + 1,
      definition: payload.draftDefinition,
      effectiveFrom: new Date().toISOString(),
      createdBy: actor.id,
      createdByName: actor.name,
      reason: 'Preview simulation',
    };

    const afterResult = evaluateEligibilitySync(
      db,
      sampleUser,
      sampleResource,
      start,
      end,
      undefined,
      { policy, version: tempVersion }
    );

    return structuredClone({
      beforeResult,
      afterResult,
      sampleUser,
      sampleResource,
    });
  },

  // --- ASSETS & QR ---
  async scanAssetQr(qrToken: string): Promise<{
    asset: Asset;
    resource: Resource;
    allowedActions: Array<{
      type: 'CHECK_IN' | 'RETURN' | 'STAFF_CONFIRM_RETURN' | 'VIEW_RESOURCE';
      label: string;
      bookingId?: string;
      description: string;
    }>;
    explanation: string;
  }> {
    if (API_MODE === 'live') {
      return liveFetch(`/assets/scan/${qrToken}`);
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const asset = db.assets.find(
      (a) => a.qrToken.toLowerCase() === qrToken.trim().toLowerCase() || a.assetTag.toLowerCase() === qrToken.trim().toLowerCase()
    );
    if (!asset) {
      throw new MockApiError(404, 'QR_TOKEN_NOT_FOUND', 'No registered institutional asset matches this QR token.');
    }
    enforceTenantMatch(actor, asset.organizationId);

    const resource = db.resources.find((r) => r.id === asset.resourceId)!;
    const isStaff = actor.roles.some((r) => ['OWNER', 'MANAGER', 'ADMIN'].includes(r));

    const allowedActions: Array<{
      type: 'CHECK_IN' | 'RETURN' | 'STAFF_CONFIRM_RETURN' | 'VIEW_RESOURCE';
      label: string;
      bookingId?: string;
      description: string;
    }> = [];

    // Check if actor has an APPROVED booking for this resource
    const approvedBooking = db.bookings.find(
      (b) => b.resourceId === resource.id && b.userId === actor.id && b.status === 'APPROVED'
    );
    if (approvedBooking) {
      allowedActions.push({
        type: 'CHECK_IN',
        label: 'Start check-in & initial condition report',
        bookingId: approvedBooking.id,
        description: `You hold approved booking ${approvedBooking.id} for ${resource.name}.`,
      });
    }

    // Check if actor has a CHECKED_OUT_TO_USER or OVERDUE booking
    const activeBooking = db.bookings.find(
      (b) =>
        b.resourceId === resource.id &&
        (b.userId === actor.id || isStaff) &&
        ['CHECKED_OUT_TO_USER', 'OVERDUE'].includes(b.status)
    );
    if (activeBooking) {
      allowedActions.push({
        type: 'RETURN',
        label: 'Submit return & final condition report',
        bookingId: activeBooking.id,
        description: `Active checkout ${activeBooking.id} is ready for return inspection.`,
      });
    }

    // Check if staff can confirm pending return
    if (isStaff) {
      const pendingReturn = db.bookings.find(
        (b) => b.resourceId === resource.id && b.status === 'RETURN_PENDING_CONFIRMATION'
      );
      if (pendingReturn) {
        allowedActions.push({
          type: 'STAFF_CONFIRM_RETURN',
          label: 'Confirm supervised return (Staff)',
          bookingId: pendingReturn.id,
          description: `Booking ${pendingReturn.id} is awaiting staff return verification.`,
        });
      }
    }

    allowedActions.push({
      type: 'VIEW_RESOURCE',
      label: 'View resource specifications & eligibility',
      description: 'Inspect published requirements, availability calendar, and audit history.',
    });

    const explanation =
      allowedActions.length > 1
        ? `Authenticated as ${actor.name} (${actor.roles.join(', ')}). Showing contextual actions permitted for your active bookings and role.`
        : `Authenticated as ${actor.name}. Scanning a QR code never grants access by itself—you do not currently hold an active approved booking for ${resource.name}.`;

    return structuredClone({
      asset,
      resource,
      allowedActions,
      explanation,
    });
  },

  async createAssetForResource(resourceId: string, assetTag: string, serialNumber: string): Promise<Asset> {
    if (API_MODE === 'live') {
      return liveFetch(`/resources/${resourceId}/assets`, {
        method: 'POST',
        body: JSON.stringify({ assetTag, serialNumber }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['OWNER', 'MANAGER', 'ADMIN'], 'Add asset unit');

    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) throw new MockApiError(404, 'RESOURCE_NOT_FOUND', 'Resource not found.');
    enforceTenantMatch(actor, resource.organizationId);

    const newAsset: Asset = {
      id: `ast_${Date.now().toString(36)}`,
      organizationId: actor.organizationId,
      resourceId: resource.id,
      assetTag: assetTag.trim(),
      serialNumber: serialNumber.trim(),
      qrToken: `qr_${actor.organizationId}_${resource.id.slice(4, 8)}_${Date.now().toString(36).slice(-5)}`,
      condition: resource.condition,
      status: 'AVAILABLE',
      lastCalibratedAt: new Date().toISOString(),
    };

    db.assets.push(newAsset);
    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'ASSET_REGISTERED',
      entityType: 'RESOURCE',
      entityId: resource.id,
      reason: `Registered physical unit ${newAsset.assetTag} (${newAsset.serialNumber}).`,
      metadata: { assetId: newAsset.id, assetTag: newAsset.assetTag, qrToken: newAsset.qrToken },
    });

    saveDb(db);
    return structuredClone(newAsset);
  },

  // --- NOTIFICATIONS ---
  async getNotifications(): Promise<Notification[]> {
    if (API_MODE === 'live') {
      return liveFetch('/notifications');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const list = db.notifications.filter(
      (n) => n.organizationId === actor.organizationId && n.userId === actor.id
    );
    return structuredClone(list);
  },

  async markNotificationRead(notificationId: string): Promise<Notification> {
    if (API_MODE === 'live') {
      return liveFetch(`/notifications/${notificationId}/read`, { method: 'POST' });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const notif = db.notifications.find(
      (n) => n.id === notificationId && n.organizationId === actor.organizationId
    );
    if (!notif) throw new MockApiError(404, 'NOT_FOUND', 'Notification not found.');
    notif.readAt = new Date().toISOString();
    saveDb(db);
    return structuredClone(notif);
  },

  async markAllNotificationsRead(): Promise<void> {
    if (API_MODE === 'live') {
      await liveFetch('/notifications/read-all', { method: 'POST' });
      return;
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const nowIso = new Date().toISOString();
    db.notifications
      .filter((n) => n.organizationId === actor.organizationId && n.userId === actor.id && !n.readAt)
      .forEach((n) => {
        n.readAt = nowIso;
      });
    saveDb(db);
  },

  // --- ADMIN: USERS, ROLES, TRAININGS ---
  async getAdminDirectory(): Promise<{
    users: User[];
    trainings: TrainingRecord[];
    organization: Organization;
  }> {
    if (API_MODE === 'live') {
      return liveFetch('/admin/users');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN', 'MANAGER', 'OWNER'], 'View organisation user directory');

    const users = db.users.filter((u) => u.organizationId === actor.organizationId);
    const trainings = db.trainings.filter((t) => t.organizationId === actor.organizationId);
    const organization = db.organizations.find((o) => o.id === actor.organizationId)!;
    return structuredClone({ users, trainings, organization });
  },

  async getMyProfileData(): Promise<{
    user: User;
    organization: Organization;
    trainings: TrainingRecord[];
    usageByResource: Array<{ resourceId: string; resourceName: string; hoursUsed7d: number }>;
  }> {
    if (API_MODE === 'live') {
      return liveFetch('/profile/data');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const organization = db.organizations.find((o) => o.id === actor.organizationId)!;
    const trainings = db.trainings.filter(
      (t) => t.organizationId === actor.organizationId && t.userId === actor.id
    );
    const resources = db.resources.filter((r) => r.organizationId === actor.organizationId);
    const usageByResource = resources.map((r) => ({
      resourceId: r.id,
      resourceName: r.name,
      hoursUsed7d: getRollingUsageHours(db, actor.id, r.id, 7),
    }));

    return structuredClone({
      user: actor,
      organization,
      trainings,
      usageByResource,
    });
  },

  async updateUserRoles(userId: string, roles: Role[], reason: string): Promise<User> {
    if (API_MODE === 'live') {
      return liveFetch(`/admin/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles, reason }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN'], 'Modify user role assignments');

    if (!reason || reason.trim().length < 5) {
      throw new MockApiError(422, 'REASON_REQUIRED', 'A governance reason is required for role changes.');
    }

    const target = db.users.find((u) => u.id === userId);
    if (!target) throw new MockApiError(404, 'USER_NOT_FOUND', 'User not found.');
    enforceTenantMatch(actor, target.organizationId);

    const prevRoles = [...target.roles];
    target.roles = roles.length > 0 ? roles : ['USER'];

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'USER_ROLES_UPDATED',
      entityType: 'USER_ROLE',
      entityId: target.id,
      reason: reason.trim(),
      metadata: { previousRoles: prevRoles, newRoles: target.roles, targetEmail: target.email },
    });

    saveDb(db);
    return structuredClone(target);
  },

  async verifyUserTraining(
    userId: string,
    trainingType: string,
    label: string,
    status: TrainingRecord['status'],
    source: string,
    reason: string
  ): Promise<TrainingRecord> {
    if (API_MODE === 'live') {
      return liveFetch(`/admin/users/${userId}/trainings`, {
        method: 'POST',
        body: JSON.stringify({ trainingType, label, status, source, reason }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    requireRole(actor, ['ADMIN', 'MANAGER', 'OWNER'], 'Verify training record');

    const target = db.users.find((u) => u.id === userId);
    if (!target) throw new MockApiError(404, 'USER_NOT_FOUND', 'User not found.');
    enforceTenantMatch(actor, target.organizationId);

    let record = db.trainings.find(
      (t) => t.userId === userId && t.type === trainingType && t.organizationId === actor.organizationId
    );
    const nowIso = new Date().toISOString();

    if (record) {
      record.status = status;
      record.source = source.trim();
      record.verifiedBy = actor.id;
      record.updatedAt = nowIso;
    } else {
      record = {
        id: `trn_${Date.now().toString(36)}`,
        userId,
        organizationId: actor.organizationId,
        type: trainingType,
        label,
        status,
        source: source.trim(),
        verifiedBy: actor.id,
        updatedAt: nowIso,
      };
      db.trainings.push(record);
    }

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: `TRAINING_${status}`,
      entityType: 'TRAINING',
      entityId: record.id,
      reason: reason.trim() || `Updated ${label} for ${target.name} to ${status}.`,
      metadata: { userId, trainingType, status, source: record.source },
    });

    saveDb(db);
    return structuredClone(record);
  },

  async requestTrainingEnrollment(trainingType: string, label: string): Promise<TrainingRecord> {
    if (API_MODE === 'live') {
      return liveFetch('/profile/training/request', {
        method: 'POST',
        body: JSON.stringify({ trainingType, label }),
      });
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();

    let record = db.trainings.find(
      (t) => t.userId === actor.id && t.type === trainingType && t.organizationId === actor.organizationId
    );
    const nowIso = new Date().toISOString();

    if (record) {
      record.status = 'PENDING';
      record.source = 'User requested practical checkoff session';
      record.updatedAt = nowIso;
    } else {
      record = {
        id: `trn_${Date.now().toString(36)}`,
        userId: actor.id,
        organizationId: actor.organizationId,
        type: trainingType,
        label,
        status: 'PENDING',
        source: 'User requested practical checkoff session',
        updatedAt: nowIso,
      };
      db.trainings.push(record);
    }

    await appendLedgerEvent(db, {
      organizationId: actor.organizationId,
      actor,
      action: 'TRAINING_ENROLLMENT_REQUESTED',
      entityType: 'TRAINING',
      entityId: record.id,
      reason: `${actor.name} requested practical verification for ${label}.`,
      metadata: { trainingType },
    });

    saveDb(db);
    return structuredClone(record);
  },

  // --- ANALYTICS ---
  async getAnalyticsData(): Promise<{
    resourceMetrics: Array<{
      resourceId: string;
      name: string;
      category: string;
      bookedHours: number;
      availableHours: number;
      utilisationPct: number;
      waitlistedCount: number;
      incidentCount: number;
    }>;
    fairnessByUser: Array<{
      userId: string;
      name: string;
      academicGroup: string;
      bookedHours: number;
      sharePct: number;
      requestsCount: number;
    }>;
    demandByHourBlock: Array<{
      block: string;
      electronics: number;
      mediaComputing: number;
      spaces: number;
    }>;
    outcomeCounts: Array<{ status: string; count: number }>;
  }> {
    if (API_MODE === 'live') {
      return liveFetch('/analytics/utilisation');
    }
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const orgResources = db.resources.filter((r) => r.organizationId === actor.organizationId);
    const orgBookings = db.bookings.filter((b) => b.organizationId === actor.organizationId);
    const orgIncidents = db.incidents.filter((i) => i.organizationId === actor.organizationId);
    const orgUsers = db.users.filter((u) => u.organizationId === actor.organizationId);

    const countedStates: BookingStatus[] = [
      'APPROVED',
      'CHECKED_OUT_TO_USER',
      'RETURN_PENDING_CONFIRMATION',
      'RETURNED',
      'OVERDUE',
      'CLOSED',
    ];

    const resourceMetrics = orgResources.map((res) => {
      const bookingsForRes = orgBookings.filter(
        (b) => b.resourceId === res.id && countedStates.includes(b.status)
      );
      const bookedHours =
        Math.round(
          bookingsForRes.reduce((sum, b) => sum + getDurationHours(b.start, b.end), 0) * 10
        ) / 10;
      const availableHours = 40; // Standard 7-day operational benchmark window
      const utilisationPct = Math.min(100, Math.round((bookedHours / availableHours) * 100));
      const waitlistedCount = orgBookings.filter(
        (b) => b.resourceId === res.id && b.status === 'WAITLISTED'
      ).length;
      const incidentCount = orgIncidents.filter((i) => i.resourceId === res.id).length;

      return {
        resourceId: res.id,
        name: res.name.split(' (')[0],
        category: res.category,
        bookedHours,
        availableHours,
        utilisationPct,
        waitlistedCount,
        incidentCount,
      };
    });

    const totalBookedAllUsers = Math.max(
      0.1,
      orgBookings
        .filter((b) => countedStates.includes(b.status))
        .reduce((sum, b) => sum + getDurationHours(b.start, b.end), 0)
    );

    const fairnessByUser = orgUsers
      .filter((u) => u.roles.includes('USER'))
      .map((u) => {
        const userBookings = orgBookings.filter((b) => b.userId === u.id);
        const bookedHours =
          Math.round(
            userBookings
              .filter((b) => countedStates.includes(b.status))
              .reduce((sum, b) => sum + getDurationHours(b.start, b.end), 0) * 10
          ) / 10;
        return {
          userId: u.id,
          name: u.name,
          academicGroup: u.academicGroup || 'COURSEWORK',
          bookedHours,
          sharePct: Math.round((bookedHours / totalBookedAllUsers) * 100),
          requestsCount: userBookings.length,
        };
      })
      .sort((a, b) => b.bookedHours - a.bookedHours);

    const demandByHourBlock = [
      { block: '08:00–11:00', electronics: 4, mediaComputing: 2, spaces: 3 },
      { block: '11:00–14:00', electronics: 7, mediaComputing: 5, spaces: 6 },
      { block: '14:00–17:00', electronics: 11, mediaComputing: 9, spaces: 5 },
      { block: '17:00–20:00', electronics: 6, mediaComputing: 7, spaces: 4 },
    ];

    const statusMap: Record<string, number> = {};
    orgBookings.forEach((b) => {
      statusMap[b.status] = (statusMap[b.status] || 0) + 1;
    });
    const outcomeCounts = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    return structuredClone({
      resourceMetrics,
      fairnessByUser,
      demandByHourBlock,
      outcomeCounts,
    });
  },

  // --- ASSISTIVE AI WITH HIGH THINKING + DETERMINISTIC FALLBACK ---
  async parseNaturalLanguageQuery(query: string): Promise<{
    category: string;
    keywords: string[];
    matches: Array<{ resourceId: string; reason: string }>;
    reasoningSummary: string;
    source: string;
  }> {
    const db = await getDb();
    const actor = await getAuthenticatedActor();
    const resources = db.resources.filter((r) => r.organizationId === actor.organizationId);

    try {
      const res = await fetch('/api/ai/parse-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          resourcesSummary: resources.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            description: r.description,
            location: r.location,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile returned IDs against canonical database records per RULES.md Section 12
        const validIds = new Set(resources.map((r) => r.id));
        const reconciledMatches = (data.matches || []).filter((m: { resourceId: string }) =>
          validIds.has(m.resourceId)
        );
        return {
          ...data,
          matches: reconciledMatches,
          source: 'Gemini 4 Argon (High Thinking · Reconciled against DB)',
        };
      }
    } catch {
      // Fall through to deterministic parser
    }

    return deterministicParseDiscoveryQuery(query, resources);
  },

  async structureIncidentDraft(rawNotes: string, resourceName: string): Promise<{
    category: Incident['category'];
    reportedStage: string;
    affectedPart: string;
    structuredDescription: string;
    suggestedCheckpoints: string[];
    requiresHumanReview: true;
    source: string;
  }> {
    try {
      const res = await fetch('/api/ai/structure-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, resourceName }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ...data,
          requiresHumanReview: true,
        };
      }
    } catch {
      // Fall through to deterministic structurer
    }

    return deterministicStructureIncident(rawNotes, resourceName);
  },
};
