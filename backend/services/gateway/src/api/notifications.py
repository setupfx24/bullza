"""Notifications API — List, Mark Read, Unread Count, Device registration."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.auth import get_current_user
from packages.common.src.push import register_push_token
from ..services import notification_service

router = APIRouter()


class DeviceTokenIn(BaseModel):
    expo_token: str
    platform: str | None = None


@router.post("/devices")
async def register_device(
    body: DeviceTokenIn,
    current_user: dict = Depends(get_current_user),
):
    """Register this device's Expo push token so the user receives phone
    pushes (lock-screen notifications) for new in-app notifications."""
    await register_push_token(current_user["user_id"], body.expo_token)
    return {"status": "ok"}


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.list_notifications(
        user_id=current_user["user_id"], unread_only=unread_only,
        page=page, per_page=per_page, db=db,
    )


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.mark_as_read(
        user_id=current_user["user_id"], notification_id=notification_id, db=db,
    )


@router.put("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.mark_all_read(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/unread-count")
async def unread_count(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notification_service.unread_count(
        user_id=current_user["user_id"], db=db,
    )
