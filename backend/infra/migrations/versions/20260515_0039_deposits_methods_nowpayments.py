"""Add 'nowpayments' to the allowed deposit/withdrawal methods.

When the NOWPayments hosted-checkout deposit flow was wired up
(2026-05-13, commit 62d9f96), the frontend started posting
method='nowpayments' to /wallet/deposit but the CHECK constraint
deposits_method_check / withdrawals_method_check only allowed
the legacy + oxapay set from migration 0003. Every NOWPayments
deposit attempt 500'd with CheckViolationError.

Revision ID: 0039
Revises: 0038
"""
from alembic import op

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None

# Keep this list in sync with wallet_service.METHOD_MAP. Adding
# 'nowpayments' on top of what 0003 introduced.
_METHODS = (
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
    "oxapay",
    "nowpayments",
    "manual",
)


def upgrade() -> None:
    methods_sql = ", ".join(f"'{m}'" for m in _METHODS)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )


def downgrade() -> None:
    # Mirror of 0003's accepted set — i.e. drop 'nowpayments' but keep
    # everything 0003 added.
    legacy = (
        "bank_transfer",
        "upi",
        "qr",
        "crypto_btc",
        "crypto_eth",
        "crypto_usdt",
        "metamask",
        "oxapay",
        "manual",
    )
    methods_sql = ", ".join(f"'{m}'" for m in legacy)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
