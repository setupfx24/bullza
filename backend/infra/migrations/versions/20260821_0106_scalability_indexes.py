"""Indexes for two columns queried once PER ROW in hot loops.

Scalability review 2026-08-21. Index coverage on the trading tables is
otherwise good (0036 + 0087); these two gaps sit inside per-row loops, so
each missing index costs a full sequential scan per position/notification.

1. copy_trades.investor_position_id
   The only index on the table is the partial unique
   (master_position_id, investor_allocation_id) WHERE status='open' from
   migration 0010. But three hot paths filter on investor_position_id:
     - trading_service.list_positions  — once per open position, and the
       terminal polls that endpoint every 1.5s per trader
     - trading_service.bulk_close_positions — once per candidate
     - portfolio_service trade history — once per trade
   Each was a seq scan of copy_trades, per row.

2. notifications.user_id
   The baseline migration creates the table with no indexes at all, yet
   both GET /notifications and /unread-count filter on user_id, and the
   bell polls unread-count every 15s per session. The table grows by a
   row per position close plus every margin call, so the scan gets
   steadily more expensive.
   The partial index serves the unread COUNT specifically, which is the
   query that actually runs on a timer.

Built CONCURRENTLY (never blocks writes on live tables) which cannot run
inside a transaction, hence autocommit_block(). IF NOT EXISTS keeps it
idempotent.

Revision ID: 0106
Revises: 0105
"""
from alembic import op


revision = "0106"
down_revision = "0105"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_copy_trades_investor_position "
            "ON copy_trades (investor_position_id);"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_user_created "
            "ON notifications (user_id, created_at DESC);"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_user_unread "
            "ON notifications (user_id) WHERE is_read = false;"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_user_unread;")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_user_created;")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_copy_trades_investor_position;")
