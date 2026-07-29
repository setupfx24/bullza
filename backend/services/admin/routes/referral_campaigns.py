"""Admin-managed referral bonus campaigns (client 2026-07-28).

CRUD for time-limited promotional referral bonuses: an admin sets a name,
a flat USD amount, a hard cap on how many referrers can claim it, and a
trades-required gate (0 = pays on KYC approval alone, N = pays once the
referred user has N closed trades AND approved KYC). Award/claim logic
lives in packages.common.src.referral_bonus_campaign, called from the KYC
approval and trade-close hook points — this router only manages campaign
config and exposes the claims audit trail.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import ReferralBonusCampaign, ReferralBonusClaim, User
from dependencies import require_permission, write_audit_log

router = APIRouter(prefix="/referral-campaigns", tags=["Referral Bonus Campaigns"])


class CampaignCreate(BaseModel):
    name: str
    amount_usd: float
    max_claims: int
    required_trades: int = 0  # 0 = KYC-only gate
    is_active: bool = True


class CampaignUpdate(BaseModel):
    name: str | None = None
    amount_usd: float | None = None
    max_claims: int | None = None
    required_trades: int | None = None
    is_active: bool | None = None


def _serialize(c: ReferralBonusCampaign) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "amount_usd": str(c.amount_usd),
        "max_claims": c.max_claims,
        "claimed_count": c.claimed_count,
        "remaining": max(0, c.max_claims - c.claimed_count),
        "required_trades": c.required_trades,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_permission("referral_campaigns.view")),
):
    """All campaigns, newest first — active and past, so admin can see
    history of what's been run."""
    rows = (await db.execute(
        select(ReferralBonusCampaign).order_by(ReferralBonusCampaign.created_at.desc())
    )).scalars().all()
    return {"items": [_serialize(c) for c in rows]}


@router.post("")
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_permission("referral_campaigns.create")),
):
    if not body.name.strip():
        raise HTTPException(400, "name is required")
    if body.amount_usd <= 0:
        raise HTTPException(400, "amount_usd must be positive")
    if body.max_claims <= 0:
        raise HTTPException(400, "max_claims must be positive")
    if body.required_trades < 0:
        raise HTTPException(400, "required_trades cannot be negative")

    campaign = ReferralBonusCampaign(
        name=body.name.strip(),
        amount_usd=body.amount_usd,
        max_claims=body.max_claims,
        required_trades=body.required_trades,
        is_active=body.is_active,
        created_by=admin.id,
    )
    db.add(campaign)
    await db.flush()
    await write_audit_log(
        db, admin.id, action="referral_campaign.create",
        entity_type="referral_bonus_campaign", entity_id=campaign.id,
        new_values={"name": campaign.name, "amount_usd": str(campaign.amount_usd),
                    "max_claims": campaign.max_claims, "required_trades": campaign.required_trades},
    )
    await db.commit()
    return _serialize(campaign)


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_permission("referral_campaigns.update")),
):
    campaign = (await db.execute(
        select(ReferralBonusCampaign).where(ReferralBonusCampaign.id == campaign_id).with_for_update()
    )).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(404, "Campaign not found")

    old_values = _serialize(campaign)

    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(400, "name cannot be empty")
        campaign.name = body.name.strip()
    if body.amount_usd is not None:
        if body.amount_usd <= 0:
            raise HTTPException(400, "amount_usd must be positive")
        campaign.amount_usd = body.amount_usd
    if body.max_claims is not None:
        if body.max_claims <= 0:
            raise HTTPException(400, "max_claims must be positive")
        # Guard: don't let max_claims be dropped below what's already claimed
        # — that would silently make claimed_count > max_claims nonsensical.
        if body.max_claims < campaign.claimed_count:
            raise HTTPException(
                400,
                f"max_claims ({body.max_claims}) cannot be less than already-claimed count ({campaign.claimed_count})",
            )
        campaign.max_claims = body.max_claims
    if body.required_trades is not None:
        if body.required_trades < 0:
            raise HTTPException(400, "required_trades cannot be negative")
        campaign.required_trades = body.required_trades
    if body.is_active is not None:
        campaign.is_active = body.is_active

    await write_audit_log(
        db, admin.id, action="referral_campaign.update",
        entity_type="referral_bonus_campaign", entity_id=campaign.id,
        old_values=old_values, new_values=_serialize(campaign),
    )
    await db.commit()
    return _serialize(campaign)


@router.get("/{campaign_id}/claims")
async def list_campaign_claims(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_permission("referral_campaigns.view")),
):
    """Audit trail — exactly who claimed this campaign and when, so support
    can answer "why didn't I get my bonus" or "who got paid" questions."""
    rows = (await db.execute(
        select(ReferralBonusClaim, User)
        .join(User, ReferralBonusClaim.referrer_id == User.id)
        .where(ReferralBonusClaim.campaign_id == campaign_id)
        # Defense in depth — check_and_award already refuses to create a
        # claim for a promotional/demo referrer, so this should never match
        # anything, but every other admin financial listing in this codebase
        # filters promo/demo too (client 2026-07-16/25).
        .where(User.is_promotional.isnot(True), User.is_demo.isnot(True))
        .order_by(ReferralBonusClaim.created_at.desc())
    )).all()
    return {
        "items": [
            {
                "referrer_email": user.email,
                "referrer_name": " ".join(filter(None, [user.first_name, user.last_name])).strip(),
                "amount_usd": str(claim.amount_usd),
                "claimed_at": claim.created_at.isoformat() if claim.created_at else None,
            }
            for claim, user in rows
        ]
    }
