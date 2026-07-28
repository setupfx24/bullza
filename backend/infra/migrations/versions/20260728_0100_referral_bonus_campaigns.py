"""Generalized, admin-manageable referral bonus campaigns — supersedes the
one-off "first 100 KYC" table from 0098. An admin can now create any number
of campaigns over time, each with its own name, amount, user cap, and a
configurable trades-required gate (0 = pays on KYC approval alone, N = pays
once the referred user has N closed trades AND approved KYC).

Revision ID: 0099
Revises: 0098
"""
from alembic import op

revision = "0100"
down_revision = "0099"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS referral_bonus_campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(120) NOT NULL,
            amount_usd NUMERIC(18, 2) NOT NULL,
            max_claims INTEGER NOT NULL,
            claimed_count INTEGER NOT NULL DEFAULT 0,
            required_trades INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    # One row per successful award. The UNIQUE constraint is what makes "a
    # referrer can only claim THIS campaign once" enforceable at the database
    # level (not just in application code) — a second award attempt for the
    # same (campaign, referrer) pair will fail the INSERT outright.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS referral_bonus_claims (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id UUID NOT NULL REFERENCES referral_bonus_campaigns(id),
            referrer_id UUID NOT NULL REFERENCES users(id),
            referred_user_id UUID NOT NULL REFERENCES users(id),
            amount_usd NUMERIC(18, 2) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (campaign_id, referrer_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_referral_bonus_claims_campaign "
        "ON referral_bonus_claims (campaign_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS referral_bonus_claims")
    op.execute("DROP TABLE IF EXISTS referral_bonus_campaigns")
