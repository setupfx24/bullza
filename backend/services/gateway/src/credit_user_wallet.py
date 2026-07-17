"""One-off: credit a user's MAIN WALLET server-side (not via the admin UI).

Does the same balance mutation the admin "Add Fund" does, minus the admin-UI
plumbing (dual-approval gate, notification), but STILL writes the Transaction
ledger row — otherwise main_wallet_balance permanently disagrees with the sum
of the user's transactions, the credit is invisible on their Transactions page,
and there is no record of where the money came from.

Uses a FOR UPDATE row lock so a concurrent admin action can't lose the write.

DRY-RUN by default; --execute to write.
    python -m services.gateway.src.credit_user_wallet --email x@y.com --amount 10000000
    python -m services.gateway.src.credit_user_wallet --email x@y.com --amount 10000000 --execute
"""
import argparse
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import Transaction, User

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("credit-wallet")

DEFAULT_DESC = "Wallet credit (manual, server-side)"


def _arg_email(value: str) -> str:
    if "@" not in value or "." not in value.split("@")[-1]:
        raise argparse.ArgumentTypeError(
            f"'{value}' is not an email address — pass the user's real email"
        )
    return value.strip().lower()


def _arg_amount(value: str) -> Decimal:
    try:
        amt = Decimal(value)
    except Exception:
        raise argparse.ArgumentTypeError(f"'{value}' is not a number, e.g. --amount 10000")
    if amt <= 0:
        raise argparse.ArgumentTypeError("--amount must be positive")
    return amt


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True, type=_arg_email)
    parser.add_argument("--amount", required=True, type=_arg_amount, help="USD to credit")
    parser.add_argument("--description", default=DEFAULT_DESC, help="Ledger description")
    parser.add_argument("--execute", action="store_true", help="Write (default: dry-run)")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        user = (await db.execute(
            select(User).where(User.email == args.email).with_for_update()
        )).scalar_one_or_none()
        if user is None:
            logger.error("%s: user not found", args.email)
            return

        old = Decimal(str(user.main_wallet_balance or 0))
        new = old + args.amount
        logger.info(
            "%s (%s) | promotional=%s demo=%s status=%s",
            args.email,
            " ".join(filter(None, [user.first_name, user.last_name])) or "-",
            bool(user.is_promotional), bool(user.is_demo), user.status,
        )
        logger.info("main_wallet_balance: $%s  ->  $%s   (+$%s)", old, new, args.amount)
        if not bool(user.is_promotional):
            logger.warning(
                "this user is NOT promotional — the credit WILL count in real "
                "company figures (Finance Overview, net deposits, withdrawable)"
            )

        if not args.execute:
            logger.info("Dry-run only — re-run with --execute to write.")
            return

        user.main_wallet_balance = new
        db.add(Transaction(
            user_id=user.id,
            account_id=None,          # main wallet — no trading account
            type="adjustment",
            amount=args.amount,
            balance_after=new,
            description=args.description,
        ))
        await db.commit()
        logger.info("COMMITTED — $%s credited, ledger row written.", args.amount)


if __name__ == "__main__":
    asyncio.run(main())
