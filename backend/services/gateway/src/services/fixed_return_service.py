"""Fixed Return — list config, create locks, withdraw (early or matured).

Rates and the early-withdrawal fee live in ``system_settings`` so admins
edit them in one form. The lock state machine is intentionally tiny:
  active --(matures_at <= now AND user withdraws)--> matured
  active --(user withdraws before maturity)--> withdrawn_early

Maturity is not auto-credited by a scheduler in this build; the user
pulls the funds back via /withdraw which the UI surfaces as a button on
the lock card after matures_at.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import FixedReturnLock, User, Transaction
from packages.common.src.settings_store import get_system_setting, get_float_setting

logger = logging.getLogger("fixed_return_service")


DEFAULT_FEE_PCT = 5.0


# ─── Config ──────────────────────────────────────────────────────────

async def get_config() -> dict:
    """Returns the admin-tunable rate matrix + fee% as one payload.

    Falls back to a sensible default if no system_settings row exists so
    a fresh database is never blank.
    """
    raw = await get_system_setting("fixed_return_rates", None)
    rates = raw if isinstance(raw, dict) and raw.get("tiers") else _fallback_rates()
    fee_pct = await get_float_setting("fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT)
    return {**rates, "early_withdrawal_fee_pct": fee_pct}


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
    """Pick the highest tier whose min_amount is <= the principal."""
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
            status_code=400,
            detail=f"Unknown tenure '{tenure_label}'",
        )

    rate_pct = Decimal(str(matrix[tenure_idx][tier_idx]))
    tier = tiers[tier_idx]
    tenure = tenures[tenure_idx]

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
    matures_at = now + timedelta(days=int(tenure["days"]))

    lock = FixedReturnLock(
        user_id=user_id,
        principal=principal,
        tier_label=tier["label"],
        tenure_label=tenure["label"],
        tenure_days=int(tenure["days"]),
        rate_pct=rate_pct,
        locked_at=now,
        matures_at=matures_at,
        state="active",
    )
    db.add(lock)

    db.add(Transaction(
        user_id=user_id,
        type="fixed_return_lock",
        amount=-principal,
        status="completed",
        description=f"Fixed Return lock — {tenure['label']} @ {rate_pct}%",
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
    """User pulls back funds from a lock. If matures_at <= now the full
    payout (principal + return) is credited. Otherwise it's principal
    minus the admin-set fee% — no return."""
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
    rate_pct = Decimal(str(lock.rate_pct))

    matures_at = lock.matures_at
    if matures_at and matures_at.tzinfo is None:
        matures_at = matures_at.replace(tzinfo=timezone.utc)

    if matures_at and matures_at <= now:
        # Matured — full payout.
        gain = (principal * rate_pct / Decimal("100")).quantize(Decimal("0.01"))
        payout = principal + gain
        fee = Decimal("0")
        new_state = "matured"
        tx_type = "fixed_return_matured"
        desc = f"Fixed Return matured — {lock.tenure_label} @ {rate_pct}% (gain ${gain:,.2f})"
    else:
        # Early — fee% on principal, no return.
        fee_pct = await get_float_setting(
            "fixed_return_early_withdrawal_fee_pct", DEFAULT_FEE_PCT
        )
        fee = (principal * Decimal(str(fee_pct)) / Decimal("100")).quantize(Decimal("0.01"))
        payout = (principal - fee).quantize(Decimal("0.01"))
        if payout < 0:
            payout = Decimal("0")
        new_state = "withdrawn_early"
        tx_type = "fixed_return_early"
        desc = f"Fixed Return early withdrawal — {lock.tenure_label} (fee ${fee:,.2f})"

    user.main_wallet_balance = Decimal(str(user.main_wallet_balance or 0)) + payout

    lock.state = new_state
    lock.payout = payout
    lock.fee_paid = fee
    lock.settled_at = now

    db.add(Transaction(
        user_id=user_id,
        type=tx_type,
        amount=payout,
        status="completed",
        description=desc,
    ))
    await db.commit()
    await db.refresh(lock)
    return _serialize_lock(lock)


# ─── Serialization ───────────────────────────────────────────────────

def _serialize_lock(r: FixedReturnLock) -> dict:
    return {
        "id": str(r.id),
        "principal": float(r.principal or 0),
        "tier_label": r.tier_label,
        "tenure_label": r.tenure_label,
        "tenure_days": int(r.tenure_days or 0),
        "rate_pct": float(r.rate_pct or 0),
        "locked_at": r.locked_at.isoformat() if r.locked_at else None,
        "matures_at": r.matures_at.isoformat() if r.matures_at else None,
        "settled_at": r.settled_at.isoformat() if r.settled_at else None,
        "state": r.state,
        "payout": float(r.payout) if r.payout is not None else None,
        "fee_paid": float(r.fee_paid) if r.fee_paid is not None else None,
        "projected_payout": float(
            Decimal(str(r.principal or 0))
            * (Decimal("1") + Decimal(str(r.rate_pct or 0)) / Decimal("100"))
        ),
    }
