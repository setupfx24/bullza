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
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    User, Deposit, Transaction, IBProfile, Referral, TradeHistory, TradingAccount,
)
from packages.common.src.settings_store import (
    get_float_setting, get_int_setting, get_system_setting,
)

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
    """Legacy hook kept as a no-op for callers that still import it.

    Referral commission used to fire on the referred user's first
    approved deposit; the client changed the model to a fixed amount
    paid AFTER the referred user completes >= 3 trades. New entry
    point is ``maybe_pay_referral_after_trades`` below, called from
    trading_service.close_position when a trade is booked.
    """
    return None


async def maybe_pay_referral_after_trades(
    db: AsyncSession, user_id: UUID
) -> Optional[dict]:
    """Pay the referrer a FLAT USD amount when this user crosses the
    qualifying trade count (admin setting, default 3). Two gates make
    sure we never double-pay:

      1. ``users.referral_qualified_at`` must still be NULL — once we
         pay, we stamp it and never re-check.
      2. The user must have a referrer set (User.referred_by_user_id),
         which is populated by ``attach_referrer_by_code`` at signup.

    Caller writes a TradeHistory row first (this helper counts
    history rows to decide), then invokes this. Best-effort: any
    error inside is swallowed so a referral hiccup never blocks
    the trade close itself.
    """
    user = (await db.execute(
        select(User).where(User.id == user_id).with_for_update()
    )).scalar_one_or_none()
    if user is None or user.referred_by_user_id is None:
        return None
    if user.referral_qualified_at is not None:
        return None  # already paid

    required = await get_int_setting("referral_qualifying_trades", 3)
    if required <= 0:
        required = 3

    # Count of CLOSED trades. TradeHistory ties to TradingAccount, so
    # we join to user_id. Open positions don't count — spec is
    # 'three trades completed'.
    trade_count = (await db.execute(
        select(func.count())
        .select_from(TradeHistory)
        .join(TradingAccount, TradingAccount.id == TradeHistory.account_id)
        .where(TradingAccount.user_id == user_id)
    )).scalar() or 0
    if trade_count < required:
        return None

    # Per-account-type payout. We look up the referred user's PRIMARY
    # account type and use the per-type bounty; fall back to the flat
    # legacy amount if either the map or the type is missing. The
    # primary account = their first non-demo trading account (matches
    # what the trader-side picker shows them).
    from packages.common.src.models import AccountGroup
    from packages.common.src.settings_store import get_system_setting

    acct_type_row = (await db.execute(
        select(AccountGroup.name)
        .select_from(TradingAccount)
        .join(AccountGroup, AccountGroup.id == TradingAccount.account_group_id)
        .where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_demo.is_(False),
        )
        .order_by(TradingAccount.created_at.asc())
        .limit(1)
    )).first()
    acct_type_key = (acct_type_row[0] if acct_type_row else "").strip().lower()

    type_map_raw = await get_system_setting("referral_commission_amounts_usd", None)
    type_map = type_map_raw if isinstance(type_map_raw, dict) else {}
    amount_usd = None
    if acct_type_key:
        v = type_map.get(acct_type_key)
        if v not in (None, ""):
            try:
                amount_usd = float(v)
            except (TypeError, ValueError):
                amount_usd = None
    if amount_usd is None:
        # Fall through to the flat legacy setting so a missing per-type
        # row never silently zeroes the payout.
        amount_usd = await get_float_setting("referral_commission_amount_usd", 5.0)

    if amount_usd <= 0:
        return None
    amount = Decimal(str(amount_usd)).quantize(Decimal("0.01"))

    referrer = (await db.execute(
        select(User).where(User.id == user.referred_by_user_id).with_for_update()
    )).scalar_one_or_none()
    if referrer is None:
        return None

    referrer.main_wallet_balance = (
        Decimal(str(referrer.main_wallet_balance or 0)) + amount
    )
    user.referral_qualified_at = datetime.now(timezone.utc)

    db.add(Transaction(
        user_id=referrer.id,
        type="referral_commission",
        amount=amount,
        balance_after=referrer.main_wallet_balance,
        reference_id=user_id,
        description=(
            f"Referral payout — {user.email or user_id} qualified "
            f"({trade_count} trades)"
        ),
    ))

    return {
        "referrer_id": str(referrer.id),
        "user_id": str(user_id),
        "trades": int(trade_count),
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

    amount_usd = await get_float_setting("referral_commission_amount_usd", 5.0)
    required_trades = await get_int_setting("referral_qualifying_trades", 3)
    # Per-account-type breakdown — the trader page renders this so the
    # user sees what they'd earn for each subscription bracket.
    type_map_raw = await get_system_setting("referral_commission_amounts_usd", None)
    amount_by_type: dict[str, float] = {}
    if isinstance(type_map_raw, dict):
        for k, v in type_map_raw.items():
            try:
                amount_by_type[str(k).lower()] = float(v)
            except (TypeError, ValueError):
                pass

    # Qualified vs pending breakdown — how many of this user's
    # referrals have already triggered a payout vs. how many are
    # still trading toward the threshold.
    qualified = (await db.execute(
        select(func.count()).select_from(User).where(
            User.referred_by_user_id == user_id,
            User.referral_qualified_at.is_not(None),
        )
    )).scalar() or 0

    return {
        "referral_code": user.referral_code,
        "referrals": int(referrals),
        "qualified_referrals": int(qualified),
        "pending_referrals": int(max(0, int(referrals) - int(qualified))),
        "total_earned": float(total_earned),
        "amount_per_referral_usd": float(amount_usd),
        "amount_by_account_type": amount_by_type,
        "required_trades": int(required_trades),
        # Kept for backward compat with any older client build that
        # still reads `commission_pct`. New clients ignore it.
        "commission_pct": 0.0,
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
