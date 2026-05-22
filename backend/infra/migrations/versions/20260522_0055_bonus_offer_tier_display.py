"""Tier-display fields on bonus_offers so the trader /bonus page is admin-managed.

Before this, the trader-facing /bonus page hardcoded three tier cards
(deposit $100-$499 / $500-$999 / $1000+) in TIERS. Admin had no way to
change ranges, percentages, perks, or which tier was "Most Popular".

These additive columns turn each `bonus_offers` row into a fully
admin-editable card on the trader page:

  max_deposit   Numeric(18,8)  — upper bound of the deposit range. NULL =
                                  no upper bound (the top tier card,
                                  rendered as "$X+").
  perks         JSONB          — array of bullet strings for the card body
                                  (["Auto-credited within minutes", …]).
  is_popular    Boolean        — flips the "Most Popular" ring + badge on
                                  the card. Only one tier should be true
                                  but the migration doesn't enforce that —
                                  the trader page renders whatever admin
                                  set.
  sort_order    Integer        — explicit ordering so admin can rearrange
                                  cards without renaming. ASC.
  cta_label     Varchar(80)    — button text on the card ("Deposit $100").
                                  NULL = auto-generated from min_deposit.
  tagline       Varchar(200)   — short label above the percent ("Welcome
                                  Match"). Optional, NULL renders nothing.

All NULL-able / defaulted so existing bonus_offers rows keep working
without backfill. The existing auto-apply BonusOffer engine ignores
these fields — they're presentation only.

Revision ID: 0055
Revises: 0054
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bonus_offers",
        sa.Column("max_deposit", sa.Numeric(18, 8), nullable=True),
    )
    op.add_column(
        "bonus_offers",
        sa.Column("perks", JSONB, nullable=True),
    )
    op.add_column(
        "bonus_offers",
        sa.Column("is_popular", sa.Boolean, server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "bonus_offers",
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "bonus_offers",
        sa.Column("cta_label", sa.String(80), nullable=True),
    )
    op.add_column(
        "bonus_offers",
        sa.Column("tagline", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bonus_offers", "tagline")
    op.drop_column("bonus_offers", "cta_label")
    op.drop_column("bonus_offers", "sort_order")
    op.drop_column("bonus_offers", "is_popular")
    op.drop_column("bonus_offers", "perks")
    op.drop_column("bonus_offers", "max_deposit")
