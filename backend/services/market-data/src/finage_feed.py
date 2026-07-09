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
import logging
from typing import Dict, List, Optional

import httpx

from .finage_rest import BASE_URL, finage_code, finage_segment, is_supported

logger = logging.getLogger("market-data.finage")


class FinageFeed:
    """Polls Finage REST last-quote and feeds mid-price ticks into the queue."""

    def __init__(self, api_key: str, instruments: Dict[str, dict], poll_interval: float = 1.0):
        self._api_key = (api_key or "").strip()
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
        if not self._api_key:
            logger.error("Finage API key empty — refusing to start")
            return
        syms = sorted(self._instruments.keys())
        if not syms:
            logger.error("FinageFeed: no priceable instruments")
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
            "timestamp": int(ts) if ts else 0,
            "volume": 1,
        })
        return None
