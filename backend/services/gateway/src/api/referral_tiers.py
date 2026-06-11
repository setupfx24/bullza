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
        # New model (2026-06-11): per-lot commission, reached by activations
        # OR cumulative referral deposit amount. Legacy min_referrals fields
        # are still emitted (0 when absent) for backward compat.
        per_lot = _coerce_float(row.get("per_lot"))
        min_act = _coerce_int(row.get("min_activations"))
        min_amt = _coerce_float(row.get("min_amount"))
        instant = row.get("instant_payout")
        tiers.append({
            "label": label,
            "per_lot": per_lot,
            "min_activations": min_act if min_act is not None else 0,
            "min_amount": min_amt,
            # Legacy fields kept so older clients don't break.
            "min_referrals": _coerce_int(row.get("min_referrals")) or 0,
            "max_referrals": _coerce_int(row.get("max_referrals")),
            "per_referral_bounty": _coerce_float(row.get("per_referral_bounty")),
            "instant_payout": True if instant is None else bool(instant),
        })

    # Order low → high by per-lot so the trader page renders the ladder
    # from entry tier to top tier.
    tiers.sort(key=lambda t: t["per_lot"])

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
