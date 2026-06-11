"""Market Data Service — Connects to price feeds, normalizes, distributes via Redis pub/sub and stores in TimescaleDB."""
import asyncio
import json
import logging
import signal
import time
from datetime import datetime, timezone

from packages.common.src.config import get_settings
from packages.common.src.redis_client import (
    CONFIG_INSTRUMENTS_RELOAD_CHANNEL,
    PriceChannel,
    redis_client,
    publish_price,
    publish_bar_update,
)

from .feed_handler import FeedSimulator, INSTRUMENTS
from .alltick_config import usable_alltick_token
from .alltick_feed import AllTickFeed
from .infoway_config import usable_infoway_token
from .infoway_feed import InfoWayFeed
from .corecen_lp_feed import CorecenLPFeed
from .bar_aggregator import BarAggregator
from .seed_bars import seed as seed_bars, flush_non_crypto_keys
from .spread_cache import StreamSpreadCache, RELOAD_INTERVAL_SEC
from .store import TickStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("market-data")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("market-data")
except Exception:
    pass

settings = get_settings()

# If the upstream feed stops sending a symbol, Redis keeps a frozen tick; refresh
# with last mid + current admin spread so Spr matches config until live ticks resume.
STALE_TICK_AFTER_SEC = 90.0
STALE_REFRESH_INTERVAL_SEC = 30.0


