"""Fixed Return — user principal locks against an admin-tunable rate matrix.

Rates and the early-withdrawal fee live in ``system_settings`` (JSON +
percent), not in dedicated tables, so admins can change the matrix in
one form without schema churn.

Money flow:
  Lock     : user.main_wallet_balance -= principal; row state='active'.
  Mature   : automatic at matures_at — principal + (principal * rate%)
             credited back to main_wallet_balance, state='matured'.
  Early    : principal * (1 - fee%) credited back; no return earned;
             state='withdrawn_early'.
"""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Numeric, Integer,
)
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class FixedReturnLock(Base):
    __tablename__ = "fixed_return_locks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    principal = Column(Numeric(18, 2), nullable=False)
    tier_label = Column(String(40), nullable=False)
    tenure_label = Column(String(40), nullable=False)
    tenure_days = Column(Integer, nullable=False)
    rate_pct = Column(Numeric(8, 4), nullable=False)

    locked_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    matures_at = Column(DateTime(timezone=True), nullable=False)
    settled_at = Column(DateTime(timezone=True), nullable=True)

    # 'active' | 'matured' | 'withdrawn_early'
    state = Column(String(20), nullable=False, default="active")
    payout = Column(Numeric(18, 2), nullable=True)
    fee_paid = Column(Numeric(18, 2), nullable=True)
