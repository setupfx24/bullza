"""Per-account-type IB commissions + flat-amount referral with 3-trade gate.

Two policy changes the client asked for in the same DB migration:

1. IB commission per-lot now varies by the REFERRED user's account
   type (Standard / ECN / VIP). Each row in
   system_settings.ib_commission_tiers gets a new
   per_lot_by_account_type map. The flat per_lot field on each tier
   stays as the fallback when the user's account type isn't keyed
   in the map.

2. The user-level referral commission is now a FIXED amount ($X
   per qualified referral) instead of a percentage of first deposit,
   AND payout is gated on the referred user completing >= 3 trades
   instead of just funding their account once. Added
   users.referral_qualified_at to mark the moment a referral
   becomes payable so re-checks don't double-pay.

Revision ID: 0046
Revises: 0045
"""
import json

from alembic import op
import sqlalchemy as sa


revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


_DEFAULT_PER_TYPE_BY_LABEL = {
    # Client's example: Standard 5, ECN 7. VIP gets the existing per_lot.
    "Starter": {"standard": 5, "ecn": 7, "vip": 8},
    "Pro":     {"standard": 7, "ecn": 9, "vip": 10},
    "Elite":   {"standard": 10, "ecn": 13, "vip": 15},
}


def upgrade() -> None:
    # ── #1: per-account-type IB tiers ────────────────────────────────
    conn = op.get_bind()
    row = conn.execute(
        sa.text("SELECT value FROM system_settings WHERE key = 'ib_commission_tiers'")
    ).first()
    if row is not None:
        raw = row[0]
        if isinstance(raw, str):
            try:
                tiers = json.loads(raw)
            except Exception:
                tiers = []
        else:
            tiers = list(raw) if raw else []

        for t in tiers:
            if "per_lot_by_account_type" not in t or not isinstance(
                t.get("per_lot_by_account_type"), dict
            ):
                label = (t.get("label") or "").strip()
                # Try the curated default; otherwise duplicate per_lot
                # so every type starts on the same value the admin can
                # then tune individually.
                default_map = _DEFAULT_PER_TYPE_BY_LABEL.get(label)
                if default_map is None:
                    base = t.get("per_lot") or 0
                    default_map = {"standard": base, "ecn": base, "vip": base}
                t["per_lot_by_account_type"] = default_map

        payload = json.dumps(tiers).replace("'", "''")
        op.execute(
            f"UPDATE system_settings SET value = '{payload}' "
            f"WHERE key = 'ib_commission_tiers';"
        )

    # ── #2: flat-amount referral + 3-trade qualification ────────────
    op.add_column(
        "users",
        sa.Column("referral_qualified_at", sa.DateTime(timezone=True), nullable=True),
    )

    # New flat-USD setting. The old referral_commission_pct row stays
    # in place (read by nothing after this migration ships) so existing
    # cached values don't break a rollback.
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES ('referral_commission_amount_usd', '5')
        ON CONFLICT (key) DO NOTHING;
        """
    )
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES ('referral_qualifying_trades', '3')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_column("users", "referral_qualified_at")
    op.execute(
        "DELETE FROM system_settings WHERE key IN ("
        "'referral_commission_amount_usd', 'referral_qualifying_trades'"
        ");"
    )
    # The per_lot_by_account_type field stays on the tiers JSON — it's
    # a forward-compatible additive change and stripping it would
    # risk breaking the admin UI on rollback.
