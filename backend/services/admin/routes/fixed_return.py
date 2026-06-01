"""Admin endpoints for the Fixed Return product.

Two surfaces:
  - Early-withdrawal approval queue — client request 2026-06-01.
    Trader files a request → lock parks in ``early_pending`` → admin
    either approves (credits payout, lock → withdrawn_early) or rejects
    (lock reverts to active).
  - Per-user rate override — admin stamps a custom rate matrix on one
    trader's User row so they see a different ladder than everyone
    else. Same shape as the global ``fixed_return_rates``.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_current_admin
from packages.common.src.database import get_db
from packages.common.src.models import User

from services import fixed_return_service


router = APIRouter(prefix="/fixed-return", tags=["Admin · Fixed Return"])


# ─── Early-withdrawal approval queue ─────────────────────────────────

class RejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=240)


@router.get("/pending")
async def list_pending(
    _admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Locks currently parked in ``early_pending`` — admin queue."""
    return await fixed_return_service.list_pending(db)


@router.post("/{lock_id}/approve")
async def approve_early(
    lock_id: UUID,
    _admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await fixed_return_service.approve(lock_id, db)


@router.post("/{lock_id}/reject")
async def reject_early(
    lock_id: UUID,
    req: RejectRequest,
    _admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await fixed_return_service.reject(lock_id, db, reason=req.reason)


# ─── Per-user rate override ──────────────────────────────────────────

class RateOverrideRequest(BaseModel):
    # Same shape as fixed_return_rates.rate_matrix_pct — 2-D array of
    # percentages. None / empty list clears the override (back to global).
    rate_matrix_pct: list[list[float]] | None = None


@router.get("/users/{user_id}/rate-override")
async def get_rate_override(
    user_id: UUID,
    _admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    row = (await db.execute(
        select(User.fixed_return_rate_override).where(User.id == user_id)
    )).first()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"rate_override": row[0]}


@router.put("/users/{user_id}/rate-override")
async def set_rate_override(
    user_id: UUID,
    body: RateOverrideRequest,
    _admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    matrix = body.rate_matrix_pct
    if matrix is None or len(matrix) == 0:
        user.fixed_return_rate_override = None
    else:
        # Validate it's a 2-D numeric grid; the matching against the
        # global tiers/tenures happens at read time so admin can stamp
        # the override BEFORE re-shaping global.
        for row in matrix:
            if not isinstance(row, list):
                raise HTTPException(status_code=400, detail="rate_matrix_pct must be a 2-D array")
            for cell in row:
                if not isinstance(cell, (int, float)):
                    raise HTTPException(
                        status_code=400, detail="rate_matrix_pct cells must be numbers",
                    )
        user.fixed_return_rate_override = {"rate_matrix_pct": matrix}

    await db.commit()
    return {"rate_override": user.fixed_return_rate_override}
