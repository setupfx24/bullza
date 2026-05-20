"""Personal referral commission — distinct from IB MLM.

Every user has a unique ``referral_code`` (User.referral_code). When a
new signup uses that code via ``?ref=``, we set the new user's
``referred_by_user_id``. On the user's FIRST approved deposit, the
referrer is paid a flat admin-controlled percentage of the deposit,
credited to their main wallet.

This runs independently of the IB MLM commission tree — an IB still
earns trade-based commissions through the existing ib_engine; this
gives every user a smaller, simpler deposit-based incentive.
"""
from __future__ import annotations

import logging
import secrets
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, Deposit, Transaction, IBProfile, Referral
from packages.common.src.settings_store import get_float_setting

logger = logging.getLogger("referral_service")


REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
REFERRAL_CODE_LEN = 8


def generate_referral_code() -> str:
    """Generate a fresh referral code. The alphabet excludes 0/O/1/I so
    users typing or messaging the code don't trip on look-alikes."""
    return "".join(secrets.choice(REFERRAL_CODE_ALPHABET) for _ in range(REFERRAL_CODE_LEN))


async def ensure_referral_code(db: AsyncSession, user: User) -> str:
    """Idempotently fill `user.referral_code` if missing. Retries a few
    times on the rare collision (8 chars of 32-symbol alphabet = ~10^12
    space; collisions are astronomically unlikely but we still loop)."""
    if user.referral_code:
        return user.referral_code
    for _ in range(8):
        code = generate_referral_code()
        existing = (await db.execute(
            select(User.id).where(User.referral_code == code)
        )).scalar_one_or_none()
        if existing is None:
            user.referral_code = code
            return code
    # Astronomically rare: extend the code and try once more.
    user.referral_code = generate_referral_code() + generate_referral_code()[:4]
    return user.referral_code


async def attach_referrer_by_code(
    db: AsyncSession, new_user_id: UUID, code: str
) -> Optional[UUID]:
    """Look up a referrer by user-level code and store the link on the
    new user. Returns the referrer's user_id if linked, else None.

    A no-op if:
      - code is empty or unrecognised
      - the referrer would be the user themselves
      - the user already has a referrer set
    """
    code = (code or "").strip()
    if not code:
        return None

    referrer = (await db.execute(
        select(User).where(User.referral_code == code).limit(1)
    )).scalar_one_or_none()
    if referrer is None or referrer.id == new_user_id:
        return None

    new_user = (await db.execute(
        select(User).where(User.id == new_user_id).with_for_update()
    )).scalar_one_or_none()
    if new_user is None:
        return None
    if new_user.referred_by_user_id is not None:
        return new_user.referred_by_user_id

    new_user.referred_by_user_id = referrer.id
    return referrer.id


async def maybe_pay_referral_on_first_deposit(
    db: AsyncSession, user_id: UUID, deposit: Deposit
) -> Optional[dict]:
    """Pay the referrer their commission if this deposit is the user's
    FIRST approved/auto-approved deposit and the user has a referrer.

    Idempotent on retries: walks the user's approved deposits and only
    pays if there is exactly one (the row just being approved). Caller
    is expected to call this AFTER setting deposit.status = approved.
    Returns the payout breakdown or None if nothing was paid.
    """
    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None or user.referred_by_user_id is None:
        return None

    # First-deposit gate: count of approved/auto_approved deposits should
    # equal exactly 1 after this row was just approved.
    count = (await db.execute(
        select(func.count()).select_from(Deposit).where(
            Deposit.user_id == user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )).scalar()
    if (count or 0) != 1:
        return None

    pct = await get_float_setting("referral_commission_pct", 5.0)
    if pct <= 0:
        return None

    amount = (Decimal(str(deposit.amount or 0)) * Decimal(str(pct)) / Decimal("100")).quantize(Decimal("0.01"))
    if amount <= 0:
        return None

    referrer = (await db.execute(
        select(User).where(User.id == user.referred_by_user_id).with_for_update()
    )).scalar_one_or_none()
    if referrer is None:
        return None

    referrer.main_wallet_balance = Decimal(str(referrer.main_wallet_balance or 0)) + amount

    db.add(Transaction(
        user_id=referrer.id,
        type="referral_commission",
        amount=amount,
        balance_after=referrer.main_wallet_balance,
        reference_id=deposit.id,
        description=f"Referral commission — {pct}% of {user.email or user_id}'s first deposit",
    ))

    return {
        "referrer_id": str(referrer.id),
        "user_id": str(user_id),
        "deposit_id": str(deposit.id),
        "pct": float(pct),
        "amount": float(amount),
    }


async def get_my_referral_dashboard(db: AsyncSession, user_id: UUID) -> dict:
    """Stats for the /referral page — every user can see this regardless
    of IB status."""
    user = (await db.execute(
        select(User).where(User.id == user_id)
    )).scalar_one_or_none()
    if user is None:
        return {"referral_code": None, "referrals": 0, "total_earned": 0.0, "commission_pct": 0.0}

    # Generate code lazily if backfill somehow missed this row.
    if not user.referral_code:
        await ensure_referral_code(db, user)
        await db.commit()
        # Re-read because commit may have flushed.
        user = (await db.execute(
            select(User).where(User.id == user_id)
        )).scalar_one_or_none()

    referrals = (await db.execute(
        select(func.count()).select_from(User).where(User.referred_by_user_id == user_id)
    )).scalar() or 0

    total_earned = (await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "referral_commission",
        )
    )).scalar() or 0

    pct = await get_float_setting("referral_commission_pct", 5.0)

    return {
        "referral_code": user.referral_code,
        "referrals": int(referrals),
        "total_earned": float(total_earned),
        "commission_pct": float(pct),
    }


