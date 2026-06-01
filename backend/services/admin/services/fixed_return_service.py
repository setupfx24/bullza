"""Admin-side Fixed Return helpers — kept separate from the trader-side
gateway service so the admin container doesn't need gateway code on its
PYTHONPATH. Money-flow + persistence logic is intentionally duplicated
rather than imported; the duplication is small and the boundary keeps
the two containers independently deployable.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import FixedReturnLock, User, Transaction
from packages.common.src.settings_store import get_float_setting, get_int_setting


DEFAULT_FEE_PCT = 5.0


def _add_months(dt: datetime, months: int) -> datetime:
    """Add calendar months, clamped at month-end. Mirrors the helper in
    the gateway service so the day-of-month stays stable across cycles."""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    from calendar import monthrange
    last_day = monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


def _tenure_to_months(tenure_days: int) -> int:
    if tenure_days >= 700: return 24
    if tenure_days >= 350: return 12
    if tenure_days >= 170: return 6
    if tenure_days >= 80:  return 3
    return 1


def _snap_to_payout_window(dt: datetime, *, payout_day: int) -> datetime:
    payout_day = max(25, min(28, int(payout_day or 25)))
    if dt.day > payout_day:
        dt = _add_months(dt, 1)
    return dt.replace(day=payout_day, hour=0, minute=0, second=0, microsecond=0)


def _serialize(r: FixedReturnLock) -> dict:
    """Minimal serializer for admin views — we only echo the fields the
    queue/edit panels render, not the trader-side projections."""
    return {
        "id": str(r.id),
        "user_id": str(r.user_id),
        "principal": float(r.principal or 0),
        "tier_label": r.tier_label,
        "tenure_label": r.tenure_label,
        "rate_pct": float(r.rate_pct or 0),
        "lock_months": int(r.lock_months_at_creation or 24),
        "locked_at": r.locked_at.isoformat() if r.locked_at else None,
        "matures_at": r.matures_at.isoformat() if r.matures_at else None,
        "next_payout_at": r.next_payout_at.isoformat() if r.next_payout_at else None,
        "early_requested_at": (
            r.early_requested_at.isoformat() if r.early_requested_at else None
        ),
        "settled_at": r.settled_at.isoformat() if r.settled_at else None,
        "state": r.state,
        "payouts_count": int(r.payouts_count or 0),
        "total_interest_paid": float(r.total_interest_paid or 0),
        "payout": float(r.payout) if r.payout is not None else None,
        "fee_paid": float(r.fee_paid) if r.fee_paid is not None else None,
    }


async def list_pending(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(FixedReturnLock, User)
        .join(User, User.id == FixedReturnLock.user_id)
        .where(FixedReturnLock.state == "early_pending")
        .order_by(FixedReturnLock.early_requested_at.asc())
    )).all()
    fee_pct = await get_float_setting(
        "fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT,
    )
    out: list[dict] = []
    for lock, user in rows:
        principal = Decimal(str(lock.principal or 0))
        total_interest = Decimal(str(lock.total_interest_paid or 0))
        fee = (principal * Decimal(str(fee_pct)) / Decimal("100")).quantize(Decimal("0.01"))
        projected = (principal - fee - total_interest).quantize(Decimal("0.01"))
        if projected < 0:
            projected = Decimal("0")
        out.append({
            **_serialize(lock),
            "user_email": user.email,
            "user_name": (
                " ".join(filter(None, [user.first_name, user.last_name])).strip()
                or None
            ),
            "projected_payout": float(projected),
            "projected_fee": float(fee),
        })
    return out


async def approve(lock_id: UUID, db: AsyncSession) -> dict:
    lock = (await db.execute(
        select(FixedReturnLock)
        .where(FixedReturnLock.id == lock_id)
        .with_for_update()
    )).scalar_one_or_none()
    if lock is None:
        raise HTTPException(status_code=404, detail="Lock not found")
    if lock.state != "early_pending":
        raise HTTPException(
            status_code=409,
            detail=f"Lock is {lock.state}, not waiting on approval",
        )

    user = (await db.execute(
        select(User).where(User.id == lock.user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    principal = Decimal(str(lock.principal or 0))
    total_interest = Decimal(str(lock.total_interest_paid or 0))
    fee_pct = await get_float_setting(
        "fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT,
    )
    fee = (principal * Decimal(str(fee_pct)) / Decimal("100")).quantize(Decimal("0.01"))
    payout = (principal - fee - total_interest).quantize(Decimal("0.01"))
    if payout < 0:
        payout = Decimal("0")

    now = datetime.now(timezone.utc)
    user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) + payout
    lock.state = "withdrawn_early"
    lock.payout = payout
    lock.fee_paid = fee
    lock.settled_at = now
    lock.early_requested_at = None
    lock.next_payout_at = None

    db.add(Transaction(
        user_id=lock.user_id,
        type="fixed_return_early",
        amount=payout,
        balance_after=user.main_wallet_balance,
        description=(
            f"Fixed Return early withdrawal (approved) — penalty ${fee:,.2f} + "
            f"interest claw-back ${total_interest:,.2f}"
        ),
    ))
    await db.commit()
    await db.refresh(lock)
    return _serialize(lock)


async def reject(lock_id: UUID, db: AsyncSession, *, reason: str | None = None) -> dict:
    lock = (await db.execute(
        select(FixedReturnLock)
        .where(FixedReturnLock.id == lock_id)
        .with_for_update()
    )).scalar_one_or_none()
    if lock is None:
        raise HTTPException(status_code=404, detail="Lock not found")
    if lock.state != "early_pending":
        raise HTTPException(
            status_code=409,
            detail=f"Lock is {lock.state}, not waiting on approval",
        )

    # Re-arm the schedule. Gateway engine filters out NULL next_payout_at
    # rows from the accrual sweep, so we MUST set a real date here or the
    # lock will silently stop earning interest after a rejection.
    now = datetime.now(timezone.utc)
    matures_at = lock.matures_at
    if matures_at and matures_at.tzinfo is None:
        matures_at = matures_at.replace(tzinfo=timezone.utc)
    cycle_months = _tenure_to_months(int(lock.tenure_days or 0))
    payout_dom = await get_int_setting("fixed_return_payout_day_of_month", 25)
    next_payout = _snap_to_payout_window(
        _add_months(now, cycle_months), payout_day=payout_dom,
    )
    if matures_at and next_payout > matures_at:
        next_payout = matures_at

    lock.state = "active"
    lock.early_requested_at = None
    lock.next_payout_at = next_payout

    db.add(Transaction(
        user_id=lock.user_id,
        type="fixed_return_early_rejected",
        amount=Decimal("0"),
        balance_after=Decimal("0"),
        description=(
            f"Fixed Return early-withdrawal request rejected by admin"
            + (f": {reason}" if reason else "")
        ),
    ))
    await db.commit()
    await db.refresh(lock)
    return _serialize(lock)
