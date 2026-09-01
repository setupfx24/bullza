"""Admin-triggered server maintenance broadcast — sent to every active
user before a scheduled downtime window so trades, withdrawals, and
deposits aren't surprised by an outage.

Subject/body are templated but the admin can override both via the
broadcast form. Window times are formatted as the caller provides them
(usually a UTC ISO string the admin already rendered for display).
"""
from __future__ import annotations

from html import escape

from ..config import get_settings
from .base import render_layout, kv_table


def render_maintenance_notice(
    *,
    first_name: str | None,
    window_label: str,           # e.g. "Sun 25 May 2026, 18:00–20:00 UTC"
    expected_duration: str,      # e.g. "~2 hours"
    impacted_services: list[str], # e.g. ["Trading", "Deposits", "Withdrawals"]
    reason: str | None = None,   # short admin-supplied explanation
    custom_message_html: str | None = None,  # raw HTML override block
    trader_app_url: str = "",
    subject_override: str | None = None,  # admin-set email subject line
    title_override: str | None = None,    # admin-set heading inside the email
) -> tuple[str, str, str]:
    s = get_settings()
    brand = (s.BRAND_NAME or "").strip() or "Bullza"
    domain = (s.BRAND_DOMAIN or "").strip() or "example.com"
    support_email = f"support@{domain}"
    trader_app_url = (trader_app_url or "").strip() or s.TRADER_APP_URL
    name = (first_name or "trader").strip() or "trader"

    rows: list[tuple[str, str]] = [
        ("Window", window_label),
        ("Expected duration", expected_duration),
        ("Services impacted", ", ".join(impacted_services) if impacted_services else "All"),
    ]
    if reason:
        rows.append(("Reason", reason))

    intro = (
        f"Heads up — {brand} will be unavailable for a short maintenance "
        "window. Close or hedge positions you don't want held through the "
        "outage. Stop-loss and take-profit orders remain server-side and "
        "will continue to trigger on the matching engine when service "
        "resumes."
    )

    body = kv_table(rows)
    if custom_message_html:
        body += f"""
        <div style="margin:16px 0 0;padding:14px 16px;border:1px solid #e5e7eb;
                    border-radius:8px;background:#f4f5f7;color:#1a1a1a;
                    font-size:14px;line-height:1.6;">
          {custom_message_html}
        </div>
        """
    body += f"""
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
      Status updates will be posted on {escape(domain)}/status throughout the
      maintenance. Need help right after? Reach
      <a href="mailto:{escape(support_email, quote=True)}" style="color:#55a630;text-decoration:none;">
        {escape(support_email)}</a>.
    </p>
    """

    subject = (subject_override or "").strip() or f"Scheduled maintenance — {window_label}"
    html = render_layout(
        title=(title_override or "").strip() or "Scheduled maintenance",
        intro=intro,
        body_html=body,
        cta_label="Check your positions",
        cta_url=f"{trader_app_url.rstrip('/')}/trading",
        hero_eyebrow="Service notice",
        footer_note=(
            "We schedule maintenance for the quietest part of the trading "
            "week. If this window overlaps a position you can't close "
            "right now, contact support to coordinate."
        ),
    )

    text_lines = [
        f"Hi {name},",
        "",
        f"{brand} will be unavailable for a short maintenance window:",
        f"  Window:            {window_label}",
        f"  Expected duration: {expected_duration}",
        f"  Services impacted: {', '.join(impacted_services) if impacted_services else 'All'}",
    ]
    if reason:
        text_lines.append(f"  Reason:            {reason}")
    text_lines += [
        "",
        f"Close or hedge positions you don't want held through the outage.",
        f"Check positions: {trader_app_url.rstrip('/')}/trading",
        "",
        f"Support: {support_email}",
    ]
    return subject, html, "\n".join(text_lines)
