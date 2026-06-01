"""MAM lot multiplier + bonus portion on investor allocation.

Client request 2026-06-01:
1. MAM investors should be able to set a DIRECT lot multiplier (e.g. 0.5
   = take half the master's lot every trade), independent of the existing
   percent-based volume scaling. We add ``lot_multiplier`` Numeric(10,4)
   nullable on ``investor_allocations``. NULL → fall back to
   ``allocation_pct`` (volume scaling) as before.
2. Bonus credit (``users.main_wallet_bonus``) should be investable into
   MAM/PAMM. We track how much of each allocation came from bonus in
   ``bonus_portion`` Numeric(18, 8) default 0 so the withdraw path can
   forfeit it (bonus is non-withdrawable per the existing welcome-bonus
   contract).

Revision ID: 0065
Revises: 0064
"""
from alembic import op
import sqlalchemy as sa


revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investor_allocations",
        sa.Column("lot_multiplier", sa.Numeric(10, 4), nullable=True),
    )
    op.add_column(
        "investor_allocations",
        sa.Column(
            "bonus_portion", sa.Numeric(18, 8),
            nullable=False, server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("investor_allocations", "bonus_portion")
    op.drop_column("investor_allocations", "lot_multiplier")
