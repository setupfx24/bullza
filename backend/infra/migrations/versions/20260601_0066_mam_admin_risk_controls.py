"""Admin-set risk controls + per-master insurance toggle for MAM/PAMM.

Client request 2026-06-01:
- Max drawdown and max-loss-per-trade should be set by the broker
  admin, not the investor. ``master_accounts`` already has
  ``max_drawdown_pct`` (default 0 = disabled); we add the matching
  ``max_loss_per_trade_pct`` column so both knobs live in the same
  place. Per-investor overrides remain available via
  ``investor_allocations.max_drawdown_pct``.
- Admin should be able to allow / forbid insurance per-master.
  ``master_accounts.insurance_enabled`` (default TRUE) records the
  switch; the trader-side invest modal reads it to show the
  "auto-insure copied trades" opt-in.
- Investor records their insurance preference per-allocation in
  ``investor_allocations.insurance_opt_in`` (default FALSE) so the
  copy engine can later auto-activate policies on mirrored positions
  for opted-in investors only.

Revision ID: 0066
Revises: 0065
"""
from alembic import op
import sqlalchemy as sa


revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_accounts",
        sa.Column("max_loss_per_trade_pct", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "master_accounts",
        sa.Column(
            "insurance_enabled", sa.Boolean(),
            nullable=False, server_default=sa.true(),
        ),
    )
    op.add_column(
        "investor_allocations",
        sa.Column(
            "insurance_opt_in", sa.Boolean(),
            nullable=False, server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("investor_allocations", "insurance_opt_in")
    op.drop_column("master_accounts", "insurance_enabled")
    op.drop_column("master_accounts", "max_loss_per_trade_pct")
