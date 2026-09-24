"""Commission outbox drainer — pays the IB chain durably.

`place_order` enqueues a CommissionOutbox row inside the order's own
transaction, so the payout claim commits atomically with the fill. This
engine drains those rows with retry/backoff.

Why it exists: commission used to run in a detached `asyncio.create_task()`
spawned AFTER the order committed. A restart or an unhandled error in that
window dropped the payout with only a log line behind it — the trade was
booked and the partner was never paid. Same failure mode the A-Book hedge
had before ABookOutbox, and the same fix.

Safety:
  * `order_id` is UNIQUE on the table, so one fill can never be claimed twice.
  * `distribute_ib_commission` bails when the order already has IBCommission
    rows, so even a partially-committed retry cannot double-pay.
  * Each row is claimed with SELECT ... FOR UPDATE SKIP LOCKED, so running
    several gateway workers is safe — and the leader lock keeps only one
    worker draining at a time anyway.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import CommissionOutbox
from packages.common.src.redis_client import acquire_leader_lock

logger = logging.getLogger("commission-outbox")

TICK_SEC = 5.0
BATCH = 50
MAX_ATTEMPTS = 12          # ~ exponential up to the 300s cap => hours of retries
BACKOFF_CAP_SEC = 300
LOCK_KEY = "engine:commission_outbox:lock"


class CommissionOutboxEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Commission outbox engine started (tick=%ss, batch=%d)", TICK_SEC, BATCH)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Under --workers N only one worker should drain, else the same
                # row is attempted N times in parallel. Fails closed on a Redis
                # hiccup: skipping a tick is recoverable, double-paying is not.
                if await acquire_leader_lock(LOCK_KEY, 30):
                    await self._flush_batch()
            except Exception as exc:  # noqa: BLE001 — the loop must never die
                logger.error("commission outbox tick failed: %s", exc, exc_info=True)
            await asyncio.sleep(TICK_SEC)

    async def _flush_batch(self):
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            rows = (await db.execute(
                select(CommissionOutbox)
                .where(
                    CommissionOutbox.status == "pending",
                    CommissionOutbox.next_attempt_at <= now,
                )
                .order_by(CommissionOutbox.created_at)
                .limit(BATCH)
                .with_for_update(skip_locked=True)
            )).scalars().all()

            for row in rows:
                await self._pay_one(db, row)

            await db.commit()

    async def _pay_one(self, db, row: CommissionOutbox):
        # Local import: ib_engine imports models too, avoid an import cycle.
        from .ib_engine import distribute_ib_commission

        now = datetime.now(timezone.utc)
        try:
            await distribute_ib_commission(
                db, row.trader_user_id, row.order_id, row.lots, row.instrument_symbol,
            )
            row.status = "sent"
            row.sent_at = now
            row.last_error = None
            logger.info(
                "IB commission distributed for order %s (%s %s lots)",
                row.order_id, row.instrument_symbol, row.lots,
            )
        except Exception as exc:  # noqa: BLE001
            row.attempts = (row.attempts or 0) + 1
            row.last_error = str(exc)[:1000]
            if row.attempts >= MAX_ATTEMPTS:
                row.status = "failed"
                # Loud: this is money a partner is owed and will not receive
                # without someone looking at the row.
                logger.error(
                    "IB commission PERMANENTLY FAILED for order %s after %d attempts: %s",
                    row.order_id, row.attempts, exc,
                )
            else:
                backoff = min(2 ** row.attempts, BACKOFF_CAP_SEC)
                row.next_attempt_at = now + timedelta(seconds=backoff)
                logger.warning(
                    "IB commission attempt %d failed for order %s, retrying in %ss: %s",
                    row.attempts, row.order_id, backoff, exc,
                )


commission_outbox_engine = CommissionOutboxEngine()
