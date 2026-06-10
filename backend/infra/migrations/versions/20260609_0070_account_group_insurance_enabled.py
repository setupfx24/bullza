"""Add insurance_enabled flag to account_groups.

Client request 2026-06-09: admin should control which account TYPES
can use Trade Insurance — e.g. allow it on Standard / Cent but block
it on VIP, or vice-versa. Until now insurance availability was global
(the `insurance` settings.enabled flag) + per-master (PAMM/MAM); this
adds a per-account-type gate that layers on top.

Default TRUE so every existing account type keeps offering insurance
exactly as before. Admin flips it off per type via the Account Types
panel. The insurance /quote + /activate endpoints check this flag and
return `insurance_disabled_for_account_type` when off.

Revision ID: 0070
Revises: 0069
"""
from alembic import op
import sqlalchemy as sa


revision = "0070"
down_revision = "0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "account_groups",
        sa.Column(
            "insurance_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("account_groups", "insurance_enabled")
