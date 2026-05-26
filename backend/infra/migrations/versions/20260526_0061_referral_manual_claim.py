"""Manual-claim flow for referral payouts.

Client request: stop auto-crediting the referrer's main wallet when a
referred user crosses the qualifying trade threshold. Instead the
referrer sees a per-friend list on /referral, clicks Claim per row to
move the bounty into a separate commission balance, then clicks
Withdraw to Main Wallet to sweep that balance into main_wallet_balance
(records a Transaction + notification on withdraw, not on claim).

Schema additions:

  users.referral_commission_balance  NUMERIC(18,8) NOT NULL DEFAULT 0
      Per-user pool of claimed-but-not-withdrawn referral bounties.
      Lives on the REFERRER row, not the referred row.

  users.referral_claimed_at          TIMESTAMPTZ NULL
      Per-referred-user stamp set when the referrer pressed Claim
      against this row. Lives on the REFERRED row (same table as the
      existing referral_qualified_at), so the dashboard can filter
      rows into pending / claimable / claimed buckets with a single
      query.

Backfill: any historical row that already had referral_qualified_at
set was paid out under the old auto-credit flow — stamp those rows
with claimed_at = qualified_at so they don't re-surface as a
"Claim" button on the new UI.

Revision ID: 0061
Revises: 0060
"""
from alembic import op
import sqlalchemy as sa


revision = "0061"
down_revision = "0060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "referral_commission_balance",
            sa.Numeric(18, 8),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "users",
        sa.Column("referral_claimed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Pre-existing qualified rows were already paid into main_wallet by
    # the old auto-credit flow — mark them as claimed so the new UI
    # doesn't show them as pending Claim entries.
    op.execute(
        "UPDATE users SET referral_claimed_at = referral_qualified_at "
        "WHERE referral_qualified_at IS NOT NULL;"
    )


def downgrade() -> None:
    op.drop_column("users", "referral_claimed_at")
    op.drop_column("users", "referral_commission_balance")
