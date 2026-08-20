"""Welcome-bonus bracket math — the ONE shared implementation.

Used by the gateway's deposit paths (oxapay / nowpayments / manual
approve via wallet_service) AND the admin add-fund path
(user_service._apply_first_funding_bonus). These used to be two
hand-synchronized copies "kept in lockstep" by comments alone — a
documented drift risk on money math (risk review 2026-08-20).

Eligibility (first deposit only, no prior bonus, not forfeited) stays
with the callers — this module only answers "how much bonus does a
deposit of X earn under the admin's current bracket table".
"""
from decimal import Decimal


async def compute_welcome_bonus(deposit_amount: Decimal) -> tuple[Decimal, str]:
    """Compute the admin-configured welcome bonus for ONE deposit.

    Reads two settings from system_settings:
      welcome_bonus_enabled    bool   — master switch
      welcome_bonus_brackets   list[dict] — admin's range table:
          [
            {"min_deposit":100,  "max_deposit":499,  "type":"percentage", "value":100, "cap_usd":100},
            {"min_deposit":1000, "max_deposit":null, "type":"percentage", "value":100, "cap_usd":1000},
            ...
          ]

    Matching: the first bracket where min_deposit ≤ deposit_amount AND
    (max_deposit is null OR deposit_amount ≤ max_deposit) wins. cap_usd
    null/0 means no cap. Returns (bonus_amount, description);
    bonus_amount = 0 means the caller should skip applying any bonus.

    Backwards-compat shim: if `welcome_bonus_brackets` isn't set but the
    legacy single-value keys (welcome_bonus_type / welcome_bonus_value /
    welcome_bonus_cap_usd) are set, we synthesise a one-bracket list
    covering the full range so old configs keep working.
    """
    from .settings_store import (
        get_bool_setting, get_float_setting, get_system_setting,
    )

    enabled = await get_bool_setting("welcome_bonus_enabled", False)
    if not enabled:
        return Decimal("0"), ""

    raw_brackets = await get_system_setting("welcome_bonus_brackets", None)
    brackets: list[dict] = []
    if isinstance(raw_brackets, list):
        brackets = raw_brackets
    else:
        legacy_value = float(await get_float_setting("welcome_bonus_value", 0.0))
        if legacy_value > 0:
            legacy_type = (str(await get_system_setting(
                "welcome_bonus_type", "percentage"
            ) or "percentage")).strip().lower()
            legacy_cap = float(await get_float_setting("welcome_bonus_cap_usd", 0.0))
            brackets = [{
                "min_deposit": 0,
                "max_deposit": None,
                "type": legacy_type,
                "value": legacy_value,
                "cap_usd": legacy_cap,
            }]

    if not brackets:
        return Decimal("0"), ""

    # First matching bracket wins — admin defines the order they want.
    # Empty / malformed rows are skipped silently.
    for row in brackets:
        try:
            min_d = Decimal(str(row.get("min_deposit") or 0))
        except (TypeError, ValueError):
            continue
        max_raw = row.get("max_deposit")
        try:
            max_d = (
                None if max_raw is None or max_raw == ""
                else Decimal(str(max_raw))
            )
        except (TypeError, ValueError):
            max_d = None
        if deposit_amount < min_d:
            continue
        if max_d is not None and deposit_amount > max_d:
            continue

        try:
            value = Decimal(str(row.get("value") or 0))
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        btype = (str(row.get("type") or "percentage")).strip().lower()
        try:
            cap = Decimal(str(row.get("cap_usd") or 0))
        except (TypeError, ValueError):
            cap = Decimal("0")

        range_label = f"${min_d}+" if max_d is None else f"${min_d} – ${max_d}"
        if btype == "percentage":
            amount = (deposit_amount * value / Decimal("100")).quantize(Decimal("0.01"))
            label = f"Welcome bonus {range_label} ({value}% of deposit)"
        else:
            amount = value.quantize(Decimal("0.01"))
            label = f"Welcome bonus {range_label} (flat ${value})"

        if cap > 0 and amount > cap:
            amount = cap
            label += f" — capped at ${cap}"

        return amount, label

    # No bracket matched — deposit fell outside every configured range.
    return Decimal("0"), ""
