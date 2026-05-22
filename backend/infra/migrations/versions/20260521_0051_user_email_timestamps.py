"""Per-user timestamps for the eligibility nudge + monthly statement
engines, so re-runs don't double-mail anyone.

Adds three NULL-able columns to users:
  fr_insurance_nudge_sent_at  — set when the engine has emailed the
                                 user about FR / Insurance eligibility
                                 (once + then quarterly resend).
  weekly_statement_sent_at    — last weekly statement digest sent.
  monthly_statement_sent_at   — last monthly statement digest sent.

Revision ID: 0051
Revises: 0050
"""
from alembic import op
import sqlalchemy as sa


revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("fr_insurance_nudge_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("weekly_statement_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("monthly_statement_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "monthly_statement_sent_at")
    op.drop_column("users", "weekly_statement_sent_at")
    op.drop_column("users", "fr_insurance_nudge_sent_at")
