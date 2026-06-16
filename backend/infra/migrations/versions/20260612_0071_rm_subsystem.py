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
    # IDEMPOTENT: the admin service's startup self-heal DDL
    # (services/admin/main.py:_apply_startup_ddl) may have already created
    # users.assigned_rm_id and rm_funding_requests on a prior boot. Plain
    # add_column / create_table would then fail with DuplicateColumn /
    # DuplicateTable and block the whole migration chain (observed
    # 2026-06-16). Raw IF NOT EXISTS makes this safe on both fresh and
    # already-healed databases.
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_rm_id UUID REFERENCES users(id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_assigned_rm_id ON users (assigned_rm_id)"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS rm_funding_requests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            rm_id UUID NOT NULL REFERENCES users(id),
            user_id UUID NOT NULL REFERENCES users(id),
            amount NUMERIC(18,2) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'USD',
            method VARCHAR(40),
            note TEXT,
            proof_path TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            approved_by UUID REFERENCES users(id),
            approved_at TIMESTAMPTZ,
            credited_by UUID REFERENCES users(id),
            credited_at TIMESTAMPTZ,
            rejected_by UUID REFERENCES users(id),
            rejected_at TIMESTAMPTZ,
            rejection_reason TEXT,
            deposit_id UUID REFERENCES deposits(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_rm_distinct_crediter CHECK (
                credited_by IS NULL OR approved_by IS NULL OR credited_by <> approved_by
            )
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_rm_funding_requests_rm_id ON rm_funding_requests (rm_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_rm_funding_requests_user_id ON rm_funding_requests (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_rm_funding_requests_status ON rm_funding_requests (status)")
    # If the table pre-existed via startup DDL (which created it WITHOUT the
    # four-eyes check), add the constraint now — guarded so it's a no-op when
    # already present.
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE rm_funding_requests
                ADD CONSTRAINT chk_rm_distinct_crediter CHECK (
                    credited_by IS NULL OR approved_by IS NULL OR credited_by <> approved_by
                );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index("ix_rm_funding_requests_status", table_name="rm_funding_requests")
    op.drop_index("ix_rm_funding_requests_user_id", table_name="rm_funding_requests")
    op.drop_index("ix_rm_funding_requests_rm_id", table_name="rm_funding_requests")
    op.drop_table("rm_funding_requests")
    op.drop_index("ix_users_assigned_rm_id", table_name="users")
    op.drop_column("users", "assigned_rm_id")
