"""Password-strength policy — server-side source of truth.

Mirrors frontend/trader/src/lib/passwordPolicy.ts. If you change a
rule here, update the frontend too — the frontend gives the user
real-time feedback before submit, but the backend is what actually
rejects weak passwords. Either layer alone is insufficient: client
checks can be bypassed, server-only checks frustrate the user with
"submit → fail → retry" loops.

Rules:
  1. Minimum 8 characters (hard floor)
  2. At least 3 of these 4 character classes: lower / upper / digit / symbol
  3. Not in the COMMON_WEAK_PASSWORDS blocklist
  4. Not a substring match against user-supplied disallow strings
     (typically the email local-part + first / last name)

A password that satisfies all four is accepted. Anything else raises
PasswordTooWeak with a short message the caller can return to the
client.
"""
from __future__ import annotations

import re
from typing import Iterable


class PasswordTooWeak(ValueError):
    """Raised when a candidate password fails policy. Use the .reason
    attribute (first failing rule) as the user-facing detail message."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# Top weak passwords — kept short on purpose (mirrors the frontend list).
# The Have-I-Been-Pwned corpus has millions; this set covers the ~70% of
# real brute-force attempts. Add to it freely when you spot a leak.
COMMON_WEAK_PASSWORDS: frozenset[str] = frozenset({
    "12345678", "123456789", "1234567890", "qwerty123", "password", "password1",
    "password123", "qwertyuiop", "asdfghjkl", "11111111", "00000000", "88888888",
    "abcdefgh", "abc12345", "iloveyou", "iloveyou1", "sunshine", "princess",
    "admin123", "admin1234", "letmein", "letmein123", "welcome1", "welcome123",
    "monkey123", "football", "baseball", "qwerty12", "asdf1234", "zxcvbnm",
    "qazwsxedc", "1q2w3e4r", "1qaz2wsx", "q1w2e3r4", "master123", "shadow123",
    "dragon123", "trustno1", "startrek", "starwars", "superman", "batman123",
    "pakistan", "india123", "hello123", "changeme", "demo1234", "test1234",
    "guest123", "user1234", "root1234", "swisdex123", "swisdex2025", "swisdex2026",
})

_LOWER_RE  = re.compile(r"[a-z]")
_UPPER_RE  = re.compile(r"[A-Z]")
_DIGIT_RE  = re.compile(r"\d")
_SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")

MIN_LENGTH = 8
MIN_CHAR_CLASSES = 3   # of {lower, upper, digit, symbol}


def validate_password(password: str, disallow: Iterable[str] = ()) -> None:
    """Raise `PasswordTooWeak` if the password fails policy; return None
    if it passes. The `disallow` iterable seeds substring-match checks
    (typically the user's email local-part, first name, last name) so
    callers can prevent "name1234" / "email@1234" style passwords.

    The check is intentionally case-insensitive on the substring search.
    """
    pw = password or ""

    if len(pw) < MIN_LENGTH:
        raise PasswordTooWeak(f"Password must be at least {MIN_LENGTH} characters")

    if pw.lower() in COMMON_WEAK_PASSWORDS:
        raise PasswordTooWeak("This password is too common — pick something unique")

    class_count = sum([
        bool(_LOWER_RE.search(pw)),
        bool(_UPPER_RE.search(pw)),
        bool(_DIGIT_RE.search(pw)),
        bool(_SYMBOL_RE.search(pw)),
    ])
    if class_count < MIN_CHAR_CLASSES:
        raise PasswordTooWeak(
            "Use a mix of upper-case, lower-case, numbers and symbols "
            f"(at least {MIN_CHAR_CLASSES} of these)"
        )

    pw_low = pw.lower()
    for needle in disallow:
        n = (needle or "").lower().strip()
        if len(n) >= 3 and n in pw_low:
            raise PasswordTooWeak("Don't reuse your email or name in your password")
