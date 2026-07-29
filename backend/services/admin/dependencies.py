import uuid
from datetime import datetime
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.models import User, Employee

# Bearer header is auto_error=False because we now also accept the
# `swisdex_admin` httpOnly cookie set by /admin/auth/login. One of the
# two must be present for protected routes.
security = HTTPBearer(auto_error=False)
settings = get_settings()

ADMIN_COOKIE_NAME = "swisdex_admin"

# High-trust permissions deliberately held by NO employee role below.
# Because super_admin bypasses the permission check entirely, gating an
# endpoint on one of these makes it effectively super_admin-only while
# still being grantable to a specific employee later via
# Employee.extra_permissions if the business ever needs it:
#   users.impersonate   — login-as a trader (account takeover)
#   users.delete        — permanently delete a user + their ledger
#   settings.manage     — edit platform/system settings (withdrawal flags…)
#   fixed_return.manage — grant/approve fixed-return locks (payouts)
#   insurance.manage    — edit insurance fee/payout economics
#   funds.approve       — approve/reject a 2nd-admin financial sign-off
#   referral_campaigns.* — create/pause/edit referral bonus campaigns (real payouts)
EMPLOYEE_ROLE_PERMISSIONS = {
    "super_admin": {"*"},
    "trade_manager": {
        "trades.view", "trades.modify", "trades.close", "trades.create",
        "positions.view", "orders.view", "users.view",
        "social.view", "social.manage",
    },
    "support": {
        "tickets.view", "tickets.reply", "tickets.assign",
        "users.view", "deposits.view", "withdrawals.view",
        "kyc.view", "kyc.manage",
        "audit_logs.view",
    },
    "finance": {
        "deposits.view", "deposits.approve", "deposits.reject",
        "withdrawals.view", "withdrawals.approve", "withdrawals.reject",
        "users.view", "users.add_fund", "users.deduct_fund",
        "banks.view", "banks.create", "banks.update",
        "ib.view",
        "kyc.view", "kyc.manage",
        # Finance admins clear RM funding requests (the two-admin approve →
        # credit flow) and assign users to RMs.
        "rm.manage", "rm.assign",
        # Dual-approval (4-eyes) sign-off. Two finance admins approve each
        # other's fund/withdrawal requests; the "can't approve your own"
        # rule still blocks self-approval, so the control stays intact.
        "funds.approve",
    },
    "risk_manager": {
        "trades.view", "positions.view", "users.view",
        "users.ban", "users.block_trading", "users.kill_switch",
        "analytics.view", "exposure.view",
        "audit_logs.view",
    },
    "marketing": {
        "banners.view", "banners.create", "banners.update", "banners.delete",
        "bonus.view", "bonus.create", "bonus.update",
        "ib.view", "ib.manage",
    },
    # Relationship Manager — a limited role that only sees its own assigned
    # users and can raise funding requests (with proof) for them. It cannot
    # approve/credit (that's rm.manage, held by finance/super_admin).
    "rm": {
        # Deliberately NOT users.view — an RM must only ever see the users
        # assigned to them, which the /rm endpoints scope by assigned_rm_id.
        "rm.view", "rm.request",
    },
    # IB Manager (client 2026-07-15) — runs the partner/IB program end to end:
    # the whole Business section (IB program + applications, sub-broker, copy
    # masters, MAM, MLM, user referrals) plus read access to users so they can
    # see who sits under each IB. Deliberately NOT given global config
    # (spreads/charges/swaps) or funds — super_admin can grant those per person
    # via extra_permissions if a particular IB manager needs them.
    "ib_manager": {
        "ib.view", "ib.manage",
        "users.view",
        "social.view", "social.manage",
    },
    # Split finance duties — an employee can be given ONLY deposits or ONLY
    # withdrawals (the combined "finance" role still exists for both).
    "deposit_manager": {
        "deposits.view", "deposits.approve", "deposits.reject",
        "users.view", "kyc.view",
    },
    "withdrawal_manager": {
        "withdrawals.view", "withdrawals.approve", "withdrawals.reject",
        "users.view",
    },
}


