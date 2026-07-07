"""Second-pass seeder: give the promotional demo account a RICH ~2-month
HISTORY so its dashboards (Trade History, account P&L, Fixed Return accrued)
look like a real, active account rather than a 3-day-old one.

Why this exists separately from seed_promo_account.py: the base seeder creates
the account, FR lock, trading account and a handful of trades — but all within
the last ~3 days, and the FR lock is dated NOW. The client wants ~2 months of
history. This script is ADDITIVE and safe to run once after the base seeder:

  - ~40 CLOSED trades spread across the last ~62 days (mixed win/loss, net
    modestly positive), each with backdated opened_at/closed_at so the Trade
    History + equity curve span two months.
  - Backdates the existing active FR lock by 60 days (locked_at / matures_at /
    next_payout_at all shifted together) so "Interest accrued" shows a real,
    growing number instead of $0. next_payout_at is kept in the FUTURE so the
    payout engine never fires a surprise cycle.

SAFETY
  - DRY-RUN by default. Prints the plan, writes NOTHING. Add --execute to write.
        python -m services.gateway.src.seed_promo_history            # dry-run
        python -m services.gateway.src.seed_promo_history --execute   # write
  - IDEMPOTENT: tags every trade it creates with comment='seed-history' and
    skips entirely if any such trade already exists — a re-run never doubles
    the history or re-shifts the FR lock.
  - The target account MUST already exist (run seed_promo_account.py first).
  - Only the TRADING ACCOUNT balance moves (by the net realized P&L of the
    seeded trades); the main wallet is never touched. Reproducible: a fixed
    RNG seed makes every run generate the same history.
"""
import argparse
import asyncio
import logging
import random
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    User, TradingAccount, Position, TradeHistory, Instrument,
    PositionStatus, OrderSide, FixedReturnLock,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("seed-promo-history")

# ── Config ──────────────────────────────────────────────────────────────────
TARGET_EMAIL = "amardeepsonar2001@gmail.com"
HISTORY_DAYS = 62                 # spread trades across ~2 months
NUM_TRADES = 40
FR_BACKDATE_DAYS = 60             # move the FR lock start back 2 months
SEED_MARKER = "seed-history"      # idempotency tag on Position.comment
RNG = random.Random(20260707)     # fixed seed → deterministic, reproducible runs

