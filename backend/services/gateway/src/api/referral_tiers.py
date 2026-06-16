"""Public referral-tier feed for the trader /products/referral page.

Reads the `referral_tiers` JSON the admin manages on the admin
/config/referral-tiers page (persisted in system_settings) and exposes
the fields the marketing page renders:

  label, min_referrals, max_referrals, per_referral_bounty, instant_payout

This is the PERSONAL friend-referral program and is independent of the IB
/ sub-broker MLM ladder (`ib_commission_tiers`, /config/ib-tiers). The two
used to share the IB key, which coupled them; the referral program now owns
its own key — the same key the money path reads
(referral_service._bounty_for_next_claim), so the public ladder and the
actual payout ladder always agree.

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
    raw = await get_system_setting("referral_tiers", None)
    if not isinstance(raw, list):
        return {"tiers": []}

    tiers = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        label = str(row.get("label") or "").strip()
        if not label:
            continue
        # Personal-referral row shape: a per-referral bounty earned across a
        # claimed-referral position range [min_referrals, max_referrals].
        instant = row.get("instant_payout")
        tiers.append({
            "label": label,
            "min_referrals": _coerce_int(row.get("min_referrals")) or 0,
            "max_referrals": _coerce_int(row.get("max_referrals")),
            "per_referral_bounty": _coerce_float(row.get("per_referral_bounty")),
            "instant_payout": True if instant is None else bool(instant),
        })

    # Order low → high by entry position so the trader page renders the
    # ladder from entry tier to top tier.
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
