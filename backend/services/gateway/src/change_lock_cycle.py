"""Change an AI-Powered Staking lock's payout cycle AND reprice it in one step.

Why this exists (2026-07-14): changing only the cycle while keeping the old
rate_pct silently mis-prices the lock — a $30k Year lock (5.5%/mo) switched to
Month kept paying 5.5%/mo instead of the Month-column 2.5%/mo ($1,650 instead
of $750). rate_pct is a PER-MONTH percentage and the accrual/payout engines
compute purely from the stored field, so tenure and rate must always move
together. Use THIS script for future cycle-change requests — not a bare
UPDATE, and not promo_fix_lock_tenures.py (that one intentionally preserves
the flat promo rate and is only right for the seeded showcase accounts).

The new rate is resolved exactly like a fresh lock would be: via
fixed_return_service.get_config(user_id=...) — so a per-user override or an
active pre-launch offer is honoured automatically.

DRY-RUN by default; --execute to write.
    python -m services.gateway.src.change_lock_cycle \
        --email user@example.com --principal 30000 --tenure Month
    python -m services.gateway.src.change_lock_cycle \
        --email user@example.com --principal 30000 --tenure Month --execute

    --lock-id <uuid>   target one lock precisely (instead of --principal)
    --keep-rate        cycle change only, old rate preserved (promo locks)
"""
import argparse
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import FixedReturnLock, User
from services.gateway.src.services.fixed_return_service import (
    _add_months, _first_payout_date, _tenure_to_months, get_config,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("change-lock-cycle")

PAYOUT_DAY = 25  # matches prod fixed_return_payout_day_of_month


def _next_payout(locked_at: datetime, matures_at: datetime | None, cycle_months: int, now: datetime):
    if locked_at.tzinfo is None:
        locked_at = locked_at.replace(tzinfo=timezone.utc)
    np = _first_payout_date(locked_at, cycle_months, payout_day=PAYOUT_DAY)
    guard = 0
    while np <= now and guard < 600:
        np = _add_months(np, cycle_months)
        guard += 1
    if matures_at is not None:
        ma = matures_at if matures_at.tzinfo else matures_at.replace(tzinfo=timezone.utc)
        if np > ma:
            np = ma
    return np


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--tenure", required=True, help="Target cycle label, e.g. Month / Quarter / Year")
    parser.add_argument("--principal", type=Decimal, default=None,
                        help="Match the active lock with this principal")
    parser.add_argument("--lock-id", type=UUID, default=None,
                        help="Target exactly one lock by id (overrides --principal)")
    parser.add_argument("--keep-rate", action="store_true",
                        help="Only change the cycle; do NOT reprice (promo flat-rate locks)")
    parser.add_argument("--execute", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        user = (await db.execute(
            select(User).where(User.email == args.email)
        )).scalar_one_or_none()
        if user is None:
            logger.error("%s: user not found", args.email)
            return

        q = select(FixedReturnLock).where(
            FixedReturnLock.user_id == user.id,
            FixedReturnLock.state == "active",
        )
        if args.lock_id is not None:
            q = q.where(FixedReturnLock.id == args.lock_id)
        elif args.principal is not None:
            q = q.where(FixedReturnLock.principal == args.principal)
        locks = (await db.execute(q.order_by(FixedReturnLock.locked_at))).scalars().all()
        if not locks:
            logger.error("%s: no matching active locks", args.email)
            return
        if len(locks) > 1 and args.lock_id is None:
            logger.error(
                "%s: %d locks match — narrow with --lock-id (%s)",
                args.email, len(locks), ", ".join(str(l.id) for l in locks),
            )
            return
        lock = locks[0]

        # Resolve the target tenure + the sheet rate the same way a new lock
        # would (honours per-user override / pre-launch offer).
        cfg = await get_config(user_id=user.id, db=db)
        tenure = next(
            (t for t in cfg["tenures"] if t["label"].lower() == args.tenure.lower()), None,
        )
        if tenure is None:
            logger.error(
                "tenure %r not in the current sheet (%s)",
                args.tenure, ", ".join(t["label"] for t in cfg["tenures"]),
            )
            return
        tenure_idx = cfg["tenures"].index(tenure)
        principal = Decimal(str(lock.principal or 0))
        tier_idx = 0
        for i, tier in enumerate(cfg["tiers"]):
            if principal >= Decimal(str(tier["min_amount"])):
                tier_idx = i
        new_rate = Decimal(str(cfg["rate_matrix_pct"][tenure_idx][tier_idx]))

        cycle_months = _tenure_to_months(int(tenure["days"]))
        np = _next_payout(lock.locked_at, lock.matures_at, cycle_months, now)

        old_rate = Decimal(str(lock.rate_pct or 0))
        final_rate = old_rate if args.keep_rate else new_rate
        logger.info(
            "%s: $%s  %s(%sd) @ %s%%/mo  ->  %s(%sd) @ %s%%/mo   "
            "interest/month $%s -> $%s   next_payout %s -> %s%s",
            args.email, principal, lock.tenure_label, lock.tenure_days, old_rate,
            tenure["label"], tenure["days"], final_rate,
            (principal * old_rate / 100).quantize(Decimal("0.01")),
            (principal * final_rate / 100).quantize(Decimal("0.01")),
            lock.next_payout_at.date() if lock.next_payout_at else None, np.date(),
            "   [--keep-rate: NOT repriced]" if args.keep_rate else "",
        )
        if not args.keep_rate and lock.total_interest_paid and Decimal(str(lock.total_interest_paid)) > 0:
            logger.warning(
                "lock has already been paid $%s at the old rate — unpaid accrual "
                "since the last credit will be re-priced at the new rate",
                lock.total_interest_paid,
            )

        if args.execute:
            lock.tenure_label = tenure["label"]
            lock.tenure_days = int(tenure["days"])
            lock.rate_pct = final_rate
            lock.next_payout_at = np
            await db.commit()
            logger.info("COMMITTED.")
        else:
            logger.info("Dry-run only — re-run with --execute to write.")


if __name__ == "__main__":
    asyncio.run(main())
