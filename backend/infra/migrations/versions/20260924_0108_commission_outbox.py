"""IB commission distribution outbox.

Commission was distributed from a fire-and-forget asyncio task spawned AFTER
the order transaction committed. A restart or an unhandled error between the
commit and the task finishing dropped the payout silently — trade booked,
partner unpaid, nothing to reconcile against. Same failure the A-Book hedge
had before abook_outbox (0102).

order_id is UNIQUE so the enqueue is idempotent and a retry can never create
a second claim on one fill.

Revision ID: 0108
Revises: 0107
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0108"
down_revision = "0107"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "commission_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Not an FK: the order may be archived while the row is still retrying.
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("trader_user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("lots", sa.Numeric(18, 8), nullable=False),
        sa.Column("instrument_symbol", sa.String(20), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_commission_outbox_due", "commission_outbox", ["status", "next_attempt_at"])

    # Backstop for the payout path itself: even outside the outbox, one order
    # must never produce two commission rows for the same IB at the same level.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_ib_commissions_trade_ib_level "
        "ON ib_commissions (source_trade_id, ib_id, mlm_level) "
        "WHERE source_trade_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_ib_commissions_trade_ib_level")
    op.drop_index("ix_commission_outbox_due", table_name="commission_outbox")
    op.drop_table("commission_outbox")
