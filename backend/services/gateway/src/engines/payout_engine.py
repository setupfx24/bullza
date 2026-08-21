"""Auto-payout engine — sends NOWPayments crypto payouts for admin-APPROVED
crypto withdrawals when automatic withdrawal is enabled (client 2026-06-22).

Two paths feed the auto-withdrawal feature:
  1. Small crypto withdrawals (<= crypto_auto_withdrawal_max_usd) are sent
     INLINE at request time in wallet_service.create_withdrawal.
  2. Larger ones go 'pending' → an admin approves them (which debits the wallet
     and sets status 'approved') → THIS engine picks them up and sends the
     payout, so the admin never has to send crypto by hand.

Only runs when `crypto_auto_withdrawal_enabled` is on AND the payout credentials
are configured; otherwise approved crypto withdrawals stay manual (unchanged).
The actual send + refund-on-failure lives in
wallet_service._send_nowpayments_payout (single source of truth, never loses funds).
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import User, Withdrawal
from packages.common.src.settings_store import get_bool_setting

logger = logging.getLogger("payout-engine")

TICK_INTERVAL = 20
CRYPTO_METHODS = ("oxapay", "nowpayments", "crypto_btc", "crypto_eth", "crypto_usdt", "metamask")


class PayoutEngine:
    def __init__(self) -> None:
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Payout engine started (tick=%ds)", TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        # Cluster leader lock. The gateway runs `--workers 2` in prod and
        # every worker starts every engine, so without this both workers
        # ran this loop concurrently — duplicate payouts/emails and double
        # the DB load. Acquired and RELEASED per tick (rather than held
        # for the TTL) so the cadence stays exactly TICK_INTERVAL; the TTL
        # is only a crash guard. Fails closed: on a Redis outage no worker
        # acquires and the tick is skipped, which is the safe direction.
        from packages.common.src.redis_client import redis_client, acquire_leader_lock
        while self._running:
            if not await acquire_leader_lock('engine:payout:lock', 300):
                await asyncio.sleep(TICK_INTERVAL)
                continue
            try:
                if await get_bool_setting("crypto_auto_withdrawal_enabled", False):
                    async with AsyncSessionLocal() as db:
                        await self._process(db)
            except Exception as e:
                logger.error("Payout engine error: %s", e, exc_info=True)
            finally:
                try:
                    await redis_client.delete('engine:payout:lock')
                except Exception:
                    pass  # TTL still expires it
            await asyncio.sleep(TICK_INTERVAL)

    async def _process(self, db: AsyncSession) -> None:
        from ..services.nowpayments_service import payouts_configured
        if not payouts_configured():
            return
        from ..services.wallet_service import _send_nowpayments_payout

        rows = (await db.execute(
            select(Withdrawal).where(
                Withdrawal.status == "approved",
                Withdrawal.method.in_(CRYPTO_METHODS),
                Withdrawal.payout_batch_id.is_(None),
            ).limit(20)
        )).scalars().all()
        for w in rows:
            # Lock the user row so the refund-on-failure path can't race with
            # other balance writes. The wallet was already debited on approval.
            user_row = (await db.execute(
                select(User).where(User.id == w.user_id).with_for_update()
            )).scalar_one_or_none()
            if not user_row:
                continue
            await _send_nowpayments_payout(w, user_row, db)
            await db.commit()


payout_engine = PayoutEngine()
