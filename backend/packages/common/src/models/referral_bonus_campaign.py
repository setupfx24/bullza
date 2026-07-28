"""Admin-managed referral bonus campaigns (migration 0100).

An admin creates any number of time-limited campaigns over time. Each one
independently gates on EITHER KYC approval alone (required_trades == 0) or
KYC approval AND N closed trades (required_trades > 0), and independently
caps how many referrers can claim it (max_claims). The award/claim logic
lives in packages.common.src.referral_bonus_campaign (service layer), not
here — this module only defines the ORM shape.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class ReferralBonusCampaign(Base):
    __tablename__ = "referral_bonus_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    amount_usd = Column(Numeric(18, 2), nullable=False)
    max_claims = Column(Integer, nullable=False)
    claimed_count = Column(Integer, nullable=False, default=0, server_default="0")
    required_trades = Column(Integer, nullable=False, default=0, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReferralBonusClaim(Base):
    """One row per successful award. UNIQUE(campaign_id, referrer_id) at the
    DB level (see migration) is what makes "one claim per referrer per
    campaign" hold even under concurrent award attempts."""
    __tablename__ = "referral_bonus_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("referral_bonus_campaigns.id"), nullable=False)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referred_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount_usd = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
