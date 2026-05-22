"""System-wide settings, bonus catalogue, per-user bonus state."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from ..database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSONB, nullable=False)
    description = Column(Text)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class BonusOffer(Base):
    __tablename__ = "bonus_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    bonus_type = Column(String(30))
    percentage = Column(Numeric(5, 2))
    fixed_amount = Column(Numeric(18, 8))
    min_deposit = Column(Numeric(18, 8), default=0)
    # Upper bound of the deposit range for tier-style display. NULL =
    # unbounded (the top tier, rendered as "$X+" on the trader page).
    # Doesn't affect the auto-apply engine — only the /bonus page render.
    max_deposit = Column(Numeric(18, 8), nullable=True)
    max_bonus = Column(Numeric(18, 8))
    lots_required = Column(Numeric(10, 4), default=0)
    target_audience = Column(String(30), default="all")
    starts_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    # Tier-display extras (migration 0053). All optional, presentation-only.
    perks = Column(JSONB, nullable=True)          # ["Auto-credited within minutes", ...]
    is_popular = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    cta_label = Column(String(80), nullable=True)
    tagline = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserBonus(Base):
    __tablename__ = "user_bonuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    offer_id = Column(UUID(as_uuid=True), ForeignKey("bonus_offers.id"))
    amount = Column(Numeric(18, 8), nullable=False)
    lots_traded = Column(Numeric(10, 4), default=0)
    lots_required = Column(Numeric(10, 4), default=0)
    status = Column(String(20), default="active")
    released_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
