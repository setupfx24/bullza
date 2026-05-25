"""Tier pricing engine — produce the tier quotes for `/insurance/quote`.

Single pricing model after 2026-05-25 cleanup: walk `cfg.simple_tiers`
and produce one quote per tier. Linear scaling with lot size:

    fee     = lots × fee_per_lot × (1 + dynamic_surcharge)
    max_cap = lots × max_cap_per_lot
    coverage = tier.coverage_pct × frequent_claim_multiplier

Dynamic surcharge is the sum of: high-leverage, no-SL, high-winrate,
copy-trade. Each is configured in admin /insurance.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import InsuranceConfig


async def _frequent_claim_reduction(
    db: AsyncSession, user_id: Optional[UUID], cfg: InsuranceConfig,
) -> float:
    """Returns the coverage multiplier (≤1.0) for frequent claimers.
    1.0 = no reduction. Best-effort: returns 1.0 if anything fails."""
    if user_id is None:
        return 1.0
    try:
        # Local import — avoid circular load when this module is read at
        # gateway boot before models/__init__ finishes.
        from ..models import InsuranceClaim
        since = datetime.now(timezone.utc) - timedelta(days=cfg.frequent_claim_window_days)
        cnt = (await db.execute(
            select(func.count())
            .select_from(InsuranceClaim)
            .where(
                InsuranceClaim.user_id == user_id,
                InsuranceClaim.paid_at >= since,
            )
        )).scalar() or 0
        if int(cnt) >= cfg.frequent_claim_count:
            return max(0.0, 1.0 - float(cfg.frequent_claim_coverage_reduction_pct))
    except Exception:
        pass
    return 1.0


class TierQuote(TypedDict):
    tier: str
    fee: float
    coverage_pct: float
    max_cap: float
    estimated_refund: float
    # Kept in the response shape (always 0 after the cleanup) so the
    # existing InsuranceTierQuote schema + InsurancePolicy.risk_score
    # NOT NULL column don't break. Removed from pricing math entirely.
    risk_score: float


def _estimated_refund(
    *,
    coverage_pct: float,
    sl_distance: Optional[float],
    position_value_usd: float,
) -> float:
    """Display-only number — what a user could expect if SL is hit.
    Falls back to 0 when no SL given (UI just hides the line)."""
    if not sl_distance or position_value_usd <= 0:
        return 0.0
    return float(sl_distance * position_value_usd * (coverage_pct / 100.0))


async def quote_all_tiers(
    *,
    cfg: InsuranceConfig,
    leverage: float,
    atr: float,
    lots: float,
    trade_size_usd: float,
    has_stop_loss: bool,
    sl_distance: Optional[float],
    win_rate: float,
    db: Optional[AsyncSession] = None,
    user_id: Optional[UUID] = None,
    is_copy_trade: bool = False,
    account_group_id: Optional[UUID] = None,
) -> list[TierQuote]:
    """Return one quote per `cfg.simple_tiers` row.

    Caller is expected to pre-check `cfg.enabled`, news blackout, and
    ATR bounds — this function only does the math.

    `db` + `user_id` are optional but enable the frequent-claim coverage
    reduction. `is_copy_trade=True` adds the copy-trade fee surcharge.
    `atr` / `account_group_id` are kept in the signature for callers
    that already pass them; they're unused in the simple-tier path.
    """
    # Dynamic surcharges — additive multiplier on fee.
    surcharge = 0.0
    if leverage > cfg.high_lev_threshold:
        surcharge += cfg.high_lev_surcharge
    if not has_stop_loss:
        surcharge += cfg.no_sl_surcharge
    if win_rate >= cfg.winrate_threshold:
        surcharge += cfg.winrate_surcharge
    if is_copy_trade:
        surcharge += cfg.copy_trade_surcharge

    # Frequent-claim coverage reduction (anti-farming). 1.0 if caller
    # didn't pass db + user_id, or user is below the threshold.
    coverage_multiplier = 1.0
    if db is not None and user_id is not None:
        coverage_multiplier = await _frequent_claim_reduction(db, user_id, cfg)

    quotes: list[TierQuote] = []
    for tier_row in cfg.simple_tiers or []:
        try:
            label = str(tier_row.get("label") or "").strip() or "tier"
            fee_per_lot = float(tier_row.get("fee_per_lot") or 0)
            max_cap_per_lot = float(tier_row.get("max_cap_per_lot") or 0)
            cov_raw = float(tier_row.get("coverage_pct") or 0)
        except (TypeError, ValueError):
            continue

        final_fee = lots * fee_per_lot * (1 + surcharge)
        max_cap = lots * max_cap_per_lot
        coverage = cov_raw * coverage_multiplier
        est_refund = _estimated_refund(
            coverage_pct=coverage,
            sl_distance=sl_distance,
            position_value_usd=trade_size_usd,
        )

        # Tier label is whatever admin set (e.g. "50%", "70%") — the
        # trader UI renders the string verbatim with light formatting.
        quotes.append({
            "tier": label,
            "fee": round(final_fee, 2),
            "coverage_pct": round(coverage, 2),
            "max_cap": round(max_cap, 2),
            "estimated_refund": round(est_refund, 2),
            "risk_score": 0.0,
        })

    return quotes


def fee_to_decimal(fee: float) -> Decimal:
    """Convenience for callers that need a Decimal-typed fee for the wallet ledger."""
    return Decimal(str(round(fee, 2)))
