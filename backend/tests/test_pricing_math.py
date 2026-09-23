"""Unit tests for executable-quote and commission arithmetic.

`symmetric_quote_from_mid` is the single place a tradeable bid/ask is built.
Both the streamed quote (market-data's spread_cache) and execution (gateway
open AND close) go through it, and that symmetry is what makes the admin
spread get crossed exactly once per round trip — the asymmetry it replaced
was what made the spread look like it was taken twice.

`_commission_from_config` turns an admin ChargeConfig row into money.
"""
from decimal import Decimal
from types import SimpleNamespace

from packages.common.src.instrument_pricing import (
    symmetric_quote_from_mid,
    apply_spread_and_impact_to_prices,
    _commission_from_config,
)

PIP5 = Decimal("0.0001")   # 5-digit FX
PIP3 = Decimal("0.01")     # JPY pairs


# ─── symmetric_quote_from_mid ─────────────────────────────────────────────

def test_zero_spread_collapses_to_the_mid():
    """Client decision 2026-06-29: an instrument with no admin spread rule
    trades at the MID (zero spread), NOT at the raw market spread. The
    resolver returns 0 when nothing matches, so this is the path that
    decision actually takes."""
    bid, ask = symmetric_quote_from_mid(Decimal("1.10000"), Decimal("0"), "pips", PIP5, 5)
    assert bid == ask == Decimal("1.10000")


def test_pips_spread_is_symmetric_about_the_mid():
    """2 pips -> 1 pip either side, so the mid is preserved exactly."""
    mid = Decimal("1.10000")
    bid, ask = symmetric_quote_from_mid(mid, Decimal("2"), "pips", PIP5, 5)
    assert bid == Decimal("1.09990")
    assert ask == Decimal("1.10010")
    assert (bid + ask) / 2 == mid


def test_percentage_spread_scales_with_price():
    """0.1% of 100 is 0.10 total -> 0.05 a side."""
    bid, ask = symmetric_quote_from_mid(Decimal("100.00"), Decimal("0.1"), "percentage", Decimal("0.01"), 2)
    assert bid == Decimal("99.95")
    assert ask == Decimal("100.05")


def test_price_impact_widens_on_top_of_spread():
    mid = Decimal("1.10000")
    _, plain = symmetric_quote_from_mid(mid, Decimal("2"), "pips", PIP5, 5)
    _, wider = symmetric_quote_from_mid(mid, Decimal("2"), "pips", PIP5, 5, Decimal("0.0002"))
    assert wider > plain


def test_quantizes_to_instrument_digits():
    bid, ask = symmetric_quote_from_mid(Decimal("150.123456"), Decimal("2"), "pips", PIP3, 3)
    assert bid.as_tuple().exponent == -3
    assert ask.as_tuple().exponent == -3


def test_ask_never_crosses_below_bid():
    """A tiny spread that quantizes to nothing must still leave ask > bid,
    never an inverted book."""
    bid, ask = symmetric_quote_from_mid(Decimal("1.10000"), Decimal("0.0001"), "pips", PIP5, 5)
    assert ask > bid


def test_unknown_spread_type_is_treated_as_pips():
    a = symmetric_quote_from_mid(Decimal("1.10000"), Decimal("2"), "fixed", PIP5, 5)
    b = symmetric_quote_from_mid(Decimal("1.10000"), Decimal("2"), "pips", PIP5, 5)
    assert a == b


def test_open_and_close_agree_so_the_spread_is_crossed_once():
    """The property the whole design rests on: the same mid and the same
    resolved spread must give the same bid/ask at open and at close. A BUY
    opens at ask and closes at bid, so the round-trip cost is exactly the
    spread — charged once."""
    mid = Decimal("1.10000")
    o_bid, o_ask = symmetric_quote_from_mid(mid, Decimal("2"), "pips", PIP5, 5)
    c_bid, c_ask = symmetric_quote_from_mid(mid, Decimal("2"), "pips", PIP5, 5)
    assert (o_bid, o_ask) == (c_bid, c_ask)
    assert o_ask - c_bid == Decimal("0.00020")  # 2 pips, once


# ─── apply_spread_and_impact_to_prices ────────────────────────────────────

def test_buy_widens_only_the_ask():
    bid, ask = apply_spread_and_impact_to_prices(
        Decimal("1.10000"), Decimal("1.10010"), "buy",
        Decimal("1"), "pips", PIP5, Decimal("0"),
    )
    assert bid == Decimal("1.10000")            # untouched
    assert ask == Decimal("1.10020")


def test_sell_widens_only_the_bid():
    bid, ask = apply_spread_and_impact_to_prices(
        Decimal("1.10000"), Decimal("1.10010"), "sell",
        Decimal("1"), "pips", PIP5, Decimal("0"),
    )
    assert ask == Decimal("1.10010")            # untouched
    assert bid == Decimal("1.09990")


# ─── _commission_from_config ──────────────────────────────────────────────

def _cfg(charge_type, value):
    return SimpleNamespace(charge_type=charge_type, value=Decimal(str(value)))


def test_per_lot_scales_with_volume():
    assert _commission_from_config(_cfg("per_lot", 7), Decimal("2.5"), Decimal("0")) == Decimal("17.5")
    assert _commission_from_config(_cfg("commission_per_lot", 7), Decimal("2"), Decimal("0")) == Decimal("14")


def test_per_trade_is_flat_regardless_of_volume():
    for lots in (Decimal("0.01"), Decimal("50")):
        assert _commission_from_config(_cfg("per_trade", 3), lots, Decimal("0")) == Decimal("3")


def test_percentage_is_taken_on_notional_not_lots():
    # 0.06% of a 100_000 notional = 60
    got = _commission_from_config(_cfg("percentage", "0.06"), Decimal("1"), Decimal("100000"))
    assert got == Decimal("60")


def test_spread_percentage_alias_matches_percentage():
    a = _commission_from_config(_cfg("spread_percentage", "0.06"), Decimal("1"), Decimal("100000"))
    b = _commission_from_config(_cfg("percentage", "0.06"), Decimal("1"), Decimal("100000"))
    assert a == b


def test_unknown_charge_type_falls_back_to_per_lot():
    assert _commission_from_config(_cfg("mystery", 5), Decimal("3"), Decimal("0")) == Decimal("15")


def test_null_value_is_zero_not_a_crash():
    assert _commission_from_config(_cfg("per_lot", 0), Decimal("3"), Decimal("0")) == Decimal("0")
    assert _commission_from_config(SimpleNamespace(charge_type="per_lot", value=None),
                                   Decimal("3"), Decimal("0")) == Decimal("0")
