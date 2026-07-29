"""Per-user referral kill-switch. Admin can disable a single user's referral so
their referral/IB code + link stop onboarding new signups (rejected as an
invalid code at registration). Defaults to false — nothing else changes.

Revision ID: 0101
Revises: 0100
"""
from alembic import op

revision = "0101"
down_revision = "0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS referral_disabled BOOLEAN NOT NULL DEFAULT false;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS referral_disabled;")
