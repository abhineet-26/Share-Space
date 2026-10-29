from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, generate_id


class Role(str, enum.Enum):
    USER = "USER"
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"


class BookingStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    NEEDS_INFORMATION = "NEEDS_INFORMATION"
    ELIGIBILITY_BLOCKED = "ELIGIBILITY_BLOCKED"
    PENDING_REVIEW = "PENDING_REVIEW"
    WAITLISTED = "WAITLISTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    CHECKED_OUT_TO_USER = "CHECKED_OUT_TO_USER"
    RETURN_PENDING_CONFIRMATION = "RETURN_PENDING_CONFIRMATION"
    RETURNED = "RETURNED"
    OVERDUE = "OVERDUE"
    CLOSED = "CLOSED"


class ResourceCategory(str, enum.Enum):
    ELECTRONICS = "ELECTRONICS"
    MEDIA_COMPUTING = "MEDIA_COMPUTING"
    SPACE = "SPACE"


class ResourceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    PAUSED = "PAUSED"
    MAINTENANCE = "MAINTENANCE"
    ARCHIVED = "ARCHIVED"


class SupervisionLevel(str, enum.Enum):
    NONE = "NONE"
    STAFF_CONFIRMATION = "STAFF_CONFIRMATION"
    STAFF_PRESENT = "STAFF_PRESENT"


