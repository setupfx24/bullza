"""Store the deny/expire reason on insurance_policies.

Client request 2026-05-27: when a policy shows as DENIED or EXPIRED on
the trader's /insurance page, surface WHY (min duration, daily claim
limit, news blackout, cap exhausted, trade closed in profit, …). The
engine already computes the reason via evaluate_claim — it just wasn't
persisted on the row. Adding a nullable VARCHAR(40) column avoids a
join to a separate audit table for what is essentially a single tag.

Revision ID: 0063
Revises: 0062
"""
from alembic import op
import sqlalchemy as sa


revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "insurance_policies",
        sa.Column("settled_reason", sa.String(40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("insurance_policies", "settled_reason")
