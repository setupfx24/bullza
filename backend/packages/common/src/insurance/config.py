"""Strongly-typed accessor over SystemSetting rows for insurance constants.

Reading via this dataclass means a single Redis round-trip per request
instead of one per setting key.

After the 2026-05-25 cleanup, the legacy 4-tier (basic / advanced / pro /
elite) pricing system + risk-score math + lot-bracket alternative were
all dropped. The engine now runs ONE pricing model: `simple_tiers` —
a list of tiers each defining (label, coverage_pct, fee_per_lot,
max_cap_per_lot). Fee and cap scale linearly with the user's lot size.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..settings_store import get_system_setting


@dataclass
class InsuranceConfig:
    enabled: bool

    # ── Pricing — the ONLY pricing source post-2026-05-25 cleanup ──
    # Each tier: {"label", "coverage_pct", "fee_per_lot", "max_cap_per_lot"}.
    #   fee     = lots × fee_per_lot
    #   max_cap = lots × max_cap_per_lot
    # Surcharges below still multiply on `fee` so risk-based pricing
    # remains. Empty list = insurance feature returns no quotes (admin
    # must configure at least one tier).
    simple_tiers: list[dict]

    # ── Anti-abuse + duration gates ────────────────────────────────
    min_trade_duration_seconds: int
    daily_claim_limit: int
    daily_payout_limit: float
    cooldown_hours: int

    # ── Dynamic risk surcharges on fee (additive multipliers) ──────
    high_lev_threshold: float
    high_lev_surcharge: float
    no_sl_surcharge: float
    winrate_threshold: float
    winrate_surcharge: float
    copy_trade_surcharge: float

    # ── Volatility kill-switches ───────────────────────────────────
    atr_floor: float
    atr_ceiling: Optional[float]

    # ── Frequent-claim coverage reduction (anti-farming) ───────────
    frequent_claim_count: int
    frequent_claim_window_days: int
    frequent_claim_coverage_reduction_pct: float

    # ── News blackout (manual emergency pause) ─────────────────────
    news_blackout_until: Optional[datetime]

    # ── Client-spec rules ──────────────────────────────────────────
    # Insurance auto-expires this many seconds after activation. 0 = no expiry.
    policy_validity_seconds: int
    # Max policies a user can activate in any rolling 24h window. 0 = unlimited.
    max_policies_per_day: int
    # UTC hour-of-day blackout. Both None = disabled. Wraps midnight.
    blackout_hour_start: Optional[int]
    blackout_hour_end: Optional[int]
    # Hard ceiling on lots an insurance policy can cover. 0 = no cap.
    max_lots_insurable: float
    # When True, claim payout credits account.credit (tradable, not
    # withdrawable). When False, classic account.balance credit.
    payout_to_credit: bool


_DEFAULTS = InsuranceConfig(
    enabled=True,
    # Client's spec defaults — 50% @ $100/lot ($1 per 0.01 lot, $5 cap per 0.01)
    # and 70% @ $300/lot ($3 per 0.01 lot, $10 cap per 0.01).
    simple_tiers=[
        {"label": "50%", "coverage_pct": 50, "fee_per_lot": 100, "max_cap_per_lot": 500},
        {"label": "70%", "coverage_pct": 70, "fee_per_lot": 300, "max_cap_per_lot": 1000},
    ],
    min_trade_duration_seconds=300,
    daily_claim_limit=2,
    daily_payout_limit=2000,
    cooldown_hours=12,
    # Surcharges default to 0 — client spec is pure linear per-lot pricing
    # ($1 per 0.01 lot at 50%, $3 per 0.01 lot at 70%). Admin can re-enable
    # any of these surcharges from /insurance if risk-based pricing is wanted.
    high_lev_threshold=200,
    high_lev_surcharge=0.0,
    no_sl_surcharge=0.0,
    winrate_threshold=0.65,
    winrate_surcharge=0.0,
    copy_trade_surcharge=0.0,
    atr_floor=0.0001,
    atr_ceiling=None,
    frequent_claim_count=4,
    frequent_claim_window_days=30,
    frequent_claim_coverage_reduction_pct=0.25,
    news_blackout_until=None,
    policy_validity_seconds=600,
    max_policies_per_day=3,
    blackout_hour_start=None,
    blackout_hour_end=None,
    max_lots_insurable=0.05,
    payout_to_credit=True,
)


async def load_config() -> InsuranceConfig:
    async def _get(key: str, default):
        v = await get_system_setting(key, default)
        return v if v is not None else default

    blackout_raw = await _get("insurance_news_blackout_until", None)
    blackout: Optional[datetime] = None
    if isinstance(blackout_raw, str):
        try:
            blackout = datetime.fromisoformat(blackout_raw.replace("Z", "+00:00"))
        except ValueError:
            blackout = None

    return InsuranceConfig(
        enabled=bool(await _get("insurance_enabled", True)),
        simple_tiers=list(
            await _get("insurance_simple_tiers", _DEFAULTS.simple_tiers)
        ),
        min_trade_duration_seconds=int(
            await _get("insurance_min_trade_duration_seconds", _DEFAULTS.min_trade_duration_seconds)
        ),
        daily_claim_limit=int(
            await _get("insurance_anti_abuse_daily_claims", _DEFAULTS.daily_claim_limit)
        ),
        daily_payout_limit=float(
            await _get("insurance_anti_abuse_daily_payout", _DEFAULTS.daily_payout_limit)
        ),
        cooldown_hours=int(
            await _get("insurance_anti_abuse_cooldown_hours", _DEFAULTS.cooldown_hours)
        ),
        high_lev_threshold=float(
            await _get("insurance_dynamic_high_lev_threshold", _DEFAULTS.high_lev_threshold)
        ),
        high_lev_surcharge=float(
            await _get("insurance_dynamic_high_lev_surcharge", _DEFAULTS.high_lev_surcharge)
        ),
        no_sl_surcharge=float(
            await _get("insurance_dynamic_no_sl_surcharge", _DEFAULTS.no_sl_surcharge)
        ),
        winrate_threshold=float(
            await _get("insurance_dynamic_winrate_threshold", _DEFAULTS.winrate_threshold)
        ),
        winrate_surcharge=float(
            await _get("insurance_dynamic_winrate_surcharge", _DEFAULTS.winrate_surcharge)
        ),
        copy_trade_surcharge=float(
            await _get("insurance_copy_trade_surcharge", _DEFAULTS.copy_trade_surcharge)
        ),
        atr_floor=float(await _get("insurance_disable_atr_floor", _DEFAULTS.atr_floor)),
        atr_ceiling=(
            float(await _get("insurance_disable_atr_ceiling", _DEFAULTS.atr_ceiling))
            if (await _get("insurance_disable_atr_ceiling", None)) is not None
            else None
        ),
        frequent_claim_count=int(
            await _get("insurance_frequent_claim_count", _DEFAULTS.frequent_claim_count)
        ),
        frequent_claim_window_days=int(
            await _get("insurance_frequent_claim_window_days", _DEFAULTS.frequent_claim_window_days)
        ),
        frequent_claim_coverage_reduction_pct=float(
            await _get("insurance_frequent_claim_coverage_reduction_pct", _DEFAULTS.frequent_claim_coverage_reduction_pct)
        ),
        news_blackout_until=blackout,
        policy_validity_seconds=int(
            await _get("insurance_policy_validity_seconds", _DEFAULTS.policy_validity_seconds)
        ),
        max_policies_per_day=int(
            await _get("insurance_max_policies_per_day", _DEFAULTS.max_policies_per_day)
        ),
        blackout_hour_start=(
            int(await _get("insurance_blackout_hour_start", None))
            if (await _get("insurance_blackout_hour_start", None)) is not None
            else None
        ),
        blackout_hour_end=(
            int(await _get("insurance_blackout_hour_end", None))
            if (await _get("insurance_blackout_hour_end", None)) is not None
            else None
        ),
        max_lots_insurable=float(
            await _get("insurance_max_lots_insurable", _DEFAULTS.max_lots_insurable)
        ),
        payout_to_credit=bool(
            await _get("insurance_payout_to_credit", _DEFAULTS.payout_to_credit)
        ),
    )
