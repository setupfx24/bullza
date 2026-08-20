"""Absorb the admin service's self-healing startup DDL into a migration.

backend/services/admin/main.py used to run these idempotent statements on
every boot so admin endpoints wouldn't 500 on hosts where migrations
lagged. That meant the schema was effectively defined in two places and a
missed migration was silently masked instead of failing loudly (risk
review 2026-08-20). The statements now live here — a no-op on any
database that already ran migrations 0071–0078 — and the startup hook
only DETECTS drift and logs an error.

Revision ID: 0104
Revises: 0103
"""
from alembic import op

revision = "0104"
down_revision = "0103"
branch_labels = None
depends_on = None

_STATEMENTS = [
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb",
    """
    CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMPTZ DEFAULT now()
    )
    """,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_rm_id UUID REFERENCES users(id)",
    """
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_rm_funding_requests_status ON rm_funding_requests(status)",
    "ALTER TABLE bonus_offers ADD COLUMN IF NOT EXISTS promo_code VARCHAR(40)",
    "ALTER TABLE bonus_offers ADD COLUMN IF NOT EXISTS code_visible BOOLEAN NOT NULL DEFAULT true",
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check",
    "ALTER TABLE ib_profiles ADD COLUMN IF NOT EXISTS tier_override VARCHAR(40)",
    "ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check",
    "ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check",
    """
    CREATE TABLE IF NOT EXISTS employee_custom_roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(40) UNIQUE NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS employee_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        assigned_by UUID REFERENCES users(id),
        assigned_to UUID NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        due_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        undone_reason TEXT,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_employee_tasks_assigned_to ON employee_tasks(assigned_to)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS spread_revenue NUMERIC(18,8) DEFAULT 0",
]


def upgrade() -> None:
    for stmt in _STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    # These objects belong to migrations 0071–0078; nothing to undo here.
    pass
