"""Verify-your-email template.

Sent at sign-up; the user must click the link before they can log in.
The signed token in `verify_url` is a JWT with type=email_verify and a
24-hour expiry — see auth_service.send_verification_email.
"""
from __future__ import annotations

from .base import render_layout


def render_verify_email(
    *,
    first_name: str | None,
    verify_url: str,
    expires_hours: int = 24,
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    intro = (
        f"Hi {name}, one quick step before you can sign in. Click the "
        "button below to confirm this is your email address. The link "
        f"is valid for {expires_hours} hours."
    )
    body_html = (
        f'<p style="margin:0 0 12px;color:#9a9a9a;font-size:13px;line-height:1.6;">'
        f'If the button doesn\'t open, paste this link into your browser:'
        f'</p>'
        f'<p style="margin:0 0 8px;word-break:break-all;color:#f5f5f5;font-size:12px;line-height:1.5;">'
        f'<a href="{verify_url}" style="color:#55a630;text-decoration:underline;">{verify_url}</a>'
        f'</p>'
    )
    subject = "Confirm your email address — SwisDex"
    html = render_layout(
        title="Confirm your email",
        intro=intro,
        body_html=body_html,
        cta_label="Confirm email",
        cta_url=verify_url,
        footer_note=(
            "If you didn't create a SwisDex account, ignore this email — "
            "the link will expire on its own and no account will be activated."
        ),
    )
    text = (
        f"Hi {name},\n\n"
        "Confirm your email address to activate your SwisDex account. "
        f"This link is valid for {expires_hours} hours:\n\n"
        f"  {verify_url}\n\n"
        "Didn't sign up? Ignore this email — the link will expire on its own.\n"
    )
    return subject, html, text
