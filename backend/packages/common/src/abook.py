"""A-Book (LP) forwarding — durable outbox enqueue.

Call sites that used to spawn fire-and-forget Corecen tasks now enqueue an
``ABookOutbox`` row inside the SAME transaction as the trade mutation. The
gateway's ``abook_outbox_engine`` delivers rows with retry/backoff, so a
hedge leg survives Corecen downtime and process restarts.
"""
import logging
import uuid
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ABookOutbox, User

logger = logging.getLogger(__name__)

# Fields the flusher must rehydrate back to Decimal before handing the
# payload to corecen_trade_client (which narrows them at the JSON
# boundary via _js_val — strings would be sent as JSON strings).
NUMERIC_FIELDS: dict[str, tuple[str, ...]] = {
    "open": ("volume", "open_price", "sl", "tp", "leverage", "contract_size"),
    "close": ("close_price", "pnl"),
    "update": ("sl", "tp"),
}


def _jsonable(value: Any) -> Any:
    """Decimal → str so JSONB storage never loses precision."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def rehydrate_payload(kind: str, payload: dict) -> dict:
    """Convert the numeric fields for `kind` back to Decimal for sending."""
    out = dict(payload)
    for field in NUMERIC_FIELDS.get(kind, ()):
        v = out.get(field)
        if v is not None and not isinstance(v, Decimal):
            try:
                out[field] = Decimal(str(v))
            except Exception:  # noqa: BLE001 — leave the raw value; client narrows
                pass
    return out


async def enqueue_abook_event(
    db: AsyncSession,
    *,
    user_id,
    is_demo: bool,
    kind: str,
    position_id,
    payload: dict[str, Any],
) -> bool:
    """Queue an LP forward if (and only if) the user is A-book.

    Runs in the caller's transaction — the row commits (or rolls back)
    atomically with the trade itself. Demo accounts never route to LP.
    Returns True when a row was enqueued.

    Never raises: booking the hedge leg must not block or roll back the
    user's trade. An enqueue failure is logged at ERROR (it means a lost
    hedge, same as the pre-outbox behavior — but now loudly).
    """
    if is_demo or not user_id:
        return False
    try:
        book = (
            await db.execute(select(User.book_type).where(User.id == user_id))
        ).scalar_one_or_none()
        if (book or "B") != "A":
            return False
        db.add(
            ABookOutbox(
                kind=kind,
                position_id=uuid.UUID(str(position_id)),
                payload=_jsonable(payload),
            )
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("[A-BOOK] outbox enqueue failed pos=%s kind=%s: %s", position_id, kind, exc)
        return False
