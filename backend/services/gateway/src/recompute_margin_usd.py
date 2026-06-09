"""One-time fix: Recompute `margin_used` on every trading account that has
open positions, after the JPY/cross-pair conversion bug fix.

Before the fix, `(lots * contract_size * price) / leverage` was stored on
`account.margin_used` directly — which is the position notional in the
QUOTE currency, not USD. For NZDJPY at 0.01 lots that meant ~189 JPY
stored as $189 instead of the correct ~$1.20.

This script walks every account, sums up the corrected (FX-converted)
margin per open position, and resets `margin_used` / `free_margin` /
`equity` to the right values. Safe to re-run.

Run inside gateway container:
    python -m src.recompute_margin_usd
"""
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import Position, TradingAccount
from packages.common.src.trading_service import convert_to_account_currency

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("recompute-margin")


async def recompute():
    async with AsyncSessionLocal() as db:
        accounts = (await db.execute(select(TradingAccount))).scalars().all()
        if not accounts:
            logger.info("No trading accounts found.")
            return

        fixed = 0
        for account in accounts:
            positions = (await db.execute(
                select(Position)
                .options(selectinload(Position.instrument))
                .where(
                    Position.account_id == account.id,
                    Position.status == "open",
                )
            )).scalars().all()

            new_margin = Decimal("0")
            for pos in positions:
                if not pos.instrument:
                    continue
                cs = pos.instrument.contract_size or Decimal("100000")
                raw_quote = (pos.lots * cs * pos.open_price) / Decimal(str(account.leverage or 1))
                converted = await convert_to_account_currency(
                    raw_quote,
                    getattr(pos.instrument, "quote_currency", None) or (
                        pos.instrument.symbol[3:6].upper()
                        if pos.instrument.symbol and len(pos.instrument.symbol) >= 6
                        else None
                    ),
                )
                new_margin += converted

            old_margin = account.margin_used or Decimal("0")
            if abs(new_margin - old_margin) < Decimal("0.01"):
                continue

            account.margin_used = new_margin
            account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
            account.free_margin = account.equity - new_margin

            logger.info(
                "account=%s pos=%d old_margin=%s new_margin=%s diff=%s",
                account.account_number, len(positions), old_margin, new_margin,
                new_margin - old_margin,
            )
            fixed += 1

        await db.commit()
        logger.info("Done. Fixed %d account(s).", fixed)


if __name__ == "__main__":
    asyncio.run(recompute())
