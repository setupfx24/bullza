"""AI Station core — shared display-only signal/trade logic.

Imported by BOTH the gateway (TradingView webhook + trader read view) and the
admin service (manual open / edit / close), so there is exactly ONE fan-out and
P&L implementation.

Isolation guarantees (do not break):
  * Nothing here writes to user balances, margin, Order/Position, or the real
    trading engine. The fixed_return guaranteed-payout logic is untouched.
  * It only READS live ticks (for honest entry/exit prices) and reads/writes the
    two ai_station_* tables. Removing this subsystem leaves the old system
    byte-for-byte identical.

Display P&L note: computed in the instrument's QUOTE currency and shown as USD.
For USD-quoted pairs (EURUSD, XAUUSD, …) this is exact; for cross/JPY-quote
pairs it is an approximation — acceptable because these figures never move
money, they are display only. `compute_display_pnl` is the single choke point
if this ever needs true conversion.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select

from .settings_store import get_system_setting, get_bool_setting
from .redis_client import PriceChannel
from .models import AiStationSignal, AiStationTrade, FixedReturnLock, Instrument
from .ai_station_math import (
    dec as _dec,
    resolve_slab_lots,
    compute_display_pnl,
    fill_price as _fill_price,
)

logger = logging.getLogger("ai-station")

# system_settings keys
SETTING_ENABLED = "ai_station_enabled"
SETTING_SECRET = "ai_station_webhook_secret"
SETTING_SLABS = "ai_station_slabs"

# Fallback slabs so a fresh install still fans out sensibly. principal range
# -> display lot size. Lower bound inclusive, upper exclusive; max=None = top.
DEFAULT_SLABS = [
    {"min": 1000, "max": 5000, "lots": 0.02},
    {"min": 5000, "max": 10000, "lots": 0.05},
    {"min": 10000, "max": 25000, "lots": 0.10},
    {"min": 25000, "max": None, "lots": 0.25},
]


# ── Pure helpers live in ai_station_math (stdlib-only, unit-tested). ─────────

def _pos_or_none(v):
    """A price is always > 0, so treat 0 / blank / negative as 'not set'. Guards
    against an unedited sl:0/tp:0 template accidentally auto-closing a trade."""
    if v in (None, ""):
        return None
    d = _dec(v)
    return d if d > 0 else None


def _f(v):
    return float(v) if v is not None else None


def _iso(dt):
    return dt.isoformat() if dt is not None else None


# ── Config ──────────────────────────────────────────────────────────────────

async def get_slabs() -> list:
    slabs = await get_system_setting(SETTING_SLABS, None)
    if isinstance(slabs, list) and slabs:
        return slabs
    return DEFAULT_SLABS


async def get_config() -> dict:
    enabled = await get_bool_setting(SETTING_ENABLED, False)
    secret = await get_system_setting(SETTING_SECRET, "") or ""
    return {"enabled": enabled, "webhook_secret": secret, "slabs": await get_slabs()}


# ── Live price / instrument ──────────────────────────────────────────────────

# Ticks are ALWAYS written on Redis logical db 0 (by market-data). The gateway's
# REDIS_URL is already /0, but the admin process is pinned to /1 — so we read
# ticks through a dedicated db-0 connection derived from REDIS_URL. This makes
# live_quote correct from BOTH the gateway (webhook) and the admin (manual open)
# process. Same db-path-rewrite trick admin settings_service uses to bust the
# gateway cache.
_tick_redis = None


async def _tick_client():
    global _tick_redis
    if _tick_redis is None:
        import os
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        base = url.rsplit("/", 1)[0]
        _tick_redis = aioredis.from_url(f"{base}/0", decode_responses=True)
    return _tick_redis


async def live_quote(symbol: str) -> Optional[tuple[Decimal, Decimal]]:
    """(bid, ask) from the latest tick, or None if there is no live price."""
    try:
        client = await _tick_client()
        raw = await client.get(PriceChannel.tick_key((symbol or "").upper()))
        if not raw:
            return None
        t = json.loads(raw)
        return _dec(t["bid"]), _dec(t["ask"])
    except Exception:
        return None


async def _contract_size(db, symbol: str) -> Decimal:
    res = await db.execute(
        select(Instrument.contract_size).where(Instrument.symbol == (symbol or "").upper())
    )
    cs = res.scalar_one_or_none()
    return _dec(cs, "100000")


async def _active_locks(db) -> list:
    res = await db.execute(select(FixedReturnLock).where(FixedReturnLock.state == "active"))
    return list(res.scalars().all())


# ── Core operations ──────────────────────────────────────────────────────────

async def open_signal(
    db,
    *,
    source: str,
    symbol: str,
    side: str,
    entry_price=None,
    stop_loss=None,
    take_profit=None,
    external_id: Optional[str] = None,
    raw=None,
    created_by: Optional[UUID] = None,
    note: Optional[str] = None,
) -> AiStationSignal:
    """Open a master signal and fan it out to every active lock (display only).

    Caller commits. Raises ValueError on bad input / no live price.
    """
    symbol = (symbol or "").upper()
    side = (side or "").lower()
    if side not in ("buy", "sell"):
        raise ValueError(f"invalid side: {side!r} (expected buy/sell)")
    if not symbol:
        raise ValueError("symbol required")

    if entry_price is None:
        q = await live_quote(symbol)
        if q is None:
            raise ValueError(f"no live price for {symbol}")
        bid, ask = q
        entry_price = _fill_price(side, bid, ask, opening=True)
    entry_price = _dec(entry_price)

    now = datetime.now(timezone.utc)
    signal = AiStationSignal(
        source=source,
        symbol=symbol,
        side=side,
        entry_price=entry_price,
        stop_loss=_pos_or_none(stop_loss),
        take_profit=_pos_or_none(take_profit),
        status="open",
        opened_at=now,
        external_id=external_id,
        raw=raw,
        created_by=created_by,
        note=note,
    )
    db.add(signal)
    await db.flush()  # populate signal.id

    slabs = await get_slabs()
    n = 0
    for lock in await _active_locks(db):
        lots = resolve_slab_lots(lock.principal, slabs)
        if lots is None or lots <= 0:
            continue
        db.add(AiStationTrade(
            signal_id=signal.id,
            lock_id=lock.id,
            user_id=lock.user_id,
            symbol=symbol,
            side=side,
            lots=lots,
            entry_price=entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            pnl=Decimal("0.00"),
            status="open",
            opened_at=now,
        ))
        n += 1
    signal.fanout_count = n
    await db.flush()
    return signal


async def close_signal(db, signal: AiStationSignal, *, close_price=None) -> int:
    """Close a signal and all its open display copies. Caller commits.

    Returns the number of trades closed. Respects `is_edited` (admin-overridden
    P&L is not clobbered by the auto-computed value).
    """
    if signal.status == "closed":
        return 0

    if close_price is None:
        q = await live_quote(signal.symbol)
        if q is None:
            close_price = signal.entry_price  # no tick -> flat (0 P&L)
        else:
            bid, ask = q
            close_price = _fill_price(signal.side, bid, ask, opening=False)
    close_price = _dec(close_price)
    cs = await _contract_size(db, signal.symbol)
    now = datetime.now(timezone.utc)

    signal.close_price = close_price
    signal.status = "closed"
    signal.closed_at = now

    res = await db.execute(
        select(AiStationTrade).where(
            AiStationTrade.signal_id == signal.id,
            AiStationTrade.status == "open",
        )
    )
    trades = list(res.scalars().all())
    for tr in trades:
        tr.close_price = close_price
        if not tr.is_edited:
            tr.pnl = compute_display_pnl(tr.side, tr.entry_price, close_price, tr.lots, cs)
        tr.status = "closed"
        tr.closed_at = now
    await db.flush()
    return len(trades)


async def close_trade(db, trade, *, close_price=None) -> None:
    """Close a SINGLE display trade (one user's copy) at the given / live price.
    Does not touch the parent signal or any other user's copy. Caller commits."""
    if trade.status == "closed":
        return
    if close_price is None:
        q = await live_quote(trade.symbol)
        if q is None:
            close_price = trade.entry_price  # no tick -> flat
        else:
            bid, ask = q
            close_price = _fill_price(trade.side, bid, ask, opening=False)
    close_price = _dec(close_price)
    cs = await _contract_size(db, trade.symbol)
    trade.close_price = close_price
    trade.pnl = compute_display_pnl(trade.side, trade.entry_price, close_price, trade.lots, cs)
    trade.status = "closed"
    trade.closed_at = datetime.now(timezone.utc)
    await db.flush()


async def sweep_sltp(db) -> int:
    """Close any open signal whose SL or TP has been hit by the live tick.

    Display-only — reads the live tick, no real position. Commits if anything
    closed. Called by the AI-Station engine.
    """
    res = await db.execute(select(AiStationSignal).where(AiStationSignal.status == "open"))
    closed = 0
    for sig in res.scalars().all():
        if sig.stop_loss is None and sig.take_profit is None:
            continue
        q = await live_quote(sig.symbol)
        if q is None:
            continue
        bid, ask = q
        px = _fill_price(sig.side, bid, ask, opening=False)
        is_buy = sig.side == "buy"
        hit = None
        if sig.take_profit is not None and (
            (is_buy and px >= sig.take_profit) or (not is_buy and px <= sig.take_profit)
        ):
            hit = sig.take_profit
        elif sig.stop_loss is not None and (
            (is_buy and px <= sig.stop_loss) or (not is_buy and px >= sig.stop_loss)
        ):
            hit = sig.stop_loss
        if hit is not None:
            await close_signal(db, sig, close_price=hit)
            closed += 1
    if closed:
        await db.commit()
    return closed


# ── Serialization (consistent shape for admin + trader) ──────────────────────

def serialize_signal(sig: AiStationSignal) -> dict:
    return {
        "id": str(sig.id),
        "source": sig.source,
        "symbol": sig.symbol,
        "side": sig.side,
        "entry_price": _f(sig.entry_price),
        "stop_loss": _f(sig.stop_loss),
        "take_profit": _f(sig.take_profit),
        "close_price": _f(sig.close_price),
        "status": sig.status,
        "fanout_count": sig.fanout_count,
        "note": sig.note,
        "opened_at": _iso(sig.opened_at),
        "closed_at": _iso(sig.closed_at),
    }


def serialize_trade(tr: AiStationTrade, *, live_pnl: Optional[Decimal] = None) -> dict:
    # Open trades show the live-recomputed P&L when available; closed trades and
    # admin-edited rows show the stored value.
    if tr.status == "open" and live_pnl is not None and not tr.is_edited:
        pnl = live_pnl
    else:
        pnl = tr.pnl
    return {
        "id": str(tr.id),
        "signal_id": str(tr.signal_id),
        "lock_id": str(tr.lock_id),
        "user_id": str(tr.user_id),
        "symbol": tr.symbol,
        "side": tr.side,
        "lots": _f(tr.lots),
        "entry_price": _f(tr.entry_price),
        "close_price": _f(tr.close_price),
        "stop_loss": _f(tr.stop_loss),
        "take_profit": _f(tr.take_profit),
        "pnl": _f(pnl),
        "status": tr.status,
        "is_edited": tr.is_edited,
        "opened_at": _iso(tr.opened_at),
        "closed_at": _iso(tr.closed_at),
    }


async def enrich_open_pnl(db, trades: list) -> dict:
    """id -> live P&L (Decimal) for the OPEN trades in `trades`.

    One redis fetch + one contract-size fetch per distinct symbol, reused across
    all trades on that symbol (cheap for the small symbol set in a portfolio).
    """
    open_syms = {t.symbol for t in trades if t.status == "open" and not t.is_edited}
    quotes: dict[str, Optional[tuple[Decimal, Decimal]]] = {}
    sizes: dict[str, Decimal] = {}
    for sym in open_syms:
        quotes[sym] = await live_quote(sym)
        sizes[sym] = await _contract_size(db, sym)
    out: dict[str, Decimal] = {}
    for t in trades:
        if t.status != "open" or t.is_edited:
            continue
        q = quotes.get(t.symbol)
        if q is None:
            continue
        bid, ask = q
        close = _fill_price(t.side, bid, ask, opening=False)
        out[str(t.id)] = compute_display_pnl(t.side, t.entry_price, close, t.lots, sizes[t.symbol])
    return out
