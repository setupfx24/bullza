import redis.asyncio as aioredis
from .config import get_settings

settings = get_settings()

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True,
)

redis_client = aioredis.Redis(connection_pool=redis_pool)


class PriceChannel:
    TICK_PREFIX = "tick:"
    PRICE_CHANNEL = "prices"
    ORDERBOOK_CHANNEL = "orderbook"

    @staticmethod
    def tick_key(symbol: str) -> str:
        return f"{PriceChannel.TICK_PREFIX}{symbol}"

    @staticmethod
    def price_channel(symbol: str) -> str:
        return f"{PriceChannel.PRICE_CHANNEL}:{symbol}"


async def get_redis():
    return redis_client


async def publish_price(symbol: str, bid: float, ask: float, timestamp: str):
    import json
    data = json.dumps({
        "symbol": symbol,
        "bid": bid,
        "ask": ask,
        "timestamp": timestamp,
        "spread": round(ask - bid, 8),
    })
    await redis_client.set(PriceChannel.tick_key(symbol), data)
    await redis_client.publish(PriceChannel.price_channel(symbol), data)
    await redis_client.publish(PriceChannel.PRICE_CHANNEL, data)


CONFIG_INSTRUMENTS_RELOAD_CHANNEL = "config:instruments:reload"


async def publish_instrument_config_reload() -> None:
    """Notify services that instrument charge/spread config changed (optional cache bust)."""
    await redis_client.publish(CONFIG_INSTRUMENTS_RELOAD_CHANNEL, "1")


# ─── Bar-update fan-out channel ──────────────────────────────────────────────
# Market-data publishes the current in-progress OHLC bar for each (symbol,
# timeframe) tuple to this single channel after every tick the aggregator
# absorbs. The gateway's /ws/bars handler subscribes once and filters
# per-client based on which (symbol, resolution) the chart is subscribed to.
# Wire shape (JSON-encoded string):
#   { "symbol": "XAUUSD", "timeframe": "5m",
#     "time": 1731000000, "open": ..., "high": ...,
#     "low": ..., "close": ..., "volume": ... }
# `timeframe` matches the BarAggregator key set ("1m" / "5m" / "15m" /
# "30m" / "1h" / "4h" / "1d"). The gateway maps these to TradingView
# resolution strings ("1" / "5" / "15" / "30" / "60" / "240" / "1D").
BAR_UPDATES_CHANNEL = "bars:updates"


async def publish_bar_update(payload: dict) -> None:
    """Fan out a current-bar snapshot. Caller serialises floats; we just dump."""
    import json
    await redis_client.publish(BAR_UPDATES_CHANNEL, json.dumps(payload))
