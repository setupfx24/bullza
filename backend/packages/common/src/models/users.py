"""Users, sessions, KYC docs, audit + IP logs, employees."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    password_hash = Column(String(255), nullable=True)  # nullable for OAuth-only users
    google_id = Column(String(64), nullable=True, index=True)  # Google `sub` claim if signed in via Google
    first_name = Column(String(100))
    last_name = Column(String(100))
    date_of_birth = Column(DateTime)
    country = Column(String(100))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    role = Column(String(20), default="user")
    status = Column(String(20), default="active")
    kyc_status = Column(String(20), default="pending")
    # KYC reminder cadence stage: 0 = none sent, 1 = 3-day reminder fired,
    # 2 = 7-day reminder fired (terminal — no further reminders).
    kyc_reminder_stage = Column(Integer, default=0, server_default="0", nullable=False)
    is_demo = Column(Boolean, default=False)
    # When TRUE the trader is routed to swap-free (Islamic) account groups
    # by default and is exempt from the overnight leverage fee engine.
    is_islamic = Column(Boolean, default=False, server_default="false")
    # Set to TRUE when the user holds an active VipPass (mirrored on User
    # for fast lookup at reward-application time). Gated by
    # system_settings.vip_pass_enabled until token economics land.
    is_vip = Column(Boolean, default=False, server_default="false")
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255))
    # Bcrypt-hashed single-use recovery codes shown to the user once at
    # 2FA setup. Each successful redemption pops one entry; empty list ⇒
    # user must contact support for recovery.
    two_factor_backup_codes = Column(JSONB, default=list, server_default="[]", nullable=False)
    language = Column(String(10), default="en")
    theme = Column(String(10), default="dark")
    book_type = Column(String(1), default="B", server_default="B")  # 'A' (LP routed) or 'B' (internal)
    trading_blocked_until = Column(DateTime(timezone=True))
    main_wallet_balance = Column(Numeric(18, 8), nullable=False, default=0)
    # Bonus credit auto-granted on the first approved deposit only. Lives
    # separately from main_wallet_balance so the withdrawal calculation
    # never sees it (bonus is tradeable, not withdrawable). On the first
    # approved withdrawal we zero this column AND every trading_account
    # .credit row for the user, and stamp bonus_forfeited_at so future
    # deposits don't re-grant a bonus. Migration 0056.
    main_wallet_bonus = Column(
        Numeric(18, 8), nullable=False, default=0, server_default="0",
    )
    bonus_forfeited_at = Column(DateTime(timezone=True), nullable=True)
    # Email verification — gate sign-in until the user clicks the verify
    # link once. Migration 0038 backfills TRUE for existing users so the
    # deploy doesn't lock anyone out; register_user explicitly sets FALSE
    # for new email-password sign-ups. Google / wallet sign-ups stay TRUE
    # because the third-party provider already verified ownership.
    email_verified = Column(Boolean, nullable=False, default=True, server_default="true")
    email_verified_at = Column(DateTime(timezone=True))
    # Lowercased EVM address (0x + 40 hex). Unique via the partial index
    # ix_users_wallet_address_lower (migration 0034). Set on first SIWE
    # sign-in or after a manual link from /profile/wallet/link.
    wallet_address = Column(String(42), nullable=True)
    # Personal referral code (separate from IB MLM). Every user gets one
    # at signup; populated for existing users by migration 0041. The
    # `?ref=` query string resolves to a user via this code AND falls
    # through to IBProfile.referral_code if no user match — so signups
    # from IB links keep paying IB commissions as before.
    referral_code = Column(String(20), unique=True, nullable=True)
    # Who referred this user (set once at signup). Drives the one-shot
    # first-deposit commission payout in deposit_service.
    referred_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # Last time we emailed the user a KYC-pending nudge. NULL means
    # we've never nudged them — the engine sends the first at +24h, then
    # every 7 days while KYC stays pending.
    kyc_last_reminded_at = Column(DateTime(timezone=True), nullable=True)
    # When the one-time "100% bonus on your first deposit" email went
    # out. NULL means the user hasn't been nudged yet; the engine only
    # sends this once.
    deposit_nudge_sent_at = Column(DateTime(timezone=True), nullable=True)
    # Set when this referred user crossed the qualifying trade count
    # (default 3) + KYC + funded gates. After 2026-05-26 the engine
    # NO LONGER auto-credits the referrer; this stamp only marks the
    # row as eligible to claim. The referrer presses Claim from the
    # /referral page to actually move the bounty into their
    # referral_commission_balance.
    referral_qualified_at = Column(DateTime(timezone=True), nullable=True)
    # Set on the REFERRED user's row when the referrer claimed this
    # specific referral's bounty. NULL = still claimable; non-NULL =
    # already swept into the referrer's referral_commission_balance.
    referral_claimed_at = Column(DateTime(timezone=True), nullable=True)
    # Per-user pool of claimed-but-not-yet-withdrawn referral bounties.
    # Lives on the REFERRER row. Withdraw to Main Wallet moves this
    # into main_wallet_balance and records a Transaction. Migration 0061.
    referral_commission_balance = Column(
        Numeric(18, 8), nullable=False, default=0, server_default="0",
    )
    # Per-IB pool of accumulated trade commissions from the MLM chain.
    # Lives on the IB's user row. Increments inside the IB engine on
    # each qualifying trade; "Transfer to Main Wallet" on /business
    # moves this into main_wallet_balance and writes a Transaction.
    # Migration 0062.
    ib_commission_balance = Column(
        Numeric(18, 8), nullable=False, default=0, server_default="0",
    )
    # Per-user Fixed Return rate override. NULL = use the global
    # `fixed_return_rates` setting (the rate matrix configured on
    # /admin/config/fixed-return). When set, expected shape:
    #   { "rate_matrix_pct": [[..], ..] }  same dims as the global matrix.
    # Read inside fixed_return_service.create_lock so a VIP trader can
    # be granted a non-standard ladder without changing the global
    # ladder visible to everyone else. Migration 0064.
    fixed_return_rate_override = Column(JSONB, nullable=True)
    # Eligibility-nudge engine: when the user crossed the funded-account
    # threshold and we educated them about Fixed Return + Trade Insurance.
    # NULL = never nudged; we re-nudge ~quarterly while still eligible.
    fr_insurance_nudge_sent_at = Column(DateTime(timezone=True), nullable=True)
    # Statement digest engine: last weekly / monthly digest send timestamps.
    # NULL = never sent; weekly engine runs Mondays, monthly on the 1st.
    weekly_statement_sent_at = Column(DateTime(timezone=True), nullable=True)
    monthly_statement_sent_at = Column(DateTime(timezone=True), nullable=True)
    # Post-profile-completion welcome email: gateway sets this the first
    # time it detects profile_complete flip false→true after PUT /profile.
    # NULL = never sent; gate keeps subsequent profile edits from re-mailing.
    welcome_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = relationship("TradingAccount", back_populates="user", lazy="selectin")
    sessions = relationship("UserSession", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", lazy="selectin")
    refresh_tokens = relationship("UserRefreshToken", back_populates="user", lazy="selectin")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(String(255), nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    device_info = Column(JSONB)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="password_reset_tokens")


class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class WalletAuthNonce(Base):
    """Single-use nonces for SIWE (EIP-4361) sign-in and account-link flows.

    A row is inserted by `wallet_auth_service.issue_nonce()` and consumed by
    a single atomic `UPDATE … RETURNING` in `verify_signature()`. After
    consume, `consumed_at` is set so a replay of the same SIWE message
    returns 401. `expires_at` (default 5 min from creation) prevents stale
    nonces from accumulating; a periodic cleanup is not strictly required.
    """
    __tablename__ = "wallet_auth_nonces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(String(42), nullable=False)
    nonce = Column(String(64), nullable=False, unique=True)
    chain_id = Column(Integer, nullable=False)
    issued_for = Column(String(20), nullable=False, default="login")
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    ip_address = Column(INET)
    user_agent_hash = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True))


class KYCDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    document_type = Column(String(30), nullable=False)
    file_url = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    rejection_reason = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class IPLog(Base):
    __tablename__ = "ip_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    ip_address = Column(INET, nullable=False)
    action = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(INET)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class UserAuditLog(Base):
    """Trader-facing activity (login, logout, orders) for admin review — separate from admin AuditLog."""

    __tablename__ = "user_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(80), nullable=False)
    ip_address = Column(String(64))
    device_info = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], lazy="noload")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    role = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    extra_permissions = Column(JSONB, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", lazy="selectin")
