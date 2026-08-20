"""A-Book outbox flusher — delivers queued LP forwards with retry/backoff.

Rows are enqueued by packages.common.src.abook.enqueue_abook_event inside
the same transaction as the trade mutation (gateway open/close/update,
b-book pending fills and SL/TP closes, risk-engine stop-outs). This
engine is the single sender: it polls due pending rows, calls the Corecen
client, and retries transient failures with exponential backoff, so a
hedge leg survives Corecen downtime and process restarts instead of being
dropped by a fire-and-forget task.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from packages.common.src import corecen_trade_client
from packages.common.src.abook import rehydrate_payload
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import ABookOutbox
from packages.common.src.redis_client import acquire_leader_lock

logger = logging.getLogger("gateway.abook_outbox")

POLL_INTERVAL = 2.0
BATCH_SIZE = 50
MAX_ATTEMPTS = 10
# Credentials absent is not a delivery failure — park rows with a long
# backoff so they flush once the LP integration is configured.
NOT_CONFIGURED_BACKOFF_SEC = 600

_DISPATCH = {
    "open": corecen_trade_client.forward_trade_open,
    "close": corecen_trade_client.forward_trade_close,
    "update": corecen_trade_client.forward_trade_update,
}


class ABookOutboxEngine:
    def __init__(self):
        self._running = False
        self._task = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("A-Book outbox engine started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("A-Book outbox engine stopped")

    async def _run(self):
        while self._running:
            try:
                # One worker flushes at a time (uvicorn --workers N).
                if await acquire_leader_lock("engine:abook_outbox:lock", 10):
                    await self._flush_batch()
            except asyncio.CancelledError:
                break
            except Exception as e:  # noqa: BLE001
                logger.error("A-Book outbox engine error: %s", e)
            await asyncio.sleep(POLL_INTERVAL)

    async def _flush_batch(self):
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            rows = (
                await db.execute(
                    select(ABookOutbox)
                    .where(
                        ABookOutbox.status == "pending",
                        ABookOutbox.next_attempt_at <= now,
                    )
                    .order_by(ABookOutbox.created_at)
                    .limit(BATCH_SIZE)
                    .with_for_update(skip_locked=True)
                )
            ).scalars().all()
            if not rows:
                return
            for row in rows:
                await self._send_one(row)
            await db.commit()

    async def _send_one(self, row: ABookOutbox):
        now = datetime.now(timezone.utc)
        sender = _DISPATCH.get(row.kind)
        if sender is None:
            row.status = "failed"
            row.last_error = f"unknown kind {row.kind!r}"
            logger.error("[A-BOOK] outbox row %s has unknown kind %r", row.id, row.kind)
            return
        # Private helper by design — the flusher is the one caller allowed
        # to peek: unconfigured credentials must park the row, not burn
        # retry attempts.
        if not corecen_trade_client._is_configured():
            row.next_attempt_at = now + timedelta(seconds=NOT_CONFIGURED_BACKOFF_SEC)
            row.last_error = "corecen_not_configured"
            return
        try:
            result = await sender(**rehydrate_payload(row.kind, dict(row.payload or {})))
            if isinstance(result, dict) and result.get("skipped"):
                # Config vanished between the check and the call — park.
                row.next_attempt_at = now + timedelta(seconds=NOT_CONFIGURED_BACKOFF_SEC)
                row.last_error = "corecen_not_configured"
                return
            if isinstance(result, dict) and result.get("error"):
                raise RuntimeError(str(result.get("detail") or result.get("status")))
            row.status = "sent"
            row.sent_at = now
            row.last_error = None
        except Exception as exc:  # noqa: BLE001
            row.attempts = (row.attempts or 0) + 1
            row.last_error = str(exc)[:1000]
            if row.attempts >= MAX_ATTEMPTS:
                row.status = "failed"
                logger.error(
                    "[A-BOOK] outbox row %s (kind=%s pos=%s) FAILED permanently after %d attempts: %s",
                    row.id, row.kind, row.position_id, row.attempts, exc,
                )
            else:
                backoff = min(2 ** row.attempts, 300)
                row.next_attempt_at = now + timedelta(seconds=backoff)
                logger.warning(
                    "[A-BOOK] outbox row %s attempt %d failed (%s) — retry in %ds",
                    row.id, row.attempts, exc, backoff,
                )


abook_outbox_engine = ABookOutboxEngine()
