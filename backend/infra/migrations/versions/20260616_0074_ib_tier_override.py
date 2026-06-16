"""Add ib_profiles.tier_override.

Client spec 2026-06-16: IB/Sub-IB commission tier is auto-resolved by
activation/deposit thresholds, but admin can manually override a specific
IB/sub-IB's tier. When set (Bronze/Silver/Gold/Platinum), the commission
engine uses that tier's per-lot rate; NULL = auto.

Revision ID: 0074
Revises: 0073
"""
from alembic import op


revision = "0074"
down_revision = "0073"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS tier_override VARCHAR(40)")


def downgrade() -> None:
    op.execute("ALTER TABLE ib_profiles DROP COLUMN IF EXISTS tier_override")
