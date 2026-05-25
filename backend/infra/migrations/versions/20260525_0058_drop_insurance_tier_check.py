"""Drop the legacy 4-value CHECK constraint on insurance_policies.tier.

Migration 0014 created the trade-insurance schema with
`tier IN ('basic','advanced','pro','elite')`. After the 2026-05-25
pricing-engine cleanup, tiers are admin-defined labels (e.g. "50%",
"70%") instead of a fixed enum, so the CHECK now rejects every
new policy with CheckViolationError → trader sees "Insurance not
activated: String should match pattern" on activate.

Tier is now treated as a free-form admin-controlled label (string
column with length cap). Dropping the CHECK is the right move —
maintaining an enum here would break every new tier label the admin
adds (50% / 70% / custom).

Revision ID: 0058
Revises: 0057
"""
from alembic import op


revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE insurance_policies "
        "DROP CONSTRAINT IF EXISTS insurance_policies_tier_check;"
    )


def downgrade() -> None:
    # Re-apply the legacy constraint. Any row whose tier falls outside
    # the original 4-value set blocks the downgrade — admin must clean
    # those rows manually first.
    op.execute(
        "ALTER TABLE insurance_policies "
        "ADD CONSTRAINT insurance_policies_tier_check "
        "CHECK (tier IN ('basic','advanced','pro','elite'));"
    )
