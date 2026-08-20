"""Unit tests for the shared close core's trigger logic.

sltp_trigger is the single SL/TP decision point used by the b-book
engine and the gateway backstop — these tests pin its semantics:
MT5-style exact-level fills, BUY marks bid / SELL marks ask, SL wins a
same-tick gap through both levels, and break-even/profit-lock stops
(level beyond the open price) still trigger.
"""
from decimal import Decimal
from types import SimpleNamespace

from packages.common.src.position_close import sltp_trigger


def _pos(side="buy", open_price="1.1000", sl=None, tp=None):
    return SimpleNamespace(
        side=side,
        open_price=Decimal(open_price),
        stop_loss=Decimal(sl) if sl is not None else None,
        take_profit=Decimal(tp) if tp is not None else None,
    )


def test_no_levels_no_trigger():
    assert sltp_trigger(_pos(), Decimal("1.0"), Decimal("1.0001")) is None


def test_buy_sl_triggers_on_bid_at_level_price():
    pos = _pos(side="buy", sl="1.0950")
    assert sltp_trigger(pos, Decimal("1.0950"), Decimal("1.0952")) == ("sl", Decimal("1.0950"))
    # Fill is the SL level itself even when the market gapped through it.
    assert sltp_trigger(pos, Decimal("1.0900"), Decimal("1.0902")) == ("sl", Decimal("1.0950"))


def test_buy_sl_not_triggered_above_level():
    pos = _pos(side="buy", sl="1.0950")
    assert sltp_trigger(pos, Decimal("1.0951"), Decimal("1.0953")) is None


def test_buy_tp_triggers_on_bid():
    pos = _pos(side="buy", tp="1.1100")
    assert sltp_trigger(pos, Decimal("1.1100"), Decimal("1.1102")) == ("tp", Decimal("1.1100"))
    # TP marks the bid for a BUY — ask through the level is not enough.
    assert sltp_trigger(pos, Decimal("1.1099"), Decimal("1.1101")) is None


def test_sell_sl_marks_ask():
    pos = _pos(side="sell", sl="1.1050")
    assert sltp_trigger(pos, Decimal("1.1048"), Decimal("1.1050")) == ("sl", Decimal("1.1050"))
    assert sltp_trigger(pos, Decimal("1.1047"), Decimal("1.1049")) is None


def test_sell_tp_marks_ask():
    pos = _pos(side="sell", tp="1.0900")
    assert sltp_trigger(pos, Decimal("1.0898"), Decimal("1.0900")) == ("tp", Decimal("1.0900"))


def test_gap_through_both_levels_sl_wins():
    # A violent gap can cross SL and TP in one tick; SL must win.
    pos = _pos(side="buy", sl="1.0950", tp="1.0940")  # inverted on purpose
    assert sltp_trigger(pos, Decimal("1.0930"), Decimal("1.0932"))[0] == "sl"


def test_break_even_stop_above_open_still_triggers():
    # Profit-lock stop: BUY opened at 1.1000, SL moved to 1.1050 after a
    # rally. The old gateway guard (sl < open_price) silently ignored
    # these; production behavior (b-book engine) honored them — pinned.
    pos = _pos(side="buy", open_price="1.1000", sl="1.1050")
    assert sltp_trigger(pos, Decimal("1.1049"), Decimal("1.1051")) == ("sl", Decimal("1.1050"))


def test_enum_like_side_objects_accepted():
    class FakeEnum:
        value = "sell"
    pos = SimpleNamespace(
        side=FakeEnum(), open_price=Decimal("1.2"),
        stop_loss=Decimal("1.25"), take_profit=None,
    )
    assert sltp_trigger(pos, Decimal("1.2498"), Decimal("1.25")) == ("sl", Decimal("1.25"))
