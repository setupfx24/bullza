"""Admin Audit Log Service — paginated listing of ADMIN actions (audit_logs).

Distinct from user_audit_log_service, which lists TRADER activity
(user_audit_logs: login/logout/orders). This one reads `audit_logs`, the
write-only trail produced by dependencies.write_audit_log() on every mutating
admin operation: who changed what, when, from which IP, and the old -> new
values for updates.

The table was being written from ~150 call sites but had no read API, so the
whole trail was invisible in the panel (only reachable via psql). This service
is the read side. There is deliberately NO create/update/delete here — the
trail is append-only.
"""
import logging
import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import select, func, or_, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import AuditLog, User

_log = logging.getLogger("uvicorn.error")


def _apply_filters(
    stmt,
    *,
    admin_id: uuid.UUID | None,
    action: str | None,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
):
    if admin_id:
        stmt = stmt.where(AuditLog.admin_id == admin_id)
    if action:
        # Actions are free-form strings written by each call site
        # (e.g. "user.add_fund", "kyc.approve"). Match as a prefix/substring so
        # "kyc" surfaces every KYC action without needing the exact verb.
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if date_from:
        stmt = stmt.where(
            AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        )
    if date_to:
        stmt = stmt.where(
            AuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        )
    return stmt


def _changed_fields(old: dict | None, new: dict | None) -> list[str]:
    """Keys whose value actually differs — lets the UI show 'what changed'
    without the reader diffing two JSON blobs by eye."""
    if not isinstance(old, dict) or not isinstance(new, dict):
        return []
    keys = set(old) | set(new)
    return sorted(k for k in keys if old.get(k) != new.get(k))


async def list_admin_audit_logs(
    *,
    page: int,
    per_page: int,
    admin_id: uuid.UUID | None,
    action: str | None,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
    db: AsyncSession,
) -> dict:
    filt = dict(
        admin_id=admin_id, action=action, entity_type=entity_type,
        entity_id=entity_id, date_from=date_from, date_to=date_to,
    )

    count_q = select(func.count()).select_from(
        _apply_filters(select(AuditLog.id), **filt).subquery()
    )
    total = (await db.execute(count_q)).scalar() or 0

    base = select(AuditLog, User).join(User, AuditLog.admin_id == User.id, isouter=True)
    base = _apply_filters(base, **filt)
    base = (
        base.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await db.execute(base)).all()

    items = []
    for log, admin in rows:
        old_v = log.old_values if isinstance(log.old_values, dict) else None
        new_v = log.new_values if isinstance(log.new_values, dict) else None
        items.append({
            "id": str(log.id),
            # admin_id is nulled when an admin account is deleted (FK
            # anonymisation in user_service.delete_user), so this can be None.
            "admin_id": str(log.admin_id) if log.admin_id else None,
            "admin_email": admin.email if admin else None,
            "admin_name": (
                f"{(admin.first_name or '').strip()} {(admin.last_name or '').strip()}".strip()
                or None
            ) if admin else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "old_values": old_v,
            "new_values": new_v,
            "changed_fields": _changed_fields(old_v, new_v),
            "ip_address": str(log.ip_address) if log.ip_address else None,
            "created_at": log.created_at,
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def audit_log_filter_options(db: AsyncSession) -> dict:
    """Distinct modules (entity_type) + admins who have entries, for the
    filter dropdowns — so the UI never hardcodes a taxonomy that drifts."""
    modules = [
        m for (m,) in (await db.execute(
            select(distinct(AuditLog.entity_type))
            .where(AuditLog.entity_type.is_not(None))
            .order_by(AuditLog.entity_type)
        )).all()
    ]

    admin_rows = (await db.execute(
        select(distinct(AuditLog.admin_id), User.email, User.first_name, User.last_name)
        .join(User, AuditLog.admin_id == User.id)
        .order_by(User.email)
    )).all()
    admins = [
        {
            "id": str(aid),
            "email": email,
            "name": f"{(fn or '').strip()} {(ln or '').strip()}".strip() or None,
        }
        for aid, email, fn, ln in admin_rows if aid
    ]

    return {"modules": modules, "admins": admins}
