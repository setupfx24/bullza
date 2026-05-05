"""Real-time bid/ask from AllTick WebSocket (depth/orderbook stream).

AllTick API spec (en.apis.alltick.co + alltick/alltick-realtime-...-websocket-api):
  • Forex / metals / crypto / commodities / index-CFD endpoint:
      wss://quote.alltick.co/quote-b-ws-api?token=<TOKEN>
  • Stocks endpoint (separate, not used here):
      wss://quote.alltick.co/quote-stock-b-ws-api?token=<TOKEN>
  • Subscribe (orderbook depth) — `cmd_id=22002`:
      {"cmd_id":22002,"seq_id":1,"trace":"<uuid>","data":{
        "symbol_list":[{"code":"EURUSD","depth_level":5}, ...]
      }}
  • Server-pushed depth tick — `cmd_id=22999`:
      {"cmd_id":22999,"data":{"code":"EURUSD","seq":"...","tick_time":"...",
        "bid_list":[{"price":"1.0823","volume":"0"}, ...],
        "ask_list":[{"price":"1.0825","volume":"0"}, ...]}}
  • Heartbeat — `cmd_id=22000` every 10s; server disconnects after 30s of silence.

Limits (Premium plan):
  • Up to 200 symbols per subscription, 3 concurrent connections.
  • 1 request per second within a connection.

This module exposes the same Feed interface as FeedSimulator / FeedSimulator:
  start() / stop() / get_tick() / current_prices  — so it slots straight into
  market-data/src/main.py without further wiring.
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

logger = logging.getLogger("market-data.alltick")

# ─── Endpoints ────────────────────────────────────────────────────────────
ALLTICK_FOREX_WS = "wss://quote.alltick.co/quote-b-ws-api"
ALLTICK_STOCK_WS = "wss://quote.alltick.co/quote-stock-b-ws-api"

# ─── Protocol IDs (per AllTick docs) ─────────────────────────────────────
CMD_HEARTBEAT = 22000
CMD_SUB_TRADES = 22004           # subscribe to last-trade ticks (price+volume)
CMD_SUB_ORDERBOOK = 22002        # subscribe to depth (best bid/ask we want)
CMD_PUSH_TRADE = 22998           # server push: trade tick
CMD_PUSH_ORDERBOOK = 22999       # server push: orderbook update

HEARTBEAT_INTERVAL_SEC = 10.0    # docs say disconnect after 30s of silence
SERVER_DISCONNECT_THRESHOLD = 30.0
RECONNECT_BACKOFF_BASE = 2.0
RECONNECT_BACKOFF_MAX = 60.0
DEPTH_LEVEL = 5                  # we only consume level 0; level 5 is fine


# ─── Symbol mapping ───────────────────────────────────────────────────────
# Platform symbol -> AllTick "code" used in subscribe payloads.
# Crypto on AllTick uses *USDT pairs; everything else is 1:1 with our DB
# symbols. If a customer plan exposes a symbol AllTick prices under a
# different code, add it here.
PLATFORM_TO_ALLTICK: Dict[str, str] = {
    # Crypto: our internal codes use *USD, AllTick streams *USDT
    "BTCUSD": "BTCUSDT",
    "ETHUSD": "ETHUSDT",
    "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT",
    "SOLUSD": "SOLUSDT",
    # Energies — sometimes listed under WTI / BRENT codes by AllTick; the
    # mapping is also accepted in reverse below.
    "USOIL": "USOIL",
    "UKOIL": "UKOIL",
}

# Reverse aliases — AllTick code received over the wire -> our platform symbol.
# Anything not here falls back to "treat the AllTick code as the platform code".
ALLTICK_TO_PLATFORM_ALIASES: Dict[str, str] = {
    "BTCUSDT": "BTCUSD",
    "ETHUSDT": "ETHUSD",
    "LTCUSDT": "LTCUSD",
    "XRPUSDT": "XRPUSD",
    "SOLUSDT": "SOLUSD",
    # Common WTI/Brent aliases AllTick may use
    "XTIUSD": "USOIL",
    "WTIUSD": "USOIL",
    "XBRUSD": "UKOIL",
    "BRENT":  "UKOIL",
}


def _trace() -> str:
    """AllTick wants a unique-ish trace string per outgoing message."""
    return secrets.token_hex(16)


def _alltick_code_for(symbol: str) -> str:
    """Wire code for a platform symbol."""
    return PLATFORM_TO_ALLTICK.get(symbol, symbol)


def _platform_code_for(alltick_code: str, instruments: Dict[str, dict]) -> Optional[str]:
    """Reverse-map a wire code to our internal symbol (None if unknown)."""
    raw = (alltick_code or "").strip().upper()
    if not raw:
        return None
    # Direct alias hit
    if raw in ALLTICK_TO_PLATFORM_ALIASES:
        plat = ALLTICK_TO_PLATFORM_ALIASES[raw]
        return plat if plat in instruments else None
    # Same-code identity (forex / metals / indices)
    if raw in instruments:
        return raw
    return None


def _parse_iso_ts(tick_time: object) -> str:
    """AllTick `tick_time` is a string of unix seconds (or sometimes ms).
    Normalise to RFC-3339 with millis like the rest of the platform expects."""
    try:
        if tick_time is None:
            raise ValueError("missing")
        s = str(tick_time).strip()
        if not s:
            raise ValueError("empty")
        v = int(s)
        # AllTick docs use seconds for tick_time. Some endpoints emit ms;
        # detect by magnitude — anything > 10^11 is ms.
        if v > 10_000_000_000:
            sec, ms = v // 1000, v % 1000
        else:
            sec, ms = v, 0
        dt = datetime.fromtimestamp(sec, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms:03d}Z"
    except (TypeError, ValueError):
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


class AllTickFeed:
    """Streams orderbook (best bid/ask) ticks from AllTick into the same
    queue contract that the rest of market-data expects."""

    def __init__(self, token: str, instruments: Dict[str, dict]):
        self._token = token.strip()
        self._instruments = instruments

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []
        self._last_msg_ts: float = 0.0
        self._seq_id = 0  # monotonically increasing client request id

    # ─── Feed interface (matches FeedSimulator / FeedSimulator) ──────────

    @property
    def current_prices(self) -> Dict[str, float]:
        return {}

    async def start(self) -> None:
        self._running = True
        if not self._token:
            logger.error("AllTick token empty — refusing to start")
            return

        # AllTick allows up to 200 symbols per subscription on Premium plans.
        # We chunk just in case the customer is on Basic (100) or Free (5);
        # the chunk size below is the conservative ceiling.
        all_codes = sorted({_alltick_code_for(s) for s in self._instruments.keys()})
        if not all_codes:
            logger.error("AllTickFeed: no instruments to subscribe to")
            return

        # Single connection covers everything except stocks (which we don't
        # carry). If the customer plan supports it, raise CHUNK_SIZE to 200.
        CHUNK_SIZE = 100
        chunks = [all_codes[i:i + CHUNK_SIZE] for i in range(0, len(all_codes), CHUNK_SIZE)]
        logger.info(
            "AllTick feed starting — %d symbols across %d connection(s)",
            len(all_codes), len(chunks),
        )
        for idx, codes in enumerate(chunks):
            self._tasks.append(
                asyncio.create_task(
                    self._run_socket(idx, codes),
                    name=f"alltick-conn-{idx}",
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
        logger.info("AllTick feed stopped")

    async def get_tick(self) -> Optional[dict]:
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ─── Internals ─────────────────────────────────────────────────────

    def _ws_url(self) -> str:
        q = urllib.parse.urlencode({"token": self._token})
        return f"{ALLTICK_FOREX_WS}?{q}"

    def _next_seq(self) -> int:
        self._seq_id += 1
        return self._seq_id

    def _enqueue(self, tick: dict) -> None:
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            # Drop oldest to keep up under burst.
            with contextlib.suppress(asyncio.QueueEmpty):
                self._tick_queue.get_nowait()
            self._tick_queue.put_nowait(tick)

    def _emit_orderbook(self, data: dict) -> None:
        """Parse a CMD_PUSH_ORDERBOOK (22999) payload and enqueue a tick.

        Kept as a fallback path in case AllTick ever streams orderbook
        depth for our asset class (currently they don't — see _run_socket
        which subscribes via CMD_SUB_TRADES instead). If 22999 frames
        arrive anyway, we treat them the same as orderbook would deliver.
        """
        code = data.get("code")
        symbol = _platform_code_for(str(code or ""), self._instruments)
        if not symbol:
            return

        bid_list = data.get("bid_list") or []
        ask_list = data.get("ask_list") or []
        if not bid_list or not ask_list:
            return
        try:
            bid = float(bid_list[0]["price"])
            ask = float(ask_list[0]["price"])
        except (KeyError, TypeError, ValueError, IndexError):
            return
        if bid <= 0 or ask <= 0 or ask < bid:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        mid = round((bid + ask) / 2.0, decimals)
        timestamp = _parse_iso_ts(data.get("tick_time"))

        vol = 1
        try:
            v_b = int(float(bid_list[0].get("volume") or 0))
            v_a = int(float(ask_list[0].get("volume") or 0))
            if v_b + v_a > 0:
                vol = v_b + v_a
        except (TypeError, ValueError):
            pass

        self._enqueue({
            "symbol": symbol,
            "bid": mid,
            "ask": mid,
            "timestamp": timestamp,
            "volume": vol,
        })

    def _emit_trade(self, data: dict) -> None:
        """Parse a CMD_PUSH_TRADE (22998) payload — the primary feed for
        forex / metals / crypto / CFDs on AllTick. Schema (per their docs):

            {"code": "EURUSD", "seq": "...", "tick_time": "1605509068",
             "price": "1.08234", "volume": "300", "trade_direction": 1}

        We use `price` as the mid — platform bid/ask spread is applied
        downstream by spread_cache.widen() in main.py. Same contract the
        FeedSimulator and orderbook path used.
        """
        code = data.get("code")
        symbol = _platform_code_for(str(code or ""), self._instruments)
        if not symbol:
            return  # not in our instruments dict

        try:
            price = float(data.get("price"))
        except (TypeError, ValueError):
            return
        if price <= 0:
            return

        info = self._instruments[symbol]
        decimals = int(info["decimals"])
        mid = round(price, decimals)
        timestamp = _parse_iso_ts(data.get("tick_time"))

        vol = 1
        try:
            v = int(float(data.get("volume") or 0))
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
        """Send cmd_id=22000 every 10s. AllTick disconnects after 30s of
        silence, so missing one heartbeat = recovery, missing three = boot."""
        while self._running:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SEC)
            except asyncio.CancelledError:
                return
            if not self._running:
                return
            try:
                await ws.send(json.dumps({
                    "cmd_id": CMD_HEARTBEAT,
                    "seq_id": self._next_seq(),
                    "trace": _trace(),
                    "data": {},
                }))
            except Exception as exc:
                logger.debug("AllTick heartbeat send failed: %s", exc)
                return

    async def _run_socket(self, conn_idx: int, codes: List[str]) -> None:
        """Long-lived connection: subscribe once, heartbeat, consume pushes,
        reconnect with capped exponential backoff on any failure.

        IMPORTANT: we subscribe with CMD_SUB_TRADES (22004) — the
        real-time tick-by-tick / last-price feed. AllTick's CMD_SUB_ORDERBOOK
        (22002) is also accepted on this token but does NOT push 22999
        frames for forex / metals / crypto / CFDs (it's stocks-oriented),
        which leaves the stream silent until the watchdog fires. 22004
        delivers a single `price` per tick (the last trade) which we use
        as the mid; platform spread is still applied downstream by
        spread_cache.widen() so admin spread config keeps working.
        """
        url = self._ws_url()
        # Trade-tick subscription needs only `code` per symbol (no depth_level).
        symbol_list = [{"code": c} for c in codes]
        backoff = RECONNECT_BACKOFF_BASE

        while self._running:
            hb_task: Optional[asyncio.Task] = None
            try:
                logger.info("AllTick [conn-%d] connecting…", conn_idx)
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=25,
                    close_timeout=10,
                    max_size=4 * 1024 * 1024,
                ) as ws:
                    sub_payload = {
                        "cmd_id": CMD_SUB_TRADES,
                        "seq_id": self._next_seq(),
                        "trace": _trace(),
                        "data": {"symbol_list": symbol_list},
                    }
                    await ws.send(json.dumps(sub_payload))
                    logger.info(
                        "AllTick [conn-%d] subscribed trade ticks for %d symbols",
                        conn_idx, len(codes),
                    )
                    backoff = RECONNECT_BACKOFF_BASE

                    hb_task = asyncio.create_task(
                        self._heartbeat_loop(ws),
                        name=f"alltick-hb-{conn_idx}",
                    )

                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            msg = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            logger.warning(
                                "AllTick [conn-%d] non-JSON frame: %r",
                                conn_idx,
                                raw[:200] if isinstance(raw, (str, bytes)) else raw,
                            )
                            continue
                        cmd = msg.get("cmd_id")
                        if cmd == CMD_PUSH_TRADE:
                            self._emit_trade(msg.get("data") or {})
                        elif cmd == CMD_PUSH_ORDERBOOK:
                            # Defensive — AllTick may also push orderbook
                            # if a different sub is added later. Same shape
                            # handler as before.
                            self._emit_orderbook(msg.get("data") or {})
                        elif cmd == CMD_HEARTBEAT:
                            continue
                        else:
                            # Anything we didn't ask for — log raw so we can
                            # decode AllTick's actual subscribe ACK / error /
                            # symbol-rejection response. Truncated to 1KB to
                            # keep logs sane. Remove this verbose block once
                            # the symbol-code map is confirmed.
                            payload = json.dumps(msg)[:1000]
                            logger.info(
                                "AllTick [conn-%d] non-tick frame cmd_id=%s body=%s",
                                conn_idx, cmd, payload,
                            )
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning(
                    "AllTick [conn-%d] WebSocket error: %s — reconnect in %.1fs",
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

        logger.info("AllTick [conn-%d] task ended", conn_idx)
