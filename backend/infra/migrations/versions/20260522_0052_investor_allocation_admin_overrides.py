"""Per-investor admin overrides on investor_allocations.

Adds three NULL-able columns so admin can carve out bespoke economics for
individual investors inside a MAM / PAMM / signal master, without forking
the master's own settings or touching the global resolver:

  performance_fee_pct_override  Numeric(5,2) — overrides
                                  master.performance_fee_pct for this
                                  investor's copy closes. NULL = inherit.
  admin_commission_pct_override Numeric(5,2) — overrides
                                  master.admin_commission_pct (the slice
                                  of the perf-fee that goes to the broker)
                                  for this investor. NULL = inherit.
  admin_notes                   Text         — free-form audit trail for
                                  admin (why we cut this investor a deal,
                                  ticket #, etc.). Surfaced read-only on
                                  the MAM page.

All three are independent: an admin can set just the perf-fee override
and leave the platform slice on the master default.

Revision ID: 0052
Revises: 0051
"""
from alembic import op
import sqlalchemy as sa


revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investor_allocations",
        sa.Column("performance_fee_pct_override", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "investor_allocations",
        sa.Column("admin_commission_pct_override", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "investor_allocations",
        sa.Column("admin_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("investor_allocations", "admin_notes")
    op.drop_column("investor_allocations", "admin_commission_pct_override")
    op.drop_column("investor_allocations", "performance_fee_pct_override")
