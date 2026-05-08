"""Seed historical OHLCV bars into Redis for all active instruments.

Run once (or on demand) to backfill chart history so the TradingView
Advanced Chart has candles to display immediately.

Usage (inside the market-data container):
    python -m src.seed_bars                 # standard reseed
    python -m src.seed_bars --force         # reseed even if Redis has bars
    python -m src.seed_bars --flush-non-crypto  # drop simulated history first

Crypto symbols: fetches REAL historical klines from Binance public API.
Non-crypto symbols: fetches REAL historical klines from AllTick REST.
Falls back to skipping (NOT simulated bars) if AllTick is unavailable —
serving an empty chart is better than serving believable lies.
"""
import argparse
import asyncio
import json
import logging

import httpx

from packages.common.src.alltick_rest import fetch_klines as alltick_fetch_klines
from packages.common.src.config import get_settings
from packages.common.src.redis_client import redis_client

logger = logging.getLogger("seed-bars")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")

TIMEFRAMES = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}

# Binance kline interval names
_TF_TO_BINANCE_INTERVAL: dict[str, str] = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "1d",
}

# Platform symbol → Binance REST pair
BINANCE_PAIRS: dict[str, str] = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT", "BNBUSD": "BNBUSDT",
    "DOGEUSD": "DOGEUSDT", "ADAUSD": "ADAUSDT",
}

BARS_COUNT = 500


def _guess_segment(symbol: str) -> str:
    s = symbol.upper()
    if s in BINANCE_PAIRS:
        return "crypto"
    if s in ("XAUUSD", "XAGUSD", "USOIL"):
        return "commodities"
    if s in ("US30", "US500", "NAS100", "UK100", "GER40"):
        return "indices"
    return "forex"


async def flush_non_crypto_keys() -> int:
    """Delete `bars:*:*` Redis keys for non-crypto symbols.

    The previous version of this seeder generated simulated random-walk
    bars for forex / metals / CFDs / indices. Those keys have no TTL so
    they linger across deploys; deleting them forces the AllTick branch
    below to repopulate with real history. Crypto bars are left alone
    (they come from real Binance data and are correct).

    Returns the number of keys deleted.
    """
    cursor = 0
    deleted = 0
    while True:
        cursor, keys = await redis_client.scan(cursor, match="bars:*:*", count=200)
        for key in keys:
            # `bars:{SYMBOL}:{TIMEFRAME}`
            parts = key.split(":")
            if len(parts) != 3:
                continue
            sym = parts[1].upper()
            if sym in BINANCE_PAIRS:
                continue
            await redis_client.delete(key)
            deleted += 1
        if cursor == 0:
            break
    if deleted:
        logger.info("Flushed %d simulated non-crypto bar keys", deleted)
    return deleted


async def _fetch_binance_klines(symbol: str, tf_name: str, count: int = 500) -> list[dict]:
    """Fetch real historical klines from Binance public REST API."""
    pair = BINANCE_PAIRS.get(symbol.upper())
    if not pair:
        return []

    interval = _TF_TO_BINANCE_INTERVAL.get(tf_name, "5m")
    params = {"symbol": pair, "interval": interval, "limit": min(count, 1000)}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://api.binance.com/api/v3/klines", params=params)
            if resp.status_code != 200:
                logger.warning("Binance HTTP %s for %s %s", resp.status_code, symbol, tf_name)
                return []
            data = resp.json()
    except Exception as exc:
        logger.warning("Binance fetch failed for %s %s: %s", symbol, tf_name, exc)
        return []

    bars = []
    for k in data:
        bars.append({
            "time": int(k[0]) // 1000,  # open_time ms → epoch seconds
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
            "tick_count": int(k[8]) if len(k) > 8 else 0,  # number of trades
        })

    return bars


