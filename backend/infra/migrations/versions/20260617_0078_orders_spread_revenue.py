"""Add orders.spread_revenue (client 2026-06-16).

Broker's gross spread revenue per filled trade, in USD — surfaced as its own
line (separate from commission) in the admin Finance Overview. Captured at
fill time in trading_service.place_order. Idempotent.

Revision ID: 0078
Revises: 0077
"""
from alembic import op


revision = "0078"
down_revision = "0077"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS spread_revenue NUMERIC(18,8) DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS spread_revenue")
