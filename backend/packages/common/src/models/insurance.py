"""Trade insurance policies + claim payouts."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Numeric, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class InsurancePolicy(Base):
    """Per-trade micro-insurance policy. Activated at order placement, settled on close."""
    __tablename__ = "insurance_policies"
    # Tier check dropped in migration 0058 — tier is now an admin-defined
    # label (e.g. "50%", "70%") instead of the legacy 4-value enum.
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','claimed','expired','denied')",
            name="insurance_policies_status_check",
        ),
        Index("ix_ins_pol_user_status", "user_id", "status"),
        Index("ix_ins_pol_position", "position_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id", ondelete="SET NULL"), unique=True)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"), nullable=False)
    tier = Column(String(16), nullable=False)
    fee = Column(Numeric(18, 8), nullable=False)
    coverage_pct = Column(Numeric(5, 2), nullable=False)  # e.g. 20.00
    max_cap = Column(Numeric(18, 8), nullable=False)
    risk_score = Column(Numeric(8, 4), nullable=False)
    status = Column(String(16), nullable=False, default="active", server_default="active")
    activated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    settled_at = Column(DateTime(timezone=True))
    # Why the policy ended up denied/expired (min_duration, hedge,
    # daily_claim_limit, vol_too_low, news_blackout, cap_exhausted,
    # not_a_loss, policy_expired, …). NULL while active or claimed.
    # Migration 0063 — surfaced on the trader /insurance page.
    settled_reason = Column(String(40), nullable=True)


class InsuranceClaim(Base):
    """Eligible-claim record. After 2026-05-25 manual-claim flow:
    rows are created with status='pending' at trade close and flip to
    'paid' only when the trader presses Claim in the dashboard.
    """
    __tablename__ = "insurance_claims"
    __table_args__ = (
        Index("ix_ins_clm_user_paid_at", "user_id", "paid_at"),
        Index("ix_ins_clm_user_status", "user_id", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    loss_amount = Column(Numeric(18, 8), nullable=False)   # absolute, positive
    claim_amount = Column(Numeric(18, 8), nullable=False)  # credited to wallet
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"))
    # 'pending' = eligible but not yet claimed by user.
    # 'paid'    = user pressed Claim and credit landed in account.credit.
    status = Column(String(16), nullable=False, default="pending", server_default="pending")
    # claimed_at is set when status flips to 'paid'. paid_at carries the
    # same value once paid (kept for backward compat with history queries).
    claimed_at = Column(DateTime(timezone=True))
    paid_at = Column(DateTime(timezone=True))
