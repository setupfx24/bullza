"""Shared HTML scaffolding for every transactional email.

Inline CSS only — Outlook/Gmail/iOS Mail strip <style> blocks.
"""
from __future__ import annotations

from html import escape

from ..config import get_settings


# Brand palette — kept inline because Outlook/Gmail/iOS Mail strip <style>
# blocks, so every colour has to live on a style="" attribute.
_BRAND       = "#55a630"   # SwisDex green (primary CTAs, logo accent)
_BRAND_DARK  = "#3f7d22"
_GOLD        = "#d6a93d"   # legacy accent — still used for secondary action
_BG          = "#0a0a0a"
_CARD        = "#141414"
_TEXT        = "#f5f5f5"
_TEXT_DIM    = "#9a9a9a"
_BORDER      = "#2a2a2a"


def _header_brand_html() -> str:
    """Logo image when EMAIL_LOGO_URL is set; styled wordmark text otherwise.

    Most clients (Gmail, Outlook, iOS Mail) block remote images by default
    until the user clicks "Display images". The alt text is the brand
    wordmark so the header still reads "SwisDex" with images off.
    """
    logo = (getattr(get_settings(), "EMAIL_LOGO_URL", "") or "").strip()
    if logo:
        return (
            f'<img src="{escape(logo, quote=True)}" alt="SwisDex" '
            f'width="140" height="40" '
            f'style="display:block;height:40px;width:auto;max-width:160px;'
            f'border:0;outline:none;text-decoration:none;">'
        )
    return (
        f'<span style="font-weight:700;font-size:22px;letter-spacing:0.2px;">'
        f'<span style="color:{_TEXT};">Swis</span>'
        f'<span style="color:{_BRAND};">Dex</span>'
        f'</span>'
    )


def _app_badges_html() -> str:
    """"Get the SwisDex app" footer section.

    Renders only when at least one of IOS_APP_URL / ANDROID_APP_URL is set
    so emails don't link to dead store pages before the apps ship.
    """
    s = get_settings()
    ios_url = (getattr(s, "IOS_APP_URL", "") or "").strip()
    and_url = (getattr(s, "ANDROID_APP_URL", "") or "").strip()
    if not ios_url and not and_url:
        return ""

    ios_badge = (getattr(s, "EMAIL_IOS_BADGE_URL", "") or "").strip()
    and_badge = (getattr(s, "EMAIL_ANDROID_BADGE_URL", "") or "").strip()

    cells: list[str] = []
    if ios_url and ios_badge:
        cells.append(f"""
        <td style="padding:0 6px;">
          <a href="{escape(ios_url, quote=True)}" style="text-decoration:none;">
            <img src="{escape(ios_badge, quote=True)}" alt="Download on the App Store"
                 height="44" style="display:block;height:44px;width:auto;border:0;outline:none;">
          </a>
        </td>
        """)
    if and_url and and_badge:
        cells.append(f"""
        <td style="padding:0 6px;">
          <a href="{escape(and_url, quote=True)}" style="text-decoration:none;">
            <img src="{escape(and_badge, quote=True)}" alt="Get it on Google Play"
                 height="44" style="display:block;height:44px;width:auto;border:0;outline:none;">
          </a>
        </td>
        """)

    if not cells:
        return ""

    return f"""
    <tr>
      <td style="padding:0 32px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-collapse:separate;background:{_BRAND};
                      border-radius:10px;padding:20px 16px;">
          <tr>
            <td align="center" style="padding:0 0 10px;color:#0a0a0a;
                                      font-size:15px;font-weight:700;letter-spacing:0.2px;">
              Trade anywhere — get the SwisDex app
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>{''.join(cells)}</tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    """


