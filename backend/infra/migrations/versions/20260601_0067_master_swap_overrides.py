"""Per-master swap rate overrides on PAMM/MAM pool accounts.

Client request 2026-06-01: admin needs to set spread + charges + swap
per MAM/PAMM master independently of any account-type defaults.
spread_markup_pips + commission_per_lot_usd already exist (Mig 0050)
— this adds the matching swap columns so the same admin form can
configure all three.

Both columns nullable: NULL = fall through to the standard
swap_configs resolver (instrument / segment / default).
swap_long_pips: applied to BUY positions held overnight.
swap_short_pips: applied to SELL positions held overnight.

Revision ID: 0067
Revises: 0066
"""
from alembic import op
import sqlalchemy as sa


revision = "0067"
down_revision = "0066"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_accounts",
        sa.Column("swap_long_pips", sa.Numeric(10, 4), nullable=True),
    )
    op.add_column(
        "master_accounts",
        sa.Column("swap_short_pips", sa.Numeric(10, 4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("master_accounts", "swap_short_pips")
    op.drop_column("master_accounts", "swap_long_pips")
