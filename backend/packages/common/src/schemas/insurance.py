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


class InsuranceClaimOut(BaseModel):
    id: UUID
    policy_id: UUID
    loss_amount: Decimal
    claim_amount: Decimal
    paid_at: datetime
