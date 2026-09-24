"""Unit tests for the IB commission outbox drainer.

Commission is money owed to a partner. It used to run in a detached task
spawned after the order committed, so a restart in that window lost the
payout silently. These tests pin the retry/backoff and the terminal-failure
behaviour of the drainer that replaced it — the part that decides whether a
payout is retried, given up on, or (worst case) paid twice.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from engines.commission_outbox_engine import (
    CommissionOutboxEngine, MAX_ATTEMPTS, BACKOFF_CAP_SEC,
)


def _row(**kw):
    base = dict(
        order_id="11111111-1111-1111-1111-111111111111",
        trader_user_id="22222222-2222-2222-2222-222222222222",
        lots=Decimal("1.5"),
        instrument_symbol="XAUUSD",
        status="pending",
        attempts=0,
        next_attempt_at=datetime.now(timezone.utc),
        last_error=None,
        sent_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.fixture
def engine():
    return CommissionOutboxEngine()


async def _pay(engine, row, monkeypatch, *, raises=None, calls=None):
    """Drive _pay_one with distribute_ib_commission stubbed."""
    async def fake_distribute(db, user_id, order_id, lots, symbol):
        if calls is not None:
            calls.append((user_id, order_id, lots, symbol))
        if raises:
            raise raises

    import engines.ib_engine as ib
    monkeypatch.setattr(ib, "distribute_ib_commission", fake_distribute)
    await engine._pay_one(object(), row)


# ─── Happy path ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_success_marks_sent_and_stamps_time(engine, monkeypatch):
    row = _row()
    await _pay(engine, row, monkeypatch)
    assert row.status == "sent"
    assert row.sent_at is not None
    assert row.last_error is None


@pytest.mark.asyncio
async def test_success_passes_the_row_through_untouched(engine, monkeypatch):
    calls = []
    row = _row(lots=Decimal("0.25"), instrument_symbol="EURUSD")
    await _pay(engine, row, monkeypatch, calls=calls)
    assert calls == [(row.trader_user_id, row.order_id, Decimal("0.25"), "EURUSD")]


# ─── Retry behaviour ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_failure_schedules_a_retry_not_a_drop(engine, monkeypatch):
    """The whole point: a failure must leave the row payable, never lost."""
    row = _row()
    before = datetime.now(timezone.utc)
    await _pay(engine, row, monkeypatch, raises=RuntimeError("db down"))
    assert row.status == "pending"          # still owed
    assert row.attempts == 1
    assert row.next_attempt_at > before     # deferred, not abandoned
    assert "db down" in row.last_error


@pytest.mark.asyncio
async def test_backoff_grows_with_attempts(engine, monkeypatch):
    delays = []
    for n in (1, 3, 5):
        row = _row(attempts=n - 1)
        now = datetime.now(timezone.utc)
        await _pay(engine, row, monkeypatch, raises=RuntimeError("x"))
        delays.append((row.next_attempt_at - now).total_seconds())
    assert delays[0] < delays[1] < delays[2]


@pytest.mark.asyncio
async def test_backoff_is_capped(engine, monkeypatch):
    """Without a cap, 2**attempts runs to days and the payout stalls."""
    row = _row(attempts=MAX_ATTEMPTS - 2)
    now = datetime.now(timezone.utc)
    await _pay(engine, row, monkeypatch, raises=RuntimeError("x"))
    assert (row.next_attempt_at - now).total_seconds() <= BACKOFF_CAP_SEC + 1


@pytest.mark.asyncio
async def test_gives_up_only_after_max_attempts(engine, monkeypatch):
    row = _row(attempts=MAX_ATTEMPTS - 1)
    await _pay(engine, row, monkeypatch, raises=RuntimeError("still broken"))
    assert row.status == "failed"
    assert row.attempts == MAX_ATTEMPTS
    # A failed row keeps its error so the amount owed can be found and paid
    # by hand — it is not silently erased.
    assert "still broken" in row.last_error


@pytest.mark.asyncio
async def test_one_attempt_short_of_the_cap_still_retries(engine, monkeypatch):
    row = _row(attempts=MAX_ATTEMPTS - 2)
    await _pay(engine, row, monkeypatch, raises=RuntimeError("x"))
    assert row.status == "pending"
    assert row.attempts == MAX_ATTEMPTS - 1


@pytest.mark.asyncio
async def test_error_text_is_truncated(engine, monkeypatch):
    row = _row()
    await _pay(engine, row, monkeypatch, raises=RuntimeError("E" * 5000))
    assert len(row.last_error) <= 1000
