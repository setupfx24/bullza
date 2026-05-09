"""email_verified flag on users — gate sign-in until the verify-email
link has been clicked once. Default TRUE for existing rows so the
deploy doesn't lock anyone out; new users get FALSE in register_user
and flip to TRUE on /auth/verify-email/{token}.

Revision ID: 0038
Revises: 0037
"""
from alembic import op


revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN
                NOT NULL DEFAULT TRUE;
    """)
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
    """)
    # Backfill: existing rows already TRUE (column default). Stamp the
    # verified_at to created_at so legacy users have a consistent
    # auditable timestamp without making a "verified just now" claim.
    op.execute("""
        UPDATE users
           SET email_verified_at = COALESCE(email_verified_at, created_at)
         WHERE email_verified = TRUE
           AND email_verified_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified;")
