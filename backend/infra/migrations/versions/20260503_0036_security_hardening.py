"""Security + scalability hardening pass:

- Critical composite/partial indexes on the hot query paths the audit
  flagged (orders by account, positions by account/status, deposits/
  withdrawals/transactions by user+status, trades by account/closed_at).
- ``processed_webhooks`` table for at-least-once webhook idempotency
  (NOWPayments, OxaPay): UNIQUE (provider, external_id) prevents
  double-credit on replay.
- ``admin_approval_requests`` table backing the 4-eyes rule on
  withdrawals and large balance mutations (admin who creates the request
  cannot approve it; status transitions are audited).

Revision ID: 0036
Revises: 0035
"""
from alembic import op


revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Composite indexes on hot paths ──────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_orders_account_created   ON orders   (account_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_orders_account_status    ON orders   (account_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_positions_account_status ON positions(account_id, status);")
    # Partial index — overwhelmingly the engine cares about open positions only.
    op.execute("CREATE INDEX IF NOT EXISTS ix_positions_open_by_account ON positions(account_id) WHERE status = 'open';")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deposits_user_created    ON deposits (user_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deposits_user_status     ON deposits (user_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_withdrawals_user_created ON withdrawals (user_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_withdrawals_user_status  ON withdrawals (user_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transactions_user_created ON transactions (user_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_trade_history_account_closed ON trade_history (account_id, closed_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_admin_created ON audit_logs (admin_id, created_at DESC);")

    # ── Webhook idempotency ─────────────────────────────────────────────
    # Replay-safety for NOWPayments + OxaPay IPNs. The provider's external
    # ID (payment_id / track_id) is the natural dedup key; (provider, id)
    # is unique. Inserting on receive is the gate — a duplicate IPN sees
    # the unique-violation and the handler short-circuits to 200 OK.
    op.execute("""
        CREATE TABLE IF NOT EXISTS processed_webhooks (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            provider      VARCHAR(40)  NOT NULL,
            external_id   VARCHAR(120) NOT NULL,
            event_type    VARCHAR(60),
            payload_hash  CHAR(64),
            received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_processed_webhooks UNIQUE (provider, external_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_processed_webhooks_received ON processed_webhooks (received_at DESC);")

    # ── 4-eyes admin approval ───────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS admin_approval_requests (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            action          VARCHAR(60)  NOT NULL,        -- e.g. withdrawal_approve, fund_add, fund_deduct
            target_type     VARCHAR(40)  NOT NULL,        -- withdrawal | user | trading_account
            target_id       UUID         NOT NULL,
            payload         JSONB        NOT NULL,        -- snapshot of the requested change
            requested_by    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            requested_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            approved_by     UUID         REFERENCES users(id) ON DELETE RESTRICT,
            approved_at     TIMESTAMPTZ,
            rejected_by     UUID         REFERENCES users(id) ON DELETE RESTRICT,
            rejected_at     TIMESTAMPTZ,
            rejection_reason TEXT,
            status          VARCHAR(16)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executed', 'expired')),
            expires_at      TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
            executed_at     TIMESTAMPTZ,
            -- Same admin cannot approve their own request.
            CONSTRAINT chk_distinct_approver CHECK (approved_by IS NULL OR approved_by <> requested_by)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_aar_status        ON admin_approval_requests (status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_aar_target        ON admin_approval_requests (target_type, target_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_aar_requested_by  ON admin_approval_requests (requested_by);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_aar_pending       ON admin_approval_requests (expires_at) WHERE status = 'pending';")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_approval_requests;")
    op.execute("DROP TABLE IF EXISTS processed_webhooks;")
    for ix in [
        "ix_orders_account_created",
        "ix_orders_account_status",
        "ix_positions_account_status",
        "ix_positions_open_by_account",
        "ix_deposits_user_created",
        "ix_deposits_user_status",
        "ix_withdrawals_user_created",
        "ix_withdrawals_user_status",
        "ix_transactions_user_created",
        "ix_trade_history_account_closed",
        "ix_audit_logs_admin_created",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {ix};")
