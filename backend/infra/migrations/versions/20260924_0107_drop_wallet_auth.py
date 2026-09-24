"""Drop the SIWE wallet-auth surface.

Wallet sign-in (EIP-4361) and the wallet-connect crypto deposit flow were
removed: the feature never went live (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
was never set, so isWalletConnectConfigured() kept the UI hidden), while the
RainbowKit -> wagmi -> @base-org/account -> @coinbase/cdp-sdk chain shipped in
every trader bundle, accounted for 23 of the app's npm advisories, pulled in
`ecdsa` PYSEC-2026-1325 which has no fix, and broke the build on Next 15.5.26.

Removes what migration 0034 added:
  * wallet_auth_nonces          single-use SIWE nonces
  * users.wallet_address        the linked EVM address
  * ix_users_wallet_address_lower

IRREVERSIBLE — downgrade() does not restore the linked addresses. This runs
on a database where the column was never populated (the flow was gated off
from day one), but take a backup anyway.

Revision ID: 0107
Revises: 0106
"""
from alembic import op

revision = "0107"
down_revision = "0106"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_wallet_address_lower")
    op.execute("DROP TABLE IF EXISTS wallet_auth_nonces CASCADE")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS wallet_address")


def downgrade() -> None:
    # One-way: the dropped column held user-linked addresses that no longer
    # have code behind them. Restore from a backup if this needs undoing.
    pass
