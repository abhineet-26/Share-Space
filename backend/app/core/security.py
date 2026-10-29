from __future__ import annotations

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

settings = get_settings()


class TokenData(BaseModel):
    user_id: str
    organization_id: str
    roles: list[str]
    exp: int


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


class InvalidTokenError(UnauthorizedError):
    """Raised when token is invalid or missing required claims."""
    pass


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        organization_id: str = payload.get("organization_id")
        roles: list[str] = payload.get("roles", [])
        exp: int = payload.get("exp", 0)

        if user_id is None or organization_id is None:
            raise InvalidTokenError("Invalid token: missing user or organization")

        return TokenData(user_id=user_id, organization_id=organization_id, roles=roles, exp=exp)
    except JWTError as e:
        raise InvalidTokenError("Invalid token") from e


def verify_token(token: str) -> TokenData:
    return decode_token(token)
