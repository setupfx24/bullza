"""IB Commission Engine — Distributes trade commissions through MLM levels.

When a referred user places a trade, this engine:
1. Finds the referrer IB via the Referral table
2. Looks up the IB commission plan (commission_per_lot)
3. Distributes commission up the MLM chain using mlm_distribution percentages
4. Creates IBCommission records and credits IB trading accounts
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    Referral, IBProfile, IBCommission, IBCommissionPlan,
    TradingAccount, Transaction, SystemSetting,
)

logger = logging.getLogger("ib-engine")

DEFAULT_MLM_DISTRIBUTION = [40, 25, 15, 10, 10]

# Fallback used if the system_settings row is absent. Matches the
# client's 2026-05-26 spec: three levels with admin-tunable commission,
# resolved by the IB's active-referral count — 1-20 → Starter,
# 21-100 → Pro, 100+ → Elite. Admin retunes from /admin/config/ib-tiers.
DEFAULT_IB_TIERS = [
    {"label": "Starter", "min_referrals": 1,   "max_referrals": 20,   "per_lot": 6,
     "instant_payout": True, "dedicated_manager": False},
    {"label": "Pro",     "min_referrals": 21,  "max_referrals": 100,  "per_lot": 8,
     "instant_payout": True, "dedicated_manager": True},
    {"label": "Elite",   "min_referrals": 101, "max_referrals": None, "per_lot": 13,
     "instant_payout": True, "dedicated_manager": True},
]


async def get_mlm_distribution(db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                return DEFAULT_MLM_DISTRIBUTION
        if isinstance(val, list):
            return [int(x) for x in val]
    return DEFAULT_MLM_DISTRIBUTION


async def get_ib_tiers(db: AsyncSession) -> list[dict]:
    """Read the admin-tunable commission tier ladder."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "ib_commission_tiers")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                return DEFAULT_IB_TIERS
        if isinstance(val, list) and val:
            return val
    return DEFAULT_IB_TIERS


def resolve_tier_for_count(count: int, tiers: list[dict]) -> dict | None:
    """Pick the tier whose [min_referrals, max_referrals] window contains
    ``count``. None means the IB hasn't hit the first threshold yet —
    they're below the program's lowest tier and earn nothing from the
    tier ladder (the plan fallback may still apply)."""
    for t in tiers:
        lo = int(t.get("min_referrals") or 0)
        hi = t.get("max_referrals")
        hi_v = int(hi) if hi is not None else None
        if count >= lo and (hi_v is None or count <= hi_v):
            return t
    return None


async def _referred_account_type_key(db: AsyncSession, order_id: UUID) -> str | None:
    """Return the lowercase AccountGroup name for the account that
    placed ``order_id`` — used to look up the right per-lot rate in
    the tier's per_lot_by_account_type map. Returns None if any
    join fails (caller falls back to the flat per_lot).
    """
    from packages.common.src.models import Order, TradingAccount, AccountGroup

    row = (await db.execute(
        select(AccountGroup.name)
        .select_from(Order)
        .join(TradingAccount, TradingAccount.id == Order.account_id)
        .join(AccountGroup, AccountGroup.id == TradingAccount.account_group_id)
        .where(Order.id == order_id)
    )).first()
    if not row or not row[0]:
        return None
    return str(row[0]).strip().lower()


async def count_active_referrals(db: AsyncSession, ib_profile_id: UUID) -> int:
    """Active referrals = rows in the referrals table pointing at this IB.

    The tier ladder uses "active referrals" — we treat any Referral row
    as active (the platform soft-bans rather than deletes), which matches
    the IB dashboard's display count and keeps the tier resolver in sync
    with what the trader sees on their /business page.
    """
    n = (await db.execute(
        select(func.count()).select_from(Referral).where(
            Referral.ib_profile_id == ib_profile_id,
        )
    )).scalar() or 0
    return int(n)


