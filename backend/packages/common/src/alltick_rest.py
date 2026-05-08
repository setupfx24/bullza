"""AllTick REST historical-kline client.

Companion to the WebSocket feed in market-data/src/alltick_feed.py — that
module delivers live ticks going forward, this one fills in the past.

Used by:
  * services/market-data/src/seed_bars.py — startup backfill of all known
    non-crypto instruments across every timeframe.
  * services/gateway/src/api/instruments.py — on-demand fallback inside
    GET /instruments/{symbol}/bars when Redis returns fewer bars than the
    chart needs (cold cache or walking back beyond what's stored).

API spec (en.apis.alltick.co):
    GET https://quote.alltick.co/quote-b-api/kline?token=<TOKEN>&query=<JSON>
    where the `query` string is JSON with shape:
        {
          "trace": "<uuid>",
          "data": {
            "code": "XAUUSD",
            "kline_type": 2,            # see _TF_TO_KLINE_TYPE below
            "kline_timestamp_end": 0,   # 0 = latest, else walk back from that ts (seconds)
            "query_kline_num": 500,     # max 1000 per call
            "adjust_type": 0
          }
        }
    Response:
        {"data":{"kline_list":[{"timestamp":"1731000000",
            "open_price":"4710.50","close_price":"4712.00",
            "high_price":"4715.00","low_price":"4708.00",
            "volume":"1234"}]}}

Premium plan: ~10 req/sec across the account. Module-global semaphore +
spacing keeps us well under that even when the seed loop is hot.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("alltick.rest")

# ─── Endpoint ─────────────────────────────────────────────────────────────
ALLTICK_REST_KLINE = "https://quote.alltick.co/quote-b-api/kline"

# ─── Mappings ─────────────────────────────────────────────────────────────
# Platform symbol → AllTick "code". Same shape as PLATFORM_TO_ALLTICK in
# alltick_feed.py — duplicated here so this module has no dependency on
# the market-data service (the gateway also imports it). Keep in sync if
# you add new aliases.
PLATFORM_TO_ALLTICK_REST: Dict[str, str] = {
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT",
    "SOLUSD": "SOLUSDT",
    "USOIL": "USOIL",
    "UKOIL": "UKOIL",
}

# Bar-aggregator timeframe key → AllTick `kline_type` integer.
# Per AllTick docs: 1=1m, 2=5m, 3=15m, 4=30m, 5=1h, 6=2h, 7=4h, 8=1d, 9=1w, 10=1mo.
_TF_TO_KLINE_TYPE: Dict[str, int] = {
    "1m":  1,
    "5m":  2,
    "15m": 3,
    "30m": 4,
    "1h":  5,
    "4h":  7,
    "1d":  8,
}

# ─── Rate-limit / concurrency ─────────────────────────────────────────────
# Premium AllTick plans cap at ~10 req/s. Cap us at 8 concurrent in-flight
# requests with a 125ms minimum spacing per slot — leaves headroom for the
# WebSocket subscriber's own RPC traffic and avoids 429s during seeding.
_MAX_CONCURRENT = 8
_MIN_SPACING_SEC = 0.125

_semaphore = asyncio.Semaphore(_MAX_CONCURRENT)
_last_request_at: float = 0.0
_spacing_lock = asyncio.Lock()


def _trace_id() -> str:
    """Unique trace token per request; AllTick echoes it back for debugging."""
    return secrets.token_hex(16)


def _alltick_code(symbol: str) -> str:
    """Map our platform symbol to AllTick's wire code."""
    return PLATFORM_TO_ALLTICK_REST.get(symbol.upper(), symbol.upper())


async def _spaced_request(
    client: httpx.AsyncClient, params: Dict[str, str],
) -> Optional[httpx.Response]:
    """Issue one HTTP GET to AllTick respecting concurrency + spacing limits."""
    async with _semaphore:
        # Enforce minimum spacing between any two requests across the process.
        async with _spacing_lock:
            global _last_request_at
            loop = asyncio.get_event_loop()
            now = loop.time()
            wait = (_last_request_at + _MIN_SPACING_SEC) - now
            if wait > 0:
                await asyncio.sleep(wait)
            _last_request_at = loop.time()
        return await client.get(ALLTICK_REST_KLINE, params=params)


