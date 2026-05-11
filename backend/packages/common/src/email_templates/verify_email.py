"""Sign-up verification + welcome email — sent ONCE at registration.

Combines the email-confirm CTA with full welcome content so the trader
gets a single rich onboarding message instead of two emails landing
together (the old flow sent welcome.py + verify_email.py back-to-back).

Layout matches the brand spec the client provided:
  • Hero eyebrow + welcome title
  • "Here's what you're about to experience" — 4 capability bullets
  • Account credentials block (email = username, optional trading ID)
  • Primary CTA: Verify My Account → signed JWT verify-email URL
  • Secondary CTA: Open Dashboard → trader login
  • "Why Trade with SwisDex" — 8 differentiator bullets
  • Standard SwisDex footer + support address

The signed token in `verify_url` is a JWT with type=email_verify and a
24-hour expiry — see auth_service.send_verification_email.
"""
from __future__ import annotations

from html import escape

from .base import render_layout


def _bullet(title: str, body: str) -> str:
    """Two-line capability bullet used in the 'experience' section."""
    return f"""
    <li style="margin:0 0 14px;padding:0;">
      <strong style="color:#f5f5f5;font-size:14px;display:block;line-height:1.4;">
        {escape(title)}
      </strong>
      <span style="color:#9a9a9a;font-size:13px;line-height:1.6;display:block;margin-top:2px;">
        {escape(body)}
      </span>
    </li>
    """


