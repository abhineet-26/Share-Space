from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError as FastAPIRequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} not found",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "identifier": identifier},
        )


class ForbiddenError(AppException):
    def __init__(self, action: str, required_roles: list[str], current_roles: list[str]):
        super().__init__(
            code="FORBIDDEN",
            message=f"Permission denied: {action} requires one of [{', '.join(required_roles)}]. Your active role is [{', '.join(current_roles)}].",
            status_code=status.HTTP_403_FORBIDDEN,
            details={
                "action": action,
                "required_roles": required_roles,
                "current_roles": current_roles,
            },
        )


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Please sign in with a valid account."):
        super().__init__(
            code="UNAUTHENTICATED",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class RequestValidationError(AppException):
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class ConflictError(AppException):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code=code,
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class InvalidStateTransitionError(AppException):
    def __init__(self, from_state: str, to_state: str, allowed: list[str]):
        super().__init__(
            code="INVALID_STATE_TRANSITION",
            message=f"Cannot transition from {from_state} to {to_state}. Allowed next states: {', '.join(allowed) or 'none'}.",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"from_state": from_state, "to_state": to_state, "allowed_states": allowed},
        )


class ReasonRequiredError(AppException):
    def __init__(self, action: str, min_length: int = 5):
        super().__init__(
            code="REASON_REQUIRED",
            message=f"A clear reason (at least {min_length} characters) is required for {action}.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"action": action, "min_length": min_length},
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning(
        "application_error",
        code=exc.code,
        message=exc.message,
        path=request.url.path,
        method=request.method,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


async def fastapi_validation_exception_handler(
    request: Request, exc: FastAPIRequestValidationError
) -> JSONResponse:
    logger.warning(
        "validation_error",
        errors=exc.errors(),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )


async def pydantic_validation_exception_handler(
    request: Request, exc: PydanticValidationError
) -> JSONResponse:
    logger.warning(
        "pydantic_validation_error",
        errors=exc.errors(),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    logger.error(
        "integrity_error",
        error=str(exc.orig),
        path=request.url.path,
        method=request.method,
    )
    error_str = str(exc.orig).lower()
    if "unique constraint" in error_str or "duplicate key" in error_str:
        if "idempotency" in error_str:
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error": {
                        "code": "IDEMPOTENCY_CONFLICT",
                        "message": "A request with this idempotency key already exists",
                        "details": {},
                    }
                },
            )
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "DUPLICATE_ENTRY",
                    "message": "A record with this value already exists",
                    "details": {},
                }
            },
        )
    if "exclude" in error_str or "overlap" in error_str:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "code": "OVERLAP_CONFLICT",
                    "message": "Time slot overlaps an existing confirmed booking",
                    "details": {},
                }
            },
        )
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "error": {
                "code": "INTEGRITY_ERROR",
                "message": "Database constraint violation",
                "details": {},
            }
        },
    )


async def operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    logger.error(
        "operational_error",
        error=str(exc.orig),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database connection failed",
                "details": {},
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(FastAPIRequestValidationError, fastapi_validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(PydanticValidationError, pydantic_validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(OperationalError, operational_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)  # type: ignore[arg-type]
