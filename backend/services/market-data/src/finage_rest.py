"""Finage REST helpers — symbol mapping, segment routing, and historical
candles (aggregates).

Finage (api.finage.co.uk) endpoints we use:
  • Last quote (real bid/ask):  GET /last/forex/{code}?apikey=KEY
        -> {"symbol":"EURUSD","ask":1.1426,"bid":1.1422,"timestamp":<ms>}
    Crypto uses /last/crypto/{code} and returns {"price":...} (no bid/ask).
  • Aggregates / candles:        GET /agg/forex/{code}/{mult}/{tf}/{from}/{to}?apikey=KEY
        -> {"symbol":"EURUSD","totalResults":N,"results":[{o,h,l,c,v,t(ms)}...]}

Auth note: the trial key literally includes the "API_KEY" prefix, e.g.
`API_KEYbc0...` — pass the whole string as apikey. (client 2026-07-09)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger("market-data.finage")

BASE_URL = "https://api.finage.co.uk"

# Platform symbol -> Finage code (mostly 1:1; oil differs; indices unsupported
# on the forex path with these names → routed to no feed).
PLATFORM_TO_FINAGE: Dict[str, str] = {
    "USOIL": "WTIUSD",
    "UKOIL": "BCOUSD",
}

# Crypto platform symbols route to /last/crypto (price-only); everything else
# to /last/forex. Crypto is normally served by Binance, so the feed skips it.
CRYPTO_SYMBOLS = {"BTCUSD", "ETHUSD", "LTCUSD", "XRPUSD", "SOLUSD"}

# Indices Finage doesn't price on the forex path (verified 2026-07-09) — the
# feed skips these so it never spams "check the symbol name".
UNSUPPORTED_SYMBOLS = {"US30", "US500", "NAS100", "UK100", "GER40"}

# Timeframe name -> (multiplier, Finage timespan)
_TF_TO_FINAGE: Dict[str, tuple[int, str]] = {
    "1m": (1, "minute"), "5m": (5, "minute"), "15m": (15, "minute"),
    "30m": (30, "minute"), "1h": (1, "hour"), "4h": (4, "hour"), "1d": (1, "day"),
}
_TF_SECONDS: Dict[str, int] = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400,
}


# Reverse: Finage wire code (slash-stripped, upper) -> platform symbol.
FINAGE_TO_PLATFORM: Dict[str, str] = {v: k for k, v in PLATFORM_TO_FINAGE.items()}


def finage_code(symbol: str) -> str:
    return PLATFORM_TO_FINAGE.get(symbol.upper(), symbol.upper())


def platform_from_finage(wire_symbol: str) -> str:
    """Map a Finage response symbol back to our platform code. The WS may return
    slashed pairs (e.g. 'XAU/USD', 'ZAR/EUR'), so strip the slash first."""
    norm = (wire_symbol or "").replace("/", "").replace("-", "").upper()
    return FINAGE_TO_PLATFORM.get(norm, norm)


def finage_segment(symbol: str) -> str:
    return "crypto" if symbol.upper() in CRYPTO_SYMBOLS else "forex"


def is_supported(symbol: str) -> bool:
    """True if the Finage FEED (forex last-quote) can price this symbol.
    Crypto (Binance) and indices (no forex-path pricing) are excluded."""
    s = symbol.upper()
    return s not in CRYPTO_SYMBOLS and s not in UNSUPPORTED_SYMBOLS


async def fetch_klines(
    symbol: str, tf_name: str, count: int, api_key: str,
    client: Optional[httpx.AsyncClient] = None,
) -> List[dict]:
    """Historical OHLCV bars (ascending). Returns [] on any failure so callers
    can skip rather than serve fabricated data."""
    mult_tf = _TF_TO_FINAGE.get(tf_name)
    if not mult_tf or not is_supported(symbol) or not api_key:
        return []
    mult, timespan = mult_tf
    code = finage_code(symbol)
    tf_sec = _TF_SECONDS.get(tf_name, 60)
    # Span a window wide enough for `count` bars (plus weekend padding for
    # intraday forex). Finage takes YYYY-MM-DD date bounds.
    now = datetime.now(timezone.utc)
    span_days = max(2, int((count * tf_sec) / 86400) + 3)
    frm = (now - timedelta(days=span_days)).strftime("%Y-%m-%d")
    to = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    url = f"{BASE_URL}/agg/forex/{code}/{mult}/{timespan}/{frm}/{to}?apikey={api_key}"

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=15.0)
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.warning("Finage agg HTTP %s for %s %s", resp.status_code, symbol, tf_name)
            return []
        data = resp.json()
        rows = data.get("results") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            return []
        bars: List[dict] = []
        for r in rows:
            try:
                bars.append({
                    "time": int(r["t"]) // 1000,  # ms -> epoch seconds
                    "open": float(r["o"]), "high": float(r["h"]),
                    "low": float(r["l"]), "close": float(r["c"]),
                    "volume": float(r.get("v") or 0), "tick_count": 0,
                })
            except (KeyError, TypeError, ValueError):
                continue
        bars.sort(key=lambda b: b["time"])
        return bars[-count:] if count and len(bars) > count else bars
    except Exception as exc:  # noqa: BLE001
        logger.warning("Finage agg fetch failed for %s %s: %s", symbol, tf_name, exc)
        return []
    finally:
        if own_client:
            await client.aclose()
