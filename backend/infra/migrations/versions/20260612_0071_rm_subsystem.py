"""RM (Relationship Manager) subsystem.

Client request 2026-06-12: introduce a Relationship Manager role. An RM is
assigned a set of users, collects funds from them offline, and uploads a
proof file. The proof creates an `rm_funding_requests` row (pending). The
admin team reviews it with a strict two-admin flow:

    pending  →  approved   (admin #1 verifies the proof)
             →  credited   (admin #2, different person, releases the money
                            into the user's main wallet)
             →  rejected   (either admin, with a reason)

This migration adds:
  1. users.assigned_rm_id  — the RM who manages this user (FK users.id).
  2. rm_funding_requests    — the proof + two-admin approval ledger.

Revision ID: 0071
Revises: 0070
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "0071"
down_revision = "0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("assigned_rm_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_users_assigned_rm_id", "users", ["assigned_rm_id"])

    op.create_table(
        "rm_funding_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("rm_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("method", sa.String(40), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("proof_path", sa.Text(), nullable=True),
        # pending | approved | credited | rejected
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("credited_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("credited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("deposit_id", UUID(as_uuid=True), sa.ForeignKey("deposits.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        # The admin who releases the money must NOT be the one who approved the
        # proof — enforce the four-eyes rule at the DB level.
        sa.CheckConstraint(
            "credited_by IS NULL OR approved_by IS NULL OR credited_by <> approved_by",
            name="chk_rm_distinct_crediter",
        ),
    )
    op.create_index("ix_rm_funding_requests_rm_id", "rm_funding_requests", ["rm_id"])
    op.create_index("ix_rm_funding_requests_user_id", "rm_funding_requests", ["user_id"])
    op.create_index("ix_rm_funding_requests_status", "rm_funding_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_rm_funding_requests_status", table_name="rm_funding_requests")
    op.drop_index("ix_rm_funding_requests_user_id", table_name="rm_funding_requests")
    op.drop_index("ix_rm_funding_requests_rm_id", table_name="rm_funding_requests")
    op.drop_table("rm_funding_requests")
    op.drop_index("ix_users_assigned_rm_id", table_name="users")
    op.drop_column("users", "assigned_rm_id")
