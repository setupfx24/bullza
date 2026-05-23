"""Drop the legacy CHECK constraint on bonus_offers.bonus_type.

The original schema (init-db.sql + migration 0001 baseline) restricted
bonus_type to {'deposit', 'welcome', 'volume', 'custom'}. The admin
UI added today sends new amount-method labels (`percentage`, `fixed`,
`no_deposit`) which the legacy CHECK rejects with
CheckViolationError → admin sees a 500 on every "Create Bonus Tier"
attempt.

bonus_type is now treated as a free-form label (categorisation only —
the auto-apply engine's behavioural filter is widened in code to
include the new values). Dropping the CHECK is the right move; trying
to maintain an enum here would break every future tier-type the
client wants to add.

The constraint name follows Postgres' default `<table>_<column>_check`
convention. We DROP IF EXISTS for safety on environments that may have
already had it manually removed.

Revision ID: 0057
Revises: 0056
"""
from alembic import op


revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE bonus_offers "
        "DROP CONSTRAINT IF EXISTS bonus_offers_bonus_type_check;"
    )


def downgrade() -> None:
    # Re-apply the original constraint. Existing rows whose bonus_type
    # falls outside the legacy set will block the downgrade — that's
    # the expected behaviour; admin must clean those rows first.
    op.execute(
        "ALTER TABLE bonus_offers "
        "ADD CONSTRAINT bonus_offers_bonus_type_check "
        "CHECK (bonus_type IS NULL OR bonus_type IN "
        "('deposit', 'welcome', 'volume', 'custom'));"
    )
