"""One-off (client 2026-07-15): wipe a user's FINANCIAL activity to zero while
KEEPING the user account, trading accounts, KYC and profile intact.

Use case: Kamni Sahu (sahunami843525@gmail.com) is a real user but was seeded
with demo financial data ($11k deposits, 195 transactions) that inflated the
admin dashboard once she was un-flagged from promotional. Client: "keep this
account but remove its transaction, make it 00."

Clears (FK-safe order — insurance before positions/transactions):
  insurance claims/policies, copy-trade links, IB commissions, trade history,
  positions, orders, fixed-return locks, staking, reward-campaign claims,
  deposits, withdrawals, deposit-requests, bonuses, transactions.
Then zeroes trading-account balances and the user's wallet columns.

KEEPS: the User row, TradingAccount rows (zeroed), KYCDocument, sessions,
profile, IBProfile. So it's a clean real account at $0, ready for real
activity — which will show on the dashboard going forward.

DRY-RUN by default; --execute to write. --email to target another account.
    python -m services.gateway.src.reset_user_financials
    python -m services.gateway.src.reset_user_financials --execute
"""
import argparse
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select, update, delete as sql_delete, text
from sqlalchemy import func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    User, TradingAccount, Position, Order, TradeHistory, Transaction,
    Deposit, Withdrawal, FixedReturnLock, CopyTrade, IBCommission,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("reset-user-financials")
Z = Decimal("0")


async def _optional_sql(db, stmts: list[str], params: dict) -> None:
    """Run raw statements each in a savepoint so a missing table / no rows is
    swallowed instead of aborting the whole run."""
    for sql in stmts:
        try:
            async with db.begin_nested():
                await db.execute(text(sql), params)
        except Exception:  # noqa: BLE001
            pass


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="sahunami843525@gmail.com")
    parser.add_argument("--execute", action="store_true", help="Write changes (default: dry-run)")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == args.email))).scalar_one_or_none()
        if user is None:
            logger.error("%s not found", args.email); return
        uid = user.id
        acc_ids = [r[0] for r in (await db.execute(
            select(TradingAccount.id).where(TradingAccount.user_id == uid))).all()]

        # BEFORE snapshot
        dep = (await db.execute(select(func.coalesce(func.sum(Deposit.amount), 0)).where(
            Deposit.user_id == uid, Deposit.status == "approved"))).scalar() or 0
        txn = (await db.execute(select(func.count(Transaction.id)).where(Transaction.user_id == uid))).scalar() or 0
        bal = (await db.execute(select(func.coalesce(func.sum(TradingAccount.balance), 0)).where(
            TradingAccount.user_id == uid))).scalar() or 0
        logger.info(
            "Target %s (%s %s) — BEFORE: approved_deposits=%s txns=%s acct_balance=%s wallet=%s",
            user.email, user.first_name, user.last_name, dep, txn, bal, user.main_wallet_balance,
        )

        if not args.execute:
            logger.info("Dry-run only — re-run with --execute to zero this account.")
            return

        # 1. Insurance FIRST (claims ref transactions & policies ref positions).
        await _optional_sql(db, [
            "DELETE FROM insurance_claims WHERE user_id = :uid",
            "DELETE FROM insurance_claims WHERE transaction_id IN "
            "(SELECT id FROM transactions WHERE user_id = :uid)",
            "DELETE FROM insurance_policies WHERE user_id = :uid",
        ], {"uid": str(uid)})

        # 2. Trades / positions / orders (clear CopyTrade + IBCommission FKs first).
        if acc_ids:
            pos_ids = [r[0] for r in (await db.execute(
                select(Position.id).where(Position.account_id.in_(acc_ids)))).all()]
            if pos_ids:
                await db.execute(sql_delete(CopyTrade).where(
                    (CopyTrade.master_position_id.in_(pos_ids)) |
                    (CopyTrade.investor_position_id.in_(pos_ids))))
            ord_ids = [r[0] for r in (await db.execute(
                select(Order.id).where(Order.account_id.in_(acc_ids)))).all()]
            if ord_ids:
                await db.execute(sql_delete(IBCommission).where(IBCommission.source_trade_id.in_(ord_ids)))
            await db.execute(sql_delete(TradeHistory).where(TradeHistory.account_id.in_(acc_ids)))
            await db.execute(update(Position).where(Position.account_id.in_(acc_ids)).values(order_id=None))
            await db.execute(sql_delete(Position).where(Position.account_id.in_(acc_ids)))
            await db.execute(sql_delete(Order).where(Order.account_id.in_(acc_ids)))

        # 3. IB commissions where this user is the source (they generated them).
        await db.execute(sql_delete(IBCommission).where(IBCommission.source_user_id == uid))

        # 4. Products + optional-table financial rows.
        await db.execute(sql_delete(FixedReturnLock).where(FixedReturnLock.user_id == uid))
        await _optional_sql(db, [
            "DELETE FROM staking_reward_accruals WHERE position_id IN "
            "(SELECT id FROM staking_positions WHERE user_id = :uid)",
            "DELETE FROM staking_positions WHERE user_id = :uid",
            "DELETE FROM reward_campaign_claims WHERE user_id = :uid",
            # rm_funding_requests FK deposits.id — must go before deposits.
            "DELETE FROM rm_funding_requests WHERE rm_id = :uid OR user_id = :uid",
            "DELETE FROM deposit_requests WHERE user_id = :uid",
            "DELETE FROM user_bonuses WHERE user_id = :uid",
        ], {"uid": str(uid)})

        # 5. Money rows.
        await db.execute(sql_delete(Deposit).where(Deposit.user_id == uid))
        await db.execute(sql_delete(Withdrawal).where(Withdrawal.user_id == uid))
        await db.execute(sql_delete(Transaction).where(Transaction.user_id == uid))

        # 6. Zero balances (keep the account rows).
        if acc_ids:
            await db.execute(update(TradingAccount).where(TradingAccount.user_id == uid).values(
                balance=Z, equity=Z, margin_used=Z, free_margin=Z, credit=Z))
        user.main_wallet_balance = Z
        user.main_wallet_bonus = Z
        user.ib_commission_balance = Z
        user.referral_commission_balance = Z

        await db.commit()
        logger.info("COMMITTED — %s financials reset to zero (account kept).", user.email)


if __name__ == "__main__":
    asyncio.run(main())
