import uuid
from datetime import datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from services import kyc_service

router = APIRouter(prefix="/kyc", tags=["KYC"])


def _date_bound(value: str | None, *, end_of_day: bool):
    """Parse YYYY-MM-DD → UTC datetime (start or end of day). None passes through."""
    if not value:
        return None
    try:
        d = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None
    return datetime.combine(d, time.max if end_of_day else time.min, tzinfo=timezone.utc)


class ApproveKYCRequest(BaseModel):
    reason: Optional[str] = None


class RejectKYCRequest(BaseModel):
    reason: str


@router.get("/pending")
async def list_pending_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with pending KYC submissions"""
    return await kyc_service.list_kyc_pending(
        page=page, per_page=per_page, db=db,
        start_date=_date_bound(start_date, end_of_day=False),
        end_date=_date_bound(end_date, end_of_day=True),
    )


@router.get("/approved")
async def list_approved_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with approved KYC"""
    return await kyc_service.list_kyc_approved(
        page=page, per_page=per_page, db=db,
        start_date=_date_bound(start_date, end_of_day=False),
        end_date=_date_bound(end_date, end_of_day=True),
    )


@router.get("/rejected")
async def list_rejected_kyc(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all users with rejected KYC"""
    return await kyc_service.list_kyc_rejected(
        page=page, per_page=per_page, db=db,
        start_date=_date_bound(start_date, end_of_day=False),
        end_date=_date_bound(end_date, end_of_day=True),
    )


@router.post("/{user_id}/approve")
async def approve_kyc(
    user_id: uuid.UUID,
    body: ApproveKYCRequest,
    request: Request,
    admin: User = Depends(require_permission("kyc.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Approve user KYC"""
    return await kyc_service.approve_kyc(
        user_id=user_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{user_id}/reject")
async def reject_kyc(
    user_id: uuid.UUID,
    body: RejectKYCRequest,
    request: Request,
    admin: User = Depends(require_permission("kyc.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Reject user KYC"""
    return await kyc_service.reject_kyc(
        user_id=user_id, reason=body.reason, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/file/{doc_id}")
async def view_kyc_file(
    doc_id: uuid.UUID,
    admin: User = Depends(require_permission("kyc.view")),
    db: AsyncSession = Depends(get_db),
):
    """Serve a user's KYC document for admin review (inline image/PDF)."""
    return await kyc_service.get_kyc_file(document_id=doc_id, db=db)
