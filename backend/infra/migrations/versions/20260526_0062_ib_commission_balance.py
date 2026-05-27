"""IB commission pool — accumulated earnings before transfer to main wallet.

Until now the IB engine credited the IB's trading-account.balance
directly on every distribution. Client request 2026-05-26: route
commissions into a separate `ib_commission_balance` on the IB's user
row instead, and let the IB explicitly Transfer the pool into their
main wallet before withdrawing — matches the referral-commission flow
we already shipped.

Schema add:

  users.ib_commission_balance  NUMERIC(18,8) NOT NULL DEFAULT 0
      Per-IB pool of accumulated trade commissions. Lives on the IB's
      User row. Increments inside distribute_ib_commission; drops to
      zero when the IB presses "Transfer to Main Wallet" on /business.

Revision ID: 0062
Revises: 0061
"""
from alembic import op
import sqlalchemy as sa


revision = "0062"
down_revision = "0061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "ib_commission_balance",
            sa.Numeric(18, 8),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "ib_commission_balance")
