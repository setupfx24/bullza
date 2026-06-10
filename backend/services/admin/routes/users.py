import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import FundRequest, CreditRequest
from services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    status_filter: str = Query(None, alias="status"),
    kyc_filter: str = Query(None, alias="kyc_status"),
    group_id: str = Query(None),
    date_from: str | None = Query(None, description="YYYY-MM-DD; inclusive lower bound on User.created_at"),
    date_to:   str | None = Query(None, description="YYYY-MM-DD; inclusive upper bound on User.created_at"),
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.list_users(
        page=page, per_page=per_page, search=search,
        status_filter=status_filter, kyc_filter=kyc_filter, group_id=group_id,
        date_from=date_from, date_to=date_to,
        db=db,
    )


@router.get("/{user_id}")
async def get_user_detail(
    user_id: uuid.UUID,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_user_detail(user_id=user_id, db=db)


@router.post("/{user_id}/add-fund")
async def add_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    approval_request_id: uuid.UUID | None = None,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    """Add funds to user main wallet.

    For amounts < ADMIN_DUAL_APPROVAL_THRESHOLD: executes immediately.
    For amounts ≥ threshold: returns 202 with `request_id`. A second admin
    must POST /admin/approvals/{request_id}/approve, then this endpoint is
    called again with `?approval_request_id=...`."""
    return await user_service.add_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
        approval_request_id=approval_request_id,
    )


@router.post("/{user_id}/deduct-fund")
async def deduct_fund(
    user_id: uuid.UUID,
    body: FundRequest,
    request: Request,
    approval_request_id: uuid.UUID | None = None,
    admin: User = Depends(require_permission("users.deduct_fund")),
    db: AsyncSession = Depends(get_db),
):
    """Deduct funds. Same dual-approval gate as add-fund."""
    return await user_service.deduct_fund(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
        approval_request_id=approval_request_id,
    )


@router.post("/{user_id}/give-credit")
async def give_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.give_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/take-credit")
async def take_credit(
    user_id: uuid.UUID,
    body: CreditRequest,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.take_credit(
        user_id=user_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/ban")
async def ban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.ban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/unban")
async def unban_user(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.ban")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.unban_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/block-trading")
async def block_trading(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.block_trading")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.block_trading(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/kill-switch")
async def kill_switch(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.kill_switch")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.kill_switch(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/login-as")
async def login_as_user(
    user_id: uuid.UUID,
    request: Request,
    # Impersonation mints a full trader session = account takeover. Gate
    # it behind a dedicated high-trust permission that no employee role
    # holds, so effectively only super_admin can impersonate (audit H1).
    admin: User = Depends(require_permission("users.impersonate")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.login_as_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/reset-password")
async def trigger_password_reset(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    """Admin triggers a password reset for the user — creates a one-time
    token + sends them the reset email. Plain password is never returned
    or stored anywhere (hashed at rest). 2026-06-01 #5."""
    return await user_service.trigger_password_reset(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/{user_id}/sessions")
async def list_user_sessions(
    user_id: uuid.UUID,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    """Active login sessions for this user — IP / user-agent / created /
    expires. Admin uses this to spot suspicious sessions + revoke."""
    return await user_service.list_user_sessions(user_id=user_id, db=db)


@router.delete("/{user_id}/sessions/{session_id}")
async def revoke_user_session(
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.revoke_user_session(
        user_id=user_id, session_id=session_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/sessions/revoke-all")
async def revoke_all_user_sessions(
    user_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.revoke_all_user_sessions(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    # Irreversible destruction of a user + their entire financial ledger.
    # Dedicated permission held by no employee role → super_admin only
    # (audit H2; was wrongly gated on the finance 'users.add_fund').
    admin: User = Depends(require_permission("users.delete")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user. Closes all open positions/orders, deletes
    trading accounts, copy-trade allocations, copy trades, deposits, withdrawals,
    transactions, referrals, IB profile, and finally the user row. Cannot be
    undone."""
    return await user_service.delete_user(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
