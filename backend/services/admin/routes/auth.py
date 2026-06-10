from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from dependencies import get_current_admin, ADMIN_COOKIE_NAME
from packages.common.src.models import User
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse, AdminRefreshRequest
from services import auth_service


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_admin_cookie(response: Response, request: Request, token: str) -> None:
    """Bake the admin JWT into an httpOnly cookie so it can never be
    exfiltrated by XSS in the admin SPA. Secure flag follows the request
    scheme (X-Forwarded-Proto from nginx); SameSite=strict because the
    admin app is single-origin."""
    s = get_settings()
    is_https = (
        request.headers.get("x-forwarded-proto", "").lower().startswith("https")
        or request.url.scheme == "https"
    )
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite="strict",
        path="/",
        max_age=s.ADMIN_JWT_EXPIRY_HOURS * 3600,
    )


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(
    body: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Brute-force throttle (audit C4) — admin accounts move funds, so
    # cap login attempts per IP + per submitted email. 5 attempts / 5 min.
    # Uses the spoof-resistant client IP (X-Real-IP set by our nginx, not
    # the forgeable left-most X-Forwarded-For — audit H3).
    from fastapi import HTTPException
    from packages.common.src.redis_client import throttle
    from packages.common.src.rate_limit import client_key
    client_ip = client_key(request)
    email_id = (body.email or "").strip().lower()
    for ident in (f"ip:{client_ip}", f"email:{email_id}"):
        if not await throttle("admin_login", ident, max_hits=5, window_sec=300):
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Try again in a few minutes.",
            )
    out = await auth_service.admin_login(body=body, db=db)
    _set_admin_cookie(response, request, out.access_token)
    return out


@router.post("/refresh", response_model=AdminLoginResponse)
async def admin_refresh(
    body: AdminRefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    out = await auth_service.admin_refresh(body=body, db=db)
    _set_admin_cookie(response, request, out.access_token)
    return out


@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie(ADMIN_COOKIE_NAME, path="/", samesite="strict")
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_admin_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    out = await auth_service.change_admin_password(
        admin=admin,
        current_password=body.current_password,
        new_password=body.new_password,
        db=db,
    )
    # Refresh THIS session's cookie to the re-minted token so the admin
    # who changed their password isn't bounced (audit H2). All other
    # outstanding tokens are now revoked by the password-epoch change.
    if out.get("access_token"):
        _set_admin_cookie(response, request, out["access_token"])
    return out


@router.get("/me")
async def get_admin_me(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.get_admin_me(admin=admin, db=db)
