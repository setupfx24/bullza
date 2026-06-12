import uuid
from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import ModifyPositionRequest, ClosePositionRequest, CreateTradeRequest
from services import trade_service

router = APIRouter(prefix="/trades", tags=["Trades"])


def _date_bound(value: str | None, *, end_of_day: bool):
    """Parse YYYY-MM-DD → UTC datetime (start or end of day). None passes through."""
    if not value:
        return None
    try:
        d = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None
    return datetime.combine(d, time.max if end_of_day else time.min, tzinfo=timezone.utc)


@router.get("/positions")
async def list_positions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("open", alias="status"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    sort: str = Query("recent", description="recent | gainers | losers"),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_positions(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
        start_date=_date_bound(start_date, end_of_day=False),
        end_date=_date_bound(end_date, end_of_day=True),
        sort=sort,
    )


@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: str = Query("pending", alias="status"),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_orders(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.get("/history")
async def list_trade_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    sort: str = Query("recent", description="recent | gainers | losers"),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_trade_history(
        page=page, per_page=per_page, db=db,
        start_date=_date_bound(start_date, end_of_day=False),
        end_date=_date_bound(end_date, end_of_day=True),
        sort=sort,
    )


@router.put("/position/{position_id}/modify")
async def modify_position(
    position_id: uuid.UUID,
    body: ModifyPositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.modify")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.modify_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/position/{position_id}/close")
async def close_position(
    position_id: uuid.UUID,
    body: ClosePositionRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.close")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.close_position(
        position_id=position_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/instruments")
async def list_instruments(
    search: str = Query(None),
    admin: User = Depends(require_permission("trades.view")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.list_instruments(search=search, db=db)


@router.post("/create")
async def create_stealth_trade(
    body: CreateTradeRequest,
    request: Request,
    admin: User = Depends(require_permission("trades.create")),
    db: AsyncSession = Depends(get_db),
):
    return await trade_service.create_stealth_trade(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )
