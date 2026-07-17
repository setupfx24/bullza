"""AI Station — display-only TradingView/admin trades mirrored onto AI-Powered
Staking locks.

Adds two tables (ai_station_signals, ai_station_trades). Nothing here touches
the existing fixed_return / wallet / trading tables — this subsystem is purely
additive and display-only.

Revision ID: 0098
Revises: 0097
"""
from alembic import op


revision = "0098"
down_revision = "0097"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_station_signals (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source        VARCHAR(20)  NOT NULL DEFAULT 'admin',
            symbol        VARCHAR(30)  NOT NULL,
            side          VARCHAR(10)  NOT NULL,
            entry_price   NUMERIC(18, 8) NOT NULL,
            stop_loss     NUMERIC(18, 8),
            take_profit   NUMERIC(18, 8),
            close_price   NUMERIC(18, 8),
            status        VARCHAR(20)  NOT NULL DEFAULT 'open',
            opened_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
            closed_at     TIMESTAMPTZ,
            fanout_count  INTEGER      NOT NULL DEFAULT 0,
            external_id   VARCHAR(120),
            raw           JSONB,
            note          TEXT,
            created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_signals_status ON ai_station_signals (status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_signals_opened ON ai_station_signals (opened_at);")
    # Dedup TradingView replays: at most one signal per non-null external_id.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_signals_external
        ON ai_station_signals (external_id) WHERE external_id IS NOT NULL;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_station_trades (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            signal_id     UUID NOT NULL REFERENCES ai_station_signals(id) ON DELETE CASCADE,
            lock_id       UUID NOT NULL REFERENCES fixed_return_locks(id) ON DELETE CASCADE,
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            symbol        VARCHAR(30)  NOT NULL,
            side          VARCHAR(10)  NOT NULL,
            lots          NUMERIC(18, 4) NOT NULL,
            entry_price   NUMERIC(18, 8) NOT NULL,
            close_price   NUMERIC(18, 8),
            stop_loss     NUMERIC(18, 8),
            take_profit   NUMERIC(18, 8),
            pnl           NUMERIC(18, 2),
            status        VARCHAR(20)  NOT NULL DEFAULT 'open',
            opened_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
            closed_at     TIMESTAMPTZ,
            is_edited     BOOLEAN      NOT NULL DEFAULT false,
            created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_trades_signal ON ai_station_trades (signal_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_trades_lock ON ai_station_trades (lock_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_trades_user ON ai_station_trades (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_trades_status ON ai_station_trades (status);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ai_trades_opened ON ai_station_trades (opened_at);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_station_trades;")
    op.execute("DROP TABLE IF EXISTS ai_station_signals;")