# ─── IB per-referral bounty (separate from user-level commission) ────

async def maybe_pay_ib_referral_bounty(
    db: AsyncSession, user_id: UUID, deposit: Deposit
) -> Optional[dict]:
    """Pay a flat bounty to the IB upline if this is the referred user's
    first approved deposit. Idempotent — runs the same first-deposit
    check as the user-level commission, but pays a TIER-SCALED FLAT
    amount instead of a percentage and only when an IB is in the chain.

    Caller is expected to call this AFTER setting deposit.status to
    approved / auto_approved. Returns the payout breakdown or None if
    nothing was paid.
    """
    # First-deposit gate — same logic as the user-level commission so
    # both payouts move together. Both helpers are idempotent.
    count = (await db.execute(
        select(func.count()).select_from(Deposit).where(
            Deposit.user_id == user_id,
            Deposit.status.in_(["approved", "auto_approved"]),
        )
    )).scalar()
    if (count or 0) != 1:
        return None

    # Find the IB the user signed up under via the Referral table (IB
    # MLM lineage, NOT the user-level User.referred_by_user_id).
    ref_row = (await db.execute(
        select(Referral).where(Referral.referred_id == user_id).limit(1)
    )).scalar_one_or_none()
    if ref_row is None or ref_row.ib_profile_id is None:
        return None

    ib = (await db.execute(
        select(IBProfile).where(IBProfile.id == ref_row.ib_profile_id).with_for_update()
    )).scalar_one_or_none()
    if ib is None or not ib.is_active:
        return None

    # Local import to keep referral_service free of engine deps.
    from ..engines.ib_engine import (
        get_ib_tiers, resolve_tier_for_count, count_active_referrals,
    )

    tiers = await get_ib_tiers(db)
    active_n = await count_active_referrals(db, ib.id)
    tier = resolve_tier_for_count(active_n, tiers)
    if not tier:
        return None
    bounty_raw = tier.get("per_referral_bounty")
    if bounty_raw in (None, ""):
        return None
    try:
        bounty = Decimal(str(bounty_raw)).quantize(Decimal("0.01"))
    except Exception:
        return None
    if bounty <= 0:
        return None

    ib_user = (await db.execute(
        select(User).where(User.id == ib.user_id).with_for_update()
    )).scalar_one_or_none()
    if ib_user is None:
        return None

    ib_user.main_wallet_balance = Decimal(str(ib_user.main_wallet_balance or 0)) + bounty

    db.add(Transaction(
        user_id=ib_user.id,
        type="ib_referral_bounty",
        amount=bounty,
        balance_after=ib_user.main_wallet_balance,
        reference_id=deposit.id,
        description=(
            f"IB referral bounty — {tier.get('label')} tier "
            f"(${float(bounty):.2f}) for {ib_user.email or ib_user.id}'s referral first deposit"
        ),
    ))

    return {
        "ib_user_id": str(ib_user.id),
        "referred_user_id": str(user_id),
        "deposit_id": str(deposit.id),
        "tier": tier.get("label"),
        "bounty": float(bounty),
    }