async def seed(force: bool = False):
    """Read current prices from Redis and seed historical bars.

    For crypto symbols, fetches real bars from Binance public API.
    For non-crypto symbols, fetches real bars from AllTick REST.
    Symbols with no real data available are skipped (we never
    generate fake bars — that was the bug this fix closes).
    """
    # Discover symbols from tick:* keys (available even before bar aggregation starts)
    symbols: set[str] = set()

    # Try bar:current keys first
    cursor = 0
    while True:
        cursor, keys = await redis_client.scan(cursor, match="bar:current:*:1m", count=200)
        for k in keys:
            parts = k.split(":")
            if len(parts) >= 3:
                symbols.add(parts[2])
        if cursor == 0:
            break

    # Also check tick:* keys (available sooner after startup)
    cursor = 0
    while True:
        cursor, keys = await redis_client.scan(cursor, match="tick:*", count=200)
        for k in keys:
            parts = k.split(":")
            if len(parts) >= 2:
                sym = parts[1].upper()
                if sym and len(sym) <= 10:
                    symbols.add(sym)
        if cursor == 0:
            break

    if not symbols:
        logger.warning("No symbols found in Redis. Is market-data running?")
        return

    logger.info("Found %d symbols: %s", len(symbols), ", ".join(sorted(symbols)))

    settings = get_settings()
    alltick_token = (settings.ALLTICK_TOKEN or "").strip()

    for sym in sorted(symbols):
        segment = _guess_segment(sym)
        is_crypto = sym in BINANCE_PAIRS
        source = "binance" if is_crypto else ("alltick" if alltick_token else "skip")

        if not is_crypto and not alltick_token:
            logger.info("Skipping %s — no ALLTICK_TOKEN configured", sym)
            continue

        logger.info("Seeding %s (segment=%s, source=%s)", sym, segment, source)

        for tf_name, _tf_seconds in TIMEFRAMES.items():
            list_key = f"bars:{sym}:{tf_name}"

            if not force:
                existing = await redis_client.llen(list_key)
                if existing >= 100:
                    logger.info("  %s:%s already has %d bars, skipping", sym, tf_name, existing)
                    continue

            if is_crypto:
                bars = await _fetch_binance_klines(sym, tf_name, BARS_COUNT)
                if not bars:
                    logger.warning("  %s:%s Binance fetch returned 0 bars", sym, tf_name)
                    continue
            else:
                # Real history from AllTick REST. If AllTick is down or the
                # symbol isn't supported, return [] and skip — never fall
                # back to simulated bars.
                bars = await alltick_fetch_klines(
                    sym, tf_name, count=BARS_COUNT, token=alltick_token,
                )
                if not bars:
                    logger.warning("  %s:%s AllTick fetch returned 0 bars", sym, tf_name)
                    continue

            # Clear old data and write new bars. lpush newest-first to match
            # the BarAggregator's live-write convention (see bar_aggregator.py).
            # AllTick / Binance fetchers return bars sorted oldest → newest;
            # iterating in that order with lpush lands the newest bar at
            # index 0, which is what get_bars() and the chart expect.
            pipe = redis_client.pipeline()
            pipe.delete(list_key)
            for bar in bars:
                bar["symbol"] = sym
                bar["timeframe"] = tf_name
                pipe.lpush(list_key, json.dumps(bar))
            pipe.ltrim(list_key, 0, 999)
            await pipe.execute()
            logger.info("  %s:%s → %d bars seeded", sym, tf_name, len(bars))

            # Small delay between requests. AllTick paid plans cap at ~10/s
            # and the rest module already enforces concurrency + spacing,
            # but a per-loop sleep keeps any single seed run from monopolising
            # the rate budget while live ticks are also flowing.
            await asyncio.sleep(0.15)

    logger.info("Done seeding all symbols.")


async def _cli_main():
    parser = argparse.ArgumentParser(description="Seed historical OHLCV bars into Redis.")
    parser.add_argument(
        "--force", action="store_true",
        help="Reseed even if Redis already has bars for a symbol/timeframe.",
    )
    parser.add_argument(
        "--flush-non-crypto", action="store_true",
        help="Drop existing non-crypto `bars:*:*` keys before seeding so any "
             "leftover simulated history is replaced with real AllTick data.",
    )
    args = parser.parse_args()
    if args.flush_non_crypto:
        await flush_non_crypto_keys()
    await seed(force=args.force)


if __name__ == "__main__":
    asyncio.run(_cli_main())
