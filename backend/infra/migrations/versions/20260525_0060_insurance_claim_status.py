"""Manual-claim flow for trade insurance.

Until now, an eligible insurance claim was auto-credited to the trader's
account.credit at trade close. The client asked for a manual flow:
eligible claims appear on the trader dashboard with a "Claim" button;
the credit only lands when the user actively claims.

This migration adds the minimum schema needed for that:

  status      VARCHAR(16) NOT NULL DEFAULT 'pending'
              ('pending' / 'paid')

  claimed_at  TIMESTAMPTZ NULL — timestamp at which the user clicked
              Claim. Existing rows backfill to paid_at so claim history
              still reads naturally for history-only viewers.

  paid_at     made nullable — a pending claim hasn't been paid yet, so
              the old NOT NULL contract no longer holds.

Existing rows (pre-migration auto-paid claims) backfill to status='paid'
with claimed_at = paid_at, so the history endpoint stays correct.

Revision ID: 0060
Revises: 0059
"""
from alembic import op
import sqlalchemy as sa


revision = "0060"
down_revision = "0059"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "insurance_claims",
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "insurance_claims",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Existing rows were paid immediately on creation under the old flow —
    # backfill their status + claimed_at to preserve history semantics.
    op.execute(
        "UPDATE insurance_claims "
        "SET status = 'paid', claimed_at = paid_at "
        "WHERE status = 'pending';"
    )

    # Pending claims have no payment timestamp yet.
    op.alter_column("insurance_claims", "paid_at", nullable=True)

    op.create_index(
        "ix_ins_clm_user_status",
        "insurance_claims",
        ["user_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_ins_clm_user_status", table_name="insurance_claims")
    # Restore NOT NULL on paid_at by filling any pending rows first.
    op.execute(
        "UPDATE insurance_claims SET paid_at = now() WHERE paid_at IS NULL;"
    )
    op.alter_column("insurance_claims", "paid_at", nullable=False)
    op.drop_column("insurance_claims", "claimed_at")
    op.drop_column("insurance_claims", "status")
