"""Decommission previous-client product modules.

The white-label reset removes five product lines and the 4-eyes gate that
only existed for the previous tenant. Code for all of them is deleted; this
migration drops their tables and the User columns that fed them.

Removed:
  * AI Station (TradingView signal fan-out)
  * AI-Powered Staking Program (fixed-return locks)
  * Staking (flexible / locked plans)
  * Play Zone (spin wheel, lottery, bidding)
  * Rewards / XP / Artha Coins (missions, store, campaigns, lifestyle, VIP)
  * Dual admin approval (admin_approval_requests)

Kept: trading, wallet, KYC, IB/referral, PAMM/MAMM, trade insurance, RM.

IRREVERSIBLE — downgrade() does not recreate these tables or their data.
Take a backup before running (scripts/backup.sh).

Revision ID: 0105
Revises: 0104
"""
from alembic import op

revision = "0105"
down_revision = "0104"
branch_labels = None
depends_on = None

# Child tables first so FK dependencies unwind cleanly; CASCADE covers any
# FK we don't know about on a given deployment.
_TABLES = [
    # AI Station
    "ai_station_trades",
    "ai_station_signals",
    # AI-Powered Staking Program
    "fixed_return_locks",
    # Staking
    "staking_reward_accruals",
    "staking_positions",
    "staking_plans",
    # Play Zone
    "bids",
    "bidding_rounds",
    "lottery_tickets",
    "lottery_rounds",
    "spin_results",
    "spin_wheel_prizes",
    # Rewards / XP / Artha Coins
    "reward_campaign_claims",
    "reward_campaign_tiers",
    "reward_campaigns",
    "lifestyle_fulfillments",
    "rewards_transactions",
    "rewards_user_mission_progress",
    "rewards_missions",
    "reward_store_items",
    "rewards_user_state",
    # VIP pass
    "vip_passes",
    # Dual admin approval (4-eyes)
    "admin_approval_requests",
]

_USER_COLUMNS = [
    "is_vip",
    "fr_referral_mode",
    "fr_referral_principal_pct_override",
    "fr_referral_interest_pct_override",
    "fixed_return_rate_override",
    "fr_insurance_nudge_sent_at",
]

# system_settings rows that configured the removed modules. Left-over rows
# would be dead weight the new tenant's admin UI can no longer edit.
_SETTING_KEYS = [
    "ai_station_enabled", "ai_station_terminal_enabled", "ai_station_webhook_secret",
    "ai_station_slabs", "ai_station_disabled_users", "ai_station_strategies",
    "fixed_return_rates", "fr_referral_principal_pct", "fr_referral_interest_pct",
    "vip_pass_enabled",
    "dual_approval_threshold_usd",
    "deposit_dual_approval_required", "deposit_dual_approval_min_usd",
    "withdrawal_dual_approval_required", "withdrawal_dual_approval_min_usd",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    for col in _USER_COLUMNS:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")
    keys = ", ".join(f"'{k}'" for k in _SETTING_KEYS)
    op.execute(
        "DO $$ BEGIN "
        "IF to_regclass('system_settings') IS NOT NULL THEN "
        f"DELETE FROM system_settings WHERE key IN ({keys}); "
        "END IF; END $$;"
    )


def downgrade() -> None:
    # One-way: the dropped tables held product data that no longer has code
    # behind it. Restore from a backup if this needs undoing.
    pass
