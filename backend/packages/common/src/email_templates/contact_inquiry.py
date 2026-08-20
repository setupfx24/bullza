"""Contact-form emails — the inbound copy for support, and the
acknowledgement we send back to the visitor.

Both are triggered by the public POST /api/v1/public/contact endpoint
(gateway `api/contact.py`). No account exists at this point, so nothing
here may assume a user record.
"""
from __future__ import annotations

from html import escape

from ..config import get_settings
from .base import render_layout, kv_table


# Form `subject` is a <select> on the landing page — map the machine value
# to the label we show in the inbox. Unknown values fall back to the raw
# string so a future option added on the frontend still renders sensibly.
SUBJECT_LABELS: dict[str, str] = {
    "general": "General Inquiry",
    "account": "Account Support",
    "technical": "Technical Issue",
    "partnership": "Partnership",
}


def subject_label(value: str) -> str:
    key = (value or "").strip().lower()
    return SUBJECT_LABELS.get(key) or (value or "General Inquiry").strip()


def _message_html(message: str) -> str:
    """Visitor text is untrusted — escape it, then restore line breaks."""
    return escape(message or "").replace("\n", "<br>")


def render_contact_inquiry(
    *,
    name: str,
    email: str,
    subject: str,
    message: str,
    when_utc: str,
    ip_address: str | None = None,
) -> tuple[str, str, str]:
    """The copy that lands in the support inbox."""
    label = subject_label(subject)

    rows: list[tuple[str, str]] = [
        ("Name", name),
        ("Email", email),
        ("Subject", label),
        ("Received (UTC)", when_utc),
    ]
    if ip_address:
        rows.append(("IP address", ip_address))

    body = kv_table(rows) + f"""
    <p style="margin:24px 0 8px;color:#6b7280;font-size:12px;font-weight:700;
              letter-spacing:0.6px;text-transform:uppercase;">
      Message
    </p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;
                background:#f4f5f7;color:#1a1a1a;font-size:14px;line-height:1.6;
                white-space:normal;word-break:break-word;">
      {_message_html(message)}
    </div>
    """

    email_subject = f"[Contact — {label}] {name}"
    html = render_layout(
        title="New contact form submission",
        intro=f"{name} sent a message through the website contact form.",
        body_html=body,
        cta_label="Reply to sender",
        cta_url=f"mailto:{email}",
        footer_note=(
            f"Replying to this email goes to the "
            f"{(get_settings().BRAND_NAME or '').strip() or 'YourBrand'} inbox, "
            "not the sender — use the button above to reply directly."
        ),
        hero_eyebrow="Website Contact Form",
    )
    text = "\n".join([
        "New contact form submission",
        "",
        f"Name:     {name}",
        f"Email:    {email}",
        f"Subject:  {label}",
        f"Received: {when_utc} UTC",
        *( [f"IP:       {ip_address}"] if ip_address else [] ),
        "",
        "Message:",
        (message or "").strip(),
    ])
    return email_subject, html, text


def render_contact_ack(
    *,
    name: str,
    subject: str,
    message: str,
) -> tuple[str, str, str]:
    """Acknowledgement sent back to the visitor so the success modal on the
    site isn't the only confirmation they get."""
    label = subject_label(subject)
    first = (name or "there").strip().split(" ")[0] or "there"
    s = get_settings()
    brand = (s.BRAND_NAME or "").strip() or "YourBrand"
    domain = (s.BRAND_DOMAIN or "").strip() or "example.com"

    body = f"""
    <p style="margin:0 0 16px;color:#1a1a1a;font-size:14px;line-height:1.6;">
      Our support team has your message and will get back to you at this
      address, usually within one business day.
    </p>
    <p style="margin:24px 0 8px;color:#6b7280;font-size:12px;font-weight:700;
              letter-spacing:0.6px;text-transform:uppercase;">
      What you sent us
    </p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;
                background:#f4f5f7;color:#1a1a1a;font-size:14px;line-height:1.6;
                word-break:break-word;">
      <strong>{escape(label)}</strong><br><br>
      {_message_html(message)}
    </div>
    """

    email_subject = f"We've received your message — {brand} Support"
    html = render_layout(
        title="Thanks for getting in touch",
        intro=f"Hi {first}, this is confirmation that your message reached us.",
        body_html=body,
        footer_note=(
            "You're receiving this because a message was submitted with this "
            f"email address on {domain}. If that wasn't you, you can ignore "
            "this email."
        ),
    )
    text = "\n".join([
        f"Hi {first},",
        "",
        "Thanks for getting in touch. Our support team has your message and "
        "will get back to you at this address, usually within one business day.",
        "",
        f"Subject: {label}",
        "",
        "Your message:",
        (message or "").strip(),
        "",
        f"— {brand} Support",
    ])
    return email_subject, html, text
