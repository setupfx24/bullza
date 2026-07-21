"""Admin · AI Station — TradingView/manual display trades on AI-Powered Staking.

All endpoints gated on ``ai_station.manage`` — held by no employee role, so it is
super-admin-only but grantable per-employee via extra_permissions (same pattern
as fixed_return.manage). Display-only: nothing here moves money.
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User

from services import ai_station_service as svc

router = APIRouter(prefix="/ai-station", tags=["Admin · AI Station"])

PERM = "ai_station.manage"


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ── config ───────────────────────────────────────────────────────────────────

class UpdateConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    slabs: Optional[list[dict[str, Any]]] = None
    regenerate_secret: bool = False
    webhook_base: Optional[str] = None


@router.get("/config")
async def get_config(
    _admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await svc.get_config(db)


@router.put("/config")
async def update_config(
    body: UpdateConfigRequest,
    request: Request,
    admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await svc.update_config(
        db, admin_id=admin.id, ip_address=_ip(request),
        enabled=body.enabled, slabs=body.slabs,
        regenerate_secret=body.regenerate_secret, webhook_base=body.webhook_base,
    )


# ── manual open / close ──────────────────────────────────────────────────────

class ManualOpenRequest(BaseModel):
    symbol: str
    side: str  # 'buy' | 'sell'
    price: Optional[float] = None       # live tick used if absent
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    note: Optional[str] = Field(default=None, max_length=240)


@router.post("/open")
async def manual_open(
    body: ManualOpenRequest,
    request: Request,
    admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await svc.manual_open(
        db, admin_id=admin.id, ip_address=_ip(request),
        symbol=body.symbol, side=body.side, price=body.price,
        stop_loss=body.stop_loss, take_profit=body.take_profit, note=body.note,
    )


class CloseSignalRequest(BaseModel):
    close_price: Optional[float] = None


@router.post("/signals/{signal_id}/close")
async def close_signal(
    signal_id: UUID,
    body: CloseSignalRequest,
    request: Request,
    admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await svc.close_signal(
        db, admin_id=admin.id, ip_address=_ip(request),
        signal_id=signal_id, close_price=body.close_price,
    )


# ── lists ────────────────────────────────────────────────────────────────────

@router.get("/signals")
async def list_signals(
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    _admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await svc.list_signals(db, status=status, limit=limit, offset=offset)


@router.get("/trades")
async def list_trades(
    status: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    signal_id: Optional[UUID] = Query(None),
    limit: int = Query(200, le=1000),
    offset: int = Query(0, ge=0),
    _admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    return await svc.list_trades(
        db, status=status, user_id=user_id, signal_id=signal_id,
        limit=limit, offset=offset,
    )


# ── edit a single trade (open or closed) ─────────────────────────────────────

class EditTradeRequest(BaseModel):
    entry_price: Optional[float] = None
    close_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    lots: Optional[float] = None
    pnl: Optional[float] = None
    status: Optional[str] = None  # 'open' | 'closed'


@router.post("/trades/{trade_id}/close")
async def close_trade(
    trade_id: UUID,
    body: CloseSignalRequest,
    request: Request,
    admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Manually close ONE user's AI trade (not the whole signal)."""
    return await svc.close_trade(
        db, admin_id=admin.id, ip_address=_ip(request),
        trade_id=trade_id, close_price=body.close_price,
    )


@router.patch("/trades/{trade_id}")
async def edit_trade(
    trade_id: UUID,
    body: EditTradeRequest,
    request: Request,
    admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    # Only forward keys the caller actually set, so an omitted field is left
    # unchanged rather than nulled.
    fields = body.model_dump(exclude_unset=True)
    return await svc.edit_trade(
        db, admin_id=admin.id, ip_address=_ip(request),
        trade_id=trade_id, fields=fields,
    )


# ── P&L summary ──────────────────────────────────────────────────────────────

@router.get("/summary")
async def summary(
    _admin: User = Depends(require_permission(PERM)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await svc.summary(db)