def render_layout(
    *,
    title: str,
    intro: str,
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    secondary_cta_label: str | None = None,
    secondary_cta_url: str | None = None,
    footer_note: str | None = None,
    hero_eyebrow: str | None = None,
) -> str:
    """Wraps body content in the standard SwisDex email shell.

    Args:
      title:                big headline at the top of the card (escaped)
      intro:                1-2 line lead under the title (escaped)
      body_html:            pre-rendered HTML for the main content (NOT escaped
                            — caller must trust or pre-escape values)
      cta_label:            primary CTA — renders the green button
      cta_url:              target for the primary CTA
      secondary_cta_label:  optional second CTA below the primary; renders as a
                            ghost / outline button so the hierarchy is clear
      secondary_cta_url:    target for the secondary CTA
      footer_note:          optional disclaimer below the CTAs
      hero_eyebrow:         optional small label above the title (e.g.
                            "Welcome to the Future of Decentralized Trading")
    """
    cta_block = ""
    if cta_label and cta_url:
        primary = f"""
        <div style="text-align:center;margin:32px 0 8px;">
          <a href="{escape(cta_url, quote=True)}"
             style="display:inline-block;padding:14px 28px;border-radius:8px;
                    background:{_BRAND};color:#0a0a0a;text-decoration:none;
                    font-weight:700;font-size:14px;letter-spacing:0.2px;">
            {escape(cta_label)}
          </a>
        </div>
        """
        cta_block = primary
        if secondary_cta_label and secondary_cta_url:
            cta_block += f"""
            <div style="text-align:center;margin:0 0 8px;">
              <a href="{escape(secondary_cta_url, quote=True)}"
                 style="display:inline-block;padding:12px 24px;border-radius:8px;
                        background:transparent;border:1px solid {_BORDER};
                        color:{_TEXT};text-decoration:none;
                        font-weight:600;font-size:13px;letter-spacing:0.2px;">
                {escape(secondary_cta_label)}
              </a>
            </div>
            """

    footer_block = ""
    if footer_note:
        footer_block = f"""
        <p style="margin:24px 0 0;color:{_TEXT_DIM};font-size:12px;line-height:1.5;">
          {escape(footer_note)}
        </p>
        """

    eyebrow_block = ""
    if hero_eyebrow:
        eyebrow_block = f"""
        <p style="margin:0 0 8px;color:{_BRAND};font-size:12px;font-weight:700;
                  letter-spacing:0.8px;text-transform:uppercase;">
          {escape(hero_eyebrow)}
        </p>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:{_TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:{_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:{_CARD};
                      border:1px solid {_BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid {_BORDER};
                       background:linear-gradient(180deg,#181818 0%,{_CARD} 100%);">
              {_header_brand_html()}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              {eyebrow_block}
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:{_TEXT};">
                {escape(title)}
              </h1>
              <p style="margin:0 0 20px;color:{_TEXT_DIM};font-size:14px;line-height:1.6;">
                {escape(intro)}
              </p>
              {body_html}
              {cta_block}
              {footer_block}
            </td>
          </tr>
          {_app_badges_html()}
          <tr>
            <td style="padding:20px 32px;border-top:1px solid {_BORDER};
                       color:{_TEXT_DIM};font-size:12px;line-height:1.5;">
              SwisDex — Trade without giving your money to any broker.<br>
              You received this because of activity on your SwisDex account.
              Need help? Reply to this email or contact
              <a href="mailto:support@swisdex.com" style="color:{_BRAND};text-decoration:none;">
                support@swisdex.com</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def kv_row(label: str, value: str) -> str:
    """One line in a label/value table for transactional details."""
    return f"""
    <tr>
      <td style="padding:10px 0;color:{_TEXT_DIM};font-size:13px;width:160px;">{escape(label)}</td>
      <td style="padding:10px 0;color:{_TEXT};font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;">
        {escape(value)}
      </td>
    </tr>
    """


def kv_table(rows: list[tuple[str, str]]) -> str:
    """Wraps kv_row items into a styled table."""
    inner = "".join(kv_row(k, v) for (k, v) in rows)
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:collapse;border:1px solid {_BORDER};
                  border-radius:8px;background:{_BG};padding:8px 16px;">
      {inner}
    </table>
    """
