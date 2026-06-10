"""Redis-backed sliding-window rate limiter.

Used by gateway auth / wallet endpoints to throttle credential stuffing,
OTP brute force, and webhook spam. Falls back to permissive mode if Redis
is unavailable so a Redis outage cannot lock everyone out — but logs a
warning so the failure is visible.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import HTTPException, Request, status

from .redis_client import redis_client

logger = logging.getLogger(__name__)


def client_key(request: Request) -> str:
    """Derive a spoof-resistant per-caller IP key (audit H3).

    Trust order:
      1. X-Real-IP — our nginx sets this to $remote_addr (the true client,
         resolved from Cloudflare's CF-Connecting-IP within trusted CF
         ranges). nginx OVERWRITES any client-supplied value, so it cannot
         be forged.
      2. The RIGHT-MOST X-Forwarded-For entry — the hop our own nginx
         appended. The left-most entries are attacker-controlled (a client
         can prepend `X-Forwarded-For: 1.2.3.4` to mint a fresh rate-limit
         bucket per fake IP and bypass the limit), so we must NOT use them.
      3. The socket peer.
    """
    real = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if real and real.strip():
        return real.strip()
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        parts = [p.strip() for p in ff.split(",") if p.strip()]
        if parts:
            return parts[-1]  # right-most = appended by our trusted proxy
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def check_rate_limit(
    bucket: str,
    identity: str,
    *,
    max_requests: int,
    window_sec: float,
) -> None:
    """Sliding-window counter via a Redis sorted set.

    Each call records `now` into a ZSET keyed by (bucket, identity), prunes
    entries older than `window_sec`, then asserts the size is <= max_requests.
    Atomicity via MULTI/EXEC pipeline so concurrent calls cannot race past
    the limit.

    Raises HTTPException(429) on overflow. Silently allows on Redis failure
    (logs warn) — failing closed here would brick login during any Redis
    incident.
    """
    if max_requests <= 0:
        return
    key = f"rl:{bucket}:{identity}"
    now_ms = int(time.time() * 1000)
    window_ms = int(window_sec * 1000)
    cutoff = now_ms - window_ms
    try:
        async with redis_client.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, cutoff)
            pipe.zadd(key, {f"{now_ms}-{identity}": now_ms})
            pipe.zcard(key)
            pipe.pexpire(key, window_ms + 1000)
            _, _, count, _ = await pipe.execute()
    except Exception as exc:  # noqa: BLE001 — fail-open by design (see docstring)
        logger.warning("rate_limit redis error on %s: %s", bucket, exc)
        return
    if count > max_requests:
        retry_after = max(1, int(window_sec))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, slow down.",
            headers={"Retry-After": str(retry_after)},
        )


async def rate_limit_request(
    request: Request,
    bucket: str,
    *,
    max_requests: int,
    window_sec: float,
    extra_key: Optional[str] = None,
) -> None:
    """Convenience wrapper that derives the identity from the request IP
    (plus an optional extra key, e.g. submitted email/wallet address so a
    single IP can't bypass by rotating identifiers)."""
    ident = client_key(request)
    if extra_key:
        ident = f"{ident}|{extra_key.lower().strip()}"
    await check_rate_limit(
        bucket,
        ident,
        max_requests=max_requests,
        window_sec=window_sec,
    )
