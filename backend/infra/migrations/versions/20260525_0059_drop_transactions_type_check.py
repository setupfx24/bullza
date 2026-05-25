"""Drop the legacy CHECK constraint on transactions.type.

The original schema (init-db.sql baseline) restricted transactions.type
to a fixed enum that pre-dated trade insurance:
  'deposit', 'withdrawal', 'commission', 'swap', 'bonus', 'credit',
  'adjustment', 'ib_commission', 'profit', 'loss', 'transfer',
  'admin_commission', 'performance_fee', 'master_commission', 'refund'

Trade-insurance settlement records use `insurance_fee` (debit on
activation) and `insurance_payout` (credit on claim), neither of
which is in the legacy set — so every insurance activate hit a
CheckViolationError → 500 → trader saw "Insurance not activated:
Request failed".

Same treatment as 0057 (bonus_offers.bonus_type): drop the enum, let
the application layer own the vocabulary. Maintaining a hard enum
here would break every new transaction kind the engine adds.

Revision ID: 0059
Revises: 0058
"""
from alembic import op


revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE transactions "
        "DROP CONSTRAINT IF EXISTS transactions_type_check;"
    )


def downgrade() -> None:
    # Re-apply the legacy constraint. Any row whose type falls outside
    # the original set blocks the downgrade — operator must clean those
    # rows manually first (insurance_fee / insurance_payout / etc.).
    op.execute(
        "ALTER TABLE transactions "
        "ADD CONSTRAINT transactions_type_check "
        "CHECK (type IN ("
        "'deposit', 'withdrawal', 'commission', 'swap', 'bonus', "
        "'credit', 'adjustment', 'ib_commission', 'profit', 'loss', "
        "'transfer', 'admin_commission', 'performance_fee', "
        "'master_commission', 'refund'));"
    )
