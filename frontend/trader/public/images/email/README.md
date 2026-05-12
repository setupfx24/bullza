# Email asset directory

Files in this directory are referenced from the backend transactional
email templates via absolute https URLs (because email clients cannot
resolve relative paths). They are served by the trader frontend at
`https://swisdex.com/images/email/<filename>`.

## Required files (when enabling the app-store footer)

Drop two PNGs here when `IOS_APP_URL` / `ANDROID_APP_URL` are set in
`.env`:

| File | Source | Approx. size |
|---|---|---|
| `app-store-badge.png` | Apple Marketing Tools — https://tools.applemediaservices.com/app-store/ | ~120 × 44 px |
| `google-play-badge.png` | Google Play Badge Generator — https://play.google.com/intl/en_us/badges/ | ~135 × 44 px |

Both badges are intended to render at 44 px tall in the email — pull a
PNG at 2× resolution (88 px tall) so they look sharp on Retina /
high-DPI inboxes.

Until both `IOS_APP_URL` and `ANDROID_APP_URL` are set in `.env`, the
app-store footer is hidden entirely — no broken links, no missing-
image placeholders.

## Why hosted here, not on a CDN

Hotlinking Apple/Google's own badge URLs is unsupported (the URLs they
list in the brand guidelines are not stable and can break overnight).
Self-hosting one PNG each is the conventional fix.
