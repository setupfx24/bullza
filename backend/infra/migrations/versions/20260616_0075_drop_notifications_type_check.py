"""Drop the notifications.type CHECK constraint.

Bug (client 2026-06-16): granting a Fixed-Return bonus threw Internal Server
Error. Root cause: creating a notification with type='bonus' violated
notifications_type_check, which only allowed a fixed list
(info/warning/error/success/trade/deposit/withdrawal/margin_call/kyc/system/
alert). The app uses many more notif types (bonus, reward, staking, ...), so
the constraint has repeatedly broken features (kyc needed adding in 0005,
now bonus). Consistent with dropping other status/type CHECK constraints
(users.status 0073, insurance/transaction/bonus 0057-0060), we drop it
entirely; notif type is controlled in application code. Idempotent.

Revision ID: 0075
Revises: 0074
"""
from alembic import op


revision = "0075"
down_revision = "0074"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE notifications ADD CONSTRAINT notifications_type_check "
        "CHECK (type IN ('info','warning','error','success','trade','deposit',"
        "'withdrawal','margin_call','kyc','system','alert'))"
    )
