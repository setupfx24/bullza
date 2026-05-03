"""Admin approval queue — second-admin sign-off for high-value financial actions."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User

# Absolute imports — admin app puts /app on PYTHONPATH; relative imports
# from a sibling package raise "attempted relative import beyond top-level
# package" because the routes/ folder isn't a child of a package.
from dependencies import require_permission, write_audit_log
from services import approval_service

router = APIRouter()


class RejectBody(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


@router.get("")
async def list_pending(
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    """List all pending approval requests (filterable client-side)."""
    rows = await db.execute(
        text(
            """
            SELECT id, action, target_type, target_id, payload,
                   requested_by, requested_at, status, expires_at
            FROM admin_approval_requests
            WHERE status = 'pending' AND expires_at > NOW()
            ORDER BY requested_at DESC
            LIMIT 200
            """
        )
    )
    return {"items": [dict(r) for r in rows.mappings().all()]}


@router.post("/{request_id}/approve")
async def approve(
    request_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    """Second-admin approval. Cannot be the same admin who requested it.
    On success the row is flipped to 'approved'; the requesting admin must
    then re-invoke the original endpoint with `?approval_request_id=...`
    to actually execute the change."""
    rec = await approval_service.approve(db, request_id=request_id, approver_id=admin.id)
    await write_audit_log(
        db, admin.id, "approval_grant", "admin_approval_request", request_id,
        new_values={"action": rec["action"], "target_id": str(rec["target_id"])},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {"message": "Approved", "request_id": str(request_id)}


@router.post("/{request_id}/reject")
async def reject(
    request_id: uuid.UUID,
    body: RejectBody,
    request: Request,
    admin: User = Depends(require_permission("users.add_fund")),
    db: AsyncSession = Depends(get_db),
):
    rec = await approval_service.reject(
        db, request_id=request_id, rejector_id=admin.id, reason=body.reason,
    )
    await write_audit_log(
        db, admin.id, "approval_reject", "admin_approval_request", request_id,
        new_values={"action": rec["action"], "reason": body.reason},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {"message": "Rejected", "request_id": str(request_id)}
