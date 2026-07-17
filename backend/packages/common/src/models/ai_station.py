"""AI Station — TradingView / admin signals mirrored onto AI-Powered Staking
locks as DISPLAY-ONLY trades.

This subsystem is intentionally isolated from the money path:

  * It NEVER touches user balances, margin, or the real trading engine.
  * The existing fixed_return (AI-Powered Staking) payout logic is untouched —
    users still receive their guaranteed rate. These rows only feed a
    read-only "Portfolio" view of the trades an admin/TradingView ran on the
    pooled AI capital.

Two tables:

  AiStationSignal  — one "master" trade. Created either by a TradingView
                     webhook alert (source='tradingview') or by an admin
                     opening a trade manually at the current price
                     (source='admin'). Holds symbol/side/entry/SL/TP and the
                     close price once it is closed.

  AiStationTrade   — the per-lock DISPLAY copy of a signal. When a signal
                     opens, one row is fanned out to every active lock, with
                     lots resolved from the admin `ai_station_slabs` config
                     (principal range -> lot size). P&L here is display-only
                     and, for open trades, is (re)computed from the live tick
                     on read. Admin may edit any field on any row (open or
                     closed); the user side is strictly read-only.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Numeric, Integer, Boolean, Text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class AiStationSignal(Base):
    """A master AI-Station trade — the source that fans out to every lock."""
    __tablename__ = "ai_station_signals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 'tradingview' (webhook) | 'admin' (manual open at current price)
    source = Column(String(20), nullable=False, default="admin")
    symbol = Column(String(30), nullable=False)
    side = Column(String(10), nullable=False)              # 'buy' | 'sell'

    entry_price = Column(Numeric(18, 8), nullable=False)
    stop_loss = Column(Numeric(18, 8), nullable=True)
    take_profit = Column(Numeric(18, 8), nullable=True)
    close_price = Column(Numeric(18, 8), nullable=True)

    # 'open' | 'closed'
    status = Column(String(20), nullable=False, default="open")
    opened_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # How many lock display-copies this signal fanned out to.
    fanout_count = Column(Integer, nullable=False, default=0, server_default="0")

    # Idempotency key for TradingView (alert id / dedup token); NULL for manual.
    external_id = Column(String(120), nullable=True)
    # Original webhook JSON, kept verbatim for the admin signals log.
    raw = Column(JSONB, nullable=True)

    note = Column(Text, nullable=True)
    # Admin who created (manual) or last edited this signal.
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AiStationTrade(Base):
    """The per-lock, display-only copy of an AiStationSignal."""
    __tablename__ = "ai_station_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signal_id = Column(UUID(as_uuid=True), ForeignKey("ai_station_signals.id", ondelete="CASCADE"), nullable=False)
    lock_id = Column(UUID(as_uuid=True), ForeignKey("fixed_return_locks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Denormalised from the signal so the trades list / portfolio query is flat.
    symbol = Column(String(30), nullable=False)
    side = Column(String(10), nullable=False)
    # Display lots resolved from the admin slab for this lock's principal.
    lots = Column(Numeric(18, 4), nullable=False)

    entry_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8), nullable=True)
    stop_loss = Column(Numeric(18, 8), nullable=True)
    take_profit = Column(Numeric(18, 8), nullable=True)

    # Display P&L in USD. For open trades this is recomputed from the live tick
    # on read; the stored value is the last snapshot / the final realised value
    # on close. Admin may override it directly.
    pnl = Column(Numeric(18, 2), nullable=True)

    # 'open' | 'closed'
    status = Column(String(20), nullable=False, default="open")
    opened_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Set when an admin manually edited this row (so an edit is not silently
    # overwritten by a later live-P&L recompute).
    is_edited = Column(Boolean, nullable=False, default=False, server_default="false")

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One-directional relationships (do NOT back_populate — keeps the old
    # User / FixedReturnLock models untouched).
    signal = relationship("AiStationSignal", lazy="selectin")
    lock = relationship("FixedReturnLock", lazy="selectin")
    user = relationship("User", lazy="selectin")
