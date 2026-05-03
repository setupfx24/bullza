"""Webhook idempotency helper.

Each provider sends the same IPN multiple times (NOWPayments documents
this; OxaPay also retries). Without dedup, every retry credits the user
again. The ``processed_webhooks`` table (migration 0036) stores
``(provider, external_id)`` as a UNIQUE constraint — one INSERT per
event, ON CONFLICT DO NOTHING returns whether we've seen this event
before.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def claim_webhook(
    db: AsyncSession,
    *,
    provider: str,
    external_id: str,
    event_type: Optional[str] = None,
    raw_body: bytes | None = None,
) -> bool:
    """Try to claim ``(provider, external_id)``. Returns True on first
    sighting, False if it has been processed already.

    Caller pattern:

        if not await claim_webhook(db, provider="nowpayments",
                                   external_id=payment_id, ...):
            return {"status": "duplicate"}

    The INSERT runs in the caller's transaction. If the surrounding
    business logic later raises and rolls back, the claim is rolled back
    too — the next retry will reprocess. That's the desired contract:
    we only mark "processed" on a successful commit downstream.
    """
    payload_hash = hashlib.sha256(raw_body).hexdigest() if raw_body else None
    try:
        result = await db.execute(
            text(
                """
                INSERT INTO processed_webhooks (provider, external_id, event_type, payload_hash)
                VALUES (:provider, :external_id, :event_type, :payload_hash)
                ON CONFLICT (provider, external_id) DO NOTHING
                RETURNING id
                """
            ),
            {
                "provider": provider,
                "external_id": str(external_id),
                "event_type": event_type,
                "payload_hash": payload_hash,
            },
        )
        row = result.first()
        if row is None:
            logger.info(
                "webhook duplicate ignored: provider=%s external_id=%s",
                provider, external_id,
            )
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "claim_webhook failed (provider=%s external_id=%s): %s — allowing through",
            provider, external_id, exc,
        )
        # On infra failure (e.g. table missing), allow through rather than
        # 500'ing the provider — they will keep retrying. Operational alert
        # should fire from the warning log.
        return True
