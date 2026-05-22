"""Positions API — View, modify SL/TP, close & partial close (MT5-like)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import ClosePositionRequest, ModifyPositionRequest
from packages.common.src.auth import get_current_user
from ..services import trading_service

router = APIRouter()


@router.get("/")
async def list_positions(
    account_id: UUID,
    status: str = "open",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.list_positions(
        account_id=account_id, user_id=current_user["user_id"],
        status=status, db=db,
    )


@router.put("/{position_id}")
async def modify_position(
    position_id: UUID,
    req: ModifyPositionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.modify_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/{position_id}/close")
async def close_position(
    position_id: UUID,
    req: ClosePositionRequest = ClosePositionRequest(),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trading_service.close_position(
        position_id=position_id, req=req,
        user_id=current_user["user_id"], db=db,
    )


class BulkCloseRequest(BaseModel):
    """Body for POST /positions/close-all. `filter` controls which open
    positions on the account are closed. `symbols` is consulted only
    when filter='symbol'."""
    account_id: UUID
    filter: str = Field(default="all", pattern="^(all|profit|loss|symbol)$")
    symbols: list[str] | None = None


@router.post("/close-all")
async def close_all_positions(
    req: BulkCloseRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sequentially close all (or a filtered subset of) open positions on
    the account in a single request. Replaces the trader UI's prior
    fan-out of N parallel POST /close calls that race-conditioned on the
    shared trading_account row."""
    return await trading_service.bulk_close_positions(
        account_id=req.account_id,
        user_id=current_user["user_id"],
        filter_type=req.filter,
        symbols=req.symbols,
        db=db,
    )
