from __future__ import annotations

import csv
import io

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Booking,
    BookingStatus,
    Incident,
    Resource,
    ResourceCategory,
    User,
)
from app.schemas.analytics import (
    AnalyticsUtilisationResponse,
    DemandByHourBlockItem,
    FairnessByUserItem,
    OutcomeCountItem,
    ResourceMetricItem,
)

COUNTED_UTILISATION_STATES = [
    BookingStatus.APPROVED,
    BookingStatus.CHECKED_OUT_TO_USER,
    BookingStatus.RETURN_PENDING_CONFIRMATION,
    BookingStatus.RETURNED,
    BookingStatus.OVERDUE,
    BookingStatus.CLOSED,
]


async def calculate_analytics_data(
    session: AsyncSession,
    organization_id: str,
) -> AnalyticsUtilisationResponse:
    """Calculate resource utilisation, fairness, demand, and booking outcomes for an organization."""
    # 1. Fetch resources
    res_stmt = select(Resource).where(Resource.organization_id == organization_id)
    res_result = await session.execute(res_stmt)
    resources = list(res_result.scalars().all())

    # 2. Fetch bookings
    bkg_stmt = select(Booking).where(Booking.organization_id == organization_id)
    bkg_result = await session.execute(bkg_stmt)
    bookings = list(bkg_result.scalars().all())

    # 3. Fetch incidents
    inc_stmt = select(Incident).where(Incident.organization_id == organization_id)
    inc_result = await session.execute(inc_stmt)
    incidents = list(inc_result.scalars().all())

    # 4. Fetch users
    usr_stmt = select(User).where(User.organization_id == organization_id)
    usr_result = await session.execute(usr_stmt)
    users = list(usr_result.scalars().all())

    # Resource metrics
    resource_metrics: list[ResourceMetricItem] = []
    for res in resources:
        res_bookings = [
            b
            for b in bookings
            if b.resource_id == res.id and b.status in COUNTED_UTILISATION_STATES
        ]
        booked_hours = sum(
            max(0.0, (b.end_at - b.start_at).total_seconds() / 3600.0) for b in res_bookings
        )
        booked_hours = round(booked_hours * 10) / 10
        available_hours = 40.0
        utilisation_pct = min(100, round((booked_hours / available_hours) * 100))
        waitlisted_count = sum(
            1 for b in bookings if b.resource_id == res.id and b.status == BookingStatus.WAITLISTED
        )
        incident_count = sum(1 for inc in incidents if inc.resource_id == res.id)

        name_display = res.name.split(" (")[0]
        cat_str = res.category.value if hasattr(res.category, "value") else str(res.category)
        resource_metrics.append(
            ResourceMetricItem(
                resource_id=res.id,
                name=name_display,
                category=cat_str,
                booked_hours=booked_hours,
                available_hours=available_hours,
                utilisation_pct=utilisation_pct,
                waitlisted_count=waitlisted_count,
                incident_count=incident_count,
            )
        )

    # Total booked hours across all users
    total_booked_hours = sum(
        (b.end_at - b.start_at).total_seconds() / 3600.0
        for b in bookings
        if b.status in COUNTED_UTILISATION_STATES
    )
    total_benchmark = max(0.1, total_booked_hours)

    # Fairness by user
    fairness_by_user: list[FairnessByUserItem] = []
    for u in users:
        actor_roles = [r.value if hasattr(r, "value") else str(r) for r in u.roles]
        if "USER" not in actor_roles:
            continue

        user_bookings = [b for b in bookings if b.user_id == u.id]
        user_counted = [b for b in user_bookings if b.status in COUNTED_UTILISATION_STATES]
        user_booked_hours = sum(
            max(0.0, (b.end_at - b.start_at).total_seconds() / 3600.0) for b in user_counted
        )
        user_booked_hours = round(user_booked_hours * 10) / 10
        share_pct = round((user_booked_hours / total_benchmark) * 100)

        academic_group_str = (
            u.academic_group.value
            if hasattr(u.academic_group, "value")
            else (str(u.academic_group) if u.academic_group else "COURSEWORK")
        )
        fairness_by_user.append(
            FairnessByUserItem(
                user_id=u.id,
                name=u.name,
                academic_group=academic_group_str,
                booked_hours=user_booked_hours,
                share_pct=share_pct,
                requests_count=len(user_bookings),
            )
        )
    fairness_by_user.sort(key=lambda x: x.booked_hours, reverse=True)

    # Demand by hour block
    resource_cat_map = {
        r.id: (r.category.value if hasattr(r.category, "value") else str(r.category))
        for r in resources
    }
    blocks_def = [
        ("08:00–11:00", 8, 11),
        ("11:00–14:00", 11, 14),
        ("14:00–17:00", 14, 17),
        ("17:00–20:00", 17, 20),
    ]
    demand_by_hour_block: list[DemandByHourBlockItem] = []
    for label, start_h, end_h in blocks_def:
        block_bookings = [b for b in bookings if start_h <= b.start_at.hour < end_h]
        electronics_cnt = sum(
            1
            for b in block_bookings
            if resource_cat_map.get(b.resource_id) == ResourceCategory.ELECTRONICS.value
        )
        media_cnt = sum(
            1
            for b in block_bookings
            if resource_cat_map.get(b.resource_id) == ResourceCategory.MEDIA_COMPUTING.value
        )
        spaces_cnt = sum(
            1
            for b in block_bookings
            if resource_cat_map.get(b.resource_id) == ResourceCategory.SPACE.value
        )
        demand_by_hour_block.append(
            DemandByHourBlockItem(
                block=label,
                electronics=electronics_cnt,
                media_computing=media_cnt,
                spaces=spaces_cnt,
            )
        )

    # Outcome counts
    status_counts: dict[str, int] = {}
    for b in bookings:
        st_val = b.status.value if hasattr(b.status, "value") else str(b.status)
        status_counts[st_val] = status_counts.get(st_val, 0) + 1
    outcome_counts = [
        OutcomeCountItem(status=st, count=cnt) for st, cnt in sorted(status_counts.items())
    ]

    return AnalyticsUtilisationResponse(
        resource_metrics=resource_metrics,
        fairness_by_user=fairness_by_user,
        demand_by_hour_block=demand_by_hour_block,
        outcome_counts=outcome_counts,
    )


def generate_utilisation_csv(data: AnalyticsUtilisationResponse) -> str:
    """Generate RFC 4180 CSV export of resource utilisation metrics."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Resource ID",
            "Resource Name",
            "Category",
            "Booked Hours",
            "Available Hours",
            "Utilisation %",
            "Waitlisted Requests",
            "Incident Count",
        ]
    )
    for item in data.resource_metrics:
        writer.writerow(
            [
                item.resource_id,
                item.name,
                item.category,
                f"{item.booked_hours:.1f}",
                f"{item.available_hours:.1f}",
                f"{item.utilisation_pct}%",
                item.waitlisted_count,
                item.incident_count,
            ]
        )
    return output.getvalue()
