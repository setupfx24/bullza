"""Per-master trade-cost overrides for PAMM / MAM pool accounts.

Client wants admin to set spread and commission individually per master
account (PAMM Alice 1.5-pip, PAMM Bob 0.5-pip, etc.) on top of the
global SpreadConfig / ChargeConfig that 0049 added.

Two new columns on master_accounts, both NULL = 'fall through to the
global resolver':

  spread_markup_pips      Numeric(10,5)  — additive pips on top of the
                                            resolved spread when the
                                            trade is on the master pool.
  commission_per_lot_usd  Numeric(10,5)  — overrides resolved commission
                                            with this flat USD-per-lot.

Distinct from performance_fee_pct / management_fee_pct / admin_commission_pct
which are profit-distribution fees applied after the trade closes. These
two columns are per-fill trade COSTS that hit the master's pool balance
at execution time.

Revision ID: 0050
Revises: 0049
"""
from alembic import op
import sqlalchemy as sa


revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_accounts",
        sa.Column("spread_markup_pips", sa.Numeric(10, 5), nullable=True),
    )
    op.add_column(
        "master_accounts",
        sa.Column("commission_per_lot_usd", sa.Numeric(10, 5), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("master_accounts", "commission_per_lot_usd")
    op.drop_column("master_accounts", "spread_markup_pips")
