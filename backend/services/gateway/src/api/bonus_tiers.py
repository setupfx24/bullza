"""Public bonus-tier feed for the trader /bonus page.

Returns the deposit-match tier cards that the admin manages in the
admin /bonus page. Filters out tiers that are inactive, expired, or
not yet active. Sorted by (sort_order ASC, min_deposit ASC) so admin
ordering wins over implicit deposit-amount ordering.

Public — no JWT. Anything that ships to the trader's marketing page must
be readable by unauthenticated visitors.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import BonusOffer

router = APIRouter()


@router.get("/tiers")
async def list_bonus_tiers(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(BonusOffer).where(BonusOffer.is_active == True)  # noqa: E712
        .order_by(
            BonusOffer.sort_order.asc(),
            BonusOffer.min_deposit.asc(),
            BonusOffer.created_at.asc(),
        )
    )
    rows = result.scalars().all()

    tiers = []
    for o in rows:
        # Window gates — admin can schedule a tier for a future window or
        # let it expire automatically.
        if o.starts_at and o.starts_at > now:
            continue
        if o.expires_at and o.expires_at <= now:
            continue
        # The /bonus page is the welcome-match story. Skip rows that
        # aren't tier-shaped (no percentage AND no fixed_amount) so
        # admin can keep one-off non-tier offers around without them
        # polluting the trader page.
        has_value = (o.percentage is not None and o.percentage > 0) or (
            o.fixed_amount is not None and o.fixed_amount > 0
        )
        if not has_value:
            continue

        tiers.append({
            "id": str(o.id),
            "name": o.name,
            "min_deposit": float(o.min_deposit or 0),
            "max_deposit": float(o.max_deposit) if o.max_deposit is not None else None,
            "percentage": float(o.percentage) if o.percentage else None,
            "fixed_amount": float(o.fixed_amount) if o.fixed_amount else None,
            "max_bonus": float(o.max_bonus) if o.max_bonus else None,
            "perks": list(o.perks) if isinstance(o.perks, list) else [],
            "is_popular": bool(o.is_popular),
            "cta_label": o.cta_label,
            "tagline": o.tagline,
        })
    return {"tiers": tiers}
