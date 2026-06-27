"""Deposit payment methods (trader side) — the admin-configured per-method
config that drives the XM-style deposit flow, plus the live FX rate the form
uses to show the USD a local-currency amount will credit.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import PaymentMethod
from packages.common.src import fx_rate


def _serialize(m: PaymentMethod) -> dict:
    return {
        "id": str(m.id),
        "method_key": m.method_key,
        "display_name": m.display_name,
        "pay_currency": m.pay_currency or "INR",
        "qr_image": m.qr_image,
        "upi_id": m.upi_id,
        "bank_text": m.bank_text,
        "notice": m.notice,            # step-2 "Accept & Continue" text
        "declaration": m.declaration,  # step-4 checkbox text
        "min_amount": float(m.min_amount) if m.min_amount is not None else None,
        "max_amount": float(m.max_amount) if m.max_amount is not None else None,
    }


async def list_methods(db: AsyncSession) -> dict:
    """Enabled methods for the trader's deposit-methods grid + flow."""
    rows = (await db.execute(
        select(PaymentMethod).where(PaymentMethod.enabled == True)  # noqa: E712
        .order_by(PaymentMethod.sort_order, PaymentMethod.display_name)
    )).scalars().all()
    return {"items": [_serialize(m) for m in rows]}


async def get_method(method_id: UUID, db: AsyncSession) -> dict | None:
    m = (await db.execute(
        select(PaymentMethod).where(PaymentMethod.id == method_id)
    )).scalar_one_or_none()
    return _serialize(m) if m else None


async def quote(currency: str, amount, db: AsyncSession) -> dict:
    """Live rate + the USD a `currency` amount would credit. usd is null when
    no rate is available (API down + no admin fallback)."""
    rate = await fx_rate.usd_per_unit(currency)
    usd = None
    if rate is not None and amount is not None:
        try:
            usd = float((Decimal(str(amount)) * rate).quantize(Decimal("0.01")))
        except Exception:
            usd = None
    return {
        "currency": (currency or "USD").upper(),
        "usd_per_unit": float(rate) if rate is not None else None,
        "usd": usd,
    }