# symbol -> (base_price, price_decimals, (lot_min, lot_max))
SYMBOLS = {
    "EURUSD": (Decimal("1.08500"), 5, (Decimal("0.02"), Decimal("0.10"))),
    "GBPUSD": (Decimal("1.27000"), 5, (Decimal("0.02"), Decimal("0.10"))),
    "XAUUSD": (Decimal("2600.00"), 2, (Decimal("0.01"), Decimal("0.05"))),
    "BTCUSD": (Decimal("62000.00"), 2, (Decimal("0.005"), Decimal("0.02"))),
    "ETHUSD": (Decimal("3000.00"), 2, (Decimal("0.02"), Decimal("0.08"))),
}
# Per-trade P&L distribution (USD): slight positive bias so 2 months nets a
# modest gain rather than a wild swing. Clamped to keep any single trade sane.
PNL_MEAN = Decimal("4")
PNL_SD = 26.0
PNL_MIN, PNL_MAX = Decimal("-70"), Decimal("85")


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
    async with AsyncSessionLocal() as db:
        # ── 1. Target user + trading account ──────────────────────────────
        main = (await db.execute(
            select(User).where(func.lower(User.email) == TARGET_EMAIL.lower())
        )).scalar_one_or_none()
        if main is None:
            raise SystemExit(
                f"User {TARGET_EMAIL} does not exist. Run seed_promo_account.py first."
            )
        acct = (await db.execute(
            select(TradingAccount).where(
                TradingAccount.user_id == main.id,
                TradingAccount.is_demo == False,  # noqa: E712
            ).order_by(TradingAccount.created_at)
        )).scalars().first()
        if acct is None:
            raise SystemExit(
                f"{TARGET_EMAIL} has no live trading account. Run seed_promo_account.py first."
            )
        logger.info("%starget %s  account=%s  balance=$%s", tag, TARGET_EMAIL,
                    acct.account_number, (acct.balance or Decimal('0')).quantize(Decimal('0.01')))

        # ── 2. Idempotency: bail if history already seeded ────────────────
        already = (await db.execute(
            select(func.count(Position.id)).where(
                Position.account_id == acct.id, Position.comment == SEED_MARKER
            )
        )).scalar() or 0
        if already > 0:
            logger.info("%shistory already seeded (%s tagged trades) — nothing to do.", tag, already)
            return

        # ── 3. Load the instruments we have prices for ────────────────────
        available: dict[str, Instrument] = {}
        for sym in SYMBOLS:
            inst = (await db.execute(
                select(Instrument).where(func.upper(Instrument.symbol) == sym.upper())
            )).scalar_one_or_none()
            if inst is not None:
                available[sym] = inst
        if not available:
            raise SystemExit("none of the seed symbols exist as instruments — cannot seed trades.")
        logger.info("%susing instruments: %s", tag, ", ".join(available))

        # ── 4. Generate ~NUM_TRADES closed trades across HISTORY_DAYS ──────
        now = _now()
        net = Decimal("0")
        wins = losses = 0
        # Even-ish spread: one trade per slice + jitter, oldest first.
        slice_days = HISTORY_DAYS / NUM_TRADES
        made = 0
        for i in range(NUM_TRADES):
            sym = RNG.choice(list(available.keys()))
            inst = available[sym]
            base, dec, (lmin, lmax) = SYMBOLS[sym]
            cs = Decimal(str(inst.contract_size or 100000))

            # Timing: slice i (from oldest) + jitter, hold a few hrs..2.5 days.
            days_ago = HISTORY_DAYS - (i * slice_days) - RNG.uniform(0, slice_days)
            days_ago = max(0.4, days_ago)
            opened_at = now - timedelta(days=days_ago, hours=RNG.uniform(0, 6))
            hold = timedelta(hours=RNG.uniform(2, 54))
            closed_at = min(opened_at + hold, now - timedelta(minutes=5))
            if closed_at <= opened_at:
                closed_at = opened_at + timedelta(hours=1)

            side = OrderSide.BUY if RNG.random() < 0.5 else OrderSide.SELL
            # Lots: random within the symbol band, rounded to 3 dp.
            span = lmax - lmin
            lots = _q(lmin + span * Decimal(str(RNG.random())), 3)
            if lots <= 0:
                lots = lmin

            # Desired P&L → derive close_price so open/close/profit stay exact.
            pnl = Decimal(str(RNG.gauss(float(PNL_MEAN), PNL_SD)))
            pnl = max(PNL_MIN, min(PNL_MAX, pnl))
            open_price = _q(base * (Decimal("1") + Decimal(str(RNG.uniform(-0.02, 0.02)))), dec)
            delta = pnl / (lots * cs)  # price move that yields `pnl`
            if side == OrderSide.BUY:
                close_price = _q(open_price + delta, dec)
            else:
                close_price = _q(open_price - delta, dec)
            # Recompute the actual profit from the rounded prices (source of truth).
            profit = profit_for(side, lots, open_price, close_price, cs).quantize(Decimal("0.01"))

            pos = Position(
                account_id=acct.id, instrument_id=inst.id, side=side,
                status=PositionStatus.CLOSED, lots=lots,
                open_price=open_price, close_price=close_price,
                profit=profit, created_at=opened_at, closed_at=closed_at,
                comment=SEED_MARKER,
            )
            db.add(pos)
            await db.flush()
            db.add(TradeHistory(
                position_id=pos.id, account_id=acct.id, instrument_id=inst.id,
                side=side, lots=lots, open_price=open_price, close_price=close_price,
                profit=profit, opened_at=opened_at, closed_at=closed_at,
                close_reason="manual",
            ))
            net += profit
            made += 1
            wins += 1 if profit >= 0 else 0
            losses += 1 if profit < 0 else 0

        logger.info("%screated %s closed trades  wins=%s losses=%s  net P&L=$%s",
                    tag, made, wins, losses, net.quantize(Decimal("0.01")))

        # Apply the net realized P&L to the trading account balance + refresh
        # equity/free_margin (open-position margin is unchanged by closed trades).
        acct.balance = (acct.balance or Decimal("0")) + net
        mu = acct.margin_used or Decimal("0")
        acct.equity = (acct.balance or Decimal("0")) + (acct.credit or Decimal("0"))
        acct.free_margin = acct.equity - mu
        acct.margin_level = (acct.equity / mu * Decimal("100")) if mu > 0 else Decimal("9999")
        logger.info("%s  account balance -> $%s  equity -> $%s", tag,
                    acct.balance.quantize(Decimal("0.01")), acct.equity.quantize(Decimal("0.01")))

        # ── 5. Backdate the active FR lock so accrued shows a real value ──
        lock = (await db.execute(
            select(FixedReturnLock).where(
                FixedReturnLock.user_id == main.id,
                FixedReturnLock.state == "active",
            ).order_by(FixedReturnLock.locked_at)
        )).scalars().first()
        if lock is None:
            logger.info("%sno active FR lock — skipping FR backdate", tag)
        else:
            shift = timedelta(days=FR_BACKDATE_DAYS)
            old_locked = lock.locked_at
            lock.locked_at = lock.locked_at - shift
            if lock.matures_at:
                lock.matures_at = lock.matures_at - shift
            if lock.next_payout_at:
                new_np = lock.next_payout_at - shift
                # Never let the next payout land in the past — the engine would
                # immediately fire a cycle. Clamp to at least 30 days out.
                if new_np <= now + timedelta(days=1):
                    new_np = now + timedelta(days=30)
                lock.next_payout_at = new_np
            logger.info("%sFR lock $%s backdated %sd (locked_at %s -> %s), next_payout=%s",
                        tag, lock.principal, FR_BACKDATE_DAYS,
                        old_locked.date() if old_locked else "?",
                        lock.locked_at.date(), lock.next_payout_at)

        # ── Commit / rollback ─────────────────────────────────────────────
        if execute:
            await db.commit()
            logger.info("DONE — committed. %s now has ~2 months of history.", TARGET_EMAIL)
        else:
            await db.rollback()
            logger.info("[dry-run] rolled back — no changes written. Re-run with --execute to apply.")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Seed ~2 months of history onto the promo demo account.")
    p.add_argument("--execute", action="store_true", help="actually write (default: dry-run)")
    args = p.parse_args()
    asyncio.run(run(execute=args.execute))
