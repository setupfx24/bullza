"""SL/TP backstop engine (gateway).

The b-book engine's 100ms loop is the primary SL/TP closer; this 1s
sweep is the backstop that keeps SL/TP working if that process is down.
Both call the SAME shared core (packages.common.src.position_close), so
trigger semantics and close math cannot drift, and the core's atomic
open→closed flip makes the two-closer race harmless (audit C2).
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import Position
from packages.common.src.position_close import close_position_atomic, sltp_trigger
from packages.common.src.redis_client import redis_client, PriceChannel

logger = logging.getLogger("gateway.sltp")

CHECK_INTERVAL = 1.0
# Same stale-feed guard as the risk engine and b-book engine — never
# close on a tick older than this.
STALE_PRICE_SECONDS = 60.0


def _tick_is_fresh(tick: dict) -> bool:
    ts = tick.get("timestamp")
    if not ts:
        return True  # no timestamp → can't judge; the 120s Redis TTL still bounds it
    try:
        tick_time = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if tick_time.tzinfo is None:
            tick_time = tick_time.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - tick_time).total_seconds() <= STALE_PRICE_SECONDS
    except (ValueError, TypeError):
        return True


class SLTPEngine:
    def __init__(self):
        self._running = False
        self._task = None
        self._prices: dict[str, dict] = {}

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("SL/TP engine started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SL/TP engine stopped")

    async def _run(self):
        from packages.common.src.redis_client import acquire_leader_lock
        while self._running:
            try:
                # Cluster leader lock — under uvicorn --workers N only one
                # worker runs the SL/TP sweep (audit C1/C3). Lock TTL > tick.
                if not await acquire_leader_lock("engine:sltp:lock", 5):
                    await asyncio.sleep(CHECK_INTERVAL)
                    continue
                await self._check_positions()
                await asyncio.sleep(CHECK_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error("SL/TP engine error: %s", e)
                await asyncio.sleep(3)

    async def _load_prices_for(self, symbols: set[str]):
        """Fetch the latest tick for exactly the symbols we care about via
        a single MGET. We deliberately avoid `KEYS tick:*` — KEYS is an
        O(keyspace) blocking command that stalls all of Redis (audit perf
        #11). Stale ticks are dropped here so no downstream check needs to
        re-validate freshness."""
        self._prices = {}
        if not symbols:
            return
        try:
            sym_list = list(symbols)
            keys = [PriceChannel.tick_key(s) for s in sym_list]
            values = await redis_client.mget(keys)
            for sym, val in zip(sym_list, values):
                if not val:
                    continue
                try:
                    tick = json.loads(val)
                except json.JSONDecodeError:
                    continue
                if _tick_is_fresh(tick):
                    self._prices[sym] = tick
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to load prices: %s", e)

    async def _check_positions(self):
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Position)
                .options(selectinload(Position.instrument))  # avoid per-position lazy load (N+1)
                .where(Position.status == "open")
                .where(
                    (Position.stop_loss.isnot(None)) | (Position.take_profit.isnot(None))
                )
            )
            positions = result.scalars().all()
            if not positions:
                return

            symbols = {
                pos.instrument.symbol for pos in positions
                if pos.instrument and pos.instrument.symbol
            }
            await self._load_prices_for(symbols)
            if not self._prices:
                return

            for pos in positions:
                symbol = pos.instrument.symbol if pos.instrument else None
                if not symbol or symbol not in self._prices:
                    continue

                tick = self._prices[symbol]
                bid = Decimal(str(tick["bid"]))
                ask = Decimal(str(tick["ask"]))

                trig = sltp_trigger(pos, bid, ask)
                if trig:
                    reason, close_price = trig
                    await close_position_atomic(
                        db, pos, close_price=close_price, reason=reason,
                    )

            await db.commit()


sltp_engine = SLTPEngine()
