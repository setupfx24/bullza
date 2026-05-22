"""Per-deposit bonus request fields — trader enters a promo code at
deposit time, admin reviews and manually grants/denies the bonus.

Two new columns on `deposits`:

  bonus_code     VARCHAR(40) NULL — code the trader typed (e.g. "SD100").
                                    NULL = the deposit asked for no bonus.
  bonus_status   VARCHAR(20) NULL — 'pending' | 'granted' | 'denied' | NULL.
                                    NULL when bonus_code is NULL.

Plus an audit pair (admin who decided + timestamp) so the deposits page
can render "Granted by admin X at …" alongside the deposit row.

Distinct from the existing auto-apply BonusOffer loop in wallet_service:
those fire for ANY qualifying deposit and require no trader opt-in. This
column captures explicit trader intent and gates manual admin approval.

Revision ID: 0054
Revises: 0053
"""
from alembic import op
import sqlalchemy as sa


revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "deposits",
        sa.Column("bonus_code", sa.String(40), nullable=True),
    )
    op.add_column(
        "deposits",
        sa.Column("bonus_status", sa.String(20), nullable=True),
    )
    op.add_column(
        "deposits",
        sa.Column("bonus_amount", sa.Numeric(18, 8), nullable=True),
    )
    op.add_column(
        "deposits",
        sa.Column("bonus_decided_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "deposits",
        sa.Column("bonus_decided_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("deposits", "bonus_decided_at")
    op.drop_column("deposits", "bonus_decided_by")
    op.drop_column("deposits", "bonus_amount")
    op.drop_column("deposits", "bonus_status")
    op.drop_column("deposits", "bonus_code")
