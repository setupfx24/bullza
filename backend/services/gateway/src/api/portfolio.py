"""Portfolio API — Holdings, PnL, performance analytics, trade export."""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from ..services import portfolio_service

router = APIRouter()


@router.get("/summary")
async def portfolio_summary(
    account_id: UUID = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await portfolio_service.portfolio_summary(
        user_id=current_user["user_id"], account_id=account_id, db=db,
    )


@router.get("/performance")
async def portfolio_performance(
    account_id: UUID = Query(None),
    period: str = Query("all", pattern="^(1m|3m|6m|1y|all|custom)$"),
    date_from: datetime = Query(None),
    date_to: datetime = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Equity curve + win-rate stats + monthly + symbol breakdowns.

    `period` accepts the legacy preset codes (1m / 3m / 6m / 1y / all) for
    backward compat, plus `custom` — when `custom` is sent, `date_from` /
    `date_to` (epoch or ISO) define the window. If only `date_from` is
    supplied with period=custom we treat `date_to` as 'now'.
    """
    return await portfolio_service.portfolio_performance(
        user_id=current_user["user_id"], account_id=account_id, period=period,
        date_from=date_from, date_to=date_to,
        db=db,
    )


@router.get("/trades")
async def trade_history(
    account_id: UUID = Query(None),
    symbol: str = Query(None),
    side: str = Query(None, pattern="^(buy|sell)$"),
    date_from: datetime = Query(None),
    date_to: datetime = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await portfolio_service.trade_history(
        user_id=current_user["user_id"], account_id=account_id,
        symbol=symbol, side=side, date_from=date_from, date_to=date_to,
        page=page, per_page=per_page, db=db,
    )


@router.get("/balance-history")
async def balance_history(
    account_id: UUID = Query(...),
    period: str = Query("7d", pattern="^(24h|7d|30d|90d|1y)$"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Time-bucketed balance series sourced from the transactions ledger.
    Powers the Balance Trend chart on the Trading Accounts page."""
    return await portfolio_service.balance_history(
        user_id=current_user["user_id"], account_id=account_id,
        period=period, db=db,
    )


@router.get("/export")
async def export_trades(
    account_id: UUID = Query(None),
    date_from: datetime = Query(None),
    date_to: datetime = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await portfolio_service.export_trades(
        user_id=current_user["user_id"], account_id=account_id,
        date_from=date_from, date_to=date_to, db=db,
    )
