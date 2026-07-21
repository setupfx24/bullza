"""AI Station — trader READ-ONLY view of the display trades on their locks.

The user can only look. There is no open/edit/close here — those live in the
admin service. P&L for open trades is recomputed live from the tick on read.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import get_current_user
from packages.common.src.database import get_db
from packages.common.src import ai_station_service as ai
from packages.common.src.models import AiStationTrade, FixedReturnLock

router = APIRouter()


def _in_current_month(dt: Optional[datetime], now: datetime) -> bool:
    return dt is not None and dt.year == now.year and dt.month == now.month


def _summary(trades: list, items: list, principal: float = 0.0) -> dict:
    """Roll up counts + P&L. `items` are the serialized dicts (pnl already
    carries the live value for open trades); `trades` are the ORM rows (for
    timestamps). `principal` = the user's total active locked principal, used
    to express P&L as a % return."""
    now = datetime.now(timezone.utc)
    open_pnl = 0.0
    realized_month = 0.0
    realized_total = 0.0
    open_count = closed_count = today_count = monthly_trades = 0
    for tr, it in zip(trades, items):
        pnl = it.get("pnl") or 0.0
        if _in_current_month(tr.opened_at, now):
            monthly_trades += 1
            if tr.opened_at and tr.opened_at.date() == now.date():
                today_count += 1
        if tr.status == "open":
            open_count += 1
            open_pnl += pnl
        else:
            closed_count += 1
            realized_total += pnl
            if _in_current_month(tr.closed_at, now):
                realized_month += pnl

    monthly_pnl = realized_month + open_pnl
    total_pnl = realized_total + open_pnl

    def pct(v):
        return round(v / principal * 100, 2) if principal > 0 else 0.0

    return {
        "open_count": open_count,
        "closed_count": closed_count,
        "today_count": today_count,
        "monthly_trades": monthly_trades,
        "open_pnl": round(open_pnl, 2),
        "realized_pnl_month": round(realized_month, 2),
        "realized_pnl_total": round(realized_total, 2),
        # Headline figures the Portfolio + terminal show.
        "monthly_pnl": round(monthly_pnl, 2),
        "total_pnl": round(total_pnl, 2),
        "principal": round(principal, 2),
        "monthly_pnl_pct": pct(monthly_pnl),
        "total_pnl_pct": pct(total_pnl),
    }


@router.get("/my-trades")
async def my_trades(
    lock_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All AI-Station display trades belonging to the caller (optionally scoped
    to one lock / status), plus a P&L summary for the Portfolio header."""
    uid = current_user["user_id"]
    q = select(AiStationTrade).where(AiStationTrade.user_id == uid)
    if lock_id is not None:
        q = q.where(AiStationTrade.lock_id == lock_id)
    if status in ("open", "closed"):
        q = q.where(AiStationTrade.status == status)
    q = q.order_by(AiStationTrade.opened_at.desc())

    trades = list((await db.execute(q)).scalars().all())
    live = await ai.enrich_open_pnl(db, trades)
    items = [ai.serialize_trade(t, live_pnl=live.get(str(t.id))) for t in trades]

    # Current market price for OPEN trades (buy closes at bid, sell at ask) so
    # the UI can show a live "Now" price. One quote per distinct open symbol.
    open_syms = {t.symbol for t in trades if t.status == "open"}
    quotes = {}
    for sy in open_syms:
        quotes[sy] = await ai.live_quote(sy)
    for t, it in zip(trades, items):
        if t.status == "open":
            qv = quotes.get(t.symbol)
            if qv:
                bid, ask = qv
                it["current_price"] = float(bid if t.side == "buy" else ask)

    # The user's total active locked principal — for the % return figure.
    principal = float((await db.execute(
        select(func.coalesce(func.sum(FixedReturnLock.principal), 0))
        .where(FixedReturnLock.user_id == uid, FixedReturnLock.state == "active")
    )).scalar() or 0)

    return {"trades": items, "summary": _summary(trades, items, principal)}
