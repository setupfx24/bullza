"""Instrument Service — Listing, market status, price retrieval."""
import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import Instrument, InstrumentSegment
from packages.common.src.schemas import InstrumentResponse, TickData
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.market_hours import market_status_dict


async def list_instruments(
    segment: str | None, active_only: bool, db: AsyncSession,
) -> list[InstrumentResponse]:
    query = select(Instrument)

    if active_only:
        query = query.where(Instrument.is_active == True)

    if segment:
        query = query.join(InstrumentSegment).where(InstrumentSegment.name == segment)

    result = await db.execute(query)
    instruments = result.scalars().all()

    return [
        InstrumentResponse(
            id=inst.id,
            symbol=inst.symbol,
            display_name=inst.display_name,
            segment=inst.segment.name if inst.segment else None,
            base_currency=inst.base_currency or (inst.symbol[:3] if inst.symbol and len(inst.symbol) >= 6 else None),
            quote_currency=inst.quote_currency or (inst.symbol[3:6] if inst.symbol and len(inst.symbol) >= 6 else None),
            digits=inst.digits,
            pip_size=inst.pip_size,
            min_lot=inst.min_lot,
            max_lot=inst.max_lot,
            lot_step=inst.lot_step,
            contract_size=inst.contract_size,
            margin_rate=inst.margin_rate,
            is_active=inst.is_active,
        )
        for inst in instruments
    ]


async def get_market_status(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Instrument).where(Instrument.is_active == True)
    )
    instruments = result.scalars().all()
    return [
        market_status_dict(
            inst.symbol,
            inst.segment.name if inst.segment else None,
            inst.trading_hours,
        )
        for inst in instruments
    ]


async def get_symbol_market_status(symbol: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(),
            Instrument.is_active == True,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail=f"Instrument {symbol} not found")
    return market_status_dict(
        inst.symbol,
        inst.segment.name if inst.segment else None,
        inst.trading_hours,
    )


# Cached `tick:*` key list for get_all_prices(). The key SET changes only
# when an instrument is added/removed (rare); the VALUES change constantly.
# Discovering the keys was the expensive half — see get_all_prices below.
_TICK_KEYS_CACHE: list[str] = []
_TICK_KEYS_AT: float = 0.0
_TICK_KEYS_TTL_SEC = 30.0


async def _tick_keys() -> list[str]:
    """Symbol key list for the price snapshot, refreshed at most every 30s.

    Discovery still uses SCAN (never KEYS), but now runs ~twice a minute
    instead of on every request. A new instrument shows up within one TTL.
    """
    global _TICK_KEYS_CACHE, _TICK_KEYS_AT
    import time as _time
    now = _time.monotonic()
    if _TICK_KEYS_CACHE and (now - _TICK_KEYS_AT) < _TICK_KEYS_TTL_SEC:
        return _TICK_KEYS_CACHE
    keys: list[str] = []
    # count=500 keeps this to a couple of round trips instead of the
    # default ~10-key chunks.
    async for key in redis_client.scan_iter(f"{PriceChannel.TICK_PREFIX}*", count=500):
        keys.append(key)
    if keys:
        _TICK_KEYS_CACHE = keys
        _TICK_KEYS_AT = now
        return keys
    # Nothing found (feed down / flushed): don't cache the empty result, but
    # keep serving the last known key set so a transient blip doesn't blank
    # every client's watchlist.
    return _TICK_KEYS_CACHE


async def get_all_prices() -> list[dict]:
    """Snapshot of every live tick.

    Polled by every open terminal every 1.5s, so it must not walk the Redis
    keyspace. It previously ran a full `scan_iter` per request; the keyspace
    also holds bar:current:*, rl:*, throttle:* and margin_call_sent:* keys and
    therefore grows with user count, making the cost per request grow with
    traffic. The key list is now cached (see _tick_keys) and only the MGET —
    which is what actually needs to be fresh — runs per request.
    """
    keys = await _tick_keys()
    if not keys:
        return []

    values = await redis_client.mget(keys)
    prices = []
    for v in values:
        if v:
            prices.append(json.loads(v))

    return prices


async def get_price(symbol: str) -> TickData:
    tick_data = await redis_client.get(PriceChannel.tick_key(symbol.upper()))
    if not tick_data:
        raise HTTPException(status_code=404, detail=f"No price data for {symbol}")

    data = json.loads(tick_data)
    return TickData(**data)
