"""Whether to use the AllTick WebSocket feed vs simulated feed.

AllTick tokens are alphanumeric (no fixed prefix). We just guard against
empty strings and obvious placeholder text from the .env example.
"""

PLACEHOLDERS = {
    "",
    "your-alltick-token",
    "your_alltick_token",
    "your-alltick-token-here",
    "alltick-token",
    "changeme",
    "<token>",
    "test",
    "testtoken",
}


def usable_alltick_token(token: str | None) -> bool:
    """True if `token` looks like a real AllTick credential (not empty / placeholder)."""
    if not token:
        return False
    t = str(token).strip().lower()
    if t in PLACEHOLDERS:
        return False
    # Real AllTick tokens are typically >= 16 chars; anything shorter is
    # almost certainly a placeholder, missing copy-paste, or the literal
    # word "test".
    return len(t) >= 16
