export type Role = 'USER' | 'OWNER' | 'MANAGER' | 'ADMIN';

export type CheckStatus = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';

export type BookingStatus =
  | 'REQUESTED'
  | 'NEEDS_INFORMATION'
  | 'ELIGIBILITY_BLOCKED'
  | 'PENDING_REVIEW'
  | 'WAITLISTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CHECKED_OUT_TO_USER'
  | 'RETURN_PENDING_CONFIRMATION'
  | 'RETURNED'
  | 'OVERDUE'
  | 'CLOSED';

export type ResourceCategory = 'ELECTRONICS' | 'MEDIA_COMPUTING' | 'SPACE';

export type ResourceStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'MAINTENANCE' | 'ARCHIVED';

export type SupervisionLevel = 'NONE' | 'STAFF_CONFIRMATION' | 'STAFF_PRESENT';

export type ConditionLevel = 'EXCELLENT' | 'GOOD' | 'MINOR_WEAR' | 'NEEDS_ATTENTION';

export type IncidentStatus = 'REPORTED' | 'UNDER_REVIEW' | 'AWAITING_INFO' | 'RESOLVED';

export type PolicyScopeType = 'ORG' | 'CATEGORY' | 'RESOURCE';

export type PolicyKind =
  | 'ELIGIBILITY'
  | 'USAGE_CAP'
  | 'PRIORITY'
  | 'APPROVAL_CHAIN'
  | 'CANCELLATION'
  | 'RETURN_WINDOW';

export interface Organization {
  id: string;
  name: string;
  domain: string;
  departmentCode?: string;
  timezone?: string;
  retentionDays?: number;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  roles: Role[];
  department: string;
  academicGroup?: 'UNDERGRAD_CAPSTONE' | 'GRAD_RESEARCH' | 'COURSEWORK' | 'STAFF' | 'COMMUNITY';
  verification: 'VERIFIED' | 'PENDING' | 'UNVERIFIED';
  demoPersonaNote?: string;
}

