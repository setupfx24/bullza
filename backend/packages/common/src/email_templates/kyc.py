from __future__ import annotations

import re
from html import escape

from .base import render_layout, kv_table


def _reason_points(reason: str) -> list[str]:
    """Split an admin's rejection reason into individual points. Admins often
    type one issue per line (or separated by ; / •); we render each as its own
    bullet instead of collapsing them into one line (client 2026-06-23)."""
    parts = re.split(r"[\r\n;]+|\s*•\s*", (reason or "").strip())
    return [p.strip(" -*\t") for p in parts if p.strip(" -*\t")]


def render_kyc_approved(
    *,
    first_name: str | None,
    trader_app_url: str = "https://trade.swisdex.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    body = """
    <p style="margin:0 0 12px;color:#1a1a1a;font-size:14px;line-height:1.6;">
      Now unlocked on your account:
    </p>
    <ul style="margin:0;padding-left:20px;color:#1a1a1a;font-size:14px;line-height:1.7;">
      <li>Higher leverage tiers</li>
      <li>Larger withdrawal limits</li>
      <li>Faster deposit settlement</li>
      <li>Premium rewards eligibility</li>
    </ul>
    """
    subject = "KYC verified — your account is fully unlocked"
    html = render_layout(
        title="Identity verified",
        intro=f"Hi {name}, your KYC documents have been approved.",
        body_html=body,
        cta_label="Open Dashboard",
        cta_url=f"{trader_app_url.rstrip('/')}/dashboard",
    )
    text = (
        f"Hi {name},\n\n"
        "Your KYC has been approved. Now unlocked:\n"
        "  - Higher leverage tiers\n"
        "  - Larger withdrawal limits\n"
        "  - Faster deposit settlement\n"
        "  - Premium rewards eligibility\n\n"
        f"Open your dashboard: {trader_app_url.rstrip('/')}/dashboard\n"
    )
    return subject, html, text


def render_kyc_rejected(
    *,
    first_name: str | None,
    reason: str | None = None,
    trader_app_url: str = "https://trade.swisdex.com",
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"
    points = _reason_points(reason) if reason else []
    if len(points) > 1:
        items = "".join(f'<li>{escape(p)}</li>' for p in points)
        reason_html = (
            '<p style="margin:0 0 6px;color:#1a1a1a;font-size:14px;font-weight:700;">Reason(s) for rejection:</p>'
            f'<ul style="margin:0 0 8px;padding-left:20px;color:#1a1a1a;font-size:14px;line-height:1.7;">{items}</ul>'
        )
    elif points:
        reason_html = kv_table([("Reason", points[0])])
    else:
        reason_html = ""
    body = reason_html + """
    <p style="margin:16px 0 0;color:#1a1a1a;font-size:14px;line-height:1.6;">
      Please re-upload corrected documents from the KYC page. Common fixes:
    </p>
    <ul style="margin:8px 0 0;padding-left:20px;color:#1a1a1a;font-size:14px;line-height:1.7;">
      <li>All four corners of the document visible</li>
      <li>Clear, readable photo (no glare or blur)</li>
      <li>Address proof issued within the last 3 months</li>
      <li>Selfie matching the photo on the ID</li>
    </ul>
    """
    subject = "KYC needs another look — action required"
    html = render_layout(
        title="KYC verification rejected",
        intro=f"Hi {name}, we couldn't verify your KYC documents on this attempt.",
        body_html=body,
        cta_label="Re-upload documents",
        cta_url=f"{trader_app_url.rstrip('/')}/profile/kyc",
        footer_note=(
            "Most rejections are resolved on the second attempt. "
            "Reply to this email if you'd like help."
        ),
    )
    text_lines = [
        f"Hi {name},",
        "",
        "We couldn't verify your KYC documents on this attempt.",
    ]
    if points:
        if len(points) > 1:
            text_lines += ["", "Reason(s) for rejection:"] + [f"  - {p}" for p in points]
        else:
            text_lines += ["", f"Reason: {points[0]}"]
    text_lines += [
        "",
        "Common fixes:",
        "  - All four corners of the document visible",
        "  - Clear, readable photo (no glare or blur)",
        "  - Address proof issued within the last 3 months",
        "  - Selfie matching the photo on the ID",
        "",
        f"Re-upload here: {trader_app_url.rstrip('/')}/profile/kyc",
    ]
    return subject, html, "\n".join(text_lines)
