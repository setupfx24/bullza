"""Trade Insurance API Pydantic schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class InsuranceQuoteRequest(BaseModel):
    account_id: UUID
    symbol: str
    side: str = Field(..., pattern="^(buy|sell)$")
    lots: Decimal = Field(gt=0, le=100)
    leverage: int = Field(default=100, ge=1, le=2000)
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None


class InsuranceTierQuote(BaseModel):
    tier: str
    fee: float
    coverage_pct: float
    max_cap: float
    estimated_refund: float
    risk_score: float


class InsuranceActivateRequest(BaseModel):
    # Tier is the admin-defined label string (e.g. "50%", "70%"). The
    # legacy 4-tier regex (basic/advanced/pro/elite) was dropped during
    # the 2026-05-25 cleanup — any non-empty label up to 32 chars is OK.
    position_id: UUID
    tier: str = Field(..., min_length=1, max_length=32)


class InsuranceActivateResponse(BaseModel):
    policy_id: UUID
    fee_charged: Decimal
    status: str


class InsurancePolicyOut(BaseModel):
    id: UUID
    position_id: Optional[UUID] = None
    instrument_symbol: Optional[str] = None
    tier: str
    fee: Decimal
    coverage_pct: Decimal
    max_cap: Decimal
    status: str
    activated_at: datetime
    settled_at: Optional[datetime] = None
    # Why the policy ended up denied/expired (min_duration,
    # daily_claim_limit, not_a_loss, …). NULL while active or
    # successfully claimed. Frontend maps the code to a friendly label.
    settled_reason: Optional[str] = None


class InsuranceClaimOut(BaseModel):
    id: UUID
    policy_id: UUID
    loss_amount: Decimal
    claim_amount: Decimal
    # 'pending' = trader hasn't pressed Claim yet, 'paid' = credited.
    status: str
    # Pending claims have no paid_at / claimed_at yet.
    paid_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    instrument_symbol: Optional[str] = None
    tier: Optional[str] = None


class InsuranceClaimPayResponse(BaseModel):
    claim_id: UUID
    amount: Decimal
    credited_to: str  # 'credit' or 'balance' (depends on payout_to_credit cfg)
    status: str       # 'paid'
