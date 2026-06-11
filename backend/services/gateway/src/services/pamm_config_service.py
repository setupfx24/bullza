"""PAMM platform policy — read admin-tunable settings from system_settings.

Centralises the 10 PAMM controls the client asked for so the gates in
social_service stay readable and the admin UI has a single source of
truth. All values fall back to safe defaults if the system_settings
row is missing, so a fresh install is never blocked.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from packages.common.src.settings_store import (
    get_system_setting, get_float_setting, get_bool_setting, get_int_setting,
)


# Defaults match what a typical broker quotes for PAMM operations.
DEFAULTS = {
    "pamm_manager_min_deposit_usd": 1000.0,
    "pamm_application_fee_usd": 50.0,
    "pamm_max_risk_per_trade_pct": 5.0,
    "pamm_max_drawdown_pct": 30.0,
    "pamm_max_manager_commission_pct": 30.0,
    "pamm_exclude_bonus_funds": True,
    "pamm_dep_window_start_day": 1,
    "pamm_dep_window_end_day": 5,
    "pamm_trade_window_start_day": 6,
    "pamm_trade_window_end_day": 30,
    "pamm_annual_maintenance_pct": 1.0,
    "pamm_monthly_profit_fee_pct": 2.0,
}


async def get_pamm_config() -> dict:
    """Read all PAMM policy settings in one call.

    Mixed-type so a single endpoint can power both the admin form and
    the trader-side banner — callers shouldn't need to know which keys
    are floats vs ints vs booleans.
    """
    return {
        "manager_min_deposit_usd": await get_float_setting(
            "pamm_manager_min_deposit_usd", DEFAULTS["pamm_manager_min_deposit_usd"]),
        "application_fee_usd": await get_float_setting(
            "pamm_application_fee_usd", DEFAULTS["pamm_application_fee_usd"]),
        "max_risk_per_trade_pct": await get_float_setting(
            "pamm_max_risk_per_trade_pct", DEFAULTS["pamm_max_risk_per_trade_pct"]),
        "max_drawdown_pct": await get_float_setting(
            "pamm_max_drawdown_pct", DEFAULTS["pamm_max_drawdown_pct"]),
        "max_manager_commission_pct": await get_float_setting(
            "pamm_max_manager_commission_pct", DEFAULTS["pamm_max_manager_commission_pct"]),
        "exclude_bonus_funds": await get_bool_setting(
            "pamm_exclude_bonus_funds", DEFAULTS["pamm_exclude_bonus_funds"]),
        "dep_window_start_day": await get_int_setting(
            "pamm_dep_window_start_day", DEFAULTS["pamm_dep_window_start_day"]),
        "dep_window_end_day": await get_int_setting(
            "pamm_dep_window_end_day", DEFAULTS["pamm_dep_window_end_day"]),
        "trade_window_start_day": await get_int_setting(
            "pamm_trade_window_start_day", DEFAULTS["pamm_trade_window_start_day"]),
        "trade_window_end_day": await get_int_setting(
            "pamm_trade_window_end_day", DEFAULTS["pamm_trade_window_end_day"]),
        "annual_maintenance_pct": await get_float_setting(
            "pamm_annual_maintenance_pct", DEFAULTS["pamm_annual_maintenance_pct"]),
        "monthly_profit_fee_pct": await get_float_setting(
            "pamm_monthly_profit_fee_pct", DEFAULTS["pamm_monthly_profit_fee_pct"]),
    }


def in_deposit_withdrawal_window(cfg: dict, now: Optional[datetime] = None) -> bool:
    """True if today's date (UTC) falls within the deposit/withdrawal day window.

    Inclusive on both ends. The two windows are stored separately so an
    admin can leave a 'no-op' gap (e.g. last week of the month locked
    out entirely) if they want.
    """
    n = now or datetime.now(timezone.utc)
    start = int(cfg.get("dep_window_start_day") or 1)
    end = int(cfg.get("dep_window_end_day") or 31)
    return start <= n.day <= end


def in_trade_window(cfg: dict, now: Optional[datetime] = None) -> bool:
    """True if today's date (UTC) falls within the PAMM/MAM trading day
    window. Masters may only open positions on their pool account during
    this window (the deposit/withdrawal window is the complementary
    part of the month). Inclusive on both ends; fail-open if the window
    is unset/degenerate (start>end) so a misconfig never freezes trading.
    """
    n = now or datetime.now(timezone.utc)
    start = int(cfg.get("trade_window_start_day") or 1)
    end = int(cfg.get("trade_window_end_day") or 31)
    if start > end:
        return True  # degenerate window — don't block
    return start <= n.day <= end
