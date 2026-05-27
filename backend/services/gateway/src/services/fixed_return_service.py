"""Fixed Return v2 — periodic interest payouts, fixed lock months.

Tenure controls the PAYOUT CADENCE; the full lock duration is a single
admin setting (``fixed_return_lock_months``, default 24). Interest is
credited per cycle by ``accrue_due_payouts`` (driven by the engine
tick). Principal is returned at maturity. Early exit pays a configurable
penalty AND claws back all interest paid to date.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import FixedReturnLock, User, Transaction
from packages.common.src.settings_store import (
    get_system_setting, get_float_setting, get_int_setting,
)

logger = logging.getLogger("fixed_return_service")


DEFAULT_FEE_PCT = 5.0
DEFAULT_LOCK_MONTHS = 24
# 30.4375d ≈ avg month — used only for projection text in the UI; the
# actual matures_at is computed from real calendar months at creation
# (SQL `INTERVAL 'N months'`).
DAYS_PER_MONTH_APPROX = Decimal("30.4375")


# ─── Config ──────────────────────────────────────────────────────────

async def get_config() -> dict:
    raw = await get_system_setting("fixed_return_rates", None)
    rates = raw if isinstance(raw, dict) and raw.get("tiers") else _fallback_rates()
    fee_pct = await get_float_setting(
        "fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT,
    )
    lock_months = await get_int_setting(
        "fixed_return_lock_months", DEFAULT_LOCK_MONTHS,
    )
    return {
        **rates,
        "early_withdrawal_fee_pct": fee_pct,
        "lock_months": lock_months,
    }


def _fallback_rates() -> dict:
    return {
        "tiers": [
            {"label": "$1K", "min_amount": 1000},
            {"label": "$10K", "min_amount": 10000},
            {"label": "$25K", "min_amount": 25000},
            {"label": "$50K", "min_amount": 50000},
            {"label": "$100K", "min_amount": 100000},
        ],
        "tenures": [
            {"label": "Month", "days": 30},
            {"label": "Quarter", "days": 90},
            {"label": "Half-Year", "days": 180},
            {"label": "Year", "days": 365},
            {"label": "2 Year", "days": 730},
        ],
        "rate_matrix_pct": [
            [1.0, 2.0, 2.5, 3.0, 4.0],
            [2.0, 3.0, 3.0, 3.5, 4.5],
            [3.0, 4.0, 4.5, 5.0, 5.0],
            [4.0, 5.0, 5.5, 6.0, 5.5],
            [5.0, 6.0, 6.5, 7.0, 7.0],
        ],
    }


def _resolve_tier_index(amount: Decimal, tiers: list[dict]) -> int:
    idx = -1
    for i, t in enumerate(tiers):
        if Decimal(str(t.get("min_amount") or 0)) <= amount:
            idx = i
    return idx


def _resolve_tenure_index(label: str, tenures: list[dict]) -> int:
    for i, t in enumerate(tenures):
        if (t.get("label") or "").lower() == label.lower():
            return i
    return -1


def _add_months(dt: datetime, months: int) -> datetime:
    """Add calendar months to a UTC datetime, clamped at month-end."""
    year = dt.year + (dt.month - 1 + months) // 12
    month = (dt.month - 1 + months) % 12 + 1
    # Day clamp — e.g. Jan 31 + 1 month → Feb 28/29.
    from calendar import monthrange
    last_day = monthrange(year, month)[1]
    day = min(dt.day, last_day)
    return dt.replace(year=year, month=month, day=day)


def _tenure_to_months(tenure_days: int) -> int:
    """Map the configured tenure_days bucket to whole calendar months so
    payouts always land on the same day-of-month (the configured payout
    day-of-month gate, 25 by default). The buckets follow the admin
    Fixed Return matrix: 30 → 1, 90 → 3, 180 → 6, 365 → 12, 730 → 24."""
    if tenure_days >= 700:
        return 24
    if tenure_days >= 350:
        return 12
    if tenure_days >= 170:
        return 6
    if tenure_days >= 80:
        return 3
    return 1


def _snap_to_payout_window(
    dt: datetime, *, payout_day: int = 25, advance_if_before: bool = False
) -> datetime:
    """Snap a datetime to the admin-configured payout day-of-month.

    Client spec: every interest cycle must land between the 25th and 30th
    of the month. We canonicalize on the 25th (admin-tunable via
    `fixed_return_payout_day_of_month`) and zero out the time so payouts
    drop reliably at 00:00 UTC of that day.

    If `advance_if_before` is True and `dt.day > payout_day`, jump to the
    payout day of the NEXT month instead — useful when the natural cycle
    end-date already passed this month's window.
    """
    payout_day = max(25, min(28, int(payout_day or 25)))
    if advance_if_before and dt.day > payout_day:
        dt = _add_months(dt, 1)
    return dt.replace(
        day=payout_day, hour=0, minute=0, second=0, microsecond=0,
    )


# ─── Lock flow ───────────────────────────────────────────────────────

async def create_lock(
    user_id: UUID,
    principal: Decimal,
    tenure_label: str,
    db: AsyncSession,
) -> dict:
    if principal <= 0:
        raise HTTPException(status_code=400, detail="Principal must be positive")

    cfg = await get_config()
    tiers = cfg["tiers"]
    tenures = cfg["tenures"]
    matrix = cfg["rate_matrix_pct"]
    lock_months = int(cfg.get("lock_months") or DEFAULT_LOCK_MONTHS)

    tier_idx = _resolve_tier_index(principal, tiers)
    if tier_idx < 0:
        min_tier = Decimal(str(tiers[0]["min_amount"]))
        raise HTTPException(
            status_code=400,
            detail=f"Minimum lock amount is ${min_tier:,.0f}",
        )

    tenure_idx = _resolve_tenure_index(tenure_label, tenures)
    if tenure_idx < 0:
        raise HTTPException(
            status_code=400, detail=f"Unknown tenure '{tenure_label}'",
        )

    rate_pct = Decimal(str(matrix[tenure_idx][tier_idx]))
    tier = tiers[tier_idx]
    tenure = tenures[tenure_idx]
    tenure_days = int(tenure["days"])

    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    balance = Decimal(str(user.main_wallet_balance or 0))
    if balance < principal:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance (have ${balance:,.2f}, need ${principal:,.2f})",
        )

    user.main_wallet_balance = balance - principal

    now = datetime.now(timezone.utc)
    matures_at = _add_months(now, lock_months)
    # Snap interest payouts to a fixed day-of-month window (25th by
    # default) so users always see their interest land in the 25-30 of
    # the month, regardless of lock day. Calendar-month cadence (1 / 3 /
    # 6 / 12 / 24 months) keeps the day stable across cycles.
    payout_dom = await get_int_setting("fixed_return_payout_day_of_month", 25)
    cycle_months = _tenure_to_months(tenure_days)
    cycle_end = _add_months(now, cycle_months)
    next_payout_at = _snap_to_payout_window(
        cycle_end, payout_day=payout_dom, advance_if_before=True,
    )
    # If the first cycle would land past maturity (e.g. 2-Year tenure
    # in a 24-month lock), clamp to maturity so the user receives
    # exactly one cycle at the end.
    if next_payout_at > matures_at:
        next_payout_at = matures_at

    lock = FixedReturnLock(
        user_id=user_id,
        principal=principal,
        tier_label=tier["label"],
        tenure_label=tenure["label"],
        tenure_days=tenure_days,
        rate_pct=rate_pct,
        locked_at=now,
        matures_at=matures_at,
        next_payout_at=next_payout_at,
        lock_months_at_creation=lock_months,
        state="active",
    )
    db.add(lock)

    db.add(Transaction(
        user_id=user_id,
        type="fixed_return_lock",
        amount=-principal,
        balance_after=user.main_wallet_balance,
        description=f"Fixed Return lock — {tenure['label']} cycle @ {rate_pct}% / {lock_months}m",
    ))
    await db.commit()
    await db.refresh(lock)
    return _serialize_lock(lock)


async def list_locks(user_id: UUID, db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(FixedReturnLock)
        .where(FixedReturnLock.user_id == user_id)
        .order_by(FixedReturnLock.locked_at.desc())
    )).scalars().all()
    return [_serialize_lock(r) for r in rows]


async def withdraw_lock(
    lock_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> dict:
    lock = (await db.execute(
        select(FixedReturnLock)
        .where(FixedReturnLock.id == lock_id)
        .with_for_update()
    )).scalar_one_or_none()
    if lock is None or lock.user_id != user_id:
        raise HTTPException(status_code=404, detail="Lock not found")
    if lock.state != "active":
        raise HTTPException(status_code=400, detail=f"Lock is already {lock.state}")

    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    principal = Decimal(str(lock.principal))
    total_interest = Decimal(str(lock.total_interest_paid or 0))

    matures_at = lock.matures_at
    if matures_at and matures_at.tzinfo is None:
        matures_at = matures_at.replace(tzinfo=timezone.utc)

    if matures_at and matures_at <= now:
        # Matured — interest was already paid in cycles; user gets the
        # principal back, period.
        payout = principal
        fee = Decimal("0")
        new_state = "matured"
        tx_type = "fixed_return_matured"
        desc = (
            f"Fixed Return matured — principal returned "
            f"(interest paid in {lock.payouts_count} cycles: ${total_interest:,.2f})"
        )
    else:
        # Early exit. Two penalties stack:
        #   1. % of principal as the broker's break fee.
        #   2. All interest paid so far claws back against the principal.
        fee_pct = await get_float_setting(
            "fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT,
        )
        fee = (principal * Decimal(str(fee_pct)) / Decimal("100")).quantize(Decimal("0.01"))
        payout = (principal - fee - total_interest).quantize(Decimal("0.01"))
        if payout < 0:
            payout = Decimal("0")
        new_state = "withdrawn_early"
        tx_type = "fixed_return_early"
        desc = (
            f"Fixed Return early withdrawal — penalty ${fee:,.2f} + "
            f"interest claw-back ${total_interest:,.2f}"
        )

    user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) + payout

    lock.state = new_state
    lock.payout = payout
    lock.fee_paid = fee
    lock.settled_at = now
    lock.next_payout_at = None  # no more cycles

    db.add(Transaction(
        user_id=user_id,
        type=tx_type,
        amount=payout,
        balance_after=user.main_wallet_balance,
        description=desc,
    ))
    await db.commit()
    await db.refresh(lock)
    return _serialize_lock(lock)


# ─── Interest payout engine ──────────────────────────────────────────

async def accrue_due_payouts(db: AsyncSession) -> int:
    """Find every active lock whose next_payout_at <= now and credit
    one interest cycle. Bumps total_interest_paid + payouts_count, and
    advances next_payout_at by tenure_days (or clears it once we're past
    maturity).

    Returns the number of payouts credited.

    Idempotency: we only credit cycles whose next_payout_at is already
    in the past — engine ticks repeatedly with no state change.

    Payout window: cycles whose next_payout_at has elapsed only credit
    when today's day-of-month is inside the admin-set range (default
    25–30, matching the client's banking-cycle spec). Outside the
    window the engine returns 0 — interest sits as a pending payout
    and lands the next time the engine ticks inside the window.
    """
    now = datetime.now(timezone.utc)

    window_start = await get_int_setting("fixed_return_payout_day_start", 25)
    window_end = await get_int_setting("fixed_return_payout_day_end", 30)
    if window_start < 1:
        window_start = 1
    if window_end > 31:
        window_end = 31
    if window_start > window_end:
        window_start, window_end = window_end, window_start
    if not (window_start <= now.day <= window_end):
        return 0

    rows = (await db.execute(
        select(FixedReturnLock).where(
            FixedReturnLock.state == "active",
            FixedReturnLock.next_payout_at.is_not(None),
            FixedReturnLock.next_payout_at <= now,
        ).with_for_update(skip_locked=True)
    )).scalars().all()

    paid = 0
    for lock in rows:
        try:
            user = (await db.execute(
                select(User).where(User.id == lock.user_id).with_for_update()
            )).scalar_one_or_none()
            if user is None:
                lock.next_payout_at = None
                continue

            # Rate matrix cell is a PER-MONTH percentage (client spec
            # 2026-05-26). Tenure decides cadence; each payout bundles
            # `months_per_cycle` months of accrual into a single credit.
            # Example: $1000 quarterly at 2% → 2% × 3 months = $60.
            months_per_cycle = _tenure_to_months(int(lock.tenure_days or 0))
            interest = (
                Decimal(str(lock.principal or 0))
                * Decimal(str(lock.rate_pct or 0))
                * Decimal(str(months_per_cycle))
                / Decimal("100")
            ).quantize(Decimal("0.01"))
            if interest <= 0:
                lock.next_payout_at = None
                continue

            user.main_wallet_balance = (
                Decimal(str(user.main_wallet_balance or 0)) + interest
            )
            lock.total_interest_paid = (
                Decimal(str(lock.total_interest_paid or 0)) + interest
            )
            lock.payouts_count = int(lock.payouts_count or 0) + 1

            # Advance the schedule by exactly one calendar cycle so the
            # day-of-month stays stable across cycles (always lands on
            # the configured 25-30 window). If the next cycle would
            # land past maturity we mark the schedule done (next = NULL)
            # — the principal is returned when the user calls withdraw
            # after matures_at.
            matures_at = lock.matures_at
            if matures_at and matures_at.tzinfo is None:
                matures_at = matures_at.replace(tzinfo=timezone.utc)
            nxt = (lock.next_payout_at or now)
            if nxt.tzinfo is None:
                nxt = nxt.replace(tzinfo=timezone.utc)
            cycle_months = _tenure_to_months(int(lock.tenure_days or 0))
            advanced = _add_months(nxt, cycle_months)
            # Re-snap to the payout day-of-month — _add_months keeps the
            # original day (already 25), so this is a no-op for normal
            # cycles, but it self-heals if the row was created before
            # this fix shipped.
            payout_dom = await get_int_setting(
                "fixed_return_payout_day_of_month", 25
            )
            advanced = _snap_to_payout_window(
                advanced, payout_day=payout_dom, advance_if_before=False,
            )
            if matures_at and advanced >= matures_at:
                lock.next_payout_at = None
            else:
                lock.next_payout_at = advanced

            db.add(Transaction(
                user_id=lock.user_id,
                type="fixed_return_interest",
                amount=interest,
                balance_after=user.main_wallet_balance,
                description=(
                    f"Fixed Return interest — {lock.tenure_label} cycle "
                    f"#{lock.payouts_count} ({lock.rate_pct}%)"
                ),
            ))
            paid += 1
        except Exception as exc:
            logger.error("Fixed Return payout failed for lock %s: %s", lock.id, exc)

    if paid:
        await db.commit()
    return paid


# ─── Serialization ───────────────────────────────────────────────────

def _serialize_lock(r: FixedReturnLock) -> dict:
    principal = Decimal(str(r.principal or 0))
    rate_pct = Decimal(str(r.rate_pct or 0))
    interest_paid = Decimal(str(r.total_interest_paid or 0))
    # Projection: rate_pct is per-MONTH (client spec 2026-05-26), so
    # the user receives `principal * rate_pct% * lock_months` total
    # interest if the lock runs to maturity. Cadence (Month / Quarter /
    # etc.) only changes when the money lands, not how much.
    lock_months = int(r.lock_months_at_creation or 24)
    projected_interest = (
        principal * rate_pct * Decimal(lock_months) / Decimal("100")
    ).quantize(Decimal("0.01"))

    return {
        "id": str(r.id),
        "principal": float(principal),
        "tier_label": r.tier_label,
        "tenure_label": r.tenure_label,
        "tenure_days": int(r.tenure_days or 0),
        "rate_pct": float(rate_pct),
        "lock_months": lock_months,
        "locked_at": r.locked_at.isoformat() if r.locked_at else None,
        "matures_at": r.matures_at.isoformat() if r.matures_at else None,
        "next_payout_at": r.next_payout_at.isoformat() if r.next_payout_at else None,
        "settled_at": r.settled_at.isoformat() if r.settled_at else None,
        "state": r.state,
        "payouts_count": int(r.payouts_count or 0),
        "total_interest_paid": float(interest_paid),
        "projected_total_interest": float(projected_interest),
        "projected_total_payout": float(principal + projected_interest),
        "payout": float(r.payout) if r.payout is not None else None,
        "fee_paid": float(r.fee_paid) if r.fee_paid is not None else None,
    }
