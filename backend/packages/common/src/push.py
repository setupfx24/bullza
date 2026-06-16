"""Expo push-notification fan-out.

Stores each device's Expo push token per user (Redis set) and delivers a push
via the Expo Push API when an in-app notification is created. Best-effort:
never raises into the caller's request / DB transaction.

Pairs with the mobile app's src/features/notifications/pushSetup.ts, which
registers its Expo token via POST /notifications/devices.
"""
import asyncio
import logging

import httpx

from .redis_client import redis_client

logger = logging.getLogger("push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _key(user_id) -> str:
    return f"push_tokens:{user_id}"


async def register_push_token(user_id, token: str) -> None:
    """Save a device's Expo push token for a user (idempotent — Redis set)."""
    token = (token or "").strip()
    if not token:
        return
    try:
        await redis_client.sadd(_key(user_id), token)
    except Exception as e:
        logger.warning("register_push_token failed: %s", e)


async def get_push_tokens(user_id) -> list[str]:
    try:
        members = await redis_client.smembers(_key(user_id))
        return [m for m in members if isinstance(m, str)]
    except Exception:
        return []


async def _drop_token(user_id, token: str) -> None:
    try:
        await redis_client.srem(_key(user_id), token)
    except Exception:
        pass


async def send_expo_push(user_id, tokens, title: str, body: str, data: dict | None = None) -> None:
    valid = [t for t in tokens if isinstance(t, str) and t.startswith(("ExponentPushToken", "ExpoPushToken"))]
    if not valid:
        return
    messages = [
        {"to": t, "title": title, "body": body, "sound": "default", "data": data or {}}
        for t in valid
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL, json=messages, headers={"Content-Type": "application/json"}
            )
            # Prune tokens Expo reports as no longer registered so the set
            # doesn't grow stale (DeviceNotRegistered).
            if resp.status_code == 200:
                tickets = (resp.json() or {}).get("data") or []
                for tok, ticket in zip(valid, tickets):
                    if isinstance(ticket, dict) and ticket.get("status") == "error":
                        if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                            await _drop_token(user_id, tok)
    except Exception as e:
        logger.warning("expo push send failed: %s", e)


async def push_to_user(user_id, title: str, body: str, data: dict | None = None) -> None:
    tokens = await get_push_tokens(user_id)
    await send_expo_push(user_id, tokens, title, body, data)


def fire_push(user_id, title: str, body: str, data: dict | None = None) -> None:
    """Fire-and-forget so notification creation isn't blocked on the network."""
    try:
        asyncio.create_task(push_to_user(user_id, title, body, data))
    except RuntimeError:
        # No running event loop (sync context) — the in-app row still lands.
        pass
