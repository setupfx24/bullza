"""IB commission tiers — referral-count-driven per-lot rate.

Default tiers match the rate sheet the client sent: 5-20 referrals get
$6/lot, 21-100 get $8/lot, 101+ get $13/lot. Admin overrides via the
new /config/ib-tiers page. Stored as a JSON array in system_settings
so editing is a single PUT with cache invalidation.

Revision ID: 0043
Revises: 0042
"""
import json

from alembic import op


revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


DEFAULT_TIERS = [
    {
        "label": "Starter",
        "min_referrals": 5,
        "max_referrals": 20,
        # Client's range was $5-$7; pick the midpoint as a sensible default.
        "per_lot": 6,
        "instant_payout": True,
        "dedicated_manager": False,
    },
    {
        "label": "Pro",
        "min_referrals": 21,
        "max_referrals": 100,
        "per_lot": 8,
        "instant_payout": True,
        "dedicated_manager": True,
    },
    {
        "label": "Elite",
        "min_referrals": 101,
        # null = "no upper bound" — the tier resolver treats it as +inf.
        "max_referrals": None,
        "per_lot": 13,
        "instant_payout": True,
        "dedicated_manager": True,
    },
]


def upgrade() -> None:
    payload = json.dumps(DEFAULT_TIERS).replace("'", "''")
    op.execute(
        f"""
        INSERT INTO system_settings (key, value)
        VALUES ('ib_commission_tiers', '{payload}')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM system_settings WHERE key = 'ib_commission_tiers';")
