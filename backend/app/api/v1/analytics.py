from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models import Role, User
from app.schemas.analytics import AnalyticsUtilisationResponse
from app.services.analytics import calculate_analytics_data, generate_utilisation_csv

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/utilisation", response_model=AnalyticsUtilisationResponse)
async def get_utilisation_analytics(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AnalyticsUtilisationResponse:
    """Retrieve operational utilisation, user fairness, and outcome metrics for the current institution."""
    return await calculate_analytics_data(
        session=session,
        organization_id=current_user.organization_id,
    )


@router.get("/export")
async def export_utilisation_csv(
    current_user: User = Depends(require_roles([Role.OWNER, Role.MANAGER, Role.ADMIN])),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Export resource utilisation metrics as an RFC 4180 CSV spreadsheet."""
    data = await calculate_analytics_data(
        session=session,
        organization_id=current_user.organization_id,
    )
    csv_content = generate_utilisation_csv(data)
    filename = f"sharespace_utilisation_{current_user.organization_id}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
