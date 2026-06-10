"""B-Book Matching Engine — All orders execute against the house book.

This is the core execution engine. In a B-Book model:
- Market orders fill immediately at current bid/ask
- Pending orders (limit, stop, stop-limit) are monitored and triggered when price conditions are met
- No external liquidity — the admin/house is the counterparty to every trade
- Executable bid/ask in Redis already include platform spread (market-data service)
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Order, OrderType, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount, Instrument,
    SpreadConfig, ChargeConfig, Transaction, TradeHistory, User,
)
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src import corecen_trade_client

logger = logging.getLogger("b-book-engine")


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
        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
        if not tick_data:
            return None
        tick = json.loads(tick_data)
        return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))

    async def _get_spread_markup(self, instrument_id, user_id, segment_id, db: AsyncSession) -> Decimal:
        """Resolve spread markup using the config hierarchy: user > instrument > segment > default."""
        for scope, sid, iid, uid in [
            ("user", None, None, user_id),
            ("instrument", None, instrument_id, None),
            ("segment", segment_id, None, None),
            ("default", None, None, None),
        ]:
            query = select(SpreadConfig).where(
                SpreadConfig.scope == scope,
                SpreadConfig.is_enabled == True,
            )
            if uid:
                query = query.where(SpreadConfig.user_id == uid)
            if iid:
                query = query.where(SpreadConfig.instrument_id == iid)
            if sid:
                query = query.where(SpreadConfig.segment_id == sid)

            result = await db.execute(query)
            config = result.scalar_one_or_none()
            if config:
                return config.value

        return Decimal("0")

    async def _get_commission(self, instrument_id, user_id, segment_id, lots: Decimal, db: AsyncSession) -> Decimal:
        """Resolve commission using config hierarchy: User > Instrument > Segment > Default."""
        candidates = [
            {"scope": "user",       "user_id": user_id,   "instrument_id": instrument_id, "segment_id": None},
            {"scope": "user",       "user_id": user_id,   "instrument_id": None,          "segment_id": None},
            {"scope": "instrument", "user_id": None,      "instrument_id": instrument_id, "segment_id": None},
            {"scope": "segment",    "user_id": None,      "instrument_id": None,          "segment_id": segment_id},
            {"scope": "default",    "user_id": None,      "instrument_id": None,          "segment_id": None},
        ]
        for c in candidates:
            if c["scope"] == "user" and not c["user_id"]:
                continue
            if c["scope"] == "instrument" and not c["instrument_id"]:
                continue
            if c["scope"] == "segment" and not c["segment_id"]:
                continue
            query = select(ChargeConfig).where(
                ChargeConfig.scope == c["scope"],
                ChargeConfig.is_enabled == True,
                ChargeConfig.user_id == c["user_id"] if c["user_id"] else ChargeConfig.user_id.is_(None),
                ChargeConfig.instrument_id == c["instrument_id"] if c["instrument_id"] else ChargeConfig.instrument_id.is_(None),
                ChargeConfig.segment_id == c["segment_id"] if c["segment_id"] else ChargeConfig.segment_id.is_(None),
            ).limit(1)
            result = await db.execute(query)
            config = result.scalar_one_or_none()
            if config:
                ct = (config.charge_type or "").lower()
                v = Decimal(str(config.value or 0))
                if ct in ("commission_per_lot", "per_lot"):
                    return v * lots
                if ct in ("commission_per_trade", "per_trade"):
                    return v
                if ct == "spread_percentage":
                    return Decimal("0")
                return v * lots

        return Decimal("0")

    async def _monitor_pending_orders(self):
        """Monitor and trigger pending orders when price conditions are met."""
        logger.info("Pending order monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Order).where(Order.status == OrderStatus.PENDING)
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
        # Notional/leverage gives margin in the quote currency (JPY for
        # NZDJPY etc.). Convert to account currency to match the value
        # stored on `account.margin_used` and used by gateway open-paths.
        from packages.common.src.trading_service import convert_to_account_currency
        margin_raw = (order.lots * instrument.contract_size * fill_price) / Decimal(str(account.leverage))
        margin = await convert_to_account_currency(
            margin_raw,
            getattr(instrument, "quote_currency", None),
        )

        if margin > account.free_margin:
            order.status = OrderStatus.REJECTED
            return

        commission = await self._get_commission(
            instrument_id=instrument.id,
            user_id=account.user_id,
            segment_id=instrument.segment_id,
            lots=order.lots,
            db=db,
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

        account.margin_used += margin
        account.balance = (account.balance or Decimal("0")) - commission
        account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
        account.free_margin = account.equity - account.margin_used

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
        """Monitor open positions for SL/TP hits."""
        logger.info("SL/TP monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Position).where(
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
                        close_price = bid if pos.side == OrderSide.BUY else ask

                        sl_hit = False
                        tp_hit = False

                        if pos.stop_loss:
                            if pos.side == OrderSide.BUY and close_price <= pos.stop_loss:
                                sl_hit = True
                            elif pos.side == OrderSide.SELL and close_price >= pos.stop_loss:
                                sl_hit = True

                        if pos.take_profit:
                            if pos.side == OrderSide.BUY and close_price >= pos.take_profit:
                                tp_hit = True
                            elif pos.side == OrderSide.SELL and close_price <= pos.take_profit:
                                tp_hit = True

                        if sl_hit or tp_hit:
                            await self._close_position(pos, close_price, "sl" if sl_hit else "tp", db)

                    await db.commit()

            except Exception as e:
                logger.error(f"SL/TP monitor error: {e}")

            await asyncio.sleep(0.1)

    async def _close_position(self, pos: Position, close_price: Decimal, reason: str, db: AsyncSession):
        # Idempotent close guard (audit C2) — the gateway sltp_engine
        # also closes on SL/TP. Atomically flip status open→closed and
        # bail if another closer already won, so we never double-book
        # P&L / TradeHistory.
        from sqlalchemy import update as _sa_update
        won = await db.execute(
            _sa_update(Position)
            .where(Position.id == pos.id, Position.status == PositionStatus.OPEN)
            .values(status=PositionStatus.CLOSED)
        )
        if (won.rowcount or 0) == 0:
            return
        # Async converters (audit JPY/cross-pair family) — the sync
        # quote_to_account_pnl returns raw quote currency for cross
        # pairs, so NZDJPY etc. would credit JPY-as-USD. Convert P&L
        # AND margin-release to account currency via live Redis rate.
        from packages.common.src.trading_service import (
            quote_to_account_pnl_async, convert_to_account_currency,
        )
        instrument = pos.instrument
        if pos.side == OrderSide.BUY:
            profit = (close_price - pos.open_price) * pos.lots * instrument.contract_size
        else:
            profit = (pos.open_price - close_price) * pos.lots * instrument.contract_size
        profit = await quote_to_account_pnl_async(
            profit,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
        )

        closed_at = datetime.now(timezone.utc)
        pos.status = PositionStatus.CLOSED
        pos.close_price = close_price
        pos.profit = profit
        pos.closed_at = closed_at

        account = await db.get(TradingAccount, pos.account_id)
        if account:
            account.balance += profit
            margin_release_raw = (pos.lots * instrument.contract_size * pos.open_price) / Decimal(str(account.leverage))
            margin_release = await convert_to_account_currency(
                margin_release_raw,
                getattr(instrument, "quote_currency", None),
            )
            account.margin_used = max(Decimal("0"), account.margin_used - margin_release)
            account.equity = account.balance + account.credit
            account.free_margin = account.equity - account.margin_used

        # Persist the close to TradeHistory so this row shows up in the
        # trader's "Closed positions" tab. Previously this engine closed
        # the position but never wrote history — the gateway's sltp_engine
        # was supposed to be the historian, but it runs at 1s while this
        # loop runs at 100ms, so this engine always wins the race and the
        # row never appeared (client-reported regression: SL/TP closes
        # missing from history). Also write the matching Transaction so
        # the balance-history chart / Transactions list pick up the
        # realized P&L event.
        side_str = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
        history = TradeHistory(
            position_id=pos.id,
            account_id=pos.account_id,
            instrument_id=pos.instrument_id,
            side=pos.side,
            lots=pos.lots,
            open_price=pos.open_price,
            close_price=close_price,
            swap=pos.swap or Decimal("0"),
            commission=pos.commission or Decimal("0"),
            profit=profit,
            close_reason=reason,
            opened_at=pos.created_at,
            closed_at=closed_at,
        )
        db.add(history)

        if account:
            tx = Transaction(
                user_id=account.user_id,
                account_id=account.id,
                type="profit" if profit >= 0 else "loss",
                amount=profit,
                balance_after=account.balance,
                reference_id=pos.id,
                description=f"{reason.upper()} hit: {instrument.symbol} {side_str} {pos.lots} lots @ {close_price}",
            )
            db.add(tx)

        logger.info(
            f"Position {pos.id} closed by {reason}: {instrument.symbol} "
            f"{side_str} @ {close_price}, profit: {profit}"
        )

        await redis_client.publish(f"account:{pos.account_id}", json.dumps({
            "type": f"position_closed_{reason}",
            "position_id": str(pos.id),
            "symbol": instrument.symbol,
            "close_price": str(close_price),
            "profit": str(profit),
        }))

        # ── A-Book: forward SL/TP close to Corecen LP ────────────────────
        # Pass Decimal through; the Corecen client's _js_val handles the
        # JSON-boundary conversion. Pre-casting to float here would lose
        # precision before the wire (audit-trail mismatch with LP).
        _pos_id = str(pos.id)
        _cp = close_price
        _pnl = profit
        _reason_upper = reason.upper()
        _user_id = account.user_id if account else None
        _is_demo = bool(account.is_demo) if account else True

        async def _forward_sltp_close():
            try:
                # Demo accounts never route to LP, regardless of user's book_type.
                if not _user_id or _is_demo:
                    return
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(
                        select(User).where(User.id == _user_id)
                    )).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        await corecen_trade_client.forward_trade_close(
                            position_id=_pos_id,
                            close_price=_cp,
                            pnl=_pnl,
                            closed_by=_reason_upper,
                        )
            except Exception as exc:
                logger.error("[A-BOOK] B-book engine SL/TP close forward failed: %s", exc)

        asyncio.create_task(_forward_sltp_close())
