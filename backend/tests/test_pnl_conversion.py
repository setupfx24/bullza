"""Unit tests for quote-currency -> account-currency P&L conversion.

This is the single most expensive piece of arithmetic in the platform and
the one that has broken most often. Forex P&L comes out in the instrument's
QUOTE currency; booking it straight to a USD balance mis-values by the FX
rate (~150x on JPY). The fixes landed in layers across the open path, close
path, partial close, risk engine and both clients, protected only by
comments — these tests pin the semantics.

Covers `quote_to_account_pnl` (sync), `quote_to_account_pnl_async` (which
adds the cross-pair leg), and `convert_to_account_currency`, including its
deliberate fail-open behaviour when no rate is quoted.
"""
import json
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from packages.common.src.trading_service import (
    quote_to_account_pnl,
    quote_to_account_pnl_async,
    convert_to_account_currency,
    calc_margin,
    _derive_currencies,
)


# ─── Sync converter ───────────────────────────────────────────────────────

def test_zero_pnl_short_circuits():
    assert quote_to_account_pnl(Decimal("0"), "EUR", "USD", Decimal("1.1")) == 0


def test_usd_quote_passes_through():
    """EURUSD profit is already USD — must not be touched."""
    pnl = quote_to_account_pnl(Decimal("25"), "EUR", "USD", Decimal("1.1000"))
    assert pnl == Decimal("25")


def test_usd_base_pair_divides_by_price():
    """USDJPY: 1500 JPY at 150.00 is $10, not $1500."""
    pnl = quote_to_account_pnl(Decimal("1500"), "USD", "JPY", Decimal("150.00"))
    assert pnl == Decimal("10")


def test_usd_base_pair_with_zero_price_returns_raw():
    """No usable rate -> return raw rather than divide by zero."""
    pnl = quote_to_account_pnl(Decimal("1500"), "USD", "JPY", Decimal("0"))
    assert pnl == Decimal("1500")


def test_currencies_derived_from_symbol_when_columns_null():
    """base/quote are nullable in the DB; the symbol is the fallback."""
    assert _derive_currencies("USDJPY") == ("USD", "JPY")
    pnl = quote_to_account_pnl(Decimal("1500"), None, None, Decimal("150.00"), symbol="USDJPY")
    assert pnl == Decimal("10")


def test_short_symbol_yields_no_currencies():
    assert _derive_currencies("XAU") == (None, None)
    assert _derive_currencies(None) == (None, None)


def test_cross_pair_sync_returns_raw_quote_value():
    """Documented limitation: the SYNC helper has no event loop, so a cross
    pair (neither side USD) comes back in the quote currency. Money paths
    must use the async variant — this test exists so that stays a conscious
    choice rather than a silent regression."""
    pnl = quote_to_account_pnl(Decimal("-37"), "NZD", "JPY", Decimal("88.50"))
    assert pnl == Decimal("-37")


# ─── Async converter (cross pairs) ────────────────────────────────────────

def _tick(bid: str, ask: str) -> str:
    return json.dumps({"bid": bid, "ask": ask})


@pytest.mark.asyncio
async def test_async_cross_pair_uses_live_fx_leg():
    """NZDJPY loss of 37 JPY with USDJPY at 150 is about -$0.2467, NOT -$37.
    Booking the raw value is what drained balances over a few trades."""
    with patch(
        "packages.common.src.trading_service.redis_client.get",
        new=AsyncMock(return_value=_tick("149.99", "150.01")),
    ):
        pnl = await quote_to_account_pnl_async(
            Decimal("-37"), "NZD", "JPY", Decimal("88.50"), "USD", symbol="NZDJPY"
        )
    assert pnl == Decimal("-37") / Decimal("150")


@pytest.mark.asyncio
async def test_async_usd_base_still_divides_without_touching_redis():
    getter = AsyncMock(return_value=None)
    with patch("packages.common.src.trading_service.redis_client.get", new=getter):
        pnl = await quote_to_account_pnl_async(
            Decimal("1500"), "USD", "JPY", Decimal("150.00"), "USD"
        )
    assert pnl == Decimal("10")
    getter.assert_not_awaited()


# ─── convert_to_account_currency ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_convert_prefers_direct_pair_and_divides():
    """USD->JPY conversion reads USDJPY and DIVIDES (JPY per USD)."""
    with patch(
        "packages.common.src.trading_service.redis_client.get",
        new=AsyncMock(return_value=_tick("149.99", "150.01")),
    ):
        out = await convert_to_account_currency(Decimal("300"), "JPY", "USD")
    assert out == Decimal("300") / Decimal("150")


@pytest.mark.asyncio
async def test_convert_falls_back_to_reverse_pair_and_multiplies():
    """No USDNZD quoted, but NZDUSD is -> multiply."""
    async def fake_get(key):
        return _tick("0.5999", "0.6001") if key.endswith("NZDUSD") else None

    with patch("packages.common.src.trading_service.redis_client.get", new=fake_get):
        out = await convert_to_account_currency(Decimal("100"), "NZD", "USD")
    assert out == Decimal("100") * Decimal("0.6")


@pytest.mark.asyncio
async def test_convert_same_currency_is_identity():
    out = await convert_to_account_currency(Decimal("42"), "USD", "USD")
    assert out == Decimal("42")


@pytest.mark.asyncio
async def test_convert_zero_and_missing_currency():
    assert await convert_to_account_currency(Decimal("0"), "JPY") == Decimal("0")
    assert await convert_to_account_currency(Decimal("42"), None) == Decimal("42")


@pytest.mark.asyncio
async def test_convert_fails_OPEN_when_no_rate_is_quoted():
    """DELIBERATE, DANGEROUS behaviour, pinned so a change is conscious:
    with neither FX leg in Redis the raw quote-currency amount is returned
    and only an ERROR is logged, so margin/P&L get booked mis-valued. The
    tick keys carry a 120s TTL, so a missing leg is a real, detectable
    condition — this deserves an alert, and arguably a rejection."""
    with patch(
        "packages.common.src.trading_service.redis_client.get",
        new=AsyncMock(return_value=None),
    ):
        out = await convert_to_account_currency(Decimal("1500"), "JPY", "USD")
    assert out == Decimal("1500")  # NOT converted


# ─── Margin ───────────────────────────────────────────────────────────────

def test_calc_margin_is_notional_over_leverage():
    # 0.10 lots x 100_000 x 1.2000 / 100 = 120
    assert calc_margin(Decimal("0.10"), Decimal("1.2000"), Decimal("100000"), 100) == Decimal("120")


def test_calc_margin_scales_inversely_with_leverage():
    lo = calc_margin(Decimal("1"), Decimal("1"), Decimal("100000"), 100)
    hi = calc_margin(Decimal("1"), Decimal("1"), Decimal("100000"), 500)
    assert hi * 5 == lo