export interface TrainingRecord {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  label: string;
  status: 'VERIFIED' | 'PENDING' | 'EXPIRED' | 'NONE';
  source: string;
  verifiedBy?: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface Requirement {
  key: string;
  type: 'TRAINING' | 'MEMBERSHIP' | 'QUALIFICATION' | 'APPROVAL';
  label: string;
  value: string;
}

export interface AvailabilityWindow {
  id: string;
  resourceId: string;
  dayOfWeek?: string;
  start: string;
  end: string;
  recurrence?: string;
}

export interface Asset {
  id: string;
  organizationId: string;
  resourceId: string;
  assetTag: string;
  serialNumber: string;
  qrToken: string;
  condition: ConditionLevel;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
  lastCalibratedAt?: string;
}

export interface Resource {
  id: string;
  organizationId: string;
  ownerId: string;
  ownerName: string;
  department: string;
  name: string;
  modelNumber?: string;
  category: ResourceCategory;
  illustrationType: 'oscilloscope' | 'soldering' | 'powersupply' | 'multimeter' | 'printer3d' | 'camera' | 'lighting' | 'workstation' | 'room_project' | 'room_meeting' | 'laser_cutter' | 'cnc_router';
  location: string;
  accessInstructions: string;
  description: string;
  condition: ConditionLevel;
  status: ResourceStatus;
  requirements: Requirement[];
  supervision: SupervisionLevel;
  accessories: string[];
  usageRules: string;
  returnRules: string;
  cancellationPolicy: string;
  availability: AvailabilityWindow[];
  policyIds: string[];
}

export interface EligibilityCheck {
  key: string;
  label: string;
  status: CheckStatus;
  reason: string;
  nextStep?: string;
}

export interface EligibilityEvaluationResult {
  eligible: boolean;
  overallStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REVIEW_REQUIRED';
  checks: EligibilityCheck[];
  appliedPolicyVersionIds: string[];
  usageHoursInWindow: number;
  maxHoursAllowed: number;
  requestedHours: number;
}

export interface Booking {
  id: string;
  organizationId: string;
  resourceId: string;
  userId: string;
  start: string;
  end: string;
  purpose: string;
  projectCode?: string;
  teamMembers?: string[];
  status: BookingStatus;
  idempotencyKey: string;
  policyVersionIds: string[];
  eligibilityChecks: EligibilityCheck[];
  waitlistPosition?: number;
  waitlistReason?: string;
  priorityFactors?: {
    academicPriority: string;
    recentHoursUsed: number;
    requestedAt: string;
    explanation: string;
  };
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
  isPolicyOverride?: boolean;
  handoverConfirmedBy?: string;
  handoverConfirmedAt?: string;
  returnConfirmedBy?: string;
  returnConfirmedAt?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataUrl: string;
  uploadedBy: string;
  linkedEntityType?: 'CONDITION_REPORT' | 'INCIDENT';
  linkedEntityId?: string;
  confirmed: boolean;
  createdAt: string;
}

export interface ConditionReport {
  id: string;
  organizationId: string;
  bookingId: string;
  stage: 'CHECK_IN' | 'RETURN';
  condition: ConditionLevel;
  accessories: { name: string; present: boolean }[];
  notes: string;
  attachmentIds: string[];
  attachmentHashes: string[];
  acknowledgedRules: boolean;
  reporterId: string;
  reporterName: string;
  actualTimestamp: string;
  staffConfirmedBy?: string;
  staffConfirmedAt?: string;
  createdAt: string;
}

export interface IncidentComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  organizationId: string;
  bookingId: string;
  resourceId: string;
  reporterId: string;
  reporterName: string;
  category:
    | 'Damage / suspected damage'
    | 'Missing accessory'
    | 'Late return'
    | 'Safety concern'
    | 'Booking conflict'
    | 'Other';
  reportedStage?: string;
  affectedPart?: string;
  description: string;
  attachmentIds: string[];
  attachmentHashes: string[];
  status: IncidentStatus;
  reviewerId?: string;
  reviewerName?: string;
  resolutionOutcome?: 'NO_ISSUE_FOUND' | 'MAINTENANCE_SCHEDULED' | 'WEAR_AND_TEAR_LOGGED' | 'TRAINING_REFRESH_RECOMMENDED' | 'ACCESSORY_REPLACED';
  resolution?: string;
  resolvedAt?: string;
  requiresHumanReview: true;
  assistedDraftUsed?: boolean;
  comments: IncidentComment[];
  createdAt: string;
}

export interface LedgerEvent {
  id: string;
  organizationId: string;
  seq: number;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: 'RESOURCE' | 'BOOKING' | 'CONDITION_REPORT' | 'INCIDENT' | 'POLICY' | 'USER_ROLE' | 'TRAINING' | 'LEDGER';
  entityId: string;
  occurredAt: string;
  reason?: string;
  metadata: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface LedgerVerificationResult {
  organizationId: string;
  valid: boolean;
  checkedCount: number;
  headSeq: number;
  headHash: string;
  verifiedAt: string;
  firstInvalidSeq?: number;
  errorDetails?: string;
}

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  scope: {
    type: PolicyScopeType;
    id?: string;
    label: string;
  };
  kind: PolicyKind;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  activeVersion?: number;
}

export interface PolicyVersion {
  id: string;
  organizationId: string;
  policyId: string;
  version: number;
  definition: {
    windowDays?: number;
    maxHoursPerUser?: number;
    appliesToRoles?: Role[];
    minLeadTimeHours?: number;
    maxBookingDurationHours?: number;
    requireVerifiedAccount?: boolean;
    requireTrainingKey?: string;
    gracePeriodMinutes?: number;
    priorityOrder?: string[];
    tieBreaker?: string;
    plainSummary: string;
  };
  effectiveFrom: string;
  createdBy: string;
  createdByName: string;
  reason: string;
}

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: 'DECISION' | 'WAITLIST_CHANGE' | 'CANCELLATION' | 'UPCOMING_BOOKING' | 'OVERDUE_RETURN' | 'INCIDENT_UPDATE';
  title: string;
  message: string;
  relatedEntityId?: string;
  relatedPath?: string;
  outboxStatus: 'DELIVERED' | 'PENDING_WORKER' | 'RETRIED';
  createdAt: string;
  readAt?: string;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
