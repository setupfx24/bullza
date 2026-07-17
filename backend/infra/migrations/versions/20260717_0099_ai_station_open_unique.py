"""AI Station — make the per-trade id (external_id) reusable across open/close.

The v0098 unique index blocked an id forever once used. With the "unique id per
trade" model we want: at most ONE OPEN signal per id at a time, but the same id
can be reused for a NEW trade after the previous one closed. So the uniqueness
is scoped to status='open'.

Revision ID: 0099
Revises: 0098
"""
from alembic import op


revision = "0099"
down_revision = "0098"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_ai_signals_external;")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_signals_external_open
        ON ai_station_signals (external_id)
        WHERE external_id IS NOT NULL AND status = 'open';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_ai_signals_external_open;")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_signals_external
        ON ai_station_signals (external_id) WHERE external_id IS NOT NULL;
    """)
