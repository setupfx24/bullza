"""2FA recovery codes — store bcrypt-hashed single-use backup codes.

Generated at 2FA enable time, shown to the user once, then verified
against the hash list on subsequent recovery. Each code is consumed
single-use (deleted from the JSONB array on success).

Revision ID: 0037
Revises: 0036
"""
from alembic import op


revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB
                NOT NULL DEFAULT '[]'::jsonb;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS two_factor_backup_codes;")
