"""Strongly-typed accessor over SystemSetting rows for insurance constants.

Reading via this dataclass means a single Redis round-trip per request
instead of one per setting key.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from ..settings_store import get_system_setting


@dataclass
class InsuranceConfig:
    enabled: bool
    # "risk_score" (legacy) — fee = risk_score × base_constant × tier_mult
    #   capped at fee_cap. The trade_size_factor input is bounded so a
    #   10-lot trade barely costs more than a 1-lot trade.
    # "per_lot" — fee = lots × per_lot_fee[tier], i.e. fee scales linearly
    #   with the number of lots. fee_cap still applies as a hard ceiling.
    pricing_mode: str
    # USD per lot per tier, used only when pricing_mode == "per_lot".
    # This is the GLOBAL DEFAULT used when no per-account-group override
    # applies.
    per_lot_fee: dict[str, float]
    # Per-account-type override: { "<account_group_id>": {"basic": x, ...} }.
    # When a quote is requested with an account_id, the resolver looks up
    # that account's group_id in this map and uses its per-tier rates
    # instead of the global `per_lot_fee`. Missing tier in a group entry
    # falls through to the global. Empty {} = no overrides, everyone on
    # the global rate.
    per_lot_fee_by_account_group: dict[str, dict[str, float]]
    base_constant: float
    tier_multipliers: dict[str, float]   # {"basic":1, ...}
    coverage_pct: dict[str, float]        # {"basic":20, ...}
    fee_cap: float
    fee_cap_high_volume: float
    high_volume_lots: float
    max_cap_rules: dict[str, list[float]]  # {"basic":[100, 0.10], ...}
    min_trade_duration_seconds: int
    daily_claim_limit: int
    daily_payout_limit: float
    cooldown_hours: int
    high_lev_threshold: float
    high_lev_surcharge: float
    no_sl_surcharge: float
    winrate_threshold: float
    winrate_surcharge: float
    atr_floor: float
    # Trade_Insurance.docx slide 17: disable insurance when volatility is
    # extreme (the inverse of atr_floor). NULL means "no ceiling" — keeps
    # the existing behaviour for installs that don't care about vol caps.
    atr_ceiling: Optional[float]
    # Slide 16 — frequent-claim coverage reduction. When a user has had
    # ≥ frequent_claim_count claims in the last frequent_claim_window_days
    # days, the offered coverage_pct on every tier is multiplied by
    # (1 - frequent_claim_coverage_reduction_pct).
    frequent_claim_count: int
    frequent_claim_window_days: int
    frequent_claim_coverage_reduction_pct: float
    # Slide 18 — copy-trade fee surcharge. Multiplies fee by (1 + this)
    # when caller marks the quote as a copy-trade context.
    copy_trade_surcharge: float
    news_blackout_until: Optional[datetime]
    # ── Client-requested rules ────────────────────────────────────────
    # Insurance auto-expires this many seconds after activation. Trades
    # closed after the window are denied with reason "policy_expired".
    # 0 / None = no auto-expiry (legacy unlimited behaviour).
    policy_validity_seconds: int
    # Max insurance policies a user can ACTIVATE in a rolling 24h window.
    # Counted at activation, not at claim time. 0 = unlimited.
    max_policies_per_day: int
    # Hour-of-day blackout window in UTC (inclusive start, exclusive end).
    # E.g. start=10, end=11 → no insurance during 10:00–10:59 UTC.
    # Both 0 / None = window disabled. Wraps midnight if start > end.
    blackout_hour_start: Optional[int]
    blackout_hour_end: Optional[int]
    # Hard ceiling on lots an insurance policy can cover. 0 = no cap.
    max_lots_insurable: float
    # Lot-size bracket pricing. When non-empty, REPLACES the global
    # per_lot_fee + coverage_pct + max_cap_rules — admin defines per
    # lot-range what each tier costs / covers / max payout.
    #   [
    #     {"min_lots":0.01, "max_lots":0.04, "tiers":[
    #       {"label":"50%", "coverage_pct":50, "fee":1.0,  "max_cap":5.0},
    #       {"label":"70%", "coverage_pct":70, "fee":3.0,  "max_cap":10.0}
    #     ]},
    #     {"min_lots":0.05, "max_lots":0.10, "tiers":[...]}
    #   ]
    # First-match wins. Empty = legacy tier system stays in effect.
    lot_brackets: list[dict]
    # Simple two-tier mode — overrides EVERYTHING above (brackets +
    # legacy 4-tier) when non-empty. Each tier defines its own fee and
    # cap PER LOT; the engine scales LINEARLY with the user's lot size:
    #   fee     = lots × fee_per_lot
    #   max_cap = lots × max_cap_per_lot
    # Client spec example:
    #   0.01 lot @ 50% = $1 fee / $5 cap   (fee_per_lot=100, max_cap_per_lot=500)
    #   0.01 lot @ 70% = $3 fee / $10 cap  (fee_per_lot=300, max_cap_per_lot=1000)
    #   0.02 lot @ 50% = $2 fee / $10 cap  (doubles automatically)
    # Non-empty list = simple mode active. Empty = fall through to
    # lot_brackets, then to legacy 4-tier ladder.
    simple_tiers: list[dict]
    # When True, the claim payout is credited to the account's `credit`
    # column (tradable equity, NOT withdrawable). When False, classic
    # `balance` credit (withdrawable). Default True per client request.
    payout_to_credit: bool


_DEFAULTS = InsuranceConfig(
    enabled=True,
    # Default to per-lot so a 5-lot trade costs ~5× a 1-lot trade.
    # Admin can flip back to "risk_score" from the insurance settings page.
    pricing_mode="per_lot",
    # Rack rates ($/lot/tier) — keep the same 1×/2×/3×/4× spacing as
    # tier_multipliers so the tier picker stays predictable.
    per_lot_fee={"basic": 0.50, "advanced": 1.00, "pro": 1.50, "elite": 2.00},
    # Empty default — no per-account-type overrides until admin adds them.
    per_lot_fee_by_account_group={},
    base_constant=1.2,
    tier_multipliers={"basic": 1, "advanced": 2, "pro": 3, "elite": 4},
    coverage_pct={"basic": 20, "advanced": 30, "pro": 40, "elite": 50},
    fee_cap=6.0,
    fee_cap_high_volume=12.0,
    high_volume_lots=5.0,
    max_cap_rules={
        "basic": [100, 0.10],
        "advanced": [300, 0.20],
        "pro": [600, 0.30],
        "elite": [1000, 0.50],
    },
    min_trade_duration_seconds=300,
    daily_claim_limit=2,
    daily_payout_limit=2000,
    cooldown_hours=12,
    high_lev_threshold=200,
    high_lev_surcharge=0.20,
    no_sl_surcharge=0.15,
    winrate_threshold=0.65,
    winrate_surcharge=0.15,
    atr_floor=0.0001,
    atr_ceiling=None,
    frequent_claim_count=4,                      # 4+ claims in 30d → reduce
    frequent_claim_window_days=30,
    frequent_claim_coverage_reduction_pct=0.25,  # 25% off coverage
    copy_trade_surcharge=0.10,                   # +10% fee on copy trades
    news_blackout_until=None,
    # Defaults match the client's example numbers in the spec —
    # 10-min validity, 3 policies/day, no hour-blackout, 0.05 lot cap.
    policy_validity_seconds=600,
    max_policies_per_day=3,
    blackout_hour_start=None,
    blackout_hour_end=None,
    max_lots_insurable=0.05,
    lot_brackets=[],
    payout_to_credit=True,
    # Client's spec exactly — 50% @ $100/lot ($1 per 0.01 lot, $5 cap per 0.01)
    # and 70% @ $300/lot ($3 per 0.01 lot, $10 cap per 0.01).
    simple_tiers=[
        {"label": "50%", "coverage_pct": 50, "fee_per_lot": 100, "max_cap_per_lot": 500},
        {"label": "70%", "coverage_pct": 70, "fee_per_lot": 300, "max_cap_per_lot": 1000},
    ],
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

    mode_raw = str(await _get("insurance_pricing_mode", _DEFAULTS.pricing_mode)).strip().lower()
    pricing_mode = mode_raw if mode_raw in ("per_lot", "risk_score") else _DEFAULTS.pricing_mode

    return InsuranceConfig(
        enabled=bool(await _get("insurance_enabled", True)),
        pricing_mode=pricing_mode,
        per_lot_fee=dict(await _get("insurance_per_lot_fee", _DEFAULTS.per_lot_fee)),
        per_lot_fee_by_account_group=dict(
            await _get(
                "insurance_per_lot_fee_by_account_group",
                _DEFAULTS.per_lot_fee_by_account_group,
            )
        ),
        base_constant=float(await _get("insurance_base_constant", _DEFAULTS.base_constant)),
        tier_multipliers=dict(await _get("insurance_tier_multipliers", _DEFAULTS.tier_multipliers)),
        coverage_pct=dict(await _get("insurance_coverage_pct", _DEFAULTS.coverage_pct)),
        fee_cap=float(await _get("insurance_fee_cap", _DEFAULTS.fee_cap)),
        fee_cap_high_volume=float(await _get("insurance_fee_cap_high_volume", _DEFAULTS.fee_cap_high_volume)),
        high_volume_lots=float(await _get("insurance_high_volume_lots", _DEFAULTS.high_volume_lots)),
        max_cap_rules=dict(await _get("insurance_max_cap_rules", _DEFAULTS.max_cap_rules)),
        min_trade_duration_seconds=int(await _get("insurance_min_trade_duration_seconds", _DEFAULTS.min_trade_duration_seconds)),
        daily_claim_limit=int(await _get("insurance_anti_abuse_daily_claims", _DEFAULTS.daily_claim_limit)),
        daily_payout_limit=float(await _get("insurance_anti_abuse_daily_payout", _DEFAULTS.daily_payout_limit)),
        cooldown_hours=int(await _get("insurance_anti_abuse_cooldown_hours", _DEFAULTS.cooldown_hours)),
        high_lev_threshold=float(await _get("insurance_dynamic_high_lev_threshold", _DEFAULTS.high_lev_threshold)),
        high_lev_surcharge=float(await _get("insurance_dynamic_high_lev_surcharge", _DEFAULTS.high_lev_surcharge)),
        no_sl_surcharge=float(await _get("insurance_dynamic_no_sl_surcharge", _DEFAULTS.no_sl_surcharge)),
        winrate_threshold=float(await _get("insurance_dynamic_winrate_threshold", _DEFAULTS.winrate_threshold)),
        winrate_surcharge=float(await _get("insurance_dynamic_winrate_surcharge", _DEFAULTS.winrate_surcharge)),
        atr_floor=float(await _get("insurance_disable_atr_floor", _DEFAULTS.atr_floor)),
        atr_ceiling=(
            float(await _get("insurance_disable_atr_ceiling", _DEFAULTS.atr_ceiling))
            if (await _get("insurance_disable_atr_ceiling", None)) is not None
            else None
        ),
        frequent_claim_count=int(await _get("insurance_frequent_claim_count", _DEFAULTS.frequent_claim_count)),
        frequent_claim_window_days=int(await _get("insurance_frequent_claim_window_days", _DEFAULTS.frequent_claim_window_days)),
        frequent_claim_coverage_reduction_pct=float(await _get("insurance_frequent_claim_coverage_reduction_pct", _DEFAULTS.frequent_claim_coverage_reduction_pct)),
        copy_trade_surcharge=float(await _get("insurance_copy_trade_surcharge", _DEFAULTS.copy_trade_surcharge)),
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
        lot_brackets=list(
            await _get("insurance_lot_brackets", _DEFAULTS.lot_brackets)
        ),
        payout_to_credit=bool(
            await _get("insurance_payout_to_credit", _DEFAULTS.payout_to_credit)
        ),
        simple_tiers=list(
            await _get("insurance_simple_tiers", _DEFAULTS.simple_tiers)
        ),
    )
