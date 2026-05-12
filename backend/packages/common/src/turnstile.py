"""Cloudflare Turnstile token verifier.

POSTs the client-supplied token to Cloudflare's siteverify endpoint
along with our secret key. Returns True iff Cloudflare confirms the
token is valid, fresh, and bound to this site key.

Behaviour when not configured: if CLOUDFLARE_TURNSTILE_SECRET_KEY is
empty (dev / staging without a key), `verify_turnstile_token` returns
True so the build / local environment isn't broken. Production
deployments MUST set the secret — otherwise registration is
effectively un-CAPTCHA'd.

Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from .config import get_settings

logger = logging.getLogger("turnstile")

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(
    token: str | None,
    *,
    remote_ip: Optional[str] = None,
) -> bool:
    """Returns True if the token is valid, False if Cloudflare rejected
    it or the request failed. Never raises — caller treats False as
    "reject the form submission."""
    settings = get_settings()
    secret = (settings.CLOUDFLARE_TURNSTILE_SECRET_KEY or "").strip()

    # Dev mode: no secret configured → skip verification. Logged once so
    # ops can spot it during smoke testing.
    if not secret:
        logger.info("Turnstile not configured (no SECRET) — allowing request")
        return True

    if not token or not str(token).strip():
        logger.warning("Turnstile: empty token submitted")
        return False

    data = {"secret": secret, "response": str(token).strip()}
    if remote_ip:
        data["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(SITEVERIFY_URL, data=data)
    except (httpx.TimeoutException, httpx.NetworkError) as exc:
        # Network failure — fail closed so a downed Cloudflare doesn't
        # accidentally disable bot protection.
        logger.warning("Turnstile siteverify network error: %s", exc)
        return False

    if resp.status_code != 200:
        logger.warning("Turnstile siteverify HTTP %s body=%r",
                       resp.status_code, resp.text[:200])
        return False

    try:
        payload = resp.json()
    except ValueError:
        logger.warning("Turnstile siteverify returned non-JSON")
        return False

    success = bool(payload.get("success"))
    if not success:
        # error-codes is a list per Cloudflare docs. Log them so we can
        # diagnose mis-configured site/secret pairs.
        logger.warning(
            "Turnstile siteverify rejected token: error_codes=%s",
            payload.get("error-codes"),
        )
    return success
