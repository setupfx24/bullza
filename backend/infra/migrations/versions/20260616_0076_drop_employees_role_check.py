"""Drop the employees.role CHECK constraint.

Bug (client 2026-06-16): creating an employee with role rm / deposit_manager
/ withdrawal_manager threw Internal Server Error. The original init-db CHECK
only allowed super_admin/trade_manager/support/finance/risk_manager/marketing
— the newer roles violated it. The role is already validated in app code
(employee_service.VALID_EMPLOYEE_ROLES), and consistent with dropping the
other status/type/role CHECK constraints (users.status 0073, notifications
0075), we drop it. Idempotent.

Revision ID: 0076
Revises: 0075
"""
from alembic import op


revision = "0076"
down_revision = "0075"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE employees ADD CONSTRAINT employees_role_check "
        "CHECK (role IN ('super_admin','trade_manager','support','finance',"
        "'risk_manager','marketing'))"
    )
