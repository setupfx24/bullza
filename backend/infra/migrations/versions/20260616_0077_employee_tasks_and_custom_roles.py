"""Employee tasks + custom roles (client 2026-06-16).

- employee_custom_roles: super-admin-defined reusable roles (name + permissions)
  assignable to many employees.
- employee_tasks: work items assigned to employees; each marked done/undone
  (with a reason when undone). The day's tasks form the daily report admin +
  super-admin review.

Revision ID: 0077
Revises: 0076
"""
from alembic import op


revision = "0077"
down_revision = "0076"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_custom_roles (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(40) UNIQUE NOT NULL,
            permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
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
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_tasks_assigned_to ON employee_tasks(assigned_to)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_tasks_status ON employee_tasks(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS employee_tasks")
    op.execute("DROP TABLE IF EXISTS employee_custom_roles")
