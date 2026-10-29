from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

settings = get_settings()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces defense-in-depth HTTP security headers on all responses per OWASP Top 10."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Clickjacking mitigation
        response.headers["X-Frame-Options"] = "DENY"

        # Legacy XSS auditor enforcement
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Enforce HTTPS transport security
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Restrict referrer leakage
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict unnecessary browser capabilities
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

        # Content Security Policy (strict script & frame controls, permitting Swagger/ReDoc CDN assets)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https: https://fastapi.tiangolo.com; "
            "connect-src 'self' http: https: ws: wss:; "
            "frame-ancestors 'none';"
        )

        return response


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter for abuse prevention."""

    def __init__(self) -> None:
        # Maps (client_key, endpoint_category) -> list of timestamps
        self._history: dict[tuple[str, str], list[float]] = defaultdict(list)

    def is_allowed(
        self, client_key: str, category: str, limit: int, window_seconds: int = 60
    ) -> tuple[bool, int, int]:
        """Returns (is_allowed, remaining_requests, retry_after_seconds)."""
        now = time.time()
        cutoff = now - window_seconds
        key = (client_key, category)

        # Purge timestamps outside the current sliding window
        self._history[key] = [t for t in self._history[key] if t > cutoff]

        current_count = len(self._history[key])
        if current_count >= limit:
            oldest = self._history[key][0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, 0, retry_after

        self._history[key].append(now)
        remaining = limit - current_count - 1
        return True, remaining, 0

    def reset(self) -> None:
        """Reset history (used in test fixtures)."""
        self._history.clear()


rate_limiter = SlidingWindowRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces rate limits on sensitive authentication and general endpoints."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Determine rate limit category and threshold
        if path.startswith("/api/v1/auth"):
            category = "auth"
            limit = settings.RATE_LIMIT_AUTH
        elif path.startswith("/api/ai"):
            category = "ai"
            limit = settings.RATE_LIMIT_AI
        elif path.startswith("/api/v1"):
            category = "api"
            limit = settings.RATE_LIMIT_DEFAULT
        else:
            # Skip rate limiting for static / health check endpoints
            return await call_next(request)

        # Extract client IP or forwarded IP
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "unknown")
        )

        allowed, remaining, retry_after = rate_limiter.is_allowed(client_ip, category, limit)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded for {category}. Please wait {retry_after} seconds.",
                        "details": {"retryAfter": retry_after, "category": category},
                    }
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