def render_verify_email(
    *,
    first_name: str | None,
    verify_url: str,
    trader_app_url: str = "https://trade.swisdex.com",
    username: str | None = None,
    trading_id: str | None = None,
    expires_hours: int = 24,
) -> tuple[str, str, str]:
    name = (first_name or "trader").strip() or "trader"

    intro = (
        "Thank you for choosing SwisDex. We are excited to welcome you to "
        "a growing community of active crypto and derivatives traders using "
        "one of the most advanced decentralized trading ecosystems available "
        "today. At SwisDex, your funds remain in your wallet while our "
        "infrastructure handles seamless and secure trade execution."
    )

    # ── "What you're about to experience" capability list ────────────────
    experience_html = (
        '<p style="margin:24px 0 12px;color:#f5f5f5;font-size:14px;font-weight:700;">'
        "Here's what you're about to experience:"
        '</p>'
        '<ul style="margin:0 0 24px;padding:0 0 0 18px;color:#f5f5f5;">'
        + _bullet(
            "Powerful Web & Mobile Trading Platform",
            "Access fast and responsive trading tools designed for both beginners and professional traders.",
        )
        + _bullet(
            "Earn Hub Rewards",
            "Unlock daily streak rewards, Spin & Win bonuses, staking opportunities, and platform tasks.",
        )
        + _bullet(
            "Advanced Risk Management",
            "Trade with smart execution systems, leverage controls, and secure wallet-based infrastructure.",
        )
        + _bullet(
            "Demo Trading Account",
            "Practice your strategies in a completely risk-free environment before entering live markets.",
        )
        + '</ul>'
    )

    # ── Credentials block ───────────────────────────────────────────────
    credentials_html = (
        '<div style="margin:0 0 24px;padding:18px 20px;border:1px solid #2a2a2a;'
        'border-radius:8px;background:#0e0e0e;">'
        '<p style="margin:0 0 10px;color:#55a630;font-size:12px;font-weight:700;'
        'letter-spacing:0.8px;text-transform:uppercase;">Your Account Credentials</p>'
        '<p style="margin:0 0 6px;color:#9a9a9a;font-size:13px;">'
        "To access your SwisDex Dashboard:"
        '</p>'
        '<p style="margin:0 0 4px;color:#f5f5f5;font-size:14px;">'
        f'<strong style="color:#f5f5f5;">Username:</strong> '
        f'<span style="color:#55a630;">{escape(username or name)}</span>'
        '</p>'
        '<p style="margin:0 0 14px;color:#9a9a9a;font-size:13px;line-height:1.5;">'
        "Use the password you created during registration."
        '</p>'
    )
    if trading_id:
        credentials_html += (
            '<p style="margin:14px 0 6px;color:#9a9a9a;font-size:13px;">'
            "To access your Trading Terminal:"
            '</p>'
            '<p style="margin:0 0 4px;color:#f5f5f5;font-size:14px;">'
            f'<strong style="color:#f5f5f5;">Trading ID:</strong> '
            f'<span style="color:#55a630;font-variant-numeric:tabular-nums;">{escape(trading_id)}</span>'
            '</p>'
            '<p style="margin:0;color:#9a9a9a;font-size:13px;line-height:1.5;">'
            "Use your trading password."
            '</p>'
        )
    credentials_html += '</div>'

    # ── Verification prompt above the CTAs ──────────────────────────────
    verify_prompt = (
        '<div style="margin:0 0 8px;padding:16px 18px;border:1px solid #55a63055;'
        'border-radius:8px;background:rgba(85,166,48,0.06);">'
        '<p style="margin:0 0 6px;color:#55a630;font-size:13px;font-weight:700;">'
        "Complete Your Verification"
        '</p>'
        '<p style="margin:0;color:#9a9a9a;font-size:13px;line-height:1.6;">'
        "As part of SwisDex compliance and security procedures, account "
        "verification is required before activating advanced trading features "
        f"and higher leverage tiers. The link below is valid for {expires_hours} hours."
        '</p>'
        '</div>'
    )

    # ── Why-trade differentiator list ───────────────────────────────────
    def li(text: str) -> str:
        return (
            f'<li style="margin:0 0 6px;color:#f5f5f5;font-size:13px;line-height:1.6;">'
            f'{escape(text)}</li>'
        )
    why_html = (
        '<p style="margin:28px 0 10px;color:#f5f5f5;font-size:14px;font-weight:700;">'
        "Why Trade with SwisDex"
        '</p>'
        '<ul style="margin:0 0 8px;padding:0 0 0 18px;">'
        + li("Decentralized wallet-based trading")
        + li("Fast order execution")
        + li("Demo & live trading accounts")
        + li("Earn Hub rewards and staking")
        + li("Advanced charting and market tools")
        + li("Multi-device trading access")
        + li("24/7 support assistance")
        + li("Daily market insights and platform updates")
        + '</ul>'
    )

    closing = (
        '<p style="margin:28px 0 6px;color:#9a9a9a;font-size:13px;line-height:1.6;">'
        "If you have any questions or require assistance, our support team is always available."
        '</p>'
        '<p style="margin:14px 0 0;color:#f5f5f5;font-size:13px;line-height:1.6;">'
        "Best regards,<br>"
        '<strong>The SwisDex Broker House Team</strong>'
        '</p>'
        '<p style="margin:18px 0 0;color:#9a9a9a;font-size:11px;line-height:1.6;">'
        "Trading digital assets and leveraged products involves risk and may "
        "result in the loss of capital. Please trade responsibly."
        '</p>'
    )

    body_html = experience_html + credentials_html + verify_prompt + why_html + closing

    subject = "Welcome to SwisDex — Verify your account"
    html = render_layout(
        hero_eyebrow="Welcome to the Future of Decentralized Trading",
        title=f"Dear {name},",
        intro=intro,
        body_html=body_html,
        cta_label="Verify My Account",
        cta_url=verify_url,
        secondary_cta_label="Open Dashboard",
        secondary_cta_url=f"{trader_app_url.rstrip('/')}/auth/login",
        footer_note=(
            "If you didn't create a SwisDex account, ignore this email — "
            f"the verification link will expire in {expires_hours} hours and "
            "no account will be activated."
        ),
    )

    # Plain-text fallback (sent alongside HTML for clients that strip markup).
    text = (
        "Welcome to the Future of Decentralized Trading\n"
        "===============================================\n\n"
        f"Dear {name},\n\n"
        "Thank you for choosing SwisDex. We are excited to welcome you to "
        "a growing community of active crypto and derivatives traders.\n\n"
        "At SwisDex, your funds remain in your wallet while our infrastructure "
        "handles seamless and secure trade execution.\n\n"
        "Here's what you're about to experience:\n"
        "  • Powerful Web & Mobile Trading Platform — fast, responsive tools for every level.\n"
        "  • Earn Hub Rewards — daily streaks, Spin & Win, staking, tasks.\n"
        "  • Advanced Risk Management — smart execution, leverage controls, wallet-based security.\n"
        "  • Demo Trading Account — practice strategies risk-free.\n\n"
        "Your Account Credentials\n"
        "------------------------\n"
        f"Username: {username or name}\n"
        "Use the password you created during registration.\n"
    )
    if trading_id:
        text += f"Trading ID: {trading_id}\n"
    text += (
        "\nComplete Your Verification\n"
        "--------------------------\n"
        "Verify your account to activate advanced features and higher leverage tiers.\n"
        f"This link is valid for {expires_hours} hours:\n\n"
        f"  {verify_url}\n\n"
        f"Open Dashboard: {trader_app_url.rstrip('/')}/auth/login\n\n"
        "Why Trade with SwisDex\n"
        "----------------------\n"
        "  • Decentralized wallet-based trading\n"
        "  • Fast order execution\n"
        "  • Demo & live trading accounts\n"
        "  • Earn Hub rewards and staking\n"
        "  • Advanced charting and market tools\n"
        "  • Multi-device trading access\n"
        "  • 24/7 support assistance\n"
        "  • Daily market insights and platform updates\n\n"
        "If you have any questions, our support team is always available.\n\n"
        "Best regards,\n"
        "The SwisDex Broker House Team\n\n"
        "Trading digital assets and leveraged products involves risk and may "
        "result in the loss of capital. Please trade responsibly.\n"
    )
    return subject, html, text
