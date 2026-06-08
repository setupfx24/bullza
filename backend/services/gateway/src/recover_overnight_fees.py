"""One-time recovery: refund the JPY/cross-pair OVERNIGHT FEE bug.

`overnight_fee_engine` used `notional = lots × price × contract_size` to
compute the daily borrowing fee, then debited that value from
`account.balance` as if it were USD. For JPY-quoted pairs (and any
cross pair quoted in a non-USD currency), the notional was actually in
JPY etc., so each daily charge was ~155× too large.

Effect: a 0.01-lot NZDJPY position held overnight got billed ~$9.43/day
instead of ~$0.06/day. Held 100 days → ~$943 over-charge. This is the
$1,266 unexplained delta on `abhishek negi`'s account (balance −$1,656
vs net P&L only −$390).

This script:
  1. Walks every `transactions` row with type='swap' for accounts that
     traded a non-USD-quote instrument referenced by `reference_id`.
  2. Recomputes the correct USD fee using the same convert helper the
     fixed engine now uses (live USDJPY tick from Redis).
  3. Sums per-account (stored_amount − correct_amount) — that's the
     over-charge to refund.
  4. Refunds via a single Transaction(type='adjustment'). The original
     swap rows + the position's `swap` column stay untouched (audit
     immutable); only the wallet balance is corrected.

Idempotent against an explicit marker: writes
`fixed_return_swap_recovered_at` on the account row (re-uses a free
column? — no; instead we tag each adjustment with a sentinel
description, and skip accounts where a prior recovery adjustment
exists).

Run inside gateway container:
    python -m services.gateway.src.recover_overnight_fees
"""
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Instrument, Position, Transaction, TradingAccount,
)
from packages.common.src.trading_service import convert_to_account_currency

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("recover-swap")

RECOVERY_TAG = "OVERNIGHT_FEE_FX_RECOVERY"


async def recover():
    async with AsyncSessionLocal() as db:
        # Pull every swap transaction. We compare each one's stored
        # `amount` against the recomputed USD value using the position
        # referenced by `reference_id`.
        swaps = (await db.execute(
            select(Transaction).where(Transaction.type == "swap")
        )).scalars().all()

        if not swaps:
            logger.info("No swap transactions in ledger.")
            return

        # Cache position + instrument lookups so we don't N+1 the DB.
        position_ids = list({s.reference_id for s in swaps if s.reference_id})
        positions = (await db.execute(
            select(Position)
            .options(selectinload(Position.instrument))
            .where(Position.id.in_(position_ids))
        )).scalars().all()
        pos_by_id = {p.id: p for p in positions}

        # Find accounts that already received a recovery adjustment so
        # we don't double-refund on re-runs.
        already = (await db.execute(
            select(Transaction.account_id)
            .where(
                Transaction.type == "adjustment",
                Transaction.description.contains(RECOVERY_TAG),
            )
        )).scalars().all()
        already_set = set(already)

        deltas: dict = {}
        affected: dict = {}

        for sw in swaps:
            if not sw.reference_id or sw.reference_id not in pos_by_id:
                continue
            pos = pos_by_id[sw.reference_id]
            inst = pos.instrument
            if not inst:
                continue

            quote = (inst.quote_currency or "").upper()
            if not quote and inst.symbol and len(inst.symbol) >= 6:
                quote = inst.symbol[3:6].upper()
            if not quote or quote == "USD":
                continue  # USD-quote pairs were always correct

            stored_amount = Decimal(str(sw.amount or 0))  # negative
            # Recompute: the OLD code stored `-fee_quote_treated_as_USD`.
            # The CORRECT USD fee is `convert(fee_quote, quote) → USD`.
            # convert factor for a single position is the same factor we
            # would have applied at the time, but we use live rate as a
            # proxy because we don't store the historical FX tick.
            converted = await convert_to_account_currency(
                stored_amount.copy_abs(),
                quote,
            )
            # Correct USD fee (signed negative)
            correct_amount = -converted
            # Difference to refund = correct - stored (which is more
            # negative — so diff is positive, i.e. a refund into balance)
            diff = correct_amount - stored_amount
            if abs(diff) < Decimal("0.01"):
                continue
            if sw.account_id in already_set:
                continue

            deltas[sw.account_id] = deltas.get(sw.account_id, Decimal("0")) + diff
            affected[sw.account_id] = affected.get(sw.account_id, 0) + 1

        if not deltas:
            logger.info("No accounts need swap correction.")
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
                    f"{RECOVERY_TAG} — corrected {affected[account_id]} swap charge(s) "
                    f"on cross-pair positions; net {'refund' if delta > 0 else 'debit'} "
                    f"{delta:+.2f} USD"
                ),
            ))
            logger.info(
                "account=%s swap_rows=%d delta=%+.2f new_balance=%.2f",
                account.account_number, affected[account_id],
                float(delta), float(new_balance),
            )

        await db.commit()
        logger.info("Done. Corrected %d account(s).", len(deltas))


if __name__ == "__main__":
    asyncio.run(recover())
