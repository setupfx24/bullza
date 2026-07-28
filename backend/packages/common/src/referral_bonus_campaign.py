"""Admin-managed referral bonus campaigns — award/claim logic.

Supersedes the old one-off "first 100 KYC" referral_kyc_promo.py. An admin
creates any number of campaigns over time (see
backend/services/admin/routes/referral_campaigns.py for the CRUD). Each
campaign independently gates on EITHER:
  - KYC approval alone (required_trades == 0), or
  - KYC approval AND N closed trades (required_trades > 0)

and independently caps how many referrers can claim it (max_claims).

ORM shapes live in .models.referral_bonus_campaign; this module is the
service layer that hook points (KYC approval, trade close) call into.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Literal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ReferralBonusCampaign, ReferralBonusClaim, User, Transaction, TradeHistory, TradingAccount
from .notify import create_notification


async def get_active_campaigns_status(db: AsyncSession) -> list[dict]:
    """Public, read-only feed for the website/mobile counter widget. Only
    returns campaigns that are active AND still have open slots — a
    campaign that's paused or full simply disappears from this list, which
    is exactly what makes the frontend widget auto-hide itself."""
    rows = (await db.execute(
        select(ReferralBonusCampaign)
        .where(ReferralBonusCampaign.is_active.is_(True))
        .order_by(ReferralBonusCampaign.created_at.desc())
    )).scalars().all()

    out = []
    for c in rows:
        remaining = max(0, c.max_claims - c.claimed_count)
        if remaining <= 0:
            continue
        out.append({
            "id": str(c.id),
            "name": c.name,
            "amount_usd": str(c.amount_usd),
            "claimed": int(c.claimed_count),
            "max": int(c.max_claims),
            "remaining": int(remaining),
            "required_trades": int(c.required_trades),
        })
    return out


async def _referred_users_closed_trade_count(db: AsyncSession, user_id) -> int:
    """How many closed trades this user has, across all their trading
    accounts — same "qualifying trade" concept the existing default
    referral funnel already uses in referral_service.py. TradeHistory has
    no user_id column directly, so this joins through TradingAccount."""
    result = await db.execute(
        select(func.count(TradeHistory.id))
        .join(TradingAccount, TradeHistory.account_id == TradingAccount.id)
        .where(TradingAccount.user_id == user_id)
    )
    return int(result.scalar() or 0)


async def check_and_award(
    db: AsyncSession,
    referred_user: User,
    event: Literal["kyc", "trade"],
) -> list[dict]:
    """Call this at the two hook points (KYC approval, trade close). Checks
    every currently-active campaign whose gate matches this event type, and
    awards any the referred_user (and their referrer) now qualifies for.

    Callers MUST wrap this in `async with db.begin_nested():` (a SAVEPOINT)
    rather than a bare try/except — a bare try/except leaves the session
    marked rolled-back on failure, which then breaks the caller's own
    db.commit() (see the trade-close hook in trading_service.py for the
    documented incident this pattern fixes).

    Returns a list of awards made (usually 0 or 1, but nothing stops a
    referred user from unlocking two different campaigns on the same
    event if an admin has more than one running at once).
    """
    if referred_user is None or referred_user.referred_by_user_id is None:
        return []
    if referred_user.kyc_status != "approved":
        return []  # KYC is always required, regardless of which event fired

    # Which campaigns COULD apply to this event:
    #   event="kyc"   -> campaigns with required_trades == 0
    #   event="trade" -> campaigns with required_trades > 0
    trade_count: int | None = None
    if event == "trade":
        trade_count = await _referred_users_closed_trade_count(db, referred_user.id)

    candidates = (await db.execute(
        select(ReferralBonusCampaign)
        .where(ReferralBonusCampaign.is_active.is_(True))
        .where(
            ReferralBonusCampaign.required_trades == 0
            if event == "kyc"
            else ReferralBonusCampaign.required_trades > 0
        )
    )).scalars().all()

    awards = []
    for campaign in candidates:
        if event == "trade" and (trade_count or 0) < campaign.required_trades:
            continue  # this referred user hasn't hit the trade count yet

        award = await _try_award_one(db, campaign, referred_user)
        if award:
            awards.append(award)
    return awards


async def _try_award_one(db: AsyncSession, campaign: ReferralBonusCampaign, referred_user: User) -> dict | None:
    # Row-lock the campaign for the check-and-increment, same reasoning as
    # every other balance mutation in this codebase.
    locked = (await db.execute(
        select(ReferralBonusCampaign).where(ReferralBonusCampaign.id == campaign.id).with_for_update()
    )).scalar_one_or_none()
    if locked is None or not locked.is_active:
        return None
    if locked.claimed_count >= locked.max_claims:
        return None

    referrer = (await db.execute(
        select(User).where(User.id == referred_user.referred_by_user_id).with_for_update()
    )).scalar_one_or_none()
    if referrer is None:
        return None

    # The database UNIQUE(campaign_id, referrer_id) constraint is the real
    # enforcement — this SELECT is just a cheap pre-check to avoid a wasted
    # write + exception on the common "already claimed" path.
    already = (await db.execute(
        select(ReferralBonusClaim).where(
            ReferralBonusClaim.campaign_id == locked.id,
            ReferralBonusClaim.referrer_id == referrer.id,
        )
    )).scalar_one_or_none()
    if already is not None:
        return None

    amount = Decimal(str(locked.amount_usd))

    referrer.referral_commission_balance = (
        Decimal(str(referrer.referral_commission_balance or 0)) + amount
    )
    locked.claimed_count += 1

    referred_display = " ".join(
        filter(None, [referred_user.first_name, referred_user.last_name])
    ).strip() or (referred_user.email or "your referral")

    db.add(ReferralBonusClaim(
        campaign_id=locked.id,
        referrer_id=referrer.id,
        referred_user_id=referred_user.id,
        amount_usd=amount,
    ))
    db.add(Transaction(
        user_id=referrer.id,
        type="referral_commission",
        amount=amount,
        balance_after=None,
        description=f"{locked.name} — {referred_display} qualified",
    ))

    await create_notification(
        db, referrer.id,
        title=f"You earned ${amount}!",
        message=f"{referred_display} qualified for the \"{locked.name}\" bonus — ${amount} added to your referral balance.",
        notif_type="referral",
        commit=False,
    )

    return {
        "campaign_id": str(locked.id),
        "campaign_name": locked.name,
        "referrer_id": str(referrer.id),
        "referred_user_id": str(referred_user.id),
        "amount_usd": str(amount),
    }