async def fetch_klines(
    symbol: str,
    timeframe: str,
    *,
    token: str,
    count: int = 500,
    end_ts: int = 0,
) -> List[Dict[str, Any]]:
    """Return up to `count` historical OHLCV bars for `symbol` at `timeframe`.

    Bars are returned oldest → newest in the same dict shape used by the
    rest of the bar pipeline (Redis lists, BarAggregator, the bars API):
        {time: int_epoch_seconds, open, high, low, close, volume, tick_count}

    Args:
      symbol:    Platform symbol (e.g. "XAUUSD", "EURUSD"). Crypto pairs are
                 supported but the caller usually prefers Binance for those.
      timeframe: Bar-aggregator key — "1m" / "5m" / "15m" / "30m" / "1h" /
                 "4h" / "1d". Anything else returns an empty list.
      token:     ALLTICK_TOKEN. Pulled from settings by the caller; no
                 fallback here so a missing token fails loudly during config
                 review rather than silently returning fake data.
      count:     Max bars to request (AllTick caps at 1000 per call).
      end_ts:    0 ⇒ latest bars. Else: walk back from this epoch second
                 (used to paginate older history).

    Returns [] on rate-limit, network failure, schema deviation, or unknown
    timeframe — never raises. Callers should treat [] as "AllTick unavailable
    right now, serve whatever we have cached."
    """
    if not token:
        logger.warning("fetch_klines called without an ALLTICK_TOKEN — returning []")
        return []

    kline_type = _TF_TO_KLINE_TYPE.get(timeframe)
    if kline_type is None:
        logger.warning("Unknown timeframe %s — returning []", timeframe)
        return []

    code = _alltick_code(symbol)
    query_obj = {
        "trace": _trace_id(),
        "data": {
            "code": code,
            "kline_type": kline_type,
            "kline_timestamp_end": int(end_ts),
            "query_kline_num": max(1, min(int(count), 1000)),
            "adjust_type": 0,
        },
    }
    params = {"token": token, "query": json.dumps(query_obj, separators=(",", ":"))}

    # 3-attempt exponential backoff for transient 429 / 5xx / network errors.
    backoff = [0.5, 1.0, 2.0]
    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt, delay in enumerate(backoff):
            try:
                resp = await _spaced_request(client, params)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                logger.warning(
                    "alltick kline %s %s attempt %d network error: %s",
                    symbol, timeframe, attempt + 1, exc,
                )
                resp = None

            if resp is not None and resp.status_code == 200:
                try:
                    payload = resp.json()
                except ValueError:
                    logger.warning(
                        "alltick kline %s %s: non-JSON body — body[:200]=%r",
                        symbol, timeframe, resp.text[:200],
                    )
                    return []
                return _parse_kline_payload(payload, symbol, timeframe)

            if resp is not None and resp.status_code in (429, 500, 502, 503, 504):
                # Retry-eligible — backoff and try again.
                if attempt < len(backoff) - 1:
                    await asyncio.sleep(delay)
                    continue

            if resp is not None:
                logger.warning(
                    "alltick kline %s %s attempt %d HTTP %s body=%r",
                    symbol, timeframe, attempt + 1, resp.status_code, resp.text[:200],
                )
                return []

            # resp is None (network error) — backoff and retry.
            if attempt < len(backoff) - 1:
                await asyncio.sleep(delay)

    return []


def _parse_kline_payload(
    payload: Dict[str, Any], symbol: str, timeframe: str,
) -> List[Dict[str, Any]]:
    """Transform AllTick's response into the project's bar dict shape."""
    try:
        kline_list = (payload.get("data") or {}).get("kline_list") or []
    except (AttributeError, TypeError):
        logger.warning(
            "alltick kline %s %s: malformed payload shape — keys=%s",
            symbol, timeframe, list(payload.keys()) if isinstance(payload, dict) else type(payload),
        )
        return []

    if not isinstance(kline_list, list):
        return []

    bars: List[Dict[str, Any]] = []
    for k in kline_list:
        try:
            bars.append({
                "time":   int(float(k["timestamp"])),
                "open":   float(k["open_price"]),
                "high":   float(k["high_price"]),
                "low":    float(k["low_price"]),
                "close":  float(k["close_price"]),
                "volume": float(k.get("volume") or 0.0),
                "tick_count": 0,  # AllTick doesn't report trade count for FX/CFD
            })
        except (KeyError, ValueError, TypeError):
            # Skip malformed rows but keep parsing; logging the whole list
            # would be too noisy if AllTick changes a field name.
            continue

    # AllTick generally returns newest → oldest. Normalise to oldest → newest
    # so callers that lpush into Redis (which puts the FIRST element at the
    # head/newest end of the list) end up with the same convention as the
    # live BarAggregator (lpush newest, ltrim 1000).
    bars.sort(key=lambda b: b["time"])
    return bars
