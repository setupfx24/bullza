"""Commission outbox — durable queue for IB commission distribution.

IB commission used to be distributed from a fire-and-forget
`asyncio.create_task()` spawned AFTER the order transaction committed. A
process restart, a deploy, or an unhandled error between the commit and the
task finishing dropped the payout silently — the trade was booked, the
partner was never paid, and nothing reconciled it. Exactly the failure the
A-Book hedge had before `ABookOutbox` (migration 0102).

A row is written in the SAME transaction as the fill, so it commits (or
rolls back) atomically with the order. `commission_outbox_engine` drains it
with retry/backoff, so a payout can be delayed but never lost.

`order_id` is UNIQUE: the enqueue is idempotent, and a retry can never
create a second claim on the same fill.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class CommissionOutbox(Base):
    __tablename__ = "commission_outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Not an FK: the order may be archived while the row is still retrying.
    # UNIQUE — one payout claim per fill, enforced by the database rather
    # than by whoever remembers to check.
    order_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    trader_user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    lots = Column(Numeric(18, 8), nullable=False)
    instrument_symbol = Column(String(20), nullable=False)

    status = Column(String(12), nullable=False, default="pending")  # pending | sent | failed
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # The drainer's polling query: pending rows whose retry time has come.
        Index("ix_commission_outbox_due", "status", "next_attempt_at"),
    )
