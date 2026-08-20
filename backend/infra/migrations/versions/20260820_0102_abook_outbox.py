"""A-Book LP forwarding outbox.

Trade events for book_type='A' users were forwarded to Corecen with
fire-and-forget asyncio tasks — a Corecen 5xx, a network blip, or a
process restart silently dropped the hedge leg. Outbox rows are written
in the same transaction as the trade mutation and delivered with
retry/backoff by the gateway's abook_outbox_engine.

Revision ID: 0102
Revises: 0101
"""
from alembic import op

revision = "0102"
down_revision = "0101"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS abook_outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            kind VARCHAR(10) NOT NULL,
            position_id UUID NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            status VARCHAR(12) NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_error TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            sent_at TIMESTAMPTZ
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_abook_outbox_position_id ON abook_outbox (position_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_abook_outbox_due ON abook_outbox (status, next_attempt_at);"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS abook_outbox;")