class ConditionLevel(str, enum.Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    MINOR_WEAR = "MINOR_WEAR"
    NEEDS_ATTENTION = "NEEDS_ATTENTION"


class IncidentStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    AWAITING_INFO = "AWAITING_INFO"
    RESOLVED = "RESOLVED"


class PolicyScopeType(str, enum.Enum):
    ORG = "ORG"
    CATEGORY = "CATEGORY"
    RESOURCE = "RESOURCE"


class PolicyKind(str, enum.Enum):
    ELIGIBILITY = "ELIGIBILITY"
    USAGE_CAP = "USAGE_CAP"
    PRIORITY = "PRIORITY"
    APPROVAL_CHAIN = "APPROVAL_CHAIN"
    CANCELLATION = "CANCELLATION"
    RETURN_WINDOW = "RETURN_WINDOW"


class PolicyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    RETIRED = "RETIRED"


class CheckStatus(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class TrainingStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    PENDING = "PENDING"
    EXPIRED = "EXPIRED"
    NONE = "NONE"


class AssetStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    IN_USE = "IN_USE"
    MAINTENANCE = "MAINTENANCE"


class LedgerEntityType(str, enum.Enum):
    RESOURCE = "RESOURCE"
    BOOKING = "BOOKING"
    CONDITION_REPORT = "CONDITION_REPORT"
    INCIDENT = "INCIDENT"
    POLICY = "POLICY"
    USER_ROLE = "USER_ROLE"
    TRAINING = "TRAINING"
    LEDGER = "LEDGER"


class NotificationType(str, enum.Enum):
    DECISION = "DECISION"
    WAITLIST_CHANGE = "WAITLIST_CHANGE"
    CANCELLATION = "CANCELLATION"
    UPCOMING_BOOKING = "UPCOMING_BOOKING"
    OVERDUE_RETURN = "OVERDUE_RETURN"
    INCIDENT_UPDATE = "INCIDENT_UPDATE"


class OutboxStatus(str, enum.Enum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    RETRIED = "RETRIED"
    FAILED = "FAILED"


class RequirementType(str, enum.Enum):
    TRAINING = "TRAINING"
    MEMBERSHIP = "MEMBERSHIP"
    QUALIFICATION = "QUALIFICATION"
    APPROVAL = "APPROVAL"


class VerificationStatus(str, enum.Enum):
    VERIFIED = "VERIFIED"
    PENDING = "PENDING"
    UNVERIFIED = "UNVERIFIED"


class AcademicGroup(str, enum.Enum):
    UNDERGRAD_CAPSTONE = "UNDERGRAD_CAPSTONE"
    GRAD_RESEARCH = "GRAD_RESEARCH"
    COURSEWORK = "COURSEWORK"
    STAFF = "STAFF"
    COMMUNITY = "COMMUNITY"


class Organization(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("org"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    department_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    retention_days: Mapped[int] = mapped_column(default=365, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    users: Mapped[list[User]] = relationship("User", back_populates="organization", lazy="dynamic")
    resources: Mapped[list[Resource]] = relationship("Resource", back_populates="organization", lazy="dynamic")
    policies: Mapped[list[Policy]] = relationship("Policy", back_populates="organization", lazy="dynamic")
    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="organization", lazy="dynamic")
    bookings: Mapped[list[Booking]] = relationship("Booking", back_populates="organization", lazy="dynamic")
    ledger_events: Mapped[list[LedgerEvent]] = relationship("LedgerEvent", back_populates="organization", lazy="dynamic")


class User(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("usr"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    roles: Mapped[list[Role]] = mapped_column(JSONB, default=list, nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    academic_group: Mapped[AcademicGroup | None] = mapped_column(
        Enum(AcademicGroup, native_enum=False), nullable=True
    )
    verification: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False), default=VerificationStatus.UNVERIFIED, nullable=False
    )
    demo_persona_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="users")
    trainings: Mapped[list[TrainingRecord]] = relationship("TrainingRecord", back_populates="user", lazy="dynamic")
    bookings: Mapped[list[Booking]] = relationship("Booking", back_populates="user", lazy="dynamic")
    condition_reports: Mapped[list[ConditionReport]] = relationship(
        "ConditionReport",
        primaryjoin="User.id == foreign(ConditionReport.reporter_id)",
        lazy="dynamic",
    )
    incidents: Mapped[list[Incident]] = relationship(
        "Incident",
        primaryjoin="User.id == foreign(Incident.reporter_id)",
        lazy="dynamic",
    )
    notifications: Mapped[list[Notification]] = relationship("Notification", back_populates="user", lazy="dynamic")


class TrainingRecord(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("trn"))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TrainingStatus] = mapped_column(
        Enum(TrainingStatus, native_enum=False), default=TrainingStatus.NONE, nullable=False
    )
    source: Mapped[str] = mapped_column(String(500), nullable=False)
    verified_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="trainings")

    __table_args__ = (
        Index("ix_training_user_type_org", "user_id", "type", "organization_id", unique=True),
    )


class Resource(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("res"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), nullable=False, index=True
    )
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[ResourceCategory] = mapped_column(
        Enum(ResourceCategory, native_enum=False), nullable=False, index=True
    )
    illustration_type: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    access_instructions: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[ConditionLevel] = mapped_column(
        Enum(ConditionLevel, native_enum=False), nullable=False
    )
    status: Mapped[ResourceStatus] = mapped_column(
        Enum(ResourceStatus, native_enum=False), default=ResourceStatus.DRAFT, nullable=False, index=True
    )
    supervision: Mapped[SupervisionLevel] = mapped_column(
        Enum(SupervisionLevel, native_enum=False), default=SupervisionLevel.NONE, nullable=False
    )
    accessories: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    usage_rules: Mapped[str] = mapped_column(Text, nullable=False)
    return_rules: Mapped[str] = mapped_column(Text, nullable=False)
    cancellation_policy: Mapped[str] = mapped_column(Text, nullable=False)
    policy_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="resources")
    owner: Mapped[User] = relationship("User", foreign_keys=[owner_id])
    requirements: Mapped[list[ResourceRequirement]] = relationship("ResourceRequirement", back_populates="resource", lazy="dynamic", cascade="all, delete-orphan")
    availability: Mapped[list[AvailabilityWindow]] = relationship("AvailabilityWindow", back_populates="resource", lazy="dynamic", cascade="all, delete-orphan")
    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="resource", lazy="dynamic")
    bookings: Mapped[list[Booking]] = relationship("Booking", back_populates="resource", lazy="dynamic")


class ResourceRequirement(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("req"))
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[RequirementType] = mapped_column(Enum(RequirementType, native_enum=False), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    resource: Mapped[Resource] = relationship("Resource", back_populates="requirements")

    __table_args__ = (
        UniqueConstraint("resource_id", "key", name="uq_resource_requirement_key"),
    )


class AvailabilityWindow(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("av"))
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_of_week: Mapped[str | None] = mapped_column(String(20), nullable=True)
    start: Mapped[str] = mapped_column(String(10), nullable=False)
    end: Mapped[str] = mapped_column(String(10), nullable=False)
    recurrence: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    resource: Mapped[Resource] = relationship("Resource", back_populates="availability")


class Asset(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("ast"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_tag: Mapped[str] = mapped_column(String(100), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False)
    qr_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    condition: Mapped[ConditionLevel] = mapped_column(
        Enum(ConditionLevel, native_enum=False), nullable=False
    )
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, native_enum=False), default=AssetStatus.AVAILABLE, nullable=False
    )
    last_calibrated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="assets")
    resource: Mapped[Resource] = relationship("Resource", back_populates="assets")

    __table_args__ = (
        UniqueConstraint("organization_id", "asset_tag", name="uq_asset_tag_per_org"),
    )


class Policy(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("pol"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    scope_type: Mapped[PolicyScopeType] = mapped_column(
        Enum(PolicyScopeType, native_enum=False), nullable=False
    )
    scope_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    scope_label: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[PolicyKind] = mapped_column(Enum(PolicyKind, native_enum=False), nullable=False)
    status: Mapped[PolicyStatus] = mapped_column(
        Enum(PolicyStatus, native_enum=False), default=PolicyStatus.DRAFT, nullable=False
    )
    active_version: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="policies")
    versions: Mapped[list[PolicyVersion]] = relationship("PolicyVersion", back_populates="policy", lazy="dynamic", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_policy_scope", "scope_type", "scope_id"),
    )


class PolicyVersion(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("polv"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_id: Mapped[str] = mapped_column(
        ForeignKey("policy.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(nullable=False)
    definition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by_name: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    organization: Mapped[Organization] = relationship("Organization")
    policy: Mapped[Policy] = relationship("Policy", back_populates="versions")

    __table_args__ = (
        UniqueConstraint("policy_id", "version", name="uq_policy_version"),
    )


class Booking(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("bkg"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    project_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    team_members: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, native_enum=False), default=BookingStatus.REQUESTED, nullable=False, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    policy_version_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    eligibility_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    waitlist_position: Mapped[int | None] = mapped_column(nullable=True)
    waitlist_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority_factors: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_policy_override: Mapped[bool] = mapped_column(default=False, nullable=False)
    handover_confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    handover_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    return_confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    return_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization", back_populates="bookings")
    resource: Mapped[Resource] = relationship("Resource", back_populates="bookings")
    user: Mapped[User] = relationship("User", back_populates="bookings")
    condition_reports: Mapped[list[ConditionReport]] = relationship("ConditionReport", back_populates="booking", lazy="dynamic")
    incidents: Mapped[list[Incident]] = relationship("Incident", back_populates="booking", lazy="dynamic")

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_booking_idempotency"),
        Index("ix_booking_resource_time_status", "resource_id", "start_at", "end_at", "status"),
    )


class ConditionReport(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("cr"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[str] = mapped_column(
        ForeignKey("booking.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    condition: Mapped[ConditionLevel] = mapped_column(
        Enum(ConditionLevel, native_enum=False), nullable=False
    )
    accessories: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    attachment_hashes: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    acknowledged_rules: Mapped[bool] = mapped_column(default=False, nullable=False)
    reporter_id: Mapped[str] = mapped_column(String(100), nullable=False)
    reporter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actual_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    staff_confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    staff_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    organization: Mapped[Organization] = relationship("Organization")
    booking: Mapped[Booking] = relationship("Booking", back_populates="condition_reports")

    __table_args__ = (
        Index("ix_condition_report_booking_stage", "booking_id", "stage", unique=True),
    )


class Incident(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("inc"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[str] = mapped_column(
        ForeignKey("booking.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[str] = mapped_column(String(100), nullable=False)
    reporter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    reported_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    affected_part: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    attachment_hashes: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, native_enum=False), default=IncidentStatus.REPORTED, nullable=False
    )
    reviewer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reviewer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolution_outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requires_human_review: Mapped[bool] = mapped_column(default=True, nullable=False)
    assisted_draft_used: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship("Organization")
    booking: Mapped[Booking] = relationship("Booking", back_populates="incidents")
    resource: Mapped[Resource] = relationship("Resource")
    comments: Mapped[list[IncidentComment]] = relationship("IncidentComment", back_populates="incident", lazy="dynamic", cascade="all, delete-orphan")


class IncidentComment(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("cmt"))
    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incident.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[str] = mapped_column(String(100), nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    incident: Mapped[Incident] = relationship("Incident", back_populates="comments")


class Attachment(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("att"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(100), nullable=False)
    linked_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linked_entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confirmed: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    organization: Mapped[Organization] = relationship("Organization")


class LedgerEvent(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("led"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[LedgerEntityType] = mapped_column(
        Enum(LedgerEntityType, native_enum=False), nullable=False
    )
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)

    organization: Mapped[Organization] = relationship("Organization", back_populates="ledger_events")

    __table_args__ = (
        UniqueConstraint("organization_id", "seq", name="uq_ledger_seq_per_org"),
        Index("ix_ledger_entity", "entity_type", "entity_id"),
    )


class Notification(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("notif"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, native_enum=False), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    related_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    outbox_status: Mapped[OutboxStatus] = mapped_column(
        Enum(OutboxStatus, native_enum=False), default=OutboxStatus.DELIVERED, nullable=False
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    organization: Mapped[Organization] = relationship("Organization")
    user: Mapped[User] = relationship("User", back_populates="notifications")


class OutboxEvent(Base):
    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: generate_id("out"))
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organization.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[OutboxStatus] = mapped_column(
        Enum(OutboxStatus, native_enum=False), default=OutboxStatus.PENDING, nullable=False
    )
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    organization: Mapped[Organization] = relationship("Organization")

    __table_args__ = (
        Index("ix_outbox_status_next_retry", "status", "next_retry_at"),
    )
