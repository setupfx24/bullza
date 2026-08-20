"""Shared position-close core — the ONE implementation of close math.

Historically three independent closers re-implemented this (gateway
sltp_engine, b-book matching engine, risk-engine stop-out) and drifted:
the JPY/cross-pair P&L fixes landed in one place before the others,
insurance settlement and the close notification existed only in the
gateway closer (which lost every SL/TP race to the b-book engine's 100ms
loop, so in practice they never ran), and the risk engine wrote no
Transaction ledger row for stop-outs. Every closer now calls
``close_position_atomic``; drift is structurally impossible.

Semantics (union of the previous behaviors, kept deliberately):
- Atomic open→closed flip guards the multi-closer race (audit C2).
- P&L via ``quote_to_account_pnl_async`` (cross pairs get the live FX leg).
- Margin release converted to account currency (mirrors the open side).
- Negative Balance Protection: broker absorbs residual loss.
- SL/TP fills at the SL/TP price itself (MT5 behavior), decided by
  ``sltp_trigger``. No inverted-level filter: a stop moved beyond the
  open price is a legitimate break-even / profit-lock stop, and order
  placement/update validation already rejects genuinely invalid levels.
- TradeHistory + Transaction rows, insurance settlement, user
  notification, account-channel publish, and a durable A-Book outbox row
  are all booked in the caller's transaction.
"""
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from .abook import enqueue_abook_event
from .models import (
    Position, PositionStatus, TradeHistory, TradingAccount, Transaction,
)
from .notify import create_notification
from .redis_client import redis_client

logger = logging.getLogger(__name__)

_REASON_LABELS = {
    "sl": "Stop Loss Hit",
    "tp": "Take Profit Hit",
    "stop_out": "Stop Out",
}


def _side_val(side) -> str:
    return side.value if hasattr(side, "value") else str(side)


def sltp_trigger(pos: Position, bid: Decimal, ask: Decimal) -> Optional[tuple[str, Decimal]]:
    """Return ``("sl" | "tp", close_price)`` when a level is hit, else None.

    BUY marks against bid, SELL against ask; the close price is the SL/TP
    level itself (MT5 convention), not the market price at detection time.
    SL wins when both trigger on the same tick (gap through both levels).
    """
    side = _side_val(pos.side)
    mark = bid if side == "buy" else ask
    if pos.stop_loss is not None:
        sl = Decimal(str(pos.stop_loss))
        if (side == "buy" and mark <= sl) or (side == "sell" and mark >= sl):
            return "sl", sl
    if pos.take_profit is not None:
        tp = Decimal(str(pos.take_profit))
        if (side == "buy" and mark >= tp) or (side == "sell" and mark <= tp):
            return "tp", tp
    return None


async def close_position_atomic(
    db: AsyncSession,
    pos: Position,
    *,
    close_price: Decimal,
    reason: str,
    account: Optional[TradingAccount] = None,
    notify: bool = True,
) -> Optional[Decimal]:
    """Close ``pos`` at ``close_price``, booking P&L, margin, history,
    ledger, insurance, notification, publish, and the A-Book outbox row.

    Returns the realized profit in account currency, or ``None`` when
    another closer already won the atomic flip (nothing was booked).
    ``pos.instrument`` must be loaded (all callers eager-load it).
    The caller owns the ``db.commit()``.
    """
    won = await db.execute(
        sa_update(Position)
        .where(Position.id == pos.id, Position.status == PositionStatus.OPEN)
        .values(status=PositionStatus.CLOSED)
    )
    if (won.rowcount or 0) == 0:
        return None  # lost the race — the winner booked everything

    # Local import — trading_service imports models too; avoid cycles.
    from .trading_service import convert_to_account_currency, quote_to_account_pnl_async

    instrument = pos.instrument
    contract_size = (
        instrument.contract_size if instrument is not None else Decimal("100000")
    )
    side = _side_val(pos.side)

    if side == "buy":
        profit = (close_price - pos.open_price) * pos.lots * contract_size
    else:
        profit = (pos.open_price - close_price) * pos.lots * contract_size
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
    if reason in ("sl", "tp"):
        pos.comment = f"Auto-closed by {reason.upper()}"

    if account is None:
        account = await db.get(TradingAccount, pos.account_id)

    if account:
        account.balance = (account.balance or Decimal("0")) + profit
        # Release margin in account currency, mirroring the USD-converted
        # value booked on open — raw quote-currency release under-releases
        # on JPY crosses and leaves phantom margin_used.
        margin_release_raw = (
            pos.lots * contract_size * pos.open_price
        ) / Decimal(str(account.leverage))
        margin_release = await convert_to_account_currency(
            margin_release_raw, getattr(instrument, "quote_currency", None),
        )
        account.margin_used = max(
            Decimal("0"), (account.margin_used or Decimal("0")) - margin_release
        )
        # Negative Balance Protection — the broker absorbs any residual
        # loss on a gapping close; a trader can never owe money.
        if account.balance < Decimal("0"):
            logger.warning(
                "NBP: absorbing %.2f negative balance on account %s after %s",
                float(-account.balance), account.account_number, reason,
            )
            account.balance = Decimal("0")
        account.equity = account.balance + (account.credit or Decimal("0"))
        account.free_margin = account.equity - (account.margin_used or Decimal("0"))

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

    symbol = getattr(instrument, "symbol", "") or ""
    label = _REASON_LABELS.get(reason, "Position Closed")

    if account:
        db.add(Transaction(
            user_id=account.user_id,
            account_id=account.id,
            type="profit" if profit >= 0 else "loss",
            amount=profit,
            balance_after=account.balance,
            reference_id=pos.id,
            description=f"{label}: {symbol} {side} {pos.lots} lots @ {close_price}",
        ))

    # Insurance settlement — best-effort; a settlement hiccup must never
    # block the close (maybe_pay also swallows its own errors).
    try:
        from .insurance.claims import maybe_pay as _insurance_maybe_pay
        await _insurance_maybe_pay(db=db, position=pos, history=history)
    except Exception as ie:  # noqa: BLE001
        logger.warning("insurance settle failed pos=%s: %s", pos.id, ie)

    try:
        await redis_client.publish(f"account:{pos.account_id}", json.dumps({
            "type": "position_closed",
            "position_id": str(pos.id),
            "reason": reason,
            "symbol": symbol,
            "close_price": str(close_price),
            "profit": str(profit),
        }))
    except Exception:  # noqa: BLE001 — a Redis blip must not fail the close
        pass

    if notify and account:
        pnl_str = (
            f"+${float(profit):.2f}" if profit >= 0 else f"-${abs(float(profit)):.2f}"
        )
        try:
            await create_notification(
                db, account.user_id,
                title=f"{label} — {symbol}",
                message=f"{side.upper()} {pos.lots} lots closed @ {close_price} | P&L: {pnl_str}",
                notif_type="trade",
                action_url="/trading",
                commit=False,
            )
        except Exception as ne:  # noqa: BLE001
            logger.warning("close notification failed pos=%s: %s", pos.id, ne)

    # Durable A-Book hedge leg — same transaction as the close itself.
    await enqueue_abook_event(
        db,
        user_id=account.user_id if account else None,
        is_demo=bool(account.is_demo) if account else True,
        kind="close",
        position_id=pos.id,
        payload={
            "position_id": str(pos.id),
            "close_price": close_price,
            "pnl": profit,
            "closed_by": reason.upper(),
        },
    )

    logger.info(
        "Position %s closed by %s: %s %s %s lots @ %s → P&L %s",
        pos.id, reason, symbol, side, pos.lots, close_price, profit,
    )
    return profit
