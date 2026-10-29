from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.assets import router as assets_router
from app.api.v1.auth import router as auth_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.eligibility import router as eligibility_router
from app.api.v1.policies import router as policies_router
from app.api.v1.resources import router as resources_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(resources_router)
api_router.include_router(assets_router)
api_router.include_router(policies_router)
api_router.include_router(eligibility_router)
api_router.include_router(bookings_router)