async def distribute_ib_commission(
    db: AsyncSession,
    trader_user_id: UUID,
    order_id: UUID,
    lots: Decimal,
    instrument_symbol: str,
):
    """Called after a market order is filled. Distributes commission to IB chain."""
    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == trader_user_id)
    )
    referral = referral_q.scalar_one_or_none()
    if not referral or not referral.ib_profile_id:
        return

    ib_profile_q = await db.execute(
        select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)
    )
    direct_ib = ib_profile_q.scalar_one_or_none()
    if not direct_ib:
        return

    plan = None
    if direct_ib.commission_plan_id:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.id == direct_ib.commission_plan_id)
        )
        plan = plan_q.scalar_one_or_none()

    if not plan:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)
        )
        plan = plan_q.scalar_one_or_none()

    # Effective per-lot rate priority:
    #   1. Direct IB's custom override (admin sets this per-agent).
    #   2. Tier ladder, BY ACCOUNT TYPE of the referred user. A trade
    #      on a Standard account can pay a different per-lot than the
    #      same trade on ECN/VIP — Standard pays less, ECN/VIP more.
    #      Lookup key is the AccountGroup.name lowercased.
    #   3. Tier ladder's flat per_lot (fallback when the account type
    #      isn't keyed in per_lot_by_account_type).
    #   4. Plan default.
    per_lot = None
    if direct_ib.custom_commission_per_lot is not None and direct_ib.custom_commission_per_lot > 0:
        per_lot = Decimal(str(direct_ib.custom_commission_per_lot))

    if per_lot is None:
        tiers = await get_ib_tiers(db)
        active_n = await count_active_referrals(db, direct_ib.id)
        tier = resolve_tier_for_count(active_n, tiers)
        if tier:
            # Look up the referred user's account-type bucket. The
            # commission row that pays is the one tied to the same
            # account that placed the order. Falls through to the
            # flat per_lot if the account-type bucket is missing.
            acct_type_key = await _referred_account_type_key(db, order_id) or ""
            type_map = tier.get("per_lot_by_account_type") or {}
            raw = type_map.get(acct_type_key) if acct_type_key else None
            if raw in (None, "") and isinstance(type_map, dict):
                raw = type_map.get("standard")  # last-resort default
            if raw in (None, ""):
                raw = tier.get("per_lot")
            if raw not in (None, ""):
                try:
                    per_lot = Decimal(str(raw))
                except Exception:
                    per_lot = None

    if per_lot is None and plan and plan.commission_per_lot is not None:
        per_lot = Decimal(str(plan.commission_per_lot))

    if per_lot is None or per_lot <= 0:
        return

    total_commission = per_lot * lots
    if total_commission <= 0:
        return

    # Prefer plan's MLM distribution; fall back to global SystemSetting; then default.
    mlm_dist: list[int] | None = None
    if plan and plan.mlm_distribution:
        raw = plan.mlm_distribution
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = None
        if isinstance(raw, list) and raw:
            mlm_dist = [int(x) for x in raw]
    if mlm_dist is None:
        mlm_dist = await get_mlm_distribution(db)

    current_ib = direct_ib
    for level, pct in enumerate(mlm_dist, start=1):
        if current_ib is None:
            break

        share = total_commission * Decimal(str(pct)) / Decimal("100")
        if share <= 0:
            current_ib = await _get_parent_ib(current_ib, db)
            continue

        commission_record = IBCommission(
            ib_id=current_ib.id,
            source_user_id=trader_user_id,
            source_trade_id=order_id,
            commission_type="trade_lot",
            amount=share,
            mlm_level=level,
            status="paid",
        )
        db.add(commission_record)

        current_ib.total_earned = (current_ib.total_earned or Decimal("0")) + share

        ib_account_q = await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == current_ib.user_id,
                TradingAccount.is_demo == False,
                TradingAccount.is_active == True,
            ).limit(1)
        )
        ib_account = ib_account_q.scalar_one_or_none()
        if ib_account:
            ib_account.balance = (ib_account.balance or Decimal("0")) + share
            ib_account.equity = ib_account.balance + (ib_account.credit or Decimal("0"))
            ib_account.free_margin = ib_account.equity - (ib_account.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=current_ib.user_id,
                account_id=ib_account.id,
                type="ib_commission",
                amount=share,
                balance_after=ib_account.balance,
                description=f"IB commission L{level}: {instrument_symbol} {lots} lots",
            ))

        logger.info(f"IB commission L{level}: ${share:.2f} to {current_ib.referral_code} ({instrument_symbol} {lots} lots)")

        current_ib = await _get_parent_ib(current_ib, db)


async def _get_parent_ib(ib: IBProfile, db: AsyncSession) -> IBProfile | None:
    if not ib.parent_ib_id:
        return None
    result = await db.execute(
        select(IBProfile).where(IBProfile.id == ib.parent_ib_id, IBProfile.is_active == True)
    )
    return result.scalar_one_or_none()
