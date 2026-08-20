"""Admin broadcast — currently only the scheduled-maintenance notice.

Mass email goes out via the SMTP path used by every transactional email
(no special service). Sends are fire-and-forget so the admin gets a
response back as soon as the recipient list is materialized; deliveries
continue in the background. Failed individual sends are logged by
send_email itself but never roll back the admin call.

Endpoint requires the system_settings.write permission so a normal
support admin can't accidentally email the whole user base.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import User
from dependencies import require_permission, write_audit_log

router = APIRouter(prefix="/broadcast", tags=["Broadcast"])


async def _resolve_recipients(db: AsyncSession, audience: str) -> list:
    """Active, email-verified, non-demo users filtered by audience segment.

    Segments: all / verified (same base), funded_only, ib, pamm_mam,
    fixed_return."""
    from sqlalchemy import func
    # Promo + demo showcase users never receive admin broadcasts (client
    # 2026-07-16 — "promotional wale account ka kuch bhi admin me na show ho";
    # sending them mail is an admin-side action too).
    base = (await db.execute(
        select(User).where(
            User.status == "active", User.email_verified.is_(True),
            User.is_promotional.isnot(True), User.is_demo.isnot(True),
        )
    )).scalars().all()
    recipients = [
        u for u in base
        if u.email and "@" in u.email
        and not bool(getattr(u, "is_demo", False))
        and not bool(getattr(u, "is_promotional", False))
    ]

    if audience in ("all", "verified"):
        return recipients

    seg_ids: set = set()
    if audience == "funded_only":
        from packages.common.src.models import TradingAccount
        rows = (await db.execute(
            select(TradingAccount.user_id, func.coalesce(func.sum(TradingAccount.balance), 0))
            .where(TradingAccount.is_demo.is_(False), TradingAccount.is_active.is_(True))
            .group_by(TradingAccount.user_id)
        )).all()
        seg_ids = {uid for uid, total in rows if float(total or 0) > 0}
    elif audience == "ib":
        from packages.common.src.models import IBProfile
        rows = (await db.execute(select(IBProfile.user_id))).all()
        seg_ids = {r[0] for r in rows}
    elif audience == "pamm_mam":
        from packages.common.src.models import MasterAccount
        rows = (await db.execute(
            select(MasterAccount.user_id).where(MasterAccount.master_type.in_(["pamm", "mamm"]))
        )).all()
        seg_ids = {r[0] for r in rows}
    elif audience == "fixed_return":
        from packages.common.src.models import FixedReturnLock
        rows = (await db.execute(
            select(FixedReturnLock.user_id).where(FixedReturnLock.state.in_(["active", "early_pending"]))
        )).all()
        seg_ids = {r[0] for r in rows}

    return [u for u in recipients if u.id in seg_ids]


class AnnouncementIn(BaseModel):
    # Free-form announcement (NOT the maintenance template). The admin sets
    # the subject + heading + body, and the audience segment.
    subject: str = Field(..., min_length=3, max_length=160)
    heading: str = Field(..., min_length=3, max_length=160)
    message_html: str = Field(..., min_length=3, max_length=8000)
    intro: str | None = Field(None, max_length=300)
    cta_label: str | None = Field(None, max_length=40)
    cta_url: str | None = Field(None, max_length=400)
    audience: str = Field("all", pattern="^(all|verified|funded_only|ib|pamm_mam|fixed_return)$")
    throttle_per_100_ms: int = Field(500, ge=0, le=10_000)
    dry_run: bool = False


@router.post("/announce")
async def send_announcement(
    body: AnnouncementIn,
    request: Request,
    admin: User = Depends(require_permission("settings.update")),
    db: AsyncSession = Depends(get_db),
):
    """Email a custom announcement (any title/body) to a chosen audience
    segment — All / IB / PAMM-MAM / Fixed-return / funded."""
    try:
        from packages.common.src.smtp_mail import send_email, smtp_configured, fire_and_forget
        from packages.common.src.email_templates import render_layout
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email subsystem unavailable: {e}")
    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured")

    recipients = await _resolve_recipients(db, body.audience)

    if body.dry_run:
        return {"dry_run": True, "would_send_to": len(recipients), "sample_subject": body.subject}

    html = render_layout(
        title=body.heading,
        intro=body.intro or "",
        body_html=body.message_html,
        cta_label=body.cta_label or None,
        cta_url=body.cta_url or None,
    )
    sent_count = 0
    for idx, u in enumerate(recipients):
        fire_and_forget(send_email(u.email, body.subject, html, category="info"))
        sent_count += 1
        if body.throttle_per_100_ms and (idx + 1) % 100 == 0:
            import asyncio as _asyncio
            await _asyncio.sleep(body.throttle_per_100_ms / 1000.0)

    await write_audit_log(
        db, admin.id, "announcement_broadcast", "broadcast", None,
        new_values={"subject": body.subject, "audience": body.audience, "recipients": sent_count,
                    "fired_at": datetime.utcnow().isoformat()},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    return {"message": f"Announcement queued for {sent_count} user(s)", "recipients": sent_count}


class MaintenanceBroadcastIn(BaseModel):
    window_label: str = Field(..., min_length=4, max_length=120)
    expected_duration: str = Field(..., min_length=2, max_length=60)
    # Optional admin overrides for the email subject + the heading shown
    # inside the email. Blank → the default "Scheduled maintenance …".
    subject: str | None = Field(None, max_length=160)
    title: str | None = Field(None, max_length=160)
    impacted_services: list[str] = Field(default_factory=list)
    reason: str | None = Field(None, max_length=400)
    custom_message_html: str | None = Field(None, max_length=4000)
    # Filter: 'all' = every active verified user, 'verified' = same
    # filter we use for other broadcasts (placeholder for future
    # filters like 'funded_only').
    audience: str = Field("all", pattern="^(all|verified|funded_only)$")
    # Safety: small per-batch sleep so SMTP relays don't throttle us
    # when the user base is large. Caller can tune from the UI.
    throttle_per_100_ms: int = Field(500, ge=0, le=10_000)
    # When True the call simulates instead of sending — returns the
    # recipient count so the admin can sanity-check before firing.
    dry_run: bool = False


@router.post("/maintenance")
async def send_maintenance_broadcast(
    body: MaintenanceBroadcastIn,
    request: Request,
    admin: User = Depends(require_permission("settings.update")),
    db: AsyncSession = Depends(get_db),
):
    """Email every active verified user about an upcoming maintenance
    window. The send loop runs inline (not via a background engine) so
    an admin sees immediate failures rather than discovering nothing
    went out hours later from a queue dashboard nobody watches."""
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_maintenance_notice
        from packages.common.src.config import get_settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email subsystem unavailable: {e}")

    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured")

    q = select(User).where(
        # User state lives in `status` string column ("active"/"suspended"
        # /"closed"). No is_active boolean.
        User.status == "active",
        User.email_verified.is_(True),
        # Promo + demo showcase users excluded (client 2026-07-16).
        User.is_promotional.isnot(True), User.is_demo.isnot(True),
    )
    users = (await db.execute(q)).scalars().all()
    recipients = [
        u for u in users
        if u.email and "@" in u.email
        and not bool(getattr(u, "is_demo", False))
        and not bool(getattr(u, "is_promotional", False))
    ]

    if body.audience == "funded_only":
        # Lazy import to avoid a circular at module load.
        from sqlalchemy import func
        from packages.common.src.models import TradingAccount
        funded_ids: set = set()
        rows = (await db.execute(
            select(
                TradingAccount.user_id, func.coalesce(func.sum(TradingAccount.balance), 0),
            ).where(
                TradingAccount.is_demo.is_(False),
                TradingAccount.is_active.is_(True),
            ).group_by(TradingAccount.user_id)
        )).all()
        for uid, total in rows:
            if float(total or 0) > 0:
                funded_ids.add(uid)
        recipients = [u for u in recipients if u.id in funded_ids]

    if body.dry_run:
        return {
            "dry_run": True,
            "would_send_to": len(recipients),
            "sample_subject": (body.subject or "").strip() or f"Scheduled maintenance — {body.window_label}",
        }

    app_url = get_settings().TRADER_APP_URL
    sent_count = 0
    for idx, u in enumerate(recipients):
        try:
            subject, html, text = render_maintenance_notice(
                first_name=u.first_name,
                window_label=body.window_label,
                expected_duration=body.expected_duration,
                impacted_services=body.impacted_services,
                reason=body.reason,
                custom_message_html=body.custom_message_html,
                trader_app_url=app_url,
                subject_override=body.subject,
                title_override=body.title,
            )
        except Exception:
            continue
        # Maintenance broadcasts are a generic platform-wide notice — they
        # don't belong to any product category. info@ is the right alias.
        fire_and_forget(send_email(u.email, subject, html, text=text, category="info"))
        sent_count += 1
        # Per-100 throttle: SMTP relays (Hostinger / SES) flag bursts
        # over ~30/sec. The default 500ms per 100 mails ≈ 200 mails/sec
        # peak, well inside the safety envelope.
        if body.throttle_per_100_ms and (idx + 1) % 100 == 0:
            import asyncio as _asyncio
            await _asyncio.sleep(body.throttle_per_100_ms / 1000.0)

    await write_audit_log(
        db, admin.id, "maintenance_broadcast", "broadcast", None,
        new_values={
            "window_label": body.window_label,
            "expected_duration": body.expected_duration,
            "impacted_services": body.impacted_services,
            "audience": body.audience,
            "recipients": sent_count,
            "fired_at": datetime.utcnow().isoformat(),
        },
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return {
        "message": f"Maintenance notice queued for {sent_count} user(s)",
        "recipients": sent_count,
    }
