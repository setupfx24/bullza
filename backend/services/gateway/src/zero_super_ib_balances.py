"""One-off (client 2026-07-15): zero the Super IB's balances — the showcase
IB account must show NO receivable and NO wallet value.

Target = the Super IB (system_settings `super_ib_code`, default SDA05) →
its IBProfile → its User. On this platform that resolves to Lukas Keller
(sdasia.01@gmail.com). Zeroes:
  - main_wallet_balance        (wallet)
  - main_wallet_bonus
  - ib_commission_balance      (IB receivable — commission earned, unswept)
  - referral_commission_balance(referral receivable)
  - IBProfile.total_earned + pending_payout

Ledger Transactions/history are NOT touched — only the denormalized balance
columns are reset. DRY-RUN by default; --execute to write.
    python -m services.gateway.src.zero_super_ib_balances
    python -m services.gateway.src.zero_super_ib_balances --execute
"""
import argparse
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import User, IBProfile
from packages.common.src.settings_store import get_system_setting

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("zero-super-ib")

Z = Decimal("0")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        code = await get_system_setting("super_ib_code", "SDA05")
        ibp = (await db.execute(
            select(IBProfile).where(IBProfile.referral_code == code)
        )).scalar_one_or_none()
        if ibp is None:
            logger.error("No IBProfile for super_ib_code=%s — aborting", code)
            return
        user = (await db.execute(select(User).where(User.id == ibp.user_id))).scalar_one_or_none()
        if user is None:
            logger.error("Super IB profile has no user — aborting")
            return

        logger.info(
            "Super IB (%s) = %s (%s %s)",
            code, user.email, user.first_name, user.last_name,
        )
        logger.info(
            "BEFORE: wallet=%s bonus=%s ib_comm=%s ref_comm=%s | IBProfile total_earned=%s pending=%s",
            user.main_wallet_balance, user.main_wallet_bonus,
            user.ib_commission_balance, user.referral_commission_balance,
            ibp.total_earned, ibp.pending_payout,
        )

        if args.execute:
            user.main_wallet_balance = Z
            user.main_wallet_bonus = Z
            user.ib_commission_balance = Z
            user.referral_commission_balance = Z
            ibp.total_earned = Z
            ibp.pending_payout = Z
            await db.commit()
            logger.info("AFTER: all balances zeroed. COMMITTED.")
        else:
            logger.info("Dry-run only — re-run with --execute to zero these.")


if __name__ == "__main__":
    asyncio.run(main())
