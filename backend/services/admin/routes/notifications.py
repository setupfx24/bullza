"""Admin Notification Center.

Single endpoint that aggregates the actionable items currently sitting
in the admin's queue — pending deposits / withdrawals / KYC submissions,
open support tickets, pending dual-approval requests, and the count of
new sign-ups in the last 24h. The admin top bar polls this every ~30s
and surfaces a bell + badge so admins can see at a glance what needs
attention without paging through every section of the dashboard.

Each item carries the deep-link the bell dropdown should navigate to,
so adding a new category is a one-line server change — no frontend
update needed unless the link target itself is new.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import (
    Deposit, SupportTicket, User, Withdrawal,
)
from dependencies import get_current_admin

router = APIRouter(prefix="/notifications", tags=["Admin Notifications"])


@router.get("/summary")
async def notifications_summary(
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Counts of actionable admin queue items.

    Returns:
        total: int — sum of all counts (used for the header bell badge)
        items: list[{ kind, count, label, link, severity }]
            severity: 'critical' for items the platform shouldn't sit on
                      (withdrawals, approvals); 'normal' for routine queue.
    """
    pending_deposits_q = await db.execute(
        select(func.count(Deposit.id)).where(Deposit.status == "pending")
    )
    pending_deposits = int(pending_deposits_q.scalar() or 0)

    pending_withdrawals_q = await db.execute(
        select(func.count(Withdrawal.id)).where(Withdrawal.status == "pending")
    )
    pending_withdrawals = int(pending_withdrawals_q.scalar() or 0)

    # KYC submissions waiting for review. State machine: pending → submitted
    # (user uploaded docs) → approved / rejected. We surface 'submitted'.
    pending_kyc_q = await db.execute(
        select(func.count(User.id)).where(User.kyc_status == "submitted")
    )
    pending_kyc = int(pending_kyc_q.scalar() or 0)

    open_tickets_q = await db.execute(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.status.in_(("open", "pending"))
        )
    )
    open_tickets = int(open_tickets_q.scalar() or 0)

    # Dual-approval queue. The other admin (not the requester) sees these.
    # Filtering out approvals the *current* admin requested themselves
    # because the rules already block self-approval; surfacing them in the
    # bell would just be noise.
    approval_q = await db.execute(
        text(
            """
            SELECT COUNT(*) FROM admin_approval_requests
            WHERE status = 'pending' AND requested_by <> :me
            """
        ),
        {"me": str(admin.id)},
    )
    pending_approvals = int(approval_q.scalar() or 0)

    # New users in the last 24 hours — informational, not action-required,
    # but useful for admins to spot abnormal sign-up spikes.
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    new_users_q = await db.execute(
        select(func.count(User.id)).where(User.created_at >= since_24h)
    )
    new_users_24h = int(new_users_q.scalar() or 0)

    # `link` values are admin-frontend route paths. Withdrawals share the
    # /deposits page (tab=withdrawals); approvals get their own page; the
    # rest map 1:1 to existing routes.
    items = [
        {"kind": "withdrawals", "count": pending_withdrawals,
         "label": "Pending withdrawals", "link": "/deposits?tab=withdrawals", "severity": "critical"},
        {"kind": "approvals",   "count": pending_approvals,
         "label": "Approval requests", "link": "/approvals", "severity": "critical"},
        {"kind": "deposits",    "count": pending_deposits,
         "label": "Pending deposits", "link": "/deposits", "severity": "normal"},
        {"kind": "kyc",         "count": pending_kyc,
         "label": "KYC submissions", "link": "/kyc", "severity": "normal"},
        {"kind": "tickets",     "count": open_tickets,
         "label": "Open support tickets", "link": "/support", "severity": "normal"},
        {"kind": "new_users",   "count": new_users_24h,
         "label": "New users (24h)", "link": "/users", "severity": "info"},
    ]
    # The badge counts only critical + normal; "info" items (new sign-ups)
    # don't pulse the bell — they're context, not a queue.
    total = sum(i["count"] for i in items if i["severity"] in ("critical", "normal"))
    return {"total": total, "items": items}
