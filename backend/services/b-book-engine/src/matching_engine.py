"""B-Book engine — pending-order triggers + SL/TP closes against the house book.

Market orders are NOT handled here — they fill inline in the gateway
(services/gateway/src/services/trading_service.py). This engine polls:
- pending orders (limit, stop, stop-limit) and fills them when triggered
- open positions with SL/TP, closing them via the shared close core

Executable bid/ask in Redis already include platform spread (market-data
service). Close math lives in packages.common.src.position_close and is
shared with the gateway sltp_engine (backstop) and the risk engine
(stop-out), so the closers can no longer drift apart.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Order, OrderType, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount, Instrument, InstrumentConfig,
    User,
)
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.position_close import close_position_atomic, sltp_trigger
from packages.common.src.abook import enqueue_abook_event
from packages.common.src.instrument_pricing import resolve_commission

logger = logging.getLogger("b-book-engine")

# Mirror of the risk engine's stale-feed guard (audit infra-C1): never
# trigger a pending fill or an SL/TP close on a tick older than this.
# The 120s Redis tick TTL alone left a window in which a frozen feed
# could still fire orders at a dead price.
STALE_PRICE_SECONDS = 60.0


class MatchingEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("B-Book Matching Engine started")

        await asyncio.gather(
            self._monitor_pending_orders(),
            self._monitor_sl_tp(),
        )

    async def stop(self):
        self._running = False

    async def _get_price(self, symbol: str) -> Optional[tuple[Decimal, Decimal]]:
        """Latest executable bid/ask, or None when the tick is missing OR
        older than STALE_PRICE_SECONDS — a stale price must never execute."""
        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
        if not tick_data:
            return None
        tick = json.loads(tick_data)
        ts = tick.get("timestamp")
        if ts:
            try:
                tick_time = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                if tick_time.tzinfo is None:
                    tick_time = tick_time.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - tick_time).total_seconds()
                if age > STALE_PRICE_SECONDS:
                    return None
            except (ValueError, TypeError):
                pass
        return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))

    async def _monitor_pending_orders(self):
        """Monitor and trigger pending orders when price conditions are met."""
        logger.info("Pending order monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Order)
                        .options(selectinload(Order.instrument))  # avoid per-order lazy load (N+1)
                        .where(Order.status == OrderStatus.PENDING)
                    )
                    pending_orders = result.scalars().all()

                    for order in pending_orders:
                        if order.expires_at and datetime.now(timezone.utc) > order.expires_at:
                            order.status = OrderStatus.EXPIRED
                            await db.commit()
                            continue

                        price_data = await self._get_price(order.instrument.symbol)
                        if not price_data:
                            continue

                        bid, ask = price_data
                        triggered = False

                        if order.order_type == OrderType.LIMIT:
                            if order.side == OrderSide.BUY and ask <= order.price:
                                triggered = True
                            elif order.side == OrderSide.SELL and bid >= order.price:
                                triggered = True

                        elif order.order_type == OrderType.STOP:
                            if order.side == OrderSide.BUY and ask >= order.price:
                                triggered = True
                            elif order.side == OrderSide.SELL and bid <= order.price:
                                triggered = True

                        elif order.order_type == OrderType.STOP_LIMIT:
                            if order.side == OrderSide.BUY and ask >= order.price:
                                if order.stop_limit_price and ask <= order.stop_limit_price:
                                    triggered = True
                            elif order.side == OrderSide.SELL and bid <= order.price:
                                if order.stop_limit_price and bid >= order.stop_limit_price:
                                    triggered = True

                        if triggered:
                            await self._execute_pending_order(order, bid, ask, db)

                    await db.commit()

            except Exception as e:
                logger.error(f"Pending order monitor error: {e}")

            await asyncio.sleep(0.1)

    async def _execute_pending_order(self, order: Order, bid: Decimal, ask: Decimal, db: AsyncSession):
        account = await db.get(TradingAccount, order.account_id)
        if not account or not account.is_active:
            order.status = OrderStatus.REJECTED
            return

        instrument = await db.get(Instrument, order.instrument_id)
        # Redis quotes already include platform spread (symmetric).
        fill_price = ask if order.side == OrderSide.BUY else bid

        # Effective leverage mirrors the gateway market-order path:
        # min(account leverage, per-instrument leverage cap).
        leverage = int(account.leverage or 100)
        cfg = (await db.execute(
            select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument.id)
        )).scalar_one_or_none()
        if cfg and cfg.leverage_max:
            leverage = min(leverage, int(cfg.leverage_max))

        # Notional/leverage gives margin in the quote currency (JPY for
        # NZDJPY etc.). Convert to account currency to match the value
        # stored on `account.margin_used` and used by gateway open-paths.
        from packages.common.src.trading_service import convert_to_account_currency
        margin_raw = (order.lots * instrument.contract_size * fill_price) / Decimal(str(leverage))
        margin = await convert_to_account_currency(
            margin_raw,
            getattr(instrument, "quote_currency", None),
        )

        if margin > account.free_margin:
            order.status = OrderStatus.REJECTED
            return

        # Same resolver as the gateway market path (user → account-type →
        # instrument → segment chain, smart-fee fallback, XP discount) —
        # the old local hierarchy ignored account groups, so a pending
        # fill could charge a different commission than the identical
        # market order.
        commission = await resolve_commission(
            db, instrument, order.lots, fill_price,
            user_id=account.user_id,
            account_group_id=getattr(account, "account_group_id", None),
        )

        order.status = OrderStatus.FILLED
        order.filled_price = fill_price
        order.filled_at = datetime.now(timezone.utc)
        order.commission = commission

        position = Position(
            account_id=account.id,
            instrument_id=instrument.id,
            order_id=order.id,
            side=order.side,
            lots=order.lots,
            open_price=fill_price,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            status=PositionStatus.OPEN,
            commission=commission,
        )
        db.add(position)
        await db.flush()  # position.id needed for the A-Book outbox row

        account.margin_used += margin
        account.balance = (account.balance or Decimal("0")) - commission
        account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
        account.free_margin = account.equity - account.margin_used

        # A-Book: queue the hedge-leg OPEN. Pending fills previously never
        # forwarded opens to the LP at all — only gateway market orders did —
        # so an A-book user's pending order left the house unhedged.
        user = await db.get(User, account.user_id)
        user_name = ""
        if user:
            user_name = " ".join(
                p for p in [getattr(user, "first_name", None), getattr(user, "last_name", None)] if p
            )
        await enqueue_abook_event(
            db,
            user_id=account.user_id,
            is_demo=bool(account.is_demo),
            kind="open",
            position_id=position.id,
            payload={
                "position_id": str(position.id),
                "user_id": str(account.user_id),
                "user_email": (getattr(user, "email", None) or ""),
                "user_name": user_name,
                "symbol": instrument.symbol,
                "side": order.side.value,
                "volume": order.lots,
                "open_price": fill_price,
                "sl": order.stop_loss,
                "tp": order.take_profit,
                "leverage": leverage,
                "contract_size": instrument.contract_size,
                "trading_account_id": str(account.id),
            },
        )

        logger.info(f"Pending order {order.id} executed: {instrument.symbol} {order.side.value} @ {fill_price}")

        await redis_client.publish(f"account:{account.id}", json.dumps({
            "type": "order_filled",
            "order_id": str(order.id),
            "symbol": instrument.symbol,
            "side": order.side.value,
            "price": str(fill_price),
            "lots": str(order.lots),
        }))

    async def _monitor_sl_tp(self):
        """Monitor open positions for SL/TP hits (shared trigger + close core)."""
        logger.info("SL/TP monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Position)
                        .options(selectinload(Position.instrument))  # avoid per-position lazy load (N+1)
                        .where(
                            Position.status == PositionStatus.OPEN,
                            (Position.stop_loss.isnot(None)) | (Position.take_profit.isnot(None))
                        )
                    )
                    positions = result.scalars().all()

                    for pos in positions:
                        price_data = await self._get_price(pos.instrument.symbol)
                        if not price_data:
                            continue

                        bid, ask = price_data
                        trig = sltp_trigger(pos, bid, ask)
                        if trig:
                            reason, close_price = trig
                            await close_position_atomic(
                                db, pos, close_price=close_price, reason=reason,
                            )

                    await db.commit()

            except Exception as e:
                logger.error(f"SL/TP monitor error: {e}")

            await asyncio.sleep(0.1)
