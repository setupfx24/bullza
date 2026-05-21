"""Per-account-type referral payout amount.

Client wants the flat-USD referral bounty to vary by the REFERRED
user's account type — same idea as the IB per-lot per-type rates we
shipped in 0046. Standard accounts pay a smaller bounty, ECN/VIP pay
more.

Stored as a JSON map under the new key ``referral_commission_amounts_usd``
(keyed by lowercased AccountGroup.name). Falls back to the existing
``referral_commission_amount_usd`` flat value when the referred user's
type isn't keyed.

Revision ID: 0047
Revises: 0046
"""
import json

from alembic import op


revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


_DEFAULT_AMOUNTS = {
    # Per the same ladder direction as the IB tier defaults.
    "standard": 5,
    "ecn": 7,
    "vip": 10,
}


def upgrade() -> None:
    payload = json.dumps(_DEFAULT_AMOUNTS).replace("'", "''")
    op.execute(
        f"""
        INSERT INTO system_settings (key, value)
        VALUES ('referral_commission_amounts_usd', '{payload}')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM system_settings "
        "WHERE key = 'referral_commission_amounts_usd';"
    )
