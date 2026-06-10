"""One-time recovery: undo the JPY/cross-pair P&L bug on balances.

Yesterday's fix (commit c66e1e2) corrected the conversion for open
positions but missed the close path — `full_profit` at
`trading_service.close_position` used the sync `calc_pnl`, which for
cross pairs (NZDJPY, EURGBP, AUDCAD…) silently returned raw QUOTE
currency. So a -37 JPY P&L was added to balance as -$37, accumulating
into accounts that went to -$12K or worse on routine 0.01-lot trades.

This script:
  1. Walks every TradeHistory row whose instrument is a cross pair
     (quote_currency != "USD" AND base_currency != "USD") OR a USD-base
     pair (USDJPY etc.) that may also have been double-converted.
  2. For each, computes the corrected USD P&L using the same
     `quote_to_account_pnl_async` we now use at close time, with
     `close_price` as the conversion reference.
  3. Sums per-account (stored_profit - corrected_profit) — that's the
     amount the bug over- (or under-) deducted from the account.
  4. Refunds (or debits) the delta to `account.balance` so the visible
     balance reflects what the user would have had if the close path
     had been correct from day one.

Safe to re-run: accounts that already carry a JPY_PNL_FX_RECOVERY
adjustment Transaction are skipped, so a second run can never
double-refund. We do NOT mutate `trade_history.profit` itself — that's
audit-immutable. Instead we issue a single Transaction of
type='adjustment' (tagged JPY_PNL_FX_RECOVERY) per affected account so
the ledger explains the change AND the next run can detect it.

Run inside gateway container:
    python -m services.gateway.src.recover_jpy_pnl_balance
"""
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Instrument, TradeHistory, TradingAccount, Transaction,
)
from packages.common.src.trading_service import quote_to_account_pnl_async

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("recover-jpy-pnl")

# Sentinel stamped on the adjustment Transaction. Accounts that already
# carry an adjustment with this tag are skipped, so re-running the
# script can NEVER double-refund (audit finding M3 — the old
# `corrected vs stored` test compared against trade_history.profit,
# which this script never mutates, so a second run re-applied the same
# delta). This mirrors the guard in recover_overnight_fees.py.
RECOVERY_TAG = "JPY_PNL_FX_RECOVERY"


async def recover():
    async with AsyncSessionLocal() as db:
        # Accounts already corrected in a prior run — skip them entirely.
        already = (await db.execute(
            select(Transaction.account_id).where(
                Transaction.type == "adjustment",
                Transaction.description.contains(RECOVERY_TAG),
            )
        )).scalars().all()
        already_set = {a for a in already if a is not None}
        rows = (await db.execute(
            select(TradeHistory)
            .options(selectinload(TradeHistory.instrument))
        )).scalars().all() if hasattr(TradeHistory, "instrument") else None

        # selectinload may not be set up for TradeHistory; fall back to a
        # manual join if needed.
        if rows is None:
            th_rows = (await db.execute(select(TradeHistory))).scalars().all()
            instrument_ids = list({th.instrument_id for th in th_rows if th.instrument_id})
            inst_rows = (await db.execute(
                select(Instrument).where(Instrument.id.in_(instrument_ids))
            )).scalars().all()
            inst_by_id = {inst.id: inst for inst in inst_rows}
            rows = []
            for th in th_rows:
                th_inst = inst_by_id.get(th.instrument_id)
                # Attach in-memory; we only read these attrs below.
                th.__dict__["instrument"] = th_inst
                rows.append(th)

        if not rows:
            logger.info("No trade_history rows found.")
            return

        deltas: dict = {}  # account_id -> Decimal delta to refund (+) or debit (-)
        affected: dict = {}  # account_id -> count of rows
        for th in rows:
            inst = th.instrument
            if not inst:
                continue
            base = (inst.base_currency or "").upper()
            quote = (inst.quote_currency or "").upper()
            # Derive from symbol if DB columns are NULL.
            if (not base or not quote) and inst.symbol and len(inst.symbol) >= 6:
                base = base or inst.symbol[:3].upper()
                quote = quote or inst.symbol[3:6].upper()
            if not quote or quote == "USD":
                # Quote-currency = USD pairs (EURUSD, XAUUSD…) were
                # already correct under the old code. Skip.
                continue

            cs = inst.contract_size or Decimal("100000")
            sv = th.side.value if hasattr(th.side, "value") else str(th.side)
            raw_quote = (
                (th.close_price - th.open_price) * th.lots * cs
                if sv == "buy"
                else (th.open_price - th.close_price) * th.lots * cs
            )
            corrected = await quote_to_account_pnl_async(
                raw_quote, base, quote, th.close_price, "USD",
                symbol=inst.symbol,
            )
            stored = th.profit or Decimal("0")
            diff = corrected - stored
            if abs(diff) < Decimal("0.01"):
                continue

            # Idempotency: never touch an account that was already
            # corrected in a previous run.
            if th.account_id in already_set:
                continue

            deltas[th.account_id] = deltas.get(th.account_id, Decimal("0")) + diff
            affected[th.account_id] = affected.get(th.account_id, 0) + 1

        if not deltas:
            logger.info("No accounts need correction — all closed trades already correct.")
            return

        for account_id, delta in deltas.items():
            account = await db.get(TradingAccount, account_id)
            if not account:
                continue

            new_balance = (account.balance or Decimal("0")) + delta
            account.balance = new_balance
            account.equity = new_balance + (account.credit or Decimal("0"))
            account.free_margin = account.equity - (account.margin_used or Decimal("0"))

            db.add(Transaction(
                user_id=account.user_id,
                account_id=account.id,
                type="adjustment",
                amount=delta,
                balance_after=new_balance,
                description=(
                    f"{RECOVERY_TAG} — JPY/cross-pair P&L recovery — "
                    f"{affected[account_id]} closed trade(s) recomputed "
                    f"(net {'refund' if delta > 0 else 'debit'} {delta:+.2f} USD)"
                ),
            ))
            logger.info(
                "account=%s rows=%d delta=%+.2f new_balance=%.2f",
                account.account_number, affected[account_id], float(delta), float(new_balance),
            )

        await db.commit()
        logger.info("Done. Corrected %d account(s).", len(deltas))


if __name__ == "__main__":
    asyncio.run(recover())
