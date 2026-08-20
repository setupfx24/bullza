"""A-Book outbox — durable queue for LP (Corecen) trade forwarding.

Trade events for book_type='A' users were previously forwarded with
fire-and-forget asyncio tasks: a Corecen 5xx, a network blip, or a
process restart silently dropped the hedge leg with only a log line left
behind. Outbox rows are written in the SAME transaction as the trade
mutation, and a gateway background engine (abook_outbox_engine) delivers
them with retry/backoff, so a hedge leg can be delayed but never lost.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from ..database import Base


class ABookOutbox(Base):
    __tablename__ = "abook_outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # open | close | update — selects the Corecen client call in the flusher.
    kind = Column(String(10), nullable=False)
    # Not an FK: the position may be deleted/archived while the row is retried.
    position_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # kwargs for the client call. Numeric values are stored as strings to
    # preserve Decimal precision across the JSONB round-trip; the flusher
    # rehydrates the fields each kind declares numeric.
    payload = Column(JSONB, nullable=False, default=dict)
    status = Column(String(12), nullable=False, default="pending")  # pending | sent | failed
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # The flusher's polling query: pending rows whose retry time has come.
        Index("ix_abook_outbox_due", "status", "next_attempt_at"),
    )
