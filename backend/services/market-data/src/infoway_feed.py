"""Real-time bid/ask from InfoWay WebSocket (docs.infoway.io).

InfoWay protocol (docs.infoway.io/en-docs/readme/forex-market-data-api):
  • URL:         wss://data.infoway.io/ws?business=common&apikey=<KEY>
  • Subscribe trade ticks  — `code=10000`:
      {"code":10000,"trace":"<uuid>","data":{"codes":"EURUSD,USDJPY"}}
  • Subscribe orderbook    — `code=10003`:
      {"code":10003,"trace":"<uuid>","data":{"codes":"EURUSD,USDJPY"}}
  • Push trade tick        — `code=10002`:
      {"code":10002,"data":{"s":"EURUSD","p":"1.08456","t":<ms>,
                            "td":1,"v":"250000","vw":"271141.25"}}
  • Push orderbook depth   — `code=10005`:
      {"code":10005,"data":{"s":"EURUSD","t":<ms>,
                            "a":[[prices],[volumes]],
                            "b":[[prices],[volumes]]}}
  • Heartbeat              — `code=10010` every ~30s. Server closes
    the socket after 60s of silence.

We expose the same Feed interface as FeedSimulator / AllTickFeed
(start / stop / get_tick / current_prices) so it slots into
market-data/src/main.py with a single-line wiring change.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import secrets
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

logger = logging.getLogger("market-data.infoway")

# ─── Protocol codes ───────────────────────────────────────────────────────
CMD_SUB_TRADE = 10000
CMD_PUSH_TRADE = 10002
CMD_SUB_DEPTH = 10003
CMD_PUSH_DEPTH = 10005
CMD_HEARTBEAT = 10010

HEARTBEAT_INTERVAL_SEC = 25.0      # docs allow 30s; send a bit earlier for safety
SERVER_SILENCE_THRESHOLD = 60.0    # server disconnects at 60s
RECONNECT_BACKOFF_BASE = 2.0
RECONNECT_BACKOFF_MAX = 60.0


# ─── Symbol mapping ───────────────────────────────────────────────────────
# Platform symbol -> InfoWay "code" used in subscribe payloads.
# InfoWay uses the same no-slash convention as AllTick for forex/metals
# (EURUSD, USDJPY, XAUUSD). Crypto symbols vary per provider; map our
# *USD platform codes onto whatever InfoWay exposes when we confirm.
PLATFORM_TO_INFOWAY: Dict[str, str] = {
    # Crypto — placeholders. InfoWay's crypto channel may use *USDT like
    # AllTick or it may stream *USD natively. Adjust once verified
    # against a live subscription ACK.
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT",
    "SOLUSD": "SOLUSDT",
}

# Reverse aliases — incoming InfoWay code -> our platform symbol.
INFOWAY_TO_PLATFORM_ALIASES: Dict[str, str] = {
    "BTCUSDT": "BTCUSD",
    "ETHUSDT": "ETHUSD",
    "LTCUSDT": "LTCUSD",
    "XRPUSDT": "XRPUSD",
    "SOLUSDT": "SOLUSD",
}


def _trace() -> str:
    """InfoWay accepts any uniqueish identifier per request."""
    return secrets.token_hex(16)


def _infoway_code_for(symbol: str) -> str:
    return PLATFORM_TO_INFOWAY.get(symbol, symbol)


def _platform_code_for(infoway_code: str, instruments: Dict[str, dict]) -> Optional[str]:
    raw = (infoway_code or "").strip().upper()
    if not raw:
        return None
    if raw in INFOWAY_TO_PLATFORM_ALIASES:
        plat = INFOWAY_TO_PLATFORM_ALIASES[raw]
        return plat if plat in instruments else None
    if raw in instruments:
        return raw
    return None


def _ms_to_iso(ts_ms: object) -> str:
    """InfoWay timestamps are unix milliseconds. Normalize to RFC-3339 with millis."""
    try:
        if ts_ms is None:
            raise ValueError("missing")
        v = int(ts_ms)
        sec, ms = v // 1000, v % 1000
        dt = datetime.fromtimestamp(sec, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"
    except (TypeError, ValueError):
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


class InfoWayFeed:
    """Streams InfoWay forex/metals/crypto ticks into the same queue
    contract the rest of market-data expects."""

    def __init__(
        self,
        token: str,
        instruments: Dict[str, dict],
        *,
        ws_url: str = "wss://data.infoway.io/ws",
        business: str = "common",
        channel: str = "depth",
    ):
        self._token = token.strip()
        self._instruments = instruments
        self._ws_base = ws_url.rstrip("?&")
        self._business = business
        # Channel: "depth" gives true bid/ask via 10003/10005; "trade"
        # uses 10000/10002 and emits mid-only ticks (bid == ask == p).
        # Spread is layered downstream by spread_cache.widen() so trade
        # mode still produces a valid bid/ask after widening.
        self._channel = channel.lower() if channel else "depth"

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []
        self._last_msg_ts: float = 0.0

    # ─── Feed interface ──────────────────────────────────────────────────

    @property
    def current_prices(self) -> Dict[str, float]:
        return {}

    async def start(self) -> None:
        self._running = True
        if not self._token:
            logger.error("InfoWay token empty — refusing to start")
            return

        all_codes = sorted({_infoway_code_for(s) for s in self._instruments.keys()})
        if not all_codes:
            logger.error("InfoWayFeed: no instruments to subscribe to")
            return

        # Docs cap aggregate request rate at 60/min; per-symbol there's no
        # documented hard limit but 100/connection is a safe chunk size.
        CHUNK_SIZE = 100
        chunks = [all_codes[i:i + CHUNK_SIZE] for i in range(0, len(all_codes), CHUNK_SIZE)]
        logger.info(
            "InfoWay feed starting — %d symbols across %d connection(s), channel=%s",
            len(all_codes), len(chunks), self._channel,
        )
        for idx, codes in enumerate(chunks):
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket(idx, codes),
                    name=f"infoway-conn-{idx}",
                )
            )

        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        self._running = False
        for t in self._tasks:
            t.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("InfoWay feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ─── Internals ─────────────────────────────────────────────────────

    def _ws_url(self) -> str:
        q = urllib.parse.urlencode({"business": self._business, "apikey": self._token})
        return f"{self._ws_base}?{q}"

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            with contextlib.suppress(asyncio.QueueEmpty):
                self._tick_queue.get_nowait()
            self._tick_queue.put_nowait(tick)

    def _emit_depth(self, data: dict) -> None:
        """Parse a CMD_PUSH_DEPTH (10005) frame and enqueue best bid/ask.

        Schema:
            {"s":"EURUSD","t":<ms>,
             "a":[[ask_prices...], [ask_vols...]],
             "b":[[bid_prices...], [bid_vols...]]}
        """
        code = data.get("s")
        symbol = _platform_code_for(str(code or ""), self._instruments)
        if not symbol:
            return

        a = data.get("a") or []
        b = data.get("b") or []
        # InfoWay returns parallel arrays — prices in [0], volumes in [1].
        # Defensive against either shape variant.
        try:
            ask_prices = a[0] if a and isinstance(a[0], list) else a
            bid_prices = b[0] if b and isinstance(b[0], list) else b
            ask = float(ask_prices[0])
            bid = float(bid_prices[0])
        except (IndexError, TypeError, ValueError):
            return
        if bid <= 0 or ask <= 0 or ask < bid:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        bid_r = round(bid, decimals)
        ask_r = round(ask, decimals)
        timestamp = _ms_to_iso(data.get("t"))

        vol = 1
        try:
            ask_vols = a[1] if len(a) > 1 else []
            bid_vols = b[1] if len(b) > 1 else []
            v_a = int(float(ask_vols[0])) if ask_vols else 0
            v_b = int(float(bid_vols[0])) if bid_vols else 0
            if v_a + v_b > 0:
                vol = v_a + v_b
        except (IndexError, TypeError, ValueError):
            pass

        self._enqueue({
            "symbol": symbol,
            "bid": bid_r,
            "ask": ask_r,
            "timestamp": timestamp,
            "volume": vol,
        })

    def _emit_trade(self, data: dict) -> None:
        """Parse a CMD_PUSH_TRADE (10002) frame.

        Schema: {"s":"EURUSD","p":"1.08456","t":<ms>,"td":1,
                 "v":"250000","vw":"271141.25"}

        Trade channel emits mid-only ticks; spread is layered downstream
        by spread_cache.widen() the same way it is for AllTick trade mode.
        """
        code = data.get("s")
        symbol = _platform_code_for(str(code or ""), self._instruments)
        if not symbol:
            return

        try:
            price = float(data.get("p"))
        except (TypeError, ValueError):
            return
        if price <= 0:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        mid = round(price, decimals)
        timestamp = _ms_to_iso(data.get("t"))

        vol = 1
        try:
            v = int(float(data.get("v") or 0))
            if v > 0:
                vol = v
        except (TypeError, ValueError):
            pass

        self._enqueue({
            "symbol": symbol,
            "bid": mid,
            "ask": mid,
            "timestamp": timestamp,
            "volume": vol,
        })

    async def _heartbeat_loop(self, ws) -> None:
        # Server closes at 60s of silence — send every 25s as a margin.
        while self._running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SEC)
            except asyncio.CancelledError:
                return
            if not self._running:
                return
            try:
                await ws.send(json.dumps({
                    "code": CMD_HEARTBEAT,
                    "trace": _trace(),
                }))
            except Exception as exc:
                logger.debug("InfoWay heartbeat send failed: %s", exc)
                return

    async def _run_socket(self, conn_idx: int, codes: List[str]) -> None:
        url = self._ws_url()
        # InfoWay accepts a comma-separated list under `codes` (string).
        codes_csv = ",".join(codes)
        sub_cmd = CMD_SUB_DEPTH if self._channel == "depth" else CMD_SUB_TRADE
        backoff = RECONNECT_BACKOFF_BASE

        while self._running:
            hb_task: Optional[asyncio.Task] = None
            try:
                logger.info("InfoWay [conn-%d] connecting…", conn_idx)
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=25,
                    close_timeout=10,
                    max_size=4 * 1024 * 1024,
                ) as ws:
                    sub_payload = {
                        "code": sub_cmd,
                        "trace": _trace(),
                        "data": {"codes": codes_csv},
                    }
                    await ws.send(json.dumps(sub_payload))
                    logger.info(
                        "InfoWay [conn-%d] subscribed %s (%d symbols)",
                        conn_idx,
                        "orderbook depth" if sub_cmd == CMD_SUB_DEPTH else "trade ticks",
                        len(codes),
                    )
                    backoff = RECONNECT_BACKOFF_BASE

                    hb_task = asyncio.create_task(
                        self._heartbeat_loop(ws),
                        name=f"infoway-hb-{conn_idx}",
                    )

                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            logger.warning(
                                "InfoWay [conn-%d] non-JSON frame: %r",
                                conn_idx,
                                raw[:200] if isinstance(raw, (str, bytes)) else raw,
                            )
                            continue
                        c = msg.get("code")
                        if c == CMD_PUSH_DEPTH:
                            self._emit_depth(msg.get("data") or {})
                        elif c == CMD_PUSH_TRADE:
                            self._emit_trade(msg.get("data") or {})
                        elif c == CMD_HEARTBEAT:
                            continue
                        else:
                            payload = json.dumps(msg)[:1000]
                            logger.info(
                                "InfoWay [conn-%d] non-tick frame code=%s body=%s",
                                conn_idx, c, payload,
                            )
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "InfoWay [conn-%d] WebSocket error: %s — reconnect in %.1fs",
                    conn_idx, exc, backoff,
                )
                try:
                    await asyncio.sleep(backoff)
                except asyncio.CancelledError:
                    break
                backoff = min(backoff * 2.0, RECONNECT_BACKOFF_MAX)
            finally:
                if hb_task:
                    hb_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await hb_task

        logger.info("InfoWay [conn-%d] task ended", conn_idx)
