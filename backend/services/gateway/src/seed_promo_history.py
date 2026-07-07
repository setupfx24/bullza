"""Second-pass seeder: give the promotional demo account a RICH, believable
~2-month HISTORY so nothing about it reads as freshly-seeded or fake.

The base seeder (seed_promo_account.py) creates the account + FR lock +
trading account + a few trades, but everything is dated within the last few
days and the account "Member since" is today. This script layers a coherent
two-month story on top:

  1. Ages the account — user.created_at (and the downline) moved back ~2 months.
  2. De-clusters the base seeder's rows — the funding / transfer / FR-lock
     ledger entries are re-dated to the START of the period instead of "today".
  3. ~48 CLOSED trades spread across ~62 days (mixed win/loss, net modestly
     positive), backdated open/close, net P&L applied to the account balance.
  4. Deposit + withdrawal HISTORY — a handful of approved deposits and
     completed withdrawals across the two months (crypto / bank / UPI), written
     as real Deposit/Withdrawal rows (visible in admin) + matching ledger
     transactions, with the main-wallet balance moved by the exact net.
  5. Spreads the referral / IB commission timestamps across the period.
  6. Backdates the active FR lock by 60 days so "Interest accrued" shows a real
     growing value (next_payout kept in the future so no cycle mis-fires).

SAFETY
  - DRY-RUN by default. Add --execute to write.
        python -m services.gateway.src.seed_promo_history            # dry-run
        python -m services.gateway.src.seed_promo_history --execute   # write
  - IDEMPOTENT: tags trades comment='seed-history' and returns immediately if
    any exist — a re-run never doubles history or re-ages anything.
  - Requires the base account to exist (run seed_promo_account.py first).
  - Reproducible: a fixed RNG seed makes every run generate the same history.
"""
import argparse
import asyncio
import logging
import random
import secrets
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    User, TradingAccount, Position, TradeHistory, Instrument, Transaction,
    Deposit, Withdrawal, IBCommission, Referral, PositionStatus, OrderSide,
    FixedReturnLock,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("seed-promo-history")

# ── Config ──────────────────────────────────────────────────────────────────
TARGET_EMAIL = "amardeepsonar2001@gmail.com"
HISTORY_DAYS = 62                 # spread activity across ~2 months
NUM_TRADES = 48
FR_BACKDATE_DAYS = 60
SEED_MARKER = "seed-history"
RNG = random.Random(20260707)     # fixed seed → deterministic

# symbol -> (base_price, price_decimals, (lot_min, lot_max))
SYMBOLS = {
    "EURUSD": (Decimal("1.08500"), 5, (Decimal("0.02"), Decimal("0.10"))),
    "GBPUSD": (Decimal("1.27000"), 5, (Decimal("0.02"), Decimal("0.10"))),
    "XAUUSD": (Decimal("2600.00"), 2, (Decimal("0.01"), Decimal("0.05"))),
    "BTCUSD": (Decimal("62000.00"), 2, (Decimal("0.005"), Decimal("0.02"))),
    "ETHUSD": (Decimal("3000.00"), 2, (Decimal("0.02"), Decimal("0.08"))),
}
PNL_MEAN = Decimal("4")
PNL_SD = 26.0
PNL_MIN, PNL_MAX = Decimal("-70"), Decimal("85")

# Deposit / withdrawal history: (days_ago, amount, method). Ordered so the
# running main-wallet balance never dips below zero. Net = +200 (a little spare
# cash left in the wallet, the rest deployed into trading + Fixed Return).
DEPOSITS = [
    (58, Decimal("1200"), "crypto_usdt"),
    (44, Decimal("600"),  "bank"),
    (16, Decimal("400"),  "upi"),
]
WITHDRAWALS = [
    (30, Decimal("800"),  "bank"),
    (6,  Decimal("1200"), "crypto_usdt"),
]


def _now():
    return datetime.now(timezone.utc)


def _q(value: Decimal, decimals: int) -> Decimal:
    return value.quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)


def profit_for(side, lots, open_price, close_price, contract_size) -> Decimal:
    if side == OrderSide.BUY:
        return (close_price - open_price) * lots * contract_size
    return (open_price - close_price) * lots * contract_size


