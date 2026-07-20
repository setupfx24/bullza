"""Public website contact form — delivers submissions to the support inbox.

Unauthenticated by design (visitors have no account), so the endpoint is
rate limited per IP and per submitted email address. Destination mailbox
is CONTACT_INBOX_EMAIL (default support@swisdex.com); comma-separated to
fan out to several mailboxes.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from packages.common.src.config import get_settings
from packages.common.src.rate_limit import rate_limit_request, client_key
from packages.common.src.smtp_mail import send_email, smtp_configured, fire_and_forget
from packages.common.src.email_templates.contact_inquiry import (
    render_contact_inquiry,
    render_contact_ack,
)

logger = logging.getLogger(__name__)

public_router = APIRouter()


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=1, max_length=60)
    message: str = Field(min_length=1, max_length=5000)


def _inbox_addresses() -> list[str]:
    raw = (getattr(get_settings(), "CONTACT_INBOX_EMAIL", "") or "").strip()
    return [a.strip() for a in raw.split(",") if a.strip()]


@public_router.post("/contact", status_code=202)
async def submit_contact(req: ContactRequest, request: Request):
    # Two buckets: a looser per-IP one, and a tight per-address one so a
    # single visitor can't hammer the inbox from a rotating IP.
    await rate_limit_request(request, "contact_form_ip", max_requests=5, window_sec=600)
    await rate_limit_request(
        request, "contact_form_addr", max_requests=3, window_sec=3600,
        extra_key=str(req.email),
    )

    recipients = _inbox_addresses()
    if not recipients:
        logger.error("CONTACT_INBOX_EMAIL is unset — dropping contact submission from %s", req.email)
        raise HTTPException(status_code=503, detail="Contact form is unavailable right now.")

    if not smtp_configured():
        # Surface the payload in logs so nothing is silently lost while SMTP
        # is still unconfigured on this environment.
        logger.error(
            "SMTP not configured — contact submission NOT delivered. from=%s <%s> subject=%s message=%r",
            req.name, req.email, req.subject, req.message,
        )
        raise HTTPException(
            status_code=503,
            detail="We couldn't send your message right now. Please email support@swisdex.com directly.",
        )

    when_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    subject, html, text = render_contact_inquiry(
        name=req.name.strip(),
        email=str(req.email),
        subject=req.subject,
        message=req.message.strip(),
        when_utc=when_utc,
        ip_address=client_key(request),
    )

    # Awaited (send_email runs SMTP on a worker thread, so the event loop is
    # never blocked) — the visitor should only see success if the message
    # actually reached the inbox.
    delivered = False
    for addr in recipients:
        if await send_email(addr, subject, html, text=text, category="support"):
            delivered = True

    if not delivered:
        raise HTTPException(
            status_code=502,
            detail="We couldn't send your message right now. Please email support@swisdex.com directly.",
        )

    # Acknowledgement to the visitor is best-effort — a bounce here must not
    # fail a submission that already landed in the support inbox.
    ack_subject, ack_html, ack_text = render_contact_ack(
        name=req.name.strip(), subject=req.subject, message=req.message.strip(),
    )
    fire_and_forget(
        send_email(str(req.email), ack_subject, ack_html, text=ack_text, category="support")
    )

    return {"status": "sent"}
