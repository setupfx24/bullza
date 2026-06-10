"""Add lot_size_multiplier to account_groups so cent accounts get
real cent-style trade sizing, not just ¢ display.

Client report 2026-06-09 — same trader who first asked for the cent
display said: "$ jo h woh ¢ me dikh rhe pr trade $ ke according ho
rha h cent ke according hona chiye." Translation: showing dollars as
cents on the screen is half the story — the underlying trade itself
must also scale down 100× so 0.01 lots on a cent account carries
1/100th the risk of 0.01 lots on a standard account, matching the
universal FBS / XM / RoboForex cent-account convention.

Approach: scale `lots` at order-open time by this multiplier. Engines
see (0.0001 effective lots) for what the trader typed as 0.01. P&L,
margin, swap, commission all flow through the same engine math —
they just operate on smaller numbers. The trader-side display layer
multiplies position.lots back by (1 / multiplier) so the table still
shows the value the trader typed.

Cent group multiplier = 0.01. Standard / VIP / ECN stay at 1.0. The
existing seed Cent row auto-flips so existing DBs pick up the right
value without admin intervention.

Revision ID: 0069
Revises: 0068
"""
from alembic import op
import sqlalchemy as sa


revision = "0069"
down_revision = "0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "account_groups",
        sa.Column(
            "lot_size_multiplier",
            sa.Numeric(10, 6),
            nullable=False,
            server_default=sa.text("1.0"),
        ),
    )
    # Flip the Cent seed row to the 0.01 multiplier in lockstep with
    # is_cent_account=true from Mig 0068. Re-runs are no-ops; custom
    # cent groups admin added later need to set the multiplier by hand
    # via the admin panel.
    op.execute(
        "UPDATE account_groups SET lot_size_multiplier = 0.01 "
        "WHERE LOWER(name) = 'cent'"
    )


def downgrade() -> None:
    op.drop_column("account_groups", "lot_size_multiplier")
