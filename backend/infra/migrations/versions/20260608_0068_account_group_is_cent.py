"""Add is_cent_account flag to account_groups.

Client request 2026-06-08: the "Cent" account type was just a label in
the seed data; the platform treated it identically to Standard. A real
cent account displays balances + P&L in cents (¢) at 1 USD = 100 ¢ so
beginners feel like they're trading meaningful amounts.

Approach: storage stays in USD across the whole stack (trading engine,
margin, ledger, reports). The flag is a DISPLAY hint the frontend reads
to multiply visible amounts by 100 and swap the $ symbol for ¢. Keeps
the engine math single-currency and avoids leaking cent semantics into
positions / orders / transactions.

Revision ID: 0068
Revises: 0067
"""
from alembic import op
import sqlalchemy as sa


revision = "0068"
down_revision = "0067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "account_groups",
        sa.Column(
            "is_cent_account",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Flip the seed "Cent" row so existing databases get the flag set
    # without admin re-entry. Idempotent — UPDATE-by-name only matches
    # if the seed was used; custom Cent groups admin added later are
    # untouched and admin can flip them via the panel.
    op.execute(
        "UPDATE account_groups SET is_cent_account = TRUE "
        "WHERE LOWER(name) = 'cent'"
    )


def downgrade() -> None:
    op.drop_column("account_groups", "is_cent_account")
