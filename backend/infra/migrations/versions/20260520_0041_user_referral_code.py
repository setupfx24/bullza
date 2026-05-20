"""User-level referral code (separate from IB MLM).

Adds:
  - users.referral_code      VARCHAR(20) UNIQUE NULLABLE
  - users.referred_by_user_id UUID FK -> users.id NULLABLE
  - default 'referral_commission_pct' system_settings row

Existing users get a generated code backfilled in this migration so the
feature works immediately on deploy. Going forward, register() fills it
at signup.

Revision ID: 0041
Revises: 0040
"""
import secrets
import string

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def _alphanum_code(n: int = 8) -> str:
    # Same alphabet IBProfile uses — uppercase letters + digits, no
    # 0/O/1/I to avoid copy/paste confusion in a shareable link.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(n))


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("referral_code", sa.String(20), nullable=True, unique=False),
    )
    op.add_column(
        "users",
        sa.Column("referred_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )

    # Backfill every existing user with a unique code. Loop in Python — we
    # need uniqueness and ~10 chars of entropy is plenty to avoid retries
    # in practice. Done in a single transaction with op.execute so the
    # migration completes atomically.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM users WHERE referral_code IS NULL")).fetchall()
    used = set(
        r[0] for r in conn.execute(
            sa.text("SELECT referral_code FROM users WHERE referral_code IS NOT NULL")
        ).fetchall()
    )
    for row in rows:
        for _ in range(20):
            code = _alphanum_code(8)
            if code not in used:
                used.add(code)
                break
        else:
            code = _alphanum_code(12)  # fallback: longer code
        conn.execute(
            sa.text("UPDATE users SET referral_code = :c WHERE id = :id"),
            {"c": code, "id": row[0]},
        )

    op.create_unique_constraint("uq_users_referral_code", "users", ["referral_code"])
    op.create_index("ix_users_referred_by_user_id", "users", ["referred_by_user_id"])

    # Default commission percentage — admin overrides via /admin/settings.
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES ('referral_commission_pct', '5')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM system_settings WHERE key = 'referral_commission_pct';")
    op.drop_index("ix_users_referred_by_user_id", table_name="users")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    op.drop_column("users", "referred_by_user_id")
    op.drop_column("users", "referral_code")
