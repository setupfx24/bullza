"""Admin action audit trail (audit_logs) — READ ONLY.

Mounted at /admin-audit-logs to avoid colliding with /audit-logs, which
already serves TRADER activity (user_audit_logs). Gated on the existing
`audit_logs.view` permission.

No POST/PUT/PATCH/DELETE routes exist here by design: the trail is
append-only, written solely by dependencies.write_audit_log().
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import admin_audit_log_service

router = APIRouter(prefix="/admin-audit-logs", tags=["Admin audit logs"])


@router.get("")
async def list_admin_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    admin_id: uuid.UUID | None = Query(None, description="Filter by the admin who acted"),
    action: str | None = Query(None, description="Substring match on the action verb"),
    entity_type: str | None = Query(None, description="Module, e.g. user / deposit / spread_config"),
    entity_id: uuid.UUID | None = Query(None, description="Trace one record's full history"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    return await admin_audit_log_service.list_admin_audit_logs(
        page=page, per_page=per_page, admin_id=admin_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        date_from=date_from, date_to=date_to, db=db,
    )


@router.get("/filters")
async def audit_log_filters(
    admin: User = Depends(require_permission("audit_logs.view")),
    db: AsyncSession = Depends(get_db),
):
    """Distinct modules + admins present in the trail, for filter dropdowns."""
    return await admin_audit_log_service.audit_log_filter_options(db=db)
