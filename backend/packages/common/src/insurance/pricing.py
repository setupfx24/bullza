"""Tier pricing engine — produce the four-quote response for `/insurance/quote`."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, TypedDict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import InsuranceConfig
from .risk import risk_score

TIERS: tuple[str, ...] = ("basic", "advanced", "pro", "elite")


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
    risk_score: float


def _max_cap_for(tier: str, trade_size_usd: float, cfg: InsuranceConfig) -> float:
    flat, pct = cfg.max_cap_rules[tier]
    return float(min(flat, pct * trade_size_usd))


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


def _match_lot_bracket(cfg: InsuranceConfig, lots: float) -> Optional[dict]:
    """Return the first lot-bracket whose [min_lots, max_lots] contains
    `lots`. None if brackets are empty or no row matches — caller falls
    back to the legacy fixed-tier pricing."""
    for row in cfg.lot_brackets or []:
        try:
            lo = float(row.get("min_lots") or 0)
            hi_raw = row.get("max_lots")
            hi = None if hi_raw is None or hi_raw == "" else float(hi_raw)
        except (TypeError, ValueError):
            continue
        if lots < lo:
            continue
        if hi is not None and lots > hi:
            continue
        return row
    return None


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
    """Return the four tiered quotes. Caller is expected to pre-check
    `cfg.enabled`, news blackout, and ATR bounds — this function only
    does the math.

    `db` + `user_id` are optional but enable the slide-16 frequent-claim
    coverage reduction. `is_copy_trade=True` adds slide-18's copy-trade
    fee surcharge."""
    rs = risk_score(leverage, atr, lots)
    base_fee = rs * cfg.base_constant

    # Fee cap — high-volume threshold widens the cap.
    fee_cap = cfg.fee_cap_high_volume if lots >= cfg.high_volume_lots else cfg.fee_cap

    # Dynamic surcharges
    surcharge = 0.0
    if leverage > cfg.high_lev_threshold:
        surcharge += cfg.high_lev_surcharge
    if not has_stop_loss:
        surcharge += cfg.no_sl_surcharge
    if win_rate >= cfg.winrate_threshold:
        surcharge += cfg.winrate_surcharge
    if is_copy_trade:
        surcharge += cfg.copy_trade_surcharge

    # Slide 16 — frequent-claim coverage reduction. Caller must pass db +
    # user_id for the lookup to fire; otherwise the multiplier is 1.0.
    coverage_multiplier = 1.0
    if db is not None and user_id is not None:
        coverage_multiplier = await _frequent_claim_reduction(db, user_id, cfg)

    # Per-lot pricing branch — fee scales linearly with `lots` so a 10-lot
    # trade costs ~10× a 1-lot trade (subject to fee_cap). Surcharges still
    # multiply; risk_score is exposed for the UI but does NOT feed the fee.
    use_per_lot = (cfg.pricing_mode or "per_lot").lower() == "per_lot"

    # Per-account-type override — admin can pin specific $/lot rates for
    # users on a given account group (Micro/Standard/Pro/Elite trading
    # account). When set, those rates REPLACE the global per_lot_fee for
    # this quote. Missing tier inside a group entry falls back to global.
    group_overrides: dict[str, float] = {}
    if account_group_id is not None and cfg.per_lot_fee_by_account_group:
        raw = cfg.per_lot_fee_by_account_group.get(str(account_group_id))
        if isinstance(raw, dict):
            for k, v in raw.items():
                try:
                    group_overrides[str(k).lower()] = float(v)
                except (TypeError, ValueError):
                    continue

    # ── SIMPLE-MODE pricing (highest precedence, client's preferred shape) ──
    # 2 tiers (50% / 70% by default). fee + max_cap scale LINEARLY with
    # lots, so 0.01 lot at fee_per_lot=$100 → $1, 0.02 lot → $2, etc.
    # Returns IMMEDIATELY — bypasses lot_brackets and legacy 4-tier ladder.
    # Surcharges still multiply on fee so risk-based pricing isn't lost.
    if cfg.simple_tiers:
        quotes: list[TierQuote] = []
        for tier_row in cfg.simple_tiers:
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
            # Keep the label exactly as admin set it (e.g. "50%", "70%")
            # so the trader UI doesn't need to know about percentages —
            # it just renders whatever string comes back.
            quotes.append({
                "tier": label,
                "fee": round(final_fee, 2),
                "coverage_pct": round(coverage, 2),
                "max_cap": round(max_cap, 2),
                "estimated_refund": round(est_refund, 2),
                "risk_score": round(rs, 4),
            })
        return quotes

    # ── Lot-size bracket pricing (advanced — multi-range admin tables) ──
    # When admin has configured lot_brackets, the matching bracket's
    # tier list REPLACES the legacy 4-tier ladder. Each bracket-tier
    # has its own (fee, coverage_pct, max_cap) — no risk-score math,
    # no fee_cap (admin already chose absolute numbers), surcharges
    # still apply on top of `fee` so dynamic risk pricing still works.
    bracket = _match_lot_bracket(cfg, lots)
    if bracket is not None:
        quotes: list[TierQuote] = []
        for tier_row in (bracket.get("tiers") or []):
            try:
                label = str(tier_row.get("label") or "").strip().lower() or "basic"
                fee = float(tier_row.get("fee") or 0)
                cov_raw = float(tier_row.get("coverage_pct") or 0)
                max_cap = float(tier_row.get("max_cap") or 0)
            except (TypeError, ValueError):
                continue
            final_fee = fee * (1 + surcharge)
            coverage = cov_raw * coverage_multiplier
            est_refund = _estimated_refund(
                coverage_pct=coverage,
                sl_distance=sl_distance,
                position_value_usd=trade_size_usd,
            )
            quotes.append({
                "tier": label,
                "fee": round(final_fee, 2),
                "coverage_pct": round(coverage, 2),
                "max_cap": round(max_cap, 2),
                "estimated_refund": round(est_refund, 2),
                "risk_score": round(rs, 4),
            })
        return quotes

    quotes: list[TierQuote] = []
    for tier in TIERS:
        if use_per_lot:
            rate = group_overrides.get(tier)
            if rate is None:
                rate = float(cfg.per_lot_fee.get(tier, 0.0) or 0.0)
            tier_fee = lots * rate * (1 + surcharge)
        else:
            mult = cfg.tier_multipliers.get(tier, 1)
            tier_fee = base_fee * mult * (1 + surcharge)
        final_fee = min(tier_fee, fee_cap)

        rack_coverage = cfg.coverage_pct.get(tier, 0)
        coverage = rack_coverage * coverage_multiplier
        max_cap = _max_cap_for(tier, trade_size_usd, cfg)
        est_refund = _estimated_refund(
            coverage_pct=coverage,
            sl_distance=sl_distance,
            position_value_usd=trade_size_usd,
        )

        quotes.append({
            "tier": tier,
            "fee": round(final_fee, 2),
            "coverage_pct": round(coverage, 2),
            "max_cap": round(max_cap, 2),
            "estimated_refund": round(est_refund, 2),
            "risk_score": round(rs, 4),
        })
    return quotes


def fee_to_decimal(fee: float) -> Decimal:
    """Convenience for callers that need a Decimal-typed fee for the wallet ledger."""
    return Decimal(str(round(fee, 2)))
