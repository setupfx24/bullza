"""InfoWay historical candlestick REST — gap backfill from the SAME provider as
the live WebSocket feed (docs.infoway.io).

Used to fill the window the market-data socket was disconnected for, so the
chart has NO price-basis seam (same source for live + history). Mirrors
``alltick_rest.fetch_klines`` so call-sites read the same.

    POST https://data.infoway.io/{business}/v2/batch_kline
      header  apiKey: <token>
      body    {"klineType": <1-12>, "klineNum": <=500, "codes": "<ONE code>",
               "timestamp": <unix-sec, optional, for historical>}

CRITICAL (per InfoWay docs):
  • Single-symbol query returns up to 500 bars; a multi-symbol BATCH returns
    only the latest 2 bars per product — useless for a gap fill. So callers
    must fetch ONE code per request (loop), never a comma-joined list here.
  • ``respList`` comes newest-first (t descending) — we reverse to ASCENDING.
  • o/h/l/c/v are STRINGS — coerced to float.
  • ``t`` is Unix seconds.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger("infoway_rest")

_BASE = "https://data.infoway.io"

# aggregator timeframe name -> InfoWay klineType
#   1=1m 2=5m 3=15m 4=30m 5=1h 6=2h 7=4h 8=1d 9=1w 10=1mo 11=1q 12=1y
_TF_TO_KLINETYPE = {
    "1m": 1, "5m": 2, "15m": 3, "30m": 4, "1h": 5, "4h": 7, "1d": 8,
}


async def fetch_klines(
    infoway_code: str,
    tf_name: str,
    count: int = 500,
    end_ts: int = 0,
    token: str = "",
    business: str = "common",
) -> list[dict]:
    """Up to ``count`` historical candles for ONE InfoWay code, ASCENDING by
    time. Returns ``[]`` on any failure (caller treats absence as "leave the
    gap" rather than crash). ``end_ts`` (unix sec) requests history ending at
    that time; omit for the latest."""
    kline_type = _TF_TO_KLINETYPE.get(tf_name)
    if not kline_type or not (infoway_code or "").strip() or not (token or "").strip():
        return []

    body: dict = {
        "klineType": kline_type,
        "klineNum": min(max(int(count), 1), 500),
        # ONE code only — batch returns just 2 bars per product (see module doc).
        "codes": infoway_code.strip(),
    }
    if end_ts and int(end_ts) > 0:
        body["timestamp"] = int(end_ts)

    url = f"{_BASE}/{business}/v2/batch_kline"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=body, headers={"apiKey": token.strip()})
        if resp.status_code != 200:
            logger.warning(
                "InfoWay kline %s %s HTTP %s: %s",
                infoway_code, tf_name, resp.status_code, resp.text[:200],
            )
            return []
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001 — network/JSON failure → leave gap
        logger.warning("InfoWay kline fetch failed %s %s: %s", infoway_code, tf_name, exc)
        return []

    rows = payload.get("data") if isinstance(payload, dict) else None
    if not rows:
        return []
    resp_list = (rows[0] or {}).get("respList") or []

    out: list[dict] = []
    for r in resp_list:
        try:
            out.append({
                "time": int(r["t"]),
                "open": float(r["o"]),
                "high": float(r["h"]),
                "low": float(r["l"]),
                "close": float(r["c"]),
                "volume": float(r.get("v") or 0),
            })
        except (KeyError, TypeError, ValueError):
            continue
    # respList is newest-first (t descending) — TradingView needs ascending.
    out.sort(key=lambda b: b["time"])
    return out
