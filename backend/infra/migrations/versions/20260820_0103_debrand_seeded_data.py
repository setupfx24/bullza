"""White-label data cleanup — remove the previous brand from seeded rows.

Earlier migrations seeded brand-specific strings into data (reward mission
descriptions, lifestyle store items) and brand-derived synthetic emails
(the shared demo login, wallet-only placeholder addresses, promo demo
accounts). Code now derives all of these from BRAND_* settings; this
migration brings EXISTING databases in line. Fresh installs already get
neutral values from the (edited) seed migrations.

Every statement is guarded so it no-ops when a table/column is absent.
Only synthetic address patterns are rewritten — real user emails are
never touched.

Revision ID: 0103
Revises: 0102
"""
from alembic import op

revision = "0103"
down_revision = "0102"
branch_labels = None
depends_on = None

_GUARDED_UPDATES = [
    # (table, column, sql)
    (
        "rewards_missions", "description",
        "UPDATE rewards_missions SET description = REPLACE(description, 'SwisDex', 'the platform') "
        "WHERE description LIKE '%SwisDex%'",
    ),
    (
        "reward_store_items", "description",
        "UPDATE reward_store_items SET description = REPLACE(description, 'SwisDex ', '') "
        "WHERE description LIKE '%SwisDex%'",
    ),
    (
        "reward_store_items", "name",
        "UPDATE reward_store_items SET name = REPLACE(name, 'SwisDex ', '') "
        "WHERE name LIKE '%SwisDex%'",
    ),
    # Wallet-only signups carry a synthetic placeholder address.
    (
        "users", "email",
        "UPDATE users SET email = REPLACE(email, '@wallet.swisdex.local', '@wallet.placeholder.local') "
        "WHERE email LIKE '%@wallet.swisdex.local'",
    ),
    # The shared demo login account (auth_service now derives demo@<BRAND_DOMAIN>).
    (
        "users", "email",
        "UPDATE users SET email = 'demo@example.com' "
        "WHERE email = 'demo@swisdex.com' "
        "AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = 'demo@example.com')",
    ),
    # Seeded promo downline accounts (reserved .local stays mailer-suppressed).
    (
        "users", "email",
        "UPDATE users SET email = REPLACE(email, '@swisdex-promo.local', '@promo-demo.local') "
        "WHERE email LIKE '%@swisdex-promo.local'",
    ),
]


def _guard(table: str, column: str, sql: str) -> str:
    return f"""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '{table}' AND column_name = '{column}'
        ) THEN
            {sql};
        END IF;
    END $$;
    """


def upgrade() -> None:
    for table, column, sql in _GUARDED_UPDATES:
        op.execute(_guard(table, column, sql))


def downgrade() -> None:
    # Data cleanup is one-way; the previous brand strings are not restored.
    pass
