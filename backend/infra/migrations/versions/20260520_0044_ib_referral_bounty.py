"""Per-referral bounty on the existing IB commission tier ladder.

Adds a ``per_referral_bounty`` field to each entry in the
``ib_commission_tiers`` system_settings JSON. Defaults match the client's
PER-REFERRAL PAYOUTS sheet: $5 / $7 / $10 across the existing 5-20 /
21-100 / 100+ brackets.

This is a flat one-shot payout the IB earns when one of their referrals
makes their FIRST approved deposit — distinct from the per-lot
commission already on the tier row (which streams in as the referral
trades).

Revision ID: 0044
Revises: 0043
"""
import json

from alembic import op
import sqlalchemy as sa


revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


_DEFAULT_BOUNTIES_BY_LABEL = {
    "Starter": 5,
    "Pro": 7,
    "Elite": 10,
}


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(
        sa.text("SELECT value FROM system_settings WHERE key = 'ib_commission_tiers'")
    ).first()

    if row is None:
        # Tier ladder not present yet (migration 0043 was rolled back at
        # some point); seed both the ladder and the bounty in one go.
        seed = [
            {"label": "Starter", "min_referrals": 5,   "max_referrals": 20,   "per_lot": 6,
             "per_referral_bounty": 5,  "instant_payout": True, "dedicated_manager": False},
            {"label": "Pro",     "min_referrals": 21,  "max_referrals": 100,  "per_lot": 8,
             "per_referral_bounty": 7,  "instant_payout": True, "dedicated_manager": True},
            {"label": "Elite",   "min_referrals": 101, "max_referrals": None, "per_lot": 13,
             "per_referral_bounty": 10, "instant_payout": True, "dedicated_manager": True},
        ]
        payload = json.dumps(seed).replace("'", "''")
        op.execute(
            f"INSERT INTO system_settings (key, value) VALUES "
            f"('ib_commission_tiers', '{payload}');"
        )
        return

    raw = row[0]
    if isinstance(raw, str):
        try:
            tiers = json.loads(raw)
        except Exception:
            tiers = []
    else:
        tiers = list(raw) if raw else []

    # Backfill the per_referral_bounty field on every existing tier. If
    # the label matches one of the canonical brackets we use the
    # client's stated payout; otherwise we leave it 0 so the admin can
    # set it explicitly on the new column.
    updated = []
    for t in tiers:
        if "per_referral_bounty" not in t or t.get("per_referral_bounty") in (None, ""):
            label = (t.get("label") or "").strip()
            t["per_referral_bounty"] = _DEFAULT_BOUNTIES_BY_LABEL.get(label, 0)
        updated.append(t)

    payload = json.dumps(updated).replace("'", "''")
    op.execute(
        f"UPDATE system_settings SET value = '{payload}' "
        f"WHERE key = 'ib_commission_tiers';"
    )


def downgrade() -> None:
    # Strip the field from every tier so the row matches its pre-0044 shape.
    conn = op.get_bind()
    row = conn.execute(
        sa.text("SELECT value FROM system_settings WHERE key = 'ib_commission_tiers'")
    ).first()
    if row is None:
        return
    raw = row[0]
    if isinstance(raw, str):
        tiers = json.loads(raw)
    else:
        tiers = list(raw) if raw else []
    for t in tiers:
        t.pop("per_referral_bounty", None)
    payload = json.dumps(tiers).replace("'", "''")
    op.execute(
        f"UPDATE system_settings SET value = '{payload}' "
        f"WHERE key = 'ib_commission_tiers';"
    )