async def get_current_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Cookie is preferred (admin frontend uses httpOnly cookies post-rebrand);
    # legacy Bearer header is still accepted while the JS client transitions.
    token = (
        request.cookies.get(ADMIN_COOKIE_NAME)
        or (credentials.credentials if credentials else None)
    )
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(
            token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
        )
        if payload.get("type") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")
        admin_id = payload.get("admin_id")
        if admin_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await db.execute(
        select(User).where(
            User.id == uuid.UUID(admin_id),
            User.role.in_(["admin", "super_admin"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user not found or inactive")

    # Revoke-on-password-change (audit H2): the token carries a `pe`
    # fingerprint of the password hash it was minted against. A mismatch
    # means the password has since changed, so this token is stale.
    # Tokens minted before this claim existed have no `pe` — accept those
    # so the rollout doesn't log every admin out; they age out naturally.
    from packages.common.src.auth import password_epoch
    tok_pe = payload.get("pe")
    if tok_pe is not None and tok_pe != password_epoch(admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked, please log in again")

    return admin


def require_permission(permission: str):
    """FastAPI dependency factory that checks if the current admin has the required permission."""
    async def _check(
        admin: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Only super_admin bypasses the granular permission check.
        #
        # SECURITY (privilege-escalation fix): employees are created with
        # User.role="admin" (employee_service.create) and carry their real
        # privileges in Employee.role. The previous bypass `admin.role in
        # ("admin","super_admin")` therefore let EVERY employee skip the
        # permission check entirely — the whole EMPLOYEE_ROLE_PERMISSIONS
        # map was dead code, so e.g. a 'marketing' or 'support' employee
        # could approve withdrawals, add funds or delete users. Only the
        # true super_admin (seeded role='super_admin', no Employee row)
        # may bypass; role='admin' falls through to its Employee grants.
        if admin.role == "super_admin":
            return admin

        result = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        employee = result.scalar_one_or_none()
        if employee:
            role_perms = EMPLOYEE_ROLE_PERMISSIONS.get(employee.role)
            if role_perms is None:
                # Super-admin-defined custom role (client 2026-06-16) — its
                # permission set lives in employee_custom_roles, resolved here
                # so custom roles behave exactly like the hardcoded ones.
                from sqlalchemy import text as _sql_text
                cr = (await db.execute(
                    _sql_text("SELECT permissions FROM employee_custom_roles WHERE name = :n"),
                    {"n": employee.role},
                )).first()
                role_perms = set(cr[0]) if cr and cr[0] else set()
            extra = set(employee.extra_permissions or [])
            effective = set(role_perms) | extra
            if "*" in effective or permission in effective:
                return admin

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )
    return _check


async def resolve_employee_permissions(admin: User, db: AsyncSession) -> set:
    """Effective permission set for an admin/employee.

    Single source of truth mirrored by require_permission() and /auth/me:
    super_admin → {"*"}; otherwise the role's defaults (built-in OR custom
    role from employee_custom_roles) unioned with extra_permissions. Used to
    scope what an employee SEES (e.g. the notification bell) to exactly what
    they're allowed to act on.
    """
    if admin.role == "super_admin":
        return {"*"}
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
    )).scalar_one_or_none()
    if not emp:
        return set()
    role_perms = EMPLOYEE_ROLE_PERMISSIONS.get(emp.role)
    if role_perms is None:
        from sqlalchemy import text as _sql_text
        cr = (await db.execute(
            _sql_text("SELECT permissions FROM employee_custom_roles WHERE name = :n"),
            {"n": emp.role},
        )).first()
        role_perms = set(cr[0]) if cr and cr[0] else set()
    return set(role_perms) | set(emp.extra_permissions or [])


async def write_audit_log(
    db: AsyncSession,
    admin_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    from packages.common.src.models import AuditLog
    log = AuditLog(
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
    )
    db.add(log)
    await db.flush()