class MarketDataService:
    def __init__(self):
        raw_alltick = (getattr(settings, "ALLTICK_TOKEN", "") or "").strip()
        raw_infoway = (getattr(settings, "INFOWAY_TOKEN", "") or "").strip()
        self._tick_count = 0
        self._alltick_watchdog_armed = False
        self._infoway_watchdog_armed = False
        # Provider priority: Corecen LP → InfoWay → AllTick → Simulator.
        # Whichever is set first wins; setting INFOWAY_TOKEN takes over
        # from AllTick without needing to clear ALLTICK_TOKEN.
        if getattr(settings, "CORECEN_LP_ENABLED", False):
            if not settings.CORECEN_LP_API_KEY or not settings.CORECEN_LP_API_SECRET:
                logger.error(
                    "CORECEN_LP_ENABLED=true but CORECEN_LP_API_KEY / CORECEN_LP_API_SECRET "
                    "are not set — gateway will reject LP pushes and no ticks will arrive."
                )
            self.feed = CorecenLPFeed()
            logger.info("Price feed: Corecen LP (receiving pushes on /api/lp/prices/batch)")
        elif usable_infoway_token(raw_infoway):
            self.feed = InfoWayFeed(
                raw_infoway,
                INSTRUMENTS,
                ws_url=getattr(settings, "INFOWAY_WS_URL", "wss://data.infoway.io/ws"),
                business=getattr(settings, "INFOWAY_BUSINESS", "common"),
                channel=getattr(settings, "INFOWAY_CHANNEL", "depth"),
            )
            self._infoway_watchdog_armed = True
            logger.info(
                "Price feed: InfoWay WebSocket (channel=%s)",
                getattr(settings, "INFOWAY_CHANNEL", "depth"),
            )
        elif usable_alltick_token(raw_alltick):
            self.feed = AllTickFeed(raw_alltick, INSTRUMENTS)
            self._alltick_watchdog_armed = True
            logger.info("Price feed: AllTick WebSocket (orderbook depth)")
        else:
            self.feed = FeedSimulator(tick_rate_multiplier=1.0)
            if raw_alltick or raw_infoway:
                logger.warning(
                    "INFOWAY_TOKEN/ALLTICK_TOKEN unset or placeholder — using simulated feed + Binance crypto"
                )
            else:
                logger.warning(
                    "No market-data token set — using simulated forex/indices + Binance crypto"
                )
        self.aggregator = BarAggregator()
        self.store = TickStore()
        self.spread_cache = StreamSpreadCache()
        self.running = True
        self._last_mid: dict[str, float] = {}
        self._last_live_mono: dict[str, float] = {}

    async def start(self):
        logger.info("Starting Market Data Service...")

        signal.signal(signal.SIGINT, lambda *_: setattr(self, "running", False))
        signal.signal(signal.SIGTERM, lambda *_: setattr(self, "running", False))

        await self.store.init()

        await self.spread_cache.reload_if_stale(force=True)
        await self._seed_last_mid_from_redis()

        tasks = [
            asyncio.create_task(self.feed.start()),
            asyncio.create_task(self._process_ticks()),
            asyncio.create_task(self._spread_reload_loop()),
            asyncio.create_task(self._spread_config_subscriber()),
            asyncio.create_task(self._stale_quote_refresher()),
            asyncio.create_task(self.aggregator.run_aggregation_loop()),
            asyncio.create_task(self._auto_seed_bars()),
        ]
        if self._alltick_watchdog_armed:
            tasks.append(asyncio.create_task(self._alltick_fallback_watchdog()))
        if self._infoway_watchdog_armed:
            tasks.append(asyncio.create_task(self._infoway_fallback_watchdog()))
        # InfoWay/AllTick don't reliably stream crypto (placeholder symbol
        # mapping) — pull crypto from Binance directly so BTC/ETH prices and
        # P&L actually move. FeedSimulator already runs its own Binance feed.
        if isinstance(self.feed, (InfoWayFeed, AllTickFeed)):
            tasks.append(asyncio.create_task(self._binance_crypto_feed()))

        await asyncio.gather(*tasks)

    async def _spread_reload_loop(self):
        while self.running:
            await asyncio.sleep(RELOAD_INTERVAL_SEC)
            if self.running:
                await self.spread_cache.reload_if_stale(force=True)

    async def _spread_config_subscriber(self):
        """Reload spread cache when admin saves spreads (same channel as instrument config)."""
        channel = CONFIG_INSTRUMENTS_RELOAD_CHANNEL
        while self.running:
            pubsub = redis_client.pubsub()
            try:
                await pubsub.subscribe(channel)
                while self.running:
                    msg = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if msg and msg.get("type") == "message":
                        logger.info("Config reload signal — refreshing spread cache")
                        await self.spread_cache.reload_if_stale(force=True)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Spread config subscriber error (retrying): %s", exc)
                await asyncio.sleep(2.0)
            finally:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()
                except Exception:
                    pass

    async def _seed_last_mid_from_redis(self) -> None:
        """Prime last mid from existing tick:* keys so stale-quote refresh can fix spread after restart."""
        try:
            mono = time.monotonic()
            n = 0
            async for key in redis_client.scan_iter(f"{PriceChannel.TICK_PREFIX}*"):
                raw = await redis_client.get(key)
                if not raw:
                    continue
                try:
                    d = json.loads(raw)
                    sym = str(d.get("symbol") or "").strip().upper()
                    if not sym:
                        continue
                    b, a = float(d["bid"]), float(d["ask"])
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue
                self._last_mid[sym] = (b + a) / 2.0
                self._last_live_mono[sym] = mono - STALE_TICK_AFTER_SEC - 1.0
                n += 1
            if n:
                logger.info("Seeded last mid from Redis for %d symbols (stale refresh eligible)", n)
        except Exception as exc:
            logger.warning("Seed last_mid from Redis failed: %s", exc)

    async def _stale_quote_refresher(self) -> None:
        while self.running:
            await asyncio.sleep(STALE_REFRESH_INTERVAL_SEC)
            if not self.running:
                break
            await self.spread_cache.reload_if_stale(force=False)
            now = time.monotonic()
            ts_dt = datetime.now(timezone.utc)
            ts = ts_dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts_dt.microsecond // 1000:03d}Z"
            for symbol, mid in list(self._last_mid.items()):
                if now - self._last_live_mono.get(symbol, 0) < STALE_TICK_AFTER_SEC:
                    continue
                try:
                    bid, ask = self.spread_cache.widen(symbol, mid)
                    await publish_price(symbol, bid, ask, ts)
                except Exception as exc:
                    logger.debug("Stale quote refresh failed for %s: %s", symbol, exc)

    async def _process_ticks(self):
        logger.info("Tick processor started")
        while self.running:
            tick = await self.feed.get_tick()
            if tick is None:
                await asyncio.sleep(0.01)
                continue

            symbol = str(tick["symbol"] or "").strip().upper()
            if not symbol:
                continue
            bid = float(tick["bid"])
            ask = float(tick["ask"])
            ts = tick.get("timestamp", datetime.now(timezone.utc).isoformat())

            mid = (bid + ask) / 2.0
            self._last_mid[symbol] = mid
            self._last_live_mono[symbol] = time.monotonic()
            bid, ask = self.spread_cache.widen(symbol, mid)

            await publish_price(symbol, bid, ask, ts)

            await self.store.insert_tick(symbol, bid, ask, ts)

            self.aggregator.update(symbol, bid, ask, ts)
            # Fan out the just-updated current bar for every timeframe so the
            # gateway's /ws/bars hub can push it to subscribed charts. This
            # replaces the trader frontend's old client-side bar synthesis,
            # which drifted from the server's authoritative aggregation. We
            # publish AFTER aggregator.update so _bars[symbol] reflects this
            # tick. bar_aggregator.py itself stays untouched — we just read
            # its in-memory snapshot.
            await self._publish_current_bars(symbol)
            self._tick_count += 1

    async def _publish_current_bars(self, symbol: str) -> None:
        """Publish current in-progress bar for every TF of `symbol` to
        BAR_UPDATES_CHANNEL. Called once per tick from _process_ticks."""
        sym_bars = self.aggregator._bars.get(symbol)
        sym_starts = self.aggregator._bar_timestamps.get(symbol)
        if not sym_bars or not sym_starts:
            return
        # Snapshot the items so the aggregator can mutate the underlying
        # dict (new bar period rollover) while we're awaiting publish.
        # Without this, `RuntimeError: dictionary keys changed during
        # iteration` crashes the tick processor on every bar boundary.
        for tf_name, bar in list(sym_bars.items()):
            bar_start = sym_starts.get(tf_name)
            if bar_start is None:
                continue
            try:
                await publish_bar_update({
                    "symbol": symbol,
                    "timeframe": tf_name,
                    "time": int(bar_start),
                    "open": float(bar.open),
                    "high": float(bar.high),
                    "low": float(bar.low),
                    "close": float(bar.close),
                    "volume": float(bar.volume),
                    "tick_count": int(bar.tick_count),
                })
            except Exception as exc:
                # Pub/sub is best-effort — don't break the tick processor
                # if Redis briefly hiccups. The gateway will catch up on
                # the next tick anyway.
                logger.debug("publish_bar_update %s %s failed: %s", symbol, tf_name, exc)

    async def _binance_crypto_feed(self) -> None:
        """Live crypto ticks from Binance, run ALONGSIDE the primary feed.

        InfoWay/AllTick's crypto symbol mapping is a placeholder and does
        not actually stream BTC/ETH/etc., so crypto prices froze and P&L
        never moved (client report: "BTC not working"). Binance's public
        trade stream is free + reliable. This mirrors _process_ticks —
        applies the admin spread via spread_cache.widen and publishes
        through the same path — but deliberately does NOT touch
        self._tick_count, so the primary-feed watchdogs still detect a
        dead forex feed correctly.
        """
        import json as _json
        import websockets as _ws
        from .feed_handler import BINANCE_MAP, BINANCE_WS

        streams = [f"{pair}@trade" for pair in BINANCE_MAP]
        url = f"{BINANCE_WS}/{'/'.join(streams)}"
        # Stop if a watchdog swaps the primary feed to FeedSimulator, which
        # runs its OWN Binance feed — else we'd double-publish crypto.
        while self.running and isinstance(self.feed, (InfoWayFeed, AllTickFeed)):
            try:
                logger.info("Binance crypto feed connecting (alongside primary feed)")
                async with _ws.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    logger.info("Binance crypto feed connected — live crypto prices active")
                    async for raw in ws:
                        if not self.running or not isinstance(self.feed, (InfoWayFeed, AllTickFeed)):
                            break
                        try:
                            data = _json.loads(raw)
                            pair = (data.get("s") or "").lower()
                            symbol = BINANCE_MAP.get(pair)
                            if not symbol:
                                continue
                            price = float(data["p"])
                        except (KeyError, ValueError, TypeError):
                            continue
                        ts = datetime.now(timezone.utc)
                        timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"
                        mid = price
                        self._last_mid[symbol] = mid
                        self._last_live_mono[symbol] = time.monotonic()
                        bid, ask = self.spread_cache.widen(symbol, mid)
                        await publish_price(symbol, bid, ask, timestamp)
                        await self.store.insert_tick(symbol, bid, ask, timestamp)
                        self.aggregator.update(symbol, bid, ask, timestamp)
                        await self._publish_current_bars(symbol)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("Binance crypto feed error: %s — reconnecting in 5s", e)
                await asyncio.sleep(5)

    async def _alltick_fallback_watchdog(self) -> None:
        """If AllTick never delivers ticks (bad token, expired plan, network,
        symbol mismatch), fall back to the simulator so quotes appear."""
        try:
            await asyncio.sleep(55.0)
        except asyncio.CancelledError:
            raise
        if not self.running or self._tick_count > 0:
            return
        if not isinstance(self.feed, AllTickFeed):
            return
        logger.error(
            "AllTick: no ticks in 55s — check ALLTICK_TOKEN, outbound WSS to "
            "quote.alltick.co, plan symbol limits, and weekend/closed-market state. "
            "Falling back to simulated feed so quotes appear."
        )
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping AllTick feed: %s", exc)
        self.feed = FeedSimulator(tick_rate_multiplier=1.0)
        asyncio.create_task(self.feed.start())

    async def _infoway_fallback_watchdog(self) -> None:
        """Same safety net as the AllTick watchdog, scoped to InfoWay.
        If the subscription comes back with an error (bad key, expired
        plan, symbol not in plan, closed-market weekend) and zero ticks
        flow for 55s, swap the feed out for the simulator."""
        try:
            await asyncio.sleep(55.0)
        except asyncio.CancelledError:
            raise
        if not self.running or self._tick_count > 0:
            return
        if not isinstance(self.feed, InfoWayFeed):
            return
        logger.error(
            "InfoWay: no ticks in 55s — check INFOWAY_TOKEN, outbound WSS to "
            "data.infoway.io, plan symbol limits, and weekend/closed-market state. "
            "Falling back to simulated feed so quotes appear."
        )
        try:
            await self.feed.stop()
        except Exception as exc:
            logger.warning("Stopping InfoWay feed: %s", exc)
        self.feed = FeedSimulator(tick_rate_multiplier=1.0)
        asyncio.create_task(self.feed.start())

    async def _auto_seed_bars(self) -> None:
        """Wait for first ticks to arrive, then seed historical bars.

        On every startup we drop any non-crypto `bars:*:*` keys first.
        Those used to be filled with simulated random-walk data when
        AllTick wasn't yet integrated; the keys have no TTL so they
        survive across deploys until explicitly deleted. After the
        flush, `seed_bars()` repopulates from real AllTick history
        (and Binance for crypto). Crypto bars are left untouched —
        they were always real.

        The crypto-presence check is kept as a fast-path: if BTCUSD
        already has 50+ bars in Redis we short-circuit so a normal
        restart doesn't re-fetch all crypto bars unnecessarily.
        """
        try:
            await asyncio.sleep(30.0)  # give feed time to start delivering ticks
        except asyncio.CancelledError:
            raise
        if not self.running:
            return

        # Drop simulated non-crypto bars from any earlier deploy so the seed
        # below replaces them with real AllTick data. No-op on a fresh deploy
        # (nothing to delete) so this is safe to run unconditionally.
        try:
            flushed = await flush_non_crypto_keys()
            if flushed:
                logger.info("Auto-seed: flushed %d stale non-crypto bar keys", flushed)
        except Exception as exc:
            logger.warning("Auto-seed flush failed (continuing): %s", exc)

        sample_count = await redis_client.llen("bars:BTCUSD:5m")
        if sample_count >= 50:
            logger.info(
                "Bars already seeded for crypto (%d bars for BTCUSD:5m); "
                "running seed for non-crypto only",
                sample_count,
            )
        else:
            logger.info("Auto-seeding historical bars (first run or bars missing)...")
        try:
            await seed_bars()
        except Exception as exc:
            logger.warning("Auto-seed bars failed: %s", exc)

    async def shutdown(self):
        logger.info("Shutting down Market Data Service...")
        self.running = False
        await self.feed.stop()
        await redis_client.close()


async def main():
    service = MarketDataService()
    try:
        await service.start()
    except KeyboardInterrupt:
        await service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
