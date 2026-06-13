"""Add promo_code + code_visible to bonus_offers.

Client request 2026-06-13: admin should be able to attach a promo code to a
(time-limited) bonus offer and decide whether that code is shown publicly on
the trader /bonus page or kept hidden (shared privately for a targeted
campaign). The offer's time window already exists (starts_at / expires_at).

Revision ID: 0072
Revises: 0071
"""
from alembic import op
import sqlalchemy as sa


revision = "0072"
down_revision = "0071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bonus_offers", sa.Column("promo_code", sa.String(40), nullable=True))
    op.add_column(
        "bonus_offers",
        sa.Column("code_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("bonus_offers", "code_visible")
    op.drop_column("bonus_offers", "promo_code")
