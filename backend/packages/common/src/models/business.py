"""IB / sub-broker / referrals + master accounts + investor allocations + copy trades."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class IBProfile(Base):
    __tablename__ = "ib_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    referral_code = Column(String(20), unique=True, nullable=False)
    parent_ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    level = Column(Integer, default=1)
    commission_plan_id = Column(UUID(as_uuid=True))
    custom_commission_per_lot = Column(Numeric(18, 8))
    custom_commission_per_trade = Column(Numeric(18, 8))
    total_earned = Column(Numeric(18, 8), default=0)
    pending_payout = Column(Numeric(18, 8), default=0)
    is_active = Column(Boolean, default=True)
    rejection_reason = Column(Text)
    rejected_at = Column(DateTime(timezone=True))
    rejected_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class IBApplication(Base):
    __tablename__ = "ib_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(20), default="pending")
    application_data = Column(JSONB)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")


class IBCommissionPlan(Base):
    __tablename__ = "ib_commission_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100))
    is_default = Column(Boolean, default=False)
    commission_per_lot = Column(Numeric(18, 8), default=0)
    commission_per_trade = Column(Numeric(18, 8), default=0)
    spread_share_pct = Column(Numeric(5, 2), default=0)
    cpa_per_deposit = Column(Numeric(18, 8), default=0)
    mlm_levels = Column(Integer, default=5)
    mlm_distribution = Column(JSONB, default=[40, 25, 15, 10, 10])
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IBCommission(Base):
    __tablename__ = "ib_commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ib_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    source_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    source_trade_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"))
    commission_type = Column(String(30))
    amount = Column(Numeric(18, 8), nullable=False)
    mlm_level = Column(Integer, default=1)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    referred_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ib_profile_id = Column(UUID(as_uuid=True), ForeignKey("ib_profiles.id"))
    utm_source = Column(String(100))
    utm_medium = Column(String(100))
    utm_campaign = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class MasterAccount(Base):
    __tablename__ = "master_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    status = Column(String(20), default="pending")
    master_type = Column(String(20))
    performance_fee_pct = Column(Numeric(5, 2), default=20)
    management_fee_pct = Column(Numeric(5, 2), default=0)
    admin_commission_pct = Column(Numeric(5, 2), default=0)
    # Per-fill TRADE COSTS for this master's pool account. NULL = fall
    # through to the global SpreadConfig / ChargeConfig resolver.
    # spread_markup_pips ADDS to the resolved spread (additive override
    # so admin can layer per-master on top of per-account-type rules).
    # commission_per_lot_usd REPLACES the resolved commission with this
    # flat USD-per-lot rate so admin can carve out PAMM/MAM economics
    # without touching the broader per-instrument commission ladder.
    spread_markup_pips = Column(Numeric(10, 5), nullable=True)
    commission_per_lot_usd = Column(Numeric(10, 5), nullable=True)
    # Per-master swap overrides (Mig 0067). When set, replace the
    # resolved swap rate (instrument / segment / default) for overnight
    # positions on this pool account. NULL = fall through to the
    # standard swap_configs resolver.
    swap_long_pips = Column(Numeric(10, 4), nullable=True)
    swap_short_pips = Column(Numeric(10, 4), nullable=True)
    max_investors = Column(Integer, default=100)
    description = Column(Text)
    strategy_info = Column(JSONB, default=None)
    min_investment = Column(Numeric(18, 8), default=100)
    total_return_pct = Column(Numeric(10, 4), default=0)
    # Admin-set risk controls (Mig 0066). max_drawdown_pct = peak-to-
    # trough equity drawdown % beyond which trading is halted on the
    # pool account. max_loss_per_trade_pct = single-trade loss cap as
    # % of pool equity. Both stored; enforcement is in the trading
    # engine (max_drawdown via stats engine, per-trade via execute).
    max_drawdown_pct = Column(Numeric(10, 4), default=0)
    max_loss_per_trade_pct = Column(Numeric(5, 2), nullable=True)
    sharpe_ratio = Column(Numeric(10, 4), default=0)
    followers_count = Column(Integer, default=0)
    total_fee_earned = Column(Numeric(18, 8), default=0)
    # Per-master insurance opt-in switch (Mig 0066). Default TRUE so
    # existing masters keep behaving the same. When FALSE, the trader
    # invest modal hides the "auto-insure copied trades" checkbox and
    # the copy engine skips auto-activating policies on mirrored trades.
    insurance_enabled = Column(
        Boolean, nullable=False, default=True, server_default="true",
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
    account = relationship("TradingAccount", lazy="selectin")


class InvestorAllocation(Base):
    __tablename__ = "investor_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_id = Column(UUID(as_uuid=True), ForeignKey("master_accounts.id"))
    investor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    investor_account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id"))
    copy_type = Column(String(20), default="signal")
    allocation_amount = Column(Numeric(18, 8), nullable=False)
    # MAM volume scaling — kept for backwards compat with existing rows.
    # If `lot_multiplier` is set the engine uses it INSTEAD of allocation_pct
    # (direct mode); otherwise it falls back to the pct-of-pool path.
    allocation_pct = Column(Numeric(5, 2))
    # Direct lot multiplier for MAM (e.g. 0.5 = take half the master's lot
    # every trade, independent of pool share). NULL = use allocation_pct
    # (volume scaling %). Honored only when copy_type == 'mam'. Mig 0065.
    lot_multiplier = Column(Numeric(10, 4), nullable=True)
    max_drawdown_pct = Column(Numeric(5, 2))
    max_lot_override = Column(Numeric(10, 4))
    # How much of allocation_amount was pulled from main_wallet_bonus
    # (vs main_wallet_balance). Mig 0065. On withdraw we forfeit this
    # portion so the bonus stays non-withdrawable per the welcome-bonus
    # contract. 0 = fully cash investment.
    bonus_portion = Column(
        Numeric(18, 8), nullable=False, default=0, server_default="0",
    )
    # Investor opts in to auto-insure copied trades on this allocation
    # (Mig 0066). Only honoured when master.insurance_enabled is True
    # (admin gate). Copy engine reads both and fires an insurance
    # activate() on each mirrored position open when both are True.
    insurance_opt_in = Column(
        Boolean, nullable=False, default=False, server_default="false",
    )
    status = Column(String(20), default="active")
    total_profit = Column(Numeric(18, 8), default=0)
    last_distribution_at = Column(DateTime(timezone=True), nullable=True)
    # Per-investor admin overrides (migration 0052). NULL = inherit from
    # master_accounts. Honored by copy_engine._close_copy when computing
    # performance fee + the broker's slice of it.
    performance_fee_pct_override = Column(Numeric(5, 2), nullable=True)
    admin_commission_pct_override = Column(Numeric(5, 2), nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CopyTrade(Base):
    __tablename__ = "copy_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    master_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    investor_allocation_id = Column(UUID(as_uuid=True), ForeignKey("investor_allocations.id"))
    investor_position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"))
    ratio = Column(Numeric(10, 4), default=1)
    status = Column(String(20), default="open")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
