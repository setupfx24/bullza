"""First-deposit-only bonus that is tradeable but not withdrawable.

Adds two columns on `users`:

  main_wallet_bonus      Numeric(18,8) NOT NULL DEFAULT 0
                         Separate from main_wallet_balance — holds bonus
                         credit auto-granted on the user's first approved
                         deposit. Withdrawals never see this column (the
                         main-wallet "available to withdraw" amount is
                         strictly main_wallet_balance).
  bonus_forfeited_at     TIMESTAMPTZ NULL
                         Stamped the first time admin approves any
                         withdrawal for this user. Once stamped, future
                         deposits no longer grant bonus and the existing
                         bonus has already been zeroed (see
                         approve_withdrawal flow).

Behaviour summary (enforced by application code, not the DB):
  - Auto-bonus on deposit fires only when the user has zero prior
    approved/auto_approved deposits AND bonus_forfeited_at IS NULL.
  - The credited amount lands in main_wallet_bonus.
  - When the user transfers from main wallet → a trading account, the
    entire main_wallet_bonus is swept to that account's `credit` so it
    contributes to equity / margin (tradeable).
  - Withdrawal validation (create + approve) reads main_wallet_balance
    only — bonus is invisible to the withdrawal calculation.
  - On the FIRST approved withdrawal: main_wallet_bonus → 0 AND every
    trading_account.credit for the user → 0, and bonus_forfeited_at is
    set so it never re-applies.

Revision ID: 0056
Revises: 0055
"""
from alembic import op
import sqlalchemy as sa


revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "main_wallet_bonus",
            sa.Numeric(18, 8),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "bonus_forfeited_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "bonus_forfeited_at")
    op.drop_column("users", "main_wallet_bonus")
