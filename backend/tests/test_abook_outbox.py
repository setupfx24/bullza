"""Unit tests for the A-Book outbox payload round-trip.

Payloads are stored in JSONB with Decimals serialized as strings
(_jsonable) and rehydrated to Decimal by the flusher (rehydrate_payload)
before the Corecen client narrows them at the JSON boundary. Losing
either direction silently corrupts the LP audit trail.
"""
from decimal import Decimal

from packages.common.src.abook import NUMERIC_FIELDS, _jsonable, rehydrate_payload


def test_jsonable_serializes_decimals_recursively():
    payload = {
        "close_price": Decimal("1.23456789"),
        "nested": {"pnl": Decimal("-42.5")},
        "list": [Decimal("1"), "x"],
        "plain": "text",
    }
    out = _jsonable(payload)
    assert out["close_price"] == "1.23456789"
    assert out["nested"]["pnl"] == "-42.5"
    assert out["list"] == ["1", "x"]
    assert out["plain"] == "text"


def test_rehydrate_close_fields():
    stored = {"position_id": "abc", "close_price": "1.23456789", "pnl": "-42.5", "closed_by": "SL"}
    out = rehydrate_payload("close", stored)
    assert out["close_price"] == Decimal("1.23456789")
    assert out["pnl"] == Decimal("-42.5")
    assert out["position_id"] == "abc"
    assert out["closed_by"] == "SL"


def test_rehydrate_leaves_none_and_missing_alone():
    stored = {"position_id": "abc", "sl": None}
    out = rehydrate_payload("update", stored)
    assert out["sl"] is None
    assert "tp" not in out


def test_rehydrate_unknown_kind_is_passthrough():
    stored = {"close_price": "1.5"}
    assert rehydrate_payload("bogus", stored) == stored


def test_round_trip_preserves_precision():
    original = Decimal("123456.123456789012345678")
    stored = _jsonable({"pnl": original})
    assert rehydrate_payload("close", stored)["pnl"] == original


def test_numeric_fields_cover_all_kinds():
    assert set(NUMERIC_FIELDS) == {"open", "close", "update"}
