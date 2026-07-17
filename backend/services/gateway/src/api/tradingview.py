"""TradingView webhook -> AI Station display trades.

Public endpoint, secured by a shared secret in the URL path (TradingView alerts
can't send custom auth headers, so the secret lives in the webhook URL the admin
copies from the AI Station config page). Display-only: it never moves money.

Expected alert JSON (all fields optional unless noted):
    {
      "action": "buy" | "sell" | "close" | "exit" | "flat",
      "symbol": "EURUSD",            # required (or "ticker")
      "side":   "buy" | "sell",      # used when action == "open"
      "price":  1.10500,             # optional; live tick used if absent
      "sl":     1.10000,             # optional stop loss
      "tp":     1.11000,             # optional take profit
      "id":     "alert-123"          # optional dedup key / close selector
    }

A `buy`/`sell` action opens; `close`/`exit`/`flat` closes all open signals for the
symbol (or the one matching `id`).
"""
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src import ai_station_service as ai
from packages.common.src.models import AiStationSignal

router = APIRouter()
logger = logging.getLogger("tradingview-webhook")


@router.post("/{secret}")
async def tradingview_webhook(
    secret: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    cfg = await ai.get_config()
    configured = cfg.get("webhook_secret") or ""
    if not configured:
        raise HTTPException(status_code=403, detail="AI Station webhook not configured")
    if not hmac.compare_digest(str(secret), str(configured)):
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
    if not cfg.get("enabled"):
        return {"status": "disabled"}

    raw = await request.body()
    try:
        payload = json.loads(raw) if raw else {}
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be a JSON object")

    action = str(payload.get("action") or "").lower().strip()
    symbol = str(payload.get("symbol") or payload.get("ticker") or "").upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol required")
    ext = payload.get("id") or payload.get("alert_id")
    ext = str(ext) if ext not in (None, "") else None

    # ── CLOSE ──────────────────────────────────────────────────────────────
    if action in ("close", "exit", "flat", "sell_close", "buy_close"):
        close_id = payload.get("close_id") or payload.get("id")
        if close_id:
            q = select(AiStationSignal).where(
                AiStationSignal.status == "open",
                AiStationSignal.external_id == str(close_id),
            )
        else:
            q = select(AiStationSignal).where(
                AiStationSignal.status == "open",
                AiStationSignal.symbol == symbol,
            )
        sigs = list((await db.execute(q)).scalars().all())
        total = 0
        for s in sigs:
            total += await ai.close_signal(db, s, close_price=payload.get("price"))
        await db.commit()
        return {"status": "ok", "signals_closed": len(sigs), "trades_closed": total}

    # ── OPEN ───────────────────────────────────────────────────────────────
    side = action if action in ("buy", "sell") else str(payload.get("side") or "").lower().strip()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side must be 'buy' or 'sell'")

    # One OPEN trade per id at a time (unique-id-per-trade model). A retry or a
    # second open while the id is still open is a no-op; once the trade closes
    # the id is free to reuse for a new trade.
    if ext:
        dup = await db.execute(
            select(AiStationSignal.id).where(
                AiStationSignal.external_id == ext,
                AiStationSignal.status == "open",
            )
        )
        if dup.scalar_one_or_none():
            return {"status": "duplicate", "reason": "id already has an open trade"}

    try:
        sig = await ai.open_signal(
            db,
            source="tradingview",
            symbol=symbol,
            side=side,
            entry_price=payload.get("price"),
            stop_loss=payload.get("sl") or payload.get("stop_loss"),
            take_profit=payload.get("tp") or payload.get("take_profit"),
            external_id=ext,
            raw=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return {"status": "ok", "signal_id": str(sig.id), "fanout": sig.fanout_count}
