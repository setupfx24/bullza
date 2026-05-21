"""Per-account-type dimension on spread_configs + charge_configs.

Client wants admin to set different spreads/commissions for the same
instrument depending on the user's account type (Standard vs ECN vs
VIP). The existing schema scoped rules by default/instrument/segment/
user — no account-type axis. Adds a nullable account_group_id column
to both tables and indexes the resolver's lookup path.

NULL account_group_id = "applies to all account types" (back-compat:
existing rows remain unchanged and keep behaving like a wildcard).

Revision ID: 0049
Revises: 0048
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("spread_configs", "charge_configs"):
        op.add_column(
            table,
            sa.Column(
                "account_group_id",
                UUID(as_uuid=True),
                sa.ForeignKey("account_groups.id"),
                nullable=True,
            ),
        )
        # Composite index speeds up the per-(scope, account_group_id)
        # lookup the resolver runs on every fill.
        op.create_index(
            f"ix_{table}_scope_acctgrp",
            table,
            ["scope", "account_group_id", "is_enabled"],
        )


def downgrade() -> None:
    for table in ("spread_configs", "charge_configs"):
        op.drop_index(f"ix_{table}_scope_acctgrp", table_name=table)
        op.drop_column(table, "account_group_id")
