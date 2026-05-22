"""Public referral-tier feed for the trader /products/referral page.

Reads the `ib_commission_tiers` JSON the admin manages on the admin
/config/ib-tiers page (persisted in system_settings) and exposes the
subset of fields the marketing page renders:

  label, min_referrals, max_referrals, per_referral_bounty, instant_payout

Per-lot rates and per-account-type rates are deliberately NOT exposed —
those are payout details for active IBs, not public marketing copy.

Public — no JWT. If no tiers are configured, returns an empty list and
the trader page falls back to its built-in defaults so the page never
goes blank.
"""
import logging
from typing import Any

from fastapi import APIRouter

from packages.common.src.settings_store import (
    get_system_setting, get_bool_setting, get_int_setting,
)

logger = logging.getLogger("referral_tiers_api")

router = APIRouter()


def _coerce_int(v: Any) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _coerce_float(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


@router.get("/tiers")
async def list_referral_tiers():
    raw = await get_system_setting("ib_commission_tiers", None)
    if not isinstance(raw, list):
        return {"tiers": []}

    tiers = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        label = str(row.get("label") or "").strip()
        if not label:
            continue
        min_r = _coerce_int(row.get("min_referrals"))
        # max_referrals: null = no upper bound (the top tier).
        max_r = _coerce_int(row.get("max_referrals"))
        bounty = _coerce_float(row.get("per_referral_bounty"))
        instant = row.get("instant_payout")
        tiers.append({
            "label": label,
            "min_referrals": min_r if min_r is not None else 0,
            "max_referrals": max_r,  # None → "X+" on the trader page
            "per_referral_bounty": bounty,
            # Default to True when admin omits it — every existing tier the
            # marketing copy refers to pays instantly.
            "instant_payout": True if instant is None else bool(instant),
        })

    # Stable order so the trader page renders left → right by referral
    # threshold, even if admin saved them out of order.
    tiers.sort(key=lambda t: t["min_referrals"])

    # Activation conditions the trader page renders under
    # "How a Referral Qualifies". Defaults match the documented promise
    # (KYC + funded + 3 closed trades). Admins can flip any of these via
    # the system_settings table without a deploy.
    requires_kyc = await get_bool_setting("referral_requires_kyc", True)
    requires_funded = await get_bool_setting("referral_requires_funded", True)
    required_trades = await get_int_setting("referral_qualifying_trades", 3)
    if required_trades <= 0:
        required_trades = 3

    return {
        "tiers": tiers,
        "qualification": {
            "requires_kyc": bool(requires_kyc),
            "requires_funded_account": bool(requires_funded),
            "required_trades": int(required_trades),
        },
    }
