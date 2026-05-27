"""Claim eligibility + payout for insured positions.

Wired into `trading_service.close_position` immediately before its final
`db.commit()` so the close + payout are atomic.

Cross-checked against Trade_Insurance.docx (May 2026):
  ✓ Slide 4   RiskScore = LeverageFactor × VolatilityFactor × TradeSizeFactor
              implemented in insurance/risk.py
  ✓ Slide 5   BaseFee = RiskScore × BaseConstant ($1.2 default)
  ✓ Slide 6   Tier multipliers Basic 1× / Advanced 2× / Pro 3× / Elite 4×
  ✓ Slide 7   Fee cap $6 (normal) / $12 (high-volume ≥5 lots)
  ✓ Slide 8   Coverage 20 / 30 / 40 / 50 %
  ✓ Slide 9   Claim = min(Loss × Coverage%, MaxCap)
  ✓ Slide 10  MaxCap rules — flat OR % of trade size, whichever is smaller
  ✓ Slide 11  EstimatedRefund (display-only) in pricing.py
  ✓ Slide 13  Trigger gates — close in loss, ≥5 min duration, no hedge,
              policy was active, news-blackout, ATR floor (low-vol disable)
  ✓ Slide 14  Instant wallet credit — Transaction(insurance_payout)
  ✓ Slide 15  Anti-abuse — 2 claims/day, 12h cooldown, $2000/day cap,
              hedge guard
  ✓ Slide 16  Dynamic surcharges — high leverage (+20%), no SL (+15%),
              high winrate (+15%) in pricing.quote_all_tiers
  ✓ Slide 17  News blackout (admin-set) + ATR floor + ATR ceiling
              (extreme-vol kill switch — added in this commit)
  ✓ Slide 18  Partial close → proportional via paid_so_far accounting

Slide 16 frequent-claim coverage reduction now applies in
quote_all_tiers when ≥ insurance_frequent_claim_count claims have been
paid in the last insurance_frequent_claim_window_days. Slide 18
copy-trade fee surcharge applies when callers pass is_copy_trade=True
to the quote function. All other slides remain ✓ as listed above.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    InsurancePolicy, InsuranceClaim, Position, TradeHistory,
    TradingAccount, Transaction,
)
from .config import InsuranceConfig, load_config
from .volatility import get_atr

logger = logging.getLogger("insurance.claims")

# Returned by evaluate_claim when the trade isn't eligible.
class _Denied(Exception):
    def __init__(self, reason: str):
        self.reason = reason


async def _hedge_exists(*, db: AsyncSession, position: Position) -> bool:
    """Any other open position on the same instrument by this account on the
    opposite side? If so, the close was effectively neutralised by a hedge."""
    q = await db.execute(
        select(Position.id).where(
            Position.account_id == position.account_id,
            Position.instrument_id == position.instrument_id,
            Position.id != position.id,
            Position.status.in_(("open", "partially_closed")),
            Position.side != position.side,
        ).limit(1)
    )
    return q.scalar_one_or_none() is not None


async def _user_claims_today(
    *, db: AsyncSession, user_id, since: datetime,
) -> tuple[int, Decimal, Optional[datetime]]:
    """Returns (count, total_payout, last_paid_at) for the given window."""
    q = await db.execute(
        select(
            func.count(InsuranceClaim.id),
            func.coalesce(func.sum(InsuranceClaim.claim_amount), 0),
            func.max(InsuranceClaim.paid_at),
        ).where(
            InsuranceClaim.user_id == user_id,
            InsuranceClaim.paid_at >= since,
        )
    )
    row = q.one()
    return int(row[0]), Decimal(str(row[1])), row[2]


async def evaluate_claim(
    *,
    db: AsyncSession,
    policy: InsurancePolicy,
    position: Position,
    history: TradeHistory,
    cfg: Optional[InsuranceConfig] = None,
) -> tuple[bool, Decimal, str]:
    """Run every gate. Returns (eligible, claim_amount, reason).
    `claim_amount` is 0 when not eligible; `reason` describes the denial.
    """
    cfg = cfg or await load_config()

    if not cfg.enabled:
        return False, Decimal("0"), "insurance_disabled"

    if cfg.news_blackout_until and datetime.now(timezone.utc) < cfg.news_blackout_until:
        return False, Decimal("0"), "news_blackout"

    if policy.status != "active":
        return False, Decimal("0"), f"policy_{policy.status}"

    # ── Client gate: policy auto-expires N seconds after activation ─
    # Trades closed after the validity window don't claim.
    if cfg.policy_validity_seconds and cfg.policy_validity_seconds > 0:
        activated = policy.activated_at
        if activated is not None:
            if activated.tzinfo is None:
                activated = activated.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - activated).total_seconds()
            if age > float(cfg.policy_validity_seconds):
                return False, Decimal("0"), "policy_expired"

    profit = Decimal(str(history.profit or 0))
    if profit >= 0:
        return False, Decimal("0"), "not_a_loss"

    # Trade duration ≥ min seconds.
    # trading_service.close_position writes history.closed_at as a naive
    # datetime.utcnow(), while history.opened_at comes from the DB column
    # as timezone-aware — subtracting them directly crashes with
    # "can't subtract offset-naive and offset-aware datetimes" and the
    # whole maybe_pay flow returns None silently (no claim recorded, no
    # policy status update). Normalise both to UTC before comparing.
    opened = history.opened_at
    closed = history.closed_at
    if opened and closed:
        if opened.tzinfo is None:
            opened = opened.replace(tzinfo=timezone.utc)
        if closed.tzinfo is None:
            closed = closed.replace(tzinfo=timezone.utc)
        if (closed - opened).total_seconds() < cfg.min_trade_duration_seconds:
            return False, Decimal("0"), "min_duration"

    # Volatility kill switches (Trade_Insurance.docx slide 17):
    #  - atr_floor: low-vol → likely-zero claims, system risk, disable.
    #  - atr_ceiling: extreme spike → unbounded payouts, disable.
    symbol = (position.instrument.symbol if position.instrument else "")
    atr = await get_atr(symbol)
    if atr < cfg.atr_floor:
        return False, Decimal("0"), "vol_too_low"
    if cfg.atr_ceiling is not None and atr > cfg.atr_ceiling:
        return False, Decimal("0"), "vol_too_high"

    # Hedge check
    if await _hedge_exists(db=db, position=position):
        return False, Decimal("0"), "hedge"

    # Anti-abuse — daily caps + cooldown
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    cooldown_window = now - timedelta(hours=cfg.cooldown_hours)

    count_24h, payout_24h, last_paid = await _user_claims_today(
        db=db, user_id=policy.user_id, since=day_ago,
    )
    if count_24h >= cfg.daily_claim_limit:
        return False, Decimal("0"), "daily_claim_limit"
    if last_paid and last_paid >= cooldown_window:
        return False, Decimal("0"), "cooldown"

    # Compute claim
    loss_abs = -profit
    coverage_frac = Decimal(str(policy.coverage_pct)) / Decimal("100")
    raw_claim = loss_abs * coverage_frac

    # Subtract any prior partial-close payouts on this same policy from the cap
    # so the total never exceeds the policy's max_cap, even across many partials.
    paid_so_far_q = await db.execute(
        select(func.coalesce(func.sum(InsuranceClaim.claim_amount), 0))
        .where(InsuranceClaim.policy_id == policy.id)
    )
    paid_so_far = Decimal(str(paid_so_far_q.scalar_one() or 0))
    remaining_cap = Decimal(str(policy.max_cap)) - paid_so_far
    if remaining_cap <= 0:
        return False, Decimal("0"), "cap_exhausted"

    claim_amount = min(raw_claim, remaining_cap)

    # Cap by remaining daily payout headroom
    remaining = Decimal(str(cfg.daily_payout_limit)) - payout_24h
    if remaining <= 0:
        return False, Decimal("0"), "daily_payout_limit"
    if claim_amount > remaining:
        claim_amount = remaining

    if claim_amount <= 0:
        return False, Decimal("0"), "zero_payout"

    return True, claim_amount.quantize(Decimal("0.01")), "eligible"


async def maybe_pay(
    *,
    db: AsyncSession,
    position: Position,
    history: TradeHistory,
) -> Optional[InsuranceClaim]:
    """Look up the active policy for `position` and, if eligible, record a
    PENDING claim. No wallet credit happens here — the trader must press
    Claim in the dashboard (see `pay_claim` below) for the funds to land
    in account.credit. Designed to be called inside the same transaction
    as the position close, immediately before commit.

    Function name kept (`maybe_pay`) for caller compatibility, but the
    semantics changed to manual-claim on 2026-05-25 at the client's
    request. Any unhandled exception is caught and logged — the close
    itself must still complete even if recording fails.
    """
    try:
        cfg = await load_config()

        pol_q = await db.execute(
            select(InsurancePolicy)
            .where(InsurancePolicy.position_id == position.id)
            .with_for_update()
        )
        policy = pol_q.scalar_one_or_none()
        if policy is None:
            return None  # No insurance — nothing to do.

        eligible, claim_amount, reason = await evaluate_claim(
            db=db, policy=policy, position=position, history=history, cfg=cfg,
        )

        if not eligible:
            policy.status = "denied" if reason in (
                "hedge", "min_duration", "cooldown", "daily_claim_limit",
                "daily_payout_limit", "vol_too_low", "vol_too_high",
                "news_blackout", "insurance_disabled",
            ) else "expired"
            policy.settled_at = datetime.now(timezone.utc)
            # Persist the reason so the trader /insurance page can
            # render "why" under each non-claimed row.
            policy.settled_reason = reason
            logger.info(
                "Insurance claim denied policy=%s reason=%s",
                policy.id, reason,
            )
            return None

        # Recompute paid_so_far to decide if this claim exhausts the policy
        # cap (and therefore should mark the policy as 'claimed' now).
        paid_so_far_q = await db.execute(
            select(func.coalesce(func.sum(InsuranceClaim.claim_amount), 0))
            .where(InsuranceClaim.policy_id == policy.id)
        )
        paid_so_far = Decimal(str(paid_so_far_q.scalar_one() or 0))

        # Pending claim — no transaction, no credit, no paid_at. Just
        # bookkeeping so the trader's dashboard can render a "Claim
        # $X.XX" row.
        claim = InsuranceClaim(
            id=uuid.uuid4(),
            policy_id=policy.id,
            user_id=policy.user_id,
            loss_amount=-Decimal(str(history.profit)),
            claim_amount=claim_amount,
            status="pending",
        )
        db.add(claim)

        # Mark the policy 'claimed' when the position is fully closed or
        # the cap is reached — even though no money has moved yet, no
        # further claims can spawn against this policy. (If the trader
        # never presses Claim, the row will just sit as 'pending'
        # indefinitely; admin can audit via the policies view.)
        position_done = position.status == "closed"
        cap_exhausted = (Decimal(str(policy.max_cap)) - paid_so_far - claim_amount) <= 0
        if position_done or cap_exhausted:
            policy.status = "claimed"
            policy.settled_at = datetime.now(timezone.utc)

        logger.info(
            "Insurance claim pending policy=%s user=%s amount=%s position_done=%s",
            policy.id, policy.user_id, claim_amount, position_done,
        )
        return claim

    except Exception as exc:  # never break the close
        logger.exception("maybe_pay failed: %s", exc)
        return None


async def pay_claim(
    *,
    db: AsyncSession,
    claim_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[Optional[InsuranceClaim], Optional[str]]:
    """Trader pressed Claim on a pending row. Verifies ownership + state,
    credits account.credit (or account.balance if admin disabled
    payout_to_credit), writes the insurance_payout transaction, and
    flips the claim to 'paid'. Returns (claim, error_reason). `error_reason`
    is None on success.

    The caller (the FastAPI route) owns the db.commit() — this function
    only mutates rows inside the active session.
    """
    cfg = await load_config()

    claim_q = await db.execute(
        select(InsuranceClaim)
        .where(InsuranceClaim.id == claim_id)
        .with_for_update()
    )
    claim = claim_q.scalar_one_or_none()
    if claim is None:
        return None, "not_found"
    if claim.user_id != user_id:
        # Don't leak existence — same error as not_found.
        return None, "not_found"
    if claim.status != "pending":
        return None, "already_claimed"

    policy_q = await db.execute(
        select(InsurancePolicy)
        .where(InsurancePolicy.id == claim.policy_id)
        .with_for_update()
    )
    policy = policy_q.scalar_one_or_none()
    if policy is None:
        return None, "policy_missing"

    account_q = await db.execute(
        select(TradingAccount)
        .where(TradingAccount.id == policy.account_id)
        .with_for_update()
    )
    account = account_q.scalar_one_or_none()
    if account is None:
        return None, "account_missing"

    claim_amount = Decimal(str(claim.claim_amount))
    payout_to_credit = bool(getattr(cfg, "payout_to_credit", True))
    if payout_to_credit:
        prev_credit = Decimal(str(account.credit or 0))
        account.credit = prev_credit + claim_amount
        if account.equity is not None:
            account.equity = Decimal(str(account.equity)) + claim_amount
        balance_after_for_tx = Decimal(str(account.balance or 0))
        description_suffix = (
            " — credited to trading credit (tradable, not withdrawable)"
        )
    else:
        prev = Decimal(str(account.balance or 0))
        new_balance = prev + claim_amount
        account.balance = new_balance
        if account.equity is not None:
            account.equity = Decimal(str(account.equity)) + claim_amount
        balance_after_for_tx = new_balance
        description_suffix = ""

    tx = Transaction(
        id=uuid.uuid4(),
        user_id=policy.user_id,
        account_id=policy.account_id,
        type="insurance_payout",
        amount=claim_amount,
        balance_after=balance_after_for_tx,
        reference_id=policy.id,
        description=(
            f"Trade insurance payout — {policy.tier} tier "
            f"({float(policy.coverage_pct):.0f}% of "
            f"${float(claim.loss_amount):.2f} loss)"
            f"{description_suffix}"
        ),
    )
    db.add(tx)
    await db.flush()

    now = datetime.now(timezone.utc)
    claim.status = "paid"
    claim.claimed_at = now
    claim.paid_at = now
    claim.transaction_id = tx.id

    logger.info(
        "Insurance claim paid claim=%s policy=%s user=%s amount=%s",
        claim.id, policy.id, policy.user_id, claim_amount,
    )
    return claim, None
