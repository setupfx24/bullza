"""Hot-path partial indexes on positions/orders status.

The engine loops (b-book matching every 100ms, risk margin monitor and gateway
SL/TP every 1s) repeatedly query "open positions" and "pending orders". The
tables carry only their PK plus a partial index on positions(last_swap_at) —
nothing usable for `status='open'`/`status='pending'` or the `account_id`
lookups the risk loop does. Since closed positions are never deleted, these
queries degrade into full sequential scans over an ever-growing table.

Add partial indexes keyed on account_id and filtered to the live rows only, so
both the "all open/pending" scans and the per-account lookups use an index that
stays small (it only covers live rows). Non-concurrent CREATE so it runs inside
Alembic's migration transaction; the tables are small enough that the brief
lock during deploy is acceptable, and IF NOT EXISTS keeps it idempotent.

Revision ID: 0087
Revises: 0086
"""
from alembic import op


revision = "0087"
down_revision = "0086"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_positions_open_account
            ON positions (account_id) WHERE status = 'open';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_pending_account
            ON orders (account_id) WHERE status = 'pending';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_positions_open_account;")
    op.execute("DROP INDEX IF EXISTS ix_orders_pending_account;")
