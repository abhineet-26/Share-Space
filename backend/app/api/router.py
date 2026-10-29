from __future__ import annotations

from fastapi import APIRouter

api_router = APIRouter()

# Placeholder - actual routes will be added in subsequent phases
@api_router.get("/test", tags=["Test"])
async def test_endpoint():
    return {"message": "API v1 is working", "status": "ok"}
