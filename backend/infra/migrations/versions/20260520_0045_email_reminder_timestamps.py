"""Track when each kind of nudge email last went out, per user.

  + users.kyc_last_reminded_at      TIMESTAMPTZ
  + users.deposit_nudge_sent_at     TIMESTAMPTZ

KYC reminder used to be a 2-stage counter on kyc_reminder_stage (3-day
and 7-day, then stop). Client wants the platform to keep nudging while
KYC is pending — so we switch to a "last sent at" timestamp and resend
every 7 days. The old stage column is kept for backwards-compat with
any in-flight cron rows, but the engine no longer reads it.

deposit_nudge_sent_at gates the new 24h "claim your 100% bonus" email
so each user only gets it once.

Revision ID: 0045
Revises: 0044
"""
from alembic import op
import sqlalchemy as sa


revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("kyc_last_reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("deposit_nudge_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "deposit_nudge_sent_at")
    op.drop_column("users", "kyc_last_reminded_at")
