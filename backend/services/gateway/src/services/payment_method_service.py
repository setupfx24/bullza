"""Deposit payment methods (trader side) — the admin-configured per-method
config that drives the XM-style deposit flow, plus the live FX rate the form
uses to show the USD a local-currency amount will credit.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException

from packages.common.src.models import PaymentMethod, Deposit, User
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
        # Admin-fixed USD-per-unit rates (null = live API).
        "usd_rate": float(m.usd_rate) if m.usd_rate is not None else None,
        "withdrawal_usd_rate": float(m.withdrawal_usd_rate) if m.withdrawal_usd_rate is not None else None,
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


async def quote(currency: str, amount, db: AsyncSession, method_id: UUID | None = None) -> dict:
    """Rate + the USD a `currency` amount would credit. If `method_id` names a
    method with an admin-fixed usd_rate, that fixed rate is used INSTEAD of the
    live API. usd is null when no rate is available (API down + no fallback)."""
    rate = None
    if method_id is not None:
        m = (await db.execute(
            select(PaymentMethod).where(PaymentMethod.id == method_id)
        )).scalar_one_or_none()
        if m is not None and m.usd_rate is not None:
            rate = Decimal(str(m.usd_rate))
    if rate is None:
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


async def withdrawal_quote(usd_amount, db: AsyncSession) -> dict:
    """For a bank/manual withdrawal entered in USD, how much local currency the
    user will receive. Uses the bank method's admin-fixed withdrawal_usd_rate
    (USD per 1 unit) when set, else the live API. The withdrawal itself still
    settles in USD — this is the informational 'you'll receive ≈ X' estimate.

    Rate source: the enabled non-USD method that has a withdrawal_usd_rate set
    (the 'Bank' method); otherwise the first enabled non-USD method (live API)."""
    methods = (await db.execute(
        select(PaymentMethod).where(PaymentMethod.enabled == True)  # noqa: E712
        .order_by(PaymentMethod.sort_order, PaymentMethod.display_name)
    )).scalars().all()
    method = next(
        (m for m in methods if (m.pay_currency or "").upper() != "USD" and m.withdrawal_usd_rate is not None),
        next((m for m in methods if (m.pay_currency or "").upper() != "USD"), None),
    )
    if method is None:
        return {"currency": None, "usd_per_unit": None, "local_amount": None}

    currency = (method.pay_currency or "INR").upper()
    if method.withdrawal_usd_rate is not None:
        rate = Decimal(str(method.withdrawal_usd_rate))          # USD per 1 unit
    else:
        rate = await fx_rate.usd_per_unit(currency)
    local = None
    if rate and rate > 0 and usd_amount is not None:
        try:
            local = float((Decimal(str(usd_amount)) / rate).quantize(Decimal("0.01")))
        except Exception:
            local = None
    return {
        "currency": currency,
        "usd_per_unit": float(rate) if rate else None,
        "local_amount": local,
    }


async def create_method_deposit(
    user_id: UUID, method_id: UUID, pay_amount, utr: str | None, db: AsyncSession,
) -> dict:
    """Confirm-Payment submit: convert the local amount to USD at the latest
    rate and create a PENDING manual deposit (admin verifies the UTR + credits).
    Funds settle in USD in the main wallet."""
    # KYC gate (mirrors wallet_service).
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if (getattr(user, "kyc_status", None) or "pending").lower() not in ("approved", "verified"):
        raise HTTPException(status_code=403, detail="Complete KYC verification before depositing.")

    method = (await db.execute(
        select(PaymentMethod).where(PaymentMethod.id == method_id)
    )).scalar_one_or_none()
    if method is None or not method.enabled:
        raise HTTPException(status_code=404, detail="Payment method not available")

    try:
        amt = Decimal(str(pay_amount))
    except Exception:
        amt = Decimal("0")
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid amount")
    if method.min_amount is not None and amt < Decimal(str(method.min_amount)):
        raise HTTPException(status_code=400, detail=f"Minimum is {method.min_amount} {method.pay_currency}")
    if method.max_amount is not None and amt > Decimal(str(method.max_amount)):
        raise HTTPException(status_code=400, detail=f"Maximum is {method.max_amount} {method.pay_currency}")

    # Admin-fixed rate for this method wins over the live API (client 2026-07-04).
    if method.usd_rate is not None:
        usd = (amt * Decimal(str(method.usd_rate))).quantize(Decimal("0.01"))
    else:
        usd = await fx_rate.convert_to_usd(amt, method.pay_currency or "INR")
    if usd is None or usd <= 0:
        raise HTTPException(status_code=503, detail="Currency rate unavailable — try again shortly.")

    deposit = Deposit(
        user_id=user_id,
        amount=usd,                       # settles in USD
        method=method.method_key[:30],
        status="pending",
        transaction_id=(utr or "")[:100] or None,
        pay_amount=amt,
        pay_currency=(method.pay_currency or "INR")[:20],
    )
    db.add(deposit)
    await db.flush()
    await db.commit()
    return {
        "id": str(deposit.id),
        "amount_usd": float(usd),
        "pay_amount": float(amt),
        "pay_currency": method.pay_currency or "INR",
        "status": "pending",
    }
