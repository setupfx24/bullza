"""Drop the users.status CHECK constraint.

Bug (client 2026-06-15): admin "Terminate Account" and "Soft Delete" did
nothing. The original init-db CHECK only allowed
  active / banned / blocked / pending_kyc / suspended
so setting status='terminated' (terminate) or status='deleted' (soft-delete)
violated the constraint and the commit failed silently — the account never
changed. (Suspend worked because 'suspended' was in the allowed set.)

Consistent with the project's move away from status CHECK constraints
(migrations 0057-0060 dropped the insurance/transaction/bonus checks),
we drop users_status_check entirely; user statuses are validated in
application code (admin user_service). Idempotent.

Revision ID: 0073
Revises: 0072
"""
from alembic import op


revision = "0073"
down_revision = "0072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check")


def downgrade() -> None:
    # Recreate the original (narrower) constraint. Note: this will fail if any
    # row currently holds 'terminated'/'deleted' — expected for a downgrade.
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT users_status_check "
        "CHECK (status IN ('active', 'banned', 'blocked', 'pending_kyc', 'suspended'))"
    )
