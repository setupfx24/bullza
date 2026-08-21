"""Admin Notification Center.

Single endpoint that aggregates the actionable items currently sitting
in the admin's queue — pending deposits / withdrawals / KYC submissions,
open support tickets, and the count of
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
from dependencies import get_current_admin, resolve_employee_permissions

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
                      (withdrawals); 'normal' for routine queue.
    """
    # Promo/demo showcase users are hidden everywhere in admin — the bell
    # badge counts must match the (filtered) pages they link to, or the badge
    # says "3" and the page shows 0 (client 2026-07-16). One subquery, reused;
    # a raw-SQL twin (_hide_sql) for the text() counts further down.
    from sqlalchemy import or_ as _or
    _hide = select(User.id).where(_or(User.is_promotional == True, User.is_demo == True))  # noqa: E712
    _hide_sql = ("(SELECT id FROM users WHERE is_promotional IS TRUE OR is_demo IS TRUE)")

    pending_deposits_q = await db.execute(
        select(func.count(Deposit.id)).where(
            Deposit.status == "pending", Deposit.user_id.notin_(_hide)
        )
    )
    pending_deposits = int(pending_deposits_q.scalar() or 0)

    pending_withdrawals_q = await db.execute(
        select(func.count(Withdrawal.id)).where(
            Withdrawal.status == "pending", Withdrawal.user_id.notin_(_hide)
        )
    )
    pending_withdrawals = int(pending_withdrawals_q.scalar() or 0)

    # KYC submissions waiting for review. State machine: pending → submitted

    # New users in the last 24 hours — informational, not action-required,
    # but useful for admins to spot abnormal sign-up spikes.
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    new_users_q = await db.execute(
        select(func.count(User.id)).where(
            User.created_at >= since_24h,
            User.is_promotional.isnot(True), User.is_demo.isnot(True),
        )
    )
    new_users_24h = int(new_users_q.scalar() or 0)

    # RM funding requests awaiting an admin (pending proof, or approved but
    # not yet credited). Surfaced so admins get notified when an RM uploads.
    # Run last + in its own savepoint so a pre-migration missing table can't
    # poison the surrounding session.
    rm_pending = 0
    try:
        async with db.begin_nested():
            rm_pending_q = await db.execute(
                text("SELECT COUNT(*) FROM rm_funding_requests "
                     "WHERE status IN ('pending','approved') "
                     f"AND user_id NOT IN {_hide_sql}")
            )
            rm_pending = int(rm_pending_q.scalar() or 0)
    except Exception:
        rm_pending = 0

    # Trader-submitted "Request to RM" forms (mail-to-RM). Persisted in
    # rm_manual_requests; admins want a bell ping for each new one so they
    # don't rely on email alone. Split deposit vs withdraw so the admin knows
    # the type at a glance. Count only status='new' (unhandled). Own savepoint
    # so a pre-migration missing table can't poison the session.
    rm_manual_deposit = 0
    rm_manual_withdraw = 0
    try:
        async with db.begin_nested():
            rm_manual_rows = await db.execute(
                text(
                    "SELECT side, COUNT(*) FROM rm_manual_requests "
                    f"WHERE status = 'new' AND user_id NOT IN {_hide_sql} "
                    "GROUP BY side"
                )
            )
            for side_val, cnt in rm_manual_rows.all():
                if (side_val or "").lower() == "withdraw":
                    rm_manual_withdraw = int(cnt or 0)
                else:
                    rm_manual_deposit = int(cnt or 0)
    except Exception:
        rm_manual_deposit = 0
        rm_manual_withdraw = 0

    # Tasks assigned to THIS admin/employee that are still pending — their
    # personal work queue (client 2026-07-10: employees weren't pinged when a
    # manager assigned them a task). perm=None → shown to every role; the
    # count is scoped to the signed-in user so nobody sees anyone else's.
    my_tasks = 0
    try:
        async with db.begin_nested():
            my_tasks_q = await db.execute(
                text(
                    "SELECT COUNT(*) FROM employee_tasks "
                    "WHERE assigned_to = :me AND status = 'pending'"
                ),
                {"me": str(admin.id)},
            )
            my_tasks = int(my_tasks_q.scalar() or 0)
    except Exception:
        my_tasks = 0

    # `link` values are admin-frontend route paths. Withdrawals share the
    # /deposits page (tab=withdrawals); the
    # rest map 1:1 to existing routes.
    items = [
        {"kind": "my_tasks", "count": my_tasks, "perm": None,
         "label": "Tasks assigned to you", "link": "/tasks", "severity": "critical"},
        {"kind": "withdrawals", "count": pending_withdrawals, "perm": "withdrawals.view",
         "label": "Pending withdrawals", "link": "/deposits?tab=withdrawals", "severity": "critical"},
        {"kind": "rm_funding",  "count": rm_pending, "perm": "rm.manage",
         "label": "RM funding requests", "link": "/rm-requests", "severity": "critical"},
        {"kind": "rm_manual_deposit",  "count": rm_manual_deposit, "perm": "rm.manage",
         "label": "New RM deposit requests", "link": "/rm-manual-requests", "severity": "critical"},
        {"kind": "rm_manual_withdraw", "count": rm_manual_withdraw, "perm": "rm.manage",
         "label": "New RM withdrawal requests", "link": "/rm-manual-requests", "severity": "critical"},
        {"kind": "deposits",    "count": pending_deposits, "perm": "deposits.view",
         "label": "Pending deposits", "link": "/deposits", "severity": "normal"},
        {"kind": "kyc",         "count": pending_kyc, "perm": "kyc.view",
         "label": "KYC submissions", "link": "/kyc", "severity": "normal"},
        {"kind": "tickets",     "count": open_tickets, "perm": "tickets.view",
         "label": "Open support tickets", "link": "/support", "severity": "normal"},
        {"kind": "new_users",   "count": new_users_24h, "perm": "users.view",
         "label": "New users (24h)", "link": "/users", "severity": "info"},
    ]

    # Scope the bell to what THIS admin can actually act on. An employee
    # should only be pinged about their own area — a withdrawal_manager sees
    # withdrawals, a support agent sees tickets, etc. — not every queue in the
    # platform. super_admin ("*") keeps the full board.
    perms = await resolve_employee_permissions(admin, db)
    if "*" not in perms:
        # perm=None marks personal items (e.g. my_tasks) every role keeps.
        items = [i for i in items if i["perm"] is None or i["perm"] in perms]

    # Strip the internal `perm` key from the response (frontend doesn't need it).
    for i in items:
        i.pop("perm", None)

    # The badge counts only critical + normal; "info" items (new sign-ups)
    # don't pulse the bell — they're context, not a queue.
    total = sum(i["count"] for i in items if i["severity"] in ("critical", "normal"))
    return {"total": total, "items": items}
