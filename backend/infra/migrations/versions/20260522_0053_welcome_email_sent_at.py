"""Track whether the post-profile-completion welcome email has been sent.

Trader frontend used to skip the dashboard-access email after the user
finished the ProfileCompleteGate. With this column the gateway can
auto-fire that email when /profile detects profile_complete just flipped
false → true, while staying idempotent across repeated profile edits
(re-saving a complete profile must NOT trigger a second email).

Single nullable timestamp:
  welcome_email_sent_at  TIMESTAMPTZ NULL — set the first time we fire
                                              the dashboard_access email
                                              for this user. NULL means
                                              not yet sent.

Revision ID: 0053
Revises: 0052
"""
from alembic import op
import sqlalchemy as sa


revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("welcome_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "welcome_email_sent_at")
