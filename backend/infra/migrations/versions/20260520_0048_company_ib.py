"""Designate a 'company / house' IB the broker uses for its own
referral campaigns and as the default parent for unreferred signups.

Two new system_settings keys (no schema change):

  company_ib_user_id              UUID — which user is the house IB.
                                  NULL means none is designated; the
                                  admin picks one from the existing
                                  approved-IBs dropdown.

  company_ib_attach_unreferred    bool — when true, new signups that
                                  arrive WITHOUT a ?ref= code are
                                  auto-attached to the house IB via a
                                  Referral row. Default false so the
                                  feature stays opt-in.

Revision ID: 0048
Revises: 0047
"""
from alembic import op


revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Empty UUID string = unset. We don't seed a real user_id because the
    # admin picks one after deploy. NULL handling in the reader keeps
    # things sane.
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES ('company_ib_user_id', '""')
        ON CONFLICT (key) DO NOTHING;
        """
    )
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES ('company_ib_attach_unreferred', 'false')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM system_settings "
        "WHERE key IN ('company_ib_user_id', 'company_ib_attach_unreferred');"
    )
