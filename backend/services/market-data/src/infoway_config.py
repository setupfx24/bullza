"""Whether to use the InfoWay WebSocket feed.

InfoWay API keys are alphanumeric and supplied via the `apikey` URL
query parameter. Guard against empty strings + obvious placeholders so
a half-configured .env doesn't silently look "configured".
"""

PLACEHOLDERS = {
    "",
    "your-infoway-token",
    "your_infoway_token",
    "your-infoway-key",
    "your_infoway_key",
    "infoway-token",
    "infoway-key",
    "changeme",
    "<token>",
    "<apikey>",
    "test",
    "testtoken",
}


def usable_infoway_token(token: str | None) -> bool:
    """True if `token` looks like a real InfoWay API key (not empty / placeholder)."""
    if not token:
        return False
    t = str(token).strip().lower()
    if t in PLACEHOLDERS:
        return False
    return len(t) >= 16