async def run(execute: bool):
    tag = "" if execute else "[dry-run] "
    now = _now()
    period_start = now - timedelta(days=HISTORY_DAYS)
    async with AsyncSessionLocal() as db:
        # ── Target user + trading account ─────────────────────────────────
        main = (await db.execute(
            select(User).where(func.lower(User.email) == TARGET_EMAIL.lower())
        )).scalar_one_or_none()
        if main is None:
            raise SystemExit(f"User {TARGET_EMAIL} does not exist. Run seed_promo_account.py first.")
        acct = (await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == main.id,
                TradingAccount.is_demo == False,  # noqa: E712
            ).order_by(TradingAccount.created_at)
        )).scalars().first()
        if acct is None:
            raise SystemExit(f"{TARGET_EMAIL} has no live trading account. Run seed_promo_account.py first.")
        logger.info("%starget %s  account=%s  balance=$%s  wallet=$%s", tag, TARGET_EMAIL,
                    acct.account_number, (acct.balance or Decimal('0')).quantize(Decimal('0.01')),
                    (main.main_wallet_balance or Decimal('0')).quantize(Decimal('0.01')))

        # ── Idempotency: bail if history already seeded ───────────────────
        already = (await db.execute(
            select(func.count(Position.id)).where(
                Position.account_id == acct.id, Position.comment == SEED_MARKER
            )
        )).scalar() or 0
        if already > 0:
            logger.info("%shistory already seeded (%s tagged trades) — nothing to do.", tag, already)
            return

        # ── 1. Age the account (Member since ~2 months ago) ───────────────
        main.created_at = period_start
        logger.info("%sage account: created_at -> %s", tag, period_start.date())

        # Downline: created between day -55 and -35 (referred over the period).
        downline = (await db.execute(
            select(User).where(User.referred_by_user_id == main.id)
        )).scalars().all()
        for i, child in enumerate(downline):
            child.created_at = now - timedelta(days=55 - i * 8, hours=RNG.uniform(0, 12))
            child.referral_qualified_at = child.created_at + timedelta(days=2)
            child.referral_claimed_at = child.created_at + timedelta(days=3)

        # ── 2. De-cluster the base seeder's ledger to the period start ────
        base_txns = (await db.execute(
            select(Transaction).where(Transaction.user_id == main.id)
        )).scalars().all()
        for t in base_txns:
            desc = (t.description or "").lower()
            if t.type == "deposit" and "funding" in desc:
                t.created_at = period_start                       # initial funding
            elif t.type == "fixed_return_lock":
                t.created_at = period_start + timedelta(days=1)   # locked next day
            elif t.type == "transfer":
                t.created_at = period_start + timedelta(days=1, hours=2)
            elif t.type == "insurance_fee":
                t.created_at = now - timedelta(days=2)            # insurance on a live trade
        logger.info("%sre-dated %s base ledger rows to the start of the period", tag, len(base_txns))

        # ── 3. ~NUM_TRADES closed trades across HISTORY_DAYS ──────────────
        available: dict[str, Instrument] = {}
        for sym in SYMBOLS:
            inst = (await db.execute(
                select(Instrument).where(func.upper(Instrument.symbol) == sym.upper())
            )).scalar_one_or_none()
            if inst is not None:
                available[sym] = inst
        if not available:
            raise SystemExit("none of the seed symbols exist as instruments — cannot seed trades.")

        net = Decimal("0")
        wins = losses = 0
        slice_days = HISTORY_DAYS / NUM_TRADES
        for i in range(NUM_TRADES):
            sym = RNG.choice(list(available.keys()))
            inst = available[sym]
            base, dec, (lmin, lmax) = SYMBOLS[sym]
            cs = Decimal(str(inst.contract_size or 100000))

            days_ago = HISTORY_DAYS - (i * slice_days) - RNG.uniform(0, slice_days)
            days_ago = max(0.4, days_ago)
            opened_at = now - timedelta(days=days_ago, hours=RNG.uniform(0, 6))
            closed_at = min(opened_at + timedelta(hours=RNG.uniform(2, 54)), now - timedelta(minutes=5))
            if closed_at <= opened_at:
                closed_at = opened_at + timedelta(hours=1)

            side = OrderSide.BUY if RNG.random() < 0.5 else OrderSide.SELL
            span = lmax - lmin
            lots = _q(lmin + span * Decimal(str(RNG.random())), 3) or lmin

            pnl = Decimal(str(RNG.gauss(float(PNL_MEAN), PNL_SD)))
            pnl = max(PNL_MIN, min(PNL_MAX, pnl))
            open_price = _q(base * (Decimal("1") + Decimal(str(RNG.uniform(-0.02, 0.02)))), dec)
            delta = pnl / (lots * cs)
            close_price = _q(open_price + delta, dec) if side == OrderSide.BUY else _q(open_price - delta, dec)
            profit = profit_for(side, lots, open_price, close_price, cs).quantize(Decimal("0.01"))

            pos = Position(
                account_id=acct.id, instrument_id=inst.id, side=side,
                status=PositionStatus.CLOSED, lots=lots,
                open_price=open_price, close_price=close_price,
                profit=profit, created_at=opened_at, closed_at=closed_at, comment=SEED_MARKER,
            )
            db.add(pos)
            await db.flush()
            db.add(TradeHistory(
                position_id=pos.id, account_id=acct.id, instrument_id=inst.id,
                side=side, lots=lots, open_price=open_price, close_price=close_price,
                profit=profit, opened_at=opened_at, closed_at=closed_at, close_reason="manual",
            ))
            net += profit
            wins += 1 if profit >= 0 else 0
            losses += 1 if profit < 0 else 0

        acct.balance = (acct.balance or Decimal("0")) + net
        mu = acct.margin_used or Decimal("0")
        acct.equity = (acct.balance or Decimal("0")) + (acct.credit or Decimal("0"))
        acct.free_margin = acct.equity - mu
        acct.margin_level = (acct.equity / mu * Decimal("100")) if mu > 0 else Decimal("9999")
        logger.info("%screated %s trades (wins=%s losses=%s) net=$%s  acct balance -> $%s",
                    tag, NUM_TRADES, wins, losses, net.quantize(Decimal("0.01")),
                    acct.balance.quantize(Decimal("0.01")))

        # ── 4. Deposit + withdrawal history (admin rows + ledger) ─────────
        # Build a chronologically-ordered list of wallet moves and replay them
        # forward from the CURRENT wallet balance so balance_after is coherent
        # and the wallet ends at old + net(deposits - withdrawals).
        events = [(d, amt, m, "deposit") for (d, amt, m) in DEPOSITS] + \
                 [(d, amt, m, "withdrawal") for (d, amt, m) in WITHDRAWALS]
        events.sort(key=lambda e: -e[0])  # oldest (largest days_ago) first
        running = main.main_wallet_balance or Decimal("0")
        for days_ago, amount, method, kind in events:
            when = now - timedelta(days=days_ago, hours=RNG.uniform(0, 8))
            if kind == "deposit":
                running += amount
                db.add(Deposit(
                    user_id=main.id, account_id=None, amount=amount, currency="USD",
                    method=method, status="approved", approved_by=main.id, approved_at=when,
                    transaction_id=f"SEED-{secrets.token_hex(4).upper()}",
                    crypto_tx_hash=("0x" + secrets.token_hex(20)) if method.startswith("crypto") else None,
                    created_at=when,
                ))
                db.add(Transaction(
                    user_id=main.id, account_id=None, type="deposit", amount=amount,
                    balance_after=running, description=f"Deposit via {method}", created_at=when,
                ))
            else:
                running -= amount
                db.add(Withdrawal(
                    user_id=main.id, account_id=None, amount=amount, currency="USD",
                    method=method, status="completed", approved_by=main.id,
                    approved_at=when, completed_at=when + timedelta(hours=1),
                    crypto_address=("0x" + secrets.token_hex(20)) if method.startswith("crypto") else None,
                    created_at=when,
                ))
                db.add(Transaction(
                    user_id=main.id, account_id=None, type="withdrawal", amount=-amount,
                    balance_after=running, description=f"Withdrawal via {method}", created_at=when,
                ))
        main.main_wallet_balance = running
        logger.info("%sdeposits=%s withdrawals=%s  wallet -> $%s", tag, len(DEPOSITS),
                    len(WITHDRAWALS), running.quantize(Decimal("0.01")))

        # ── 5. Spread referral / IB commission timestamps ─────────────────
        ib_comms = []
        if downline:
            ib_comms = (await db.execute(
                select(IBCommission).where(
                    IBCommission.source_user_id.in_([c.id for c in downline])
                )
            )).scalars().all()
        for i, c in enumerate(ib_comms):
            c.created_at = now - timedelta(days=50 - i * 7, hours=RNG.uniform(0, 12))
        refs = (await db.execute(
            select(Referral).where(Referral.referrer_id == main.id)
        )).scalars().all()
        for i, r in enumerate(refs):
            r.created_at = now - timedelta(days=52 - i * 7, hours=RNG.uniform(0, 12))
        logger.info("%sspread %s IB commissions + %s referrals over the period", tag, len(ib_comms), len(refs))

        # ── 6. Backdate the active FR lock so accrued shows a real value ──
        lock = (await db.execute(
            select(FixedReturnLock).where(
                FixedReturnLock.user_id == main.id, FixedReturnLock.state == "active",
            ).order_by(FixedReturnLock.locked_at)
        )).scalars().first()
        if lock is None:
            logger.info("%sno active FR lock — skipping FR backdate", tag)
        else:
            shift = timedelta(days=FR_BACKDATE_DAYS)
            old = lock.locked_at
            lock.locked_at = lock.locked_at - shift
            if lock.matures_at:
                lock.matures_at = lock.matures_at - shift
            if lock.next_payout_at:
                np = lock.next_payout_at - shift
                if np <= now + timedelta(days=1):
                    np = now + timedelta(days=30)
                lock.next_payout_at = np
            logger.info("%sFR lock $%s backdated %sd (%s -> %s)", tag, lock.principal,
                        FR_BACKDATE_DAYS, old.date() if old else "?", lock.locked_at.date())

        # ── Commit / rollback ─────────────────────────────────────────────
        if execute:
            await db.commit()
            logger.info("DONE — committed. %s now has a full ~2-month history.", TARGET_EMAIL)
        else:
            await db.rollback()
            logger.info("[dry-run] rolled back — no changes written. Re-run with --execute to apply.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Seed a full ~2-month history onto the promo demo account.")
    p.add_argument("--execute", action="store_true", help="actually write (default: dry-run)")
    args = p.parse_args()
    asyncio.run(run(execute=args.execute))
