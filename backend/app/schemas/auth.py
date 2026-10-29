from __future__ import annotations

from app.models import AcademicGroup, Role, VerificationStatus
from app.schemas.base import CamelModel


class OrganizationRead(CamelModel):
    id: str
    name: str
    domain: str
    department_code: str | None = None
    timezone: str = "Asia/Kolkata"
    retention_days: int = 365


class UserRead(CamelModel):
    id: str
    organization_id: str
    name: str
    email: str
    roles: list[Role]
    department: str
    academic_group: AcademicGroup | None = None
    verification: VerificationStatus = VerificationStatus.UNVERIFIED
    demo_persona_note: str | None = None


class MeResponse(CamelModel):
    user: UserRead
    organization: OrganizationRead
    all_demo_users: list[UserRead]
    all_organizations: list[OrganizationRead]


class DemoLoginRequest(CamelModel):
    user_id: str


class DemoLoginResponse(CamelModel):
    user: UserRead
    organization: OrganizationRead
    token: str | None = None


class UpdateUserRolesRequest(CamelModel):
    roles: list[Role]
    reason: str
