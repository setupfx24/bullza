"""JWT authentication and password utilities."""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, datetime]:
    # Timezone-aware UTC: avoids asyncpg/timestamptz issues and PyJWT edge cases with naive datetimes.
    now = datetime.now(timezone.utc)
    expires = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES))
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expires,
        "iat": now,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_epoch(password_hash: str | None) -> str:
    """Short, stable fingerprint of a user's bcrypt hash, embedded in
    admin JWTs as the `pe` claim (audit H2). It lets us revoke every
    outstanding token — access AND refresh — the instant the password
    changes, with no token-version table / migration: a new hash yields
    a new fingerprint, so any token minted against the old password no
    longer validates. The bcrypt hash itself never leaves the server."""
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]


# ─── Email-verify token (separate JWT type, can't be used as a session) ──

def create_email_verify_token(user_id: str, *, expires_hours: int = 24) -> tuple[str, datetime]:
    """Mint a short-lived JWT for the verify-email click link. Includes an
    explicit `type=email_verify` claim so a leaked token can't be replayed
    on /auth/me or any session-cookie path."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=expires_hours)
    payload = {
        "sub": user_id,
        "type": "email_verify",
        "exp": expires,
        "iat": now,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_email_verify_token(token: str) -> Optional[dict]:
    """Decode + validate an email-verify token. Returns None on any failure
    (expired, bad signature, malformed, wrong type). Caller decides the
    user-facing error message."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    if payload.get("type") != "email_verify":
        return None
    return payload


def _extract_bearer_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials
    st = get_settings()
    return request.cookies.get(st.ACCESS_TOKEN_COOKIE_NAME)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = _extract_bearer_token(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    return {
        "user_id": UUID(payload["sub"]),
        "role": payload["role"],
    }


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user
