"""Transactional email via SMTP (Hostinger, SES, Gmail, etc.).

Single send path — `send_email(to, subject, html, text)` — used by every
business event (welcome, deposit, withdrawal, password reset). The
old `send_password_reset_email` is kept as a thin wrapper so existing
callers don't change.

The actual `smtplib` call runs in a thread (asyncio.to_thread) so the
event loop isn't blocked while SMTP handshakes.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from .config import get_settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    s = get_settings()
    return bool(s.SMTP_HOST and str(s.SMTP_HOST).strip())


# ── Per-category From aliases ─────────────────────────────────────────
# Callers pass a `category=` keyword to `send_email`. The category is
# mapped to a settings field; if that field is blank, we fall through
# to the legacy single SMTP_FROM. This keeps backward compat (existing
# call sites that omit category continue to work) while letting each
# topical email come from a topical address.
#
# Display names per category — surfaces a useful sender label in the
# inbox preview even when the underlying mailbox is the generic support
# account. Override globally with MAIL_FROM_NAME (legacy behaviour).
_CATEGORY_DISPLAY_NAMES: dict[str, str] = {
    "account":    "SwisDex Account",
    "insure":     "SwisDex Insurance",
    "affiliates": "SwisDex Affiliates",
    "voucher":    "SwisDex Rewards",
    "stacking":   "SwisDex Earn",
    "info":       "SwisDex",
    "support":    "SwisDex Support",
    "default":    "SwisDex",
}


def _category_address(category: str) -> str | None:
    """Look up the alias address configured for a given category. Returns
    None when no per-category alias is set so the caller falls back to
    the legacy SMTP_FROM / SMTP_USER address."""
    s = get_settings()
    field = {
        "account":    getattr(s, "SMTP_FROM_ACCOUNT", "") or "",
        "insure":     getattr(s, "SMTP_FROM_INSURE", "") or "",
        "affiliates": getattr(s, "SMTP_FROM_AFFILIATES", "") or "",
        "voucher":    getattr(s, "SMTP_FROM_VOUCHER", "") or "",
        "stacking":   getattr(s, "SMTP_FROM_STACKING", "") or "",
        "info":       getattr(s, "SMTP_FROM_INFO", "") or "",
        "support":    getattr(s, "SMTP_FROM_SUPPORT", "") or "",
    }.get(category, "")
    addr = field.strip()
    return addr or None


def _from_address(category: str = "default") -> str:
    """Build the From header with the canonical display name.

    Routing:
      1. If a per-category alias env var is set (SMTP_FROM_<CATEGORY>),
         use it — wrapped with a category-aware display name.
      2. Otherwise fall back to SMTP_FROM, then SMTP_USER — wrapped with
         the global MAIL_FROM_NAME.

    Returns "<Display Name> <bare-email>" (RFC 5322 'name-addr').

    If the configured value is already in 'Name <addr>' form, we replace
    the name rather than nest two display names.
    """
    s = get_settings()

    cat = (category or "default").strip().lower()
    cat_addr = _category_address(cat)

    if cat_addr:
        raw = cat_addr
        name = _CATEGORY_DISPLAY_NAMES.get(cat) or _CATEGORY_DISPLAY_NAMES["default"]
    else:
        raw = (s.SMTP_FROM or s.SMTP_USER or "").strip()
        if not raw:
            raise ValueError("SMTP_FROM or SMTP_USER must be set when SMTP_HOST is set")
        # Legacy single-address path keeps the global display name so we
        # don't silently break existing branding.
        name = (getattr(s, "MAIL_FROM_NAME", None) or "SwisDex").strip()

    # Strip any pre-existing 'Name <addr>' wrapping — keep just the address.
    if "<" in raw and raw.endswith(">"):
        try:
            addr = raw[raw.rindex("<") + 1: -1].strip()
        except ValueError:
            addr = raw
    else:
        addr = raw
    return f"{name} <{addr}>"


def _send_sync(to_email: str, subject: str, html: str, text: Optional[str], category: str) -> None:
    s = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_address(category)
    # Reply-To matches the From so a user hitting "Reply" goes back to the
    # topical inbox (e.g. account@) rather than the SMTP-credential mailbox
    # — important when those addresses differ.
    try:
        msg["Reply-To"] = msg["From"]
    except Exception:
        pass
    msg["To"] = to_email
    # Always include a plain-text fallback. If the caller didn't give us one,
    # produce a crude strip-tags version of the html so picky clients still
    # render something.
    plain = text if text else _strip_tags(html)
    msg.set_content(plain)
    msg.add_alternative(html, subtype="html")

    host = str(s.SMTP_HOST).strip()
    port = int(s.SMTP_PORT)
    with smtplib.SMTP(host, port, timeout=30) as server:
        if s.SMTP_USE_TLS:
            server.starttls()
        user = (s.SMTP_USER or "").strip()
        pwd = (s.SMTP_PASSWORD or "").strip()
        if user:
            server.login(user, pwd)
        server.send_message(msg)


async def send_email(
    to_email: str,
    subject: str,
    html: str,
    *,
    text: Optional[str] = None,
    category: str = "info",
) -> bool:
    """Send a transactional email. Returns True on success, False on
    misconfiguration or SMTP failure. Never raises — caller can ignore
    the result if they don't care.

    ``category`` selects which `From:` alias the message uses. Recognised:
      - account     — deposits, withdrawals
      - insure      — insured-trade payouts / reminders
      - affiliates  — IB, PAMM, MAM
      - voucher     — bonus, referral
      - stacking    — fixed return, staking
      - info        — generic / website / default (the default)
      - support     — auth, KYC, password reset

    Unknown / blank categories fall back to the legacy SMTP_FROM address,
    so existing callers that don't pass the kwarg keep working.
    """
    if not smtp_configured():
        logger.warning("SMTP not configured — skipping email to %s subj=%r", to_email, subject)
        return False
    if not to_email or "@" not in to_email:
        logger.warning("Skipping email — bad recipient %r", to_email)
        return False
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, html, text, category)
        logger.info("email sent to=%s cat=%s subj=%r", to_email, category, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s subj=%r", to_email, subject)
        return False


def fire_and_forget(coro) -> None:
    """Schedule a send_email coroutine on the running loop without awaiting.
    Use from API handlers + services so SMTP latency never delays a response
    and a delivery failure never rolls back a transaction."""
    try:
        asyncio.create_task(coro)
    except RuntimeError:
        # No running loop (sync context) — best-effort fallback.
        try:
            asyncio.run(coro)
        except Exception:
            logger.exception("fire_and_forget fallback failed")


# ─── Plain-text fallback ────────────────────────────────────────────


def _strip_tags(html: str) -> str:
    import re
    # Remove block-level tags as line breaks first so the plaintext is readable.
    txt = re.sub(r"</(p|div|h[1-6]|li|tr)>", "\n", html, flags=re.IGNORECASE)
    txt = re.sub(r"<br\s*/?>", "\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", "", txt)
    # Collapse whitespace.
    txt = re.sub(r"\n\s*\n+", "\n\n", txt)
    return txt.strip()


# ─── Backwards-compat helper used by auth_service.forgot_password ───


async def send_password_reset_email(
    to_email: str, reset_link: str, *, app_name: str = "SwisDex",
) -> bool:
    from .email_templates import render_password_reset
    subject, html, text = render_password_reset(app_name=app_name, reset_link=reset_link)
    # Password reset is a support-style transactional flow.
    return await send_email(to_email, subject, html, text=text, category="support")
