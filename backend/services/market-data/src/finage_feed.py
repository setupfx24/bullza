"""Real-time price feed from Finage via REST last-quote polling.

Finage's WebSocket needs a JS-rendered docs flow we couldn't confirm on the
trial, but its REST last-quote (`/last/forex/{code}`) returns REAL bid/ask and
is confirmed working, so this feed polls it per symbol every
`FINAGE_POLL_INTERVAL` seconds and emits ticks into the same queue contract the
rest of market-data uses (start / stop / get_tick / current_prices).

Per the platform convention (see AllTickFeed / InfoWayFeed): we take the MID of
Finage's bid/ask and enqueue bid == ask == mid; the broker's own spread is
layered downstream by spread_cache.widen() in main.py. Crypto (Binance) and
indices (unpriced on Finage's forex path) are skipped. (client 2026-07-09)
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
import websockets

from .finage_rest import BASE_URL, finage_code, finage_segment, is_supported, platform_from_finage

logger = logging.getLogger("market-data.finage")


def _ms_to_iso(ms) -> str:
    """Finage timestamps are epoch-milliseconds ints; the tick store's
    _parse_tick_time expects an ISO STRING (it calls .strip()). Convert, and on
    any bad value return "" so the store falls back to now()."""
    try:
        return datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError, OverflowError):
        return ""

RECONNECT_BACKOFF_BASE = 2.0
RECONNECT_BACKOFF_MAX = 60.0


class FinageFeed:
    """Streams Finage prices as mid ticks. Uses the WebSocket when ws_url is set
    (dense, real-time), otherwise falls back to REST last-quote polling."""

    def __init__(
        self, api_key: str, instruments: Dict[str, dict],
        poll_interval: float = 1.0, ws_url: str = "",
    ):
        self._api_key = (api_key or "").strip()
        self._ws_url = (ws_url or "").strip()
        # Only symbols Finage can actually price on the forex last-quote path.
        self._instruments = {s: v for s, v in instruments.items() if is_supported(s)}
        self._poll_interval = max(0.25, float(poll_interval or 1.0))
        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []

    # ─── Feed interface (matches FeedSimulator / InfoWayFeed / AllTickFeed) ──

    @property
    def current_prices(self) -> Dict[str, float]:
        return {}

    async def start(self) -> None:
        self._running = True
        syms = sorted(self._instruments.keys())
        if not syms:
            logger.error("FinageFeed: no priceable instruments")
            return
        if self._ws_url:
            logger.info(
                "Finage feed starting — WebSocket streaming %d symbols: %s",
                len(syms), ",".join(syms),
            )
            self._tasks.append(asyncio.create_task(self._run_ws(), name="finage-ws"))
        else:
            if not self._api_key:
                logger.error("Finage: no WS URL and no API key — refusing to start")
                return
            logger.info(
                "Finage feed starting — REST last-quote polling %d symbols every %.2fs: %s",
                len(syms), self._poll_interval, ",".join(syms),
            )
            self._tasks.append(asyncio.create_task(self._poll_loop(), name="finage-poll"))
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Finage feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ─── Internals ─────────────────────────────────────────────────────────

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)

    # ─── WebSocket path ──────────────────────────────────────────────────────

    def _emit_ws(self, data: dict) -> None:
        """Parse one Finage WS push and enqueue a mid tick. Fields (per docs):
        s=symbol (may be slashed, e.g. 'XAU/USD'), a/ap=ask, b/bp=bid,
        p=trade price, t=timestamp(ms)."""
        sym = platform_from_finage(str(data.get("s") or ""))
        info = self._instruments.get(sym)
        if not info:
            return  # not one of our instruments
        ask = data.get("a", data.get("ap"))
        bid = data.get("b", data.get("bp"))
        mid: Optional[float] = None
        try:
            if ask is not None and bid is not None:
                mid = (float(ask) + float(bid)) / 2.0
            elif data.get("p") is not None:
                mid = float(data.get("p"))
        except (TypeError, ValueError):
            return
        if mid is None or not (mid > 0):
            return
        decimals = int(info["decimals"])
        mid = round(mid, decimals)
        ts = data.get("t")
        self._enqueue({
            "symbol": sym, "bid": mid, "ask": mid,
            "timestamp": _ms_to_iso(ts), "volume": 1,
        })

    async def _run_ws(self) -> None:
        codes = sorted({finage_code(s) for s in self._instruments.keys()})
        sub_msg = json.dumps({"action": "subscribe", "symbols": ",".join(codes)})
        backoff = RECONNECT_BACKOFF_BASE
        while self._running:
            try:
                async with websockets.connect(
                    self._ws_url, ping_interval=20, ping_timeout=25,
                    close_timeout=10, max_size=4 * 1024 * 1024,
                ) as ws:
                    await ws.send(sub_msg)
                    logger.info("Finage WS connected + subscribed %d symbols", len(codes))
                    backoff = RECONNECT_BACKOFF_BASE
                    while self._running:
                        raw = await ws.recv()
                        try:
                            msg = json.loads(raw)
                        except (ValueError, TypeError):
                            continue
                        # Control frames (authorizing / connected / errors) carry
                        # status_code; price ticks carry 's'.
                        if isinstance(msg, dict) and msg.get("s"):
                            self._emit_ws(msg)
                        elif isinstance(msg, list):
                            for m in msg:
                                if isinstance(m, dict) and m.get("s"):
                                    self._emit_ws(m)
                        elif isinstance(msg, dict) and msg.get("status_code") not in (None, 200):
                            logger.warning("Finage WS status: %s", raw[:200])
            except asyncio.CancelledError:
                return
            except Exception as exc:  # noqa: BLE001
                if not self._running:
                    return
                logger.warning("Finage WS disconnected (%s) — reconnecting in %.0fs", exc, backoff)
                try:
                    await asyncio.sleep(backoff)
                except asyncio.CancelledError:
                    return
                backoff = min(backoff * 2, RECONNECT_BACKOFF_MAX)

    # ─── REST polling path ───────────────────────────────────────────────────

    async def _poll_loop(self) -> None:
        # One shared client; poll all symbols concurrently each cycle. A 429
        # (rate limit) on a symbol just skips that reading — the next cycle
        # retries. Raise FINAGE_POLL_INTERVAL if the plan rate-limits hard.
        backoff_until = 0.0
        async with httpx.AsyncClient(timeout=8.0) as client:
            loop = asyncio.get_event_loop()
            while self._running:
                start = loop.time()
                if start >= backoff_until:
                    results = await asyncio.gather(
                        *[self._fetch_one(client, s) for s in self._instruments],
                        return_exceptions=True,
                    )
                    if any(r == 429 for r in results):
                        backoff_until = loop.time() + 5.0
                        logger.warning("Finage 429 — backing off 5s (raise FINAGE_POLL_INTERVAL)")
                elapsed = loop.time() - start
                try:
                    await asyncio.sleep(max(0.0, self._poll_interval - elapsed))
                except asyncio.CancelledError:
                    return

    async def _fetch_one(self, client: httpx.AsyncClient, symbol: str):
        code = finage_code(symbol)
        seg = finage_segment(symbol)
        url = f"{BASE_URL}/last/{seg}/{code}?apikey={self._api_key}"
        try:
            resp = await client.get(url)
        except Exception:
            return None
        if resp.status_code == 429:
            return 429
        if resp.status_code != 200:
            return None
        try:
            data = resp.json()
        except Exception:
            return None
        bid = data.get("bid")
        ask = data.get("ask")
        if bid is not None and ask is not None:
            try:
                mid = (float(bid) + float(ask)) / 2.0
            except (TypeError, ValueError):
                return None
        else:
            price = data.get("price")  # crypto path is price-only
            try:
                mid = float(price)
            except (TypeError, ValueError):
                return None
        if not (mid > 0):
            return None
        info = self._instruments.get(symbol)
        decimals = int(info["decimals"]) if info else 5
        mid = round(mid, decimals)
        ts = data.get("timestamp")
        self._enqueue({
            "symbol": symbol,
            "bid": mid,
            "ask": mid,
            "timestamp": _ms_to_iso(ts),
            "volume": 1,
        })
        return None
