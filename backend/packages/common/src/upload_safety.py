"""Defense-in-depth upload validation.

Filename suffix and ``Content-Type`` are both attacker-controlled. The
only reliable signal that an uploaded blob is *actually* what it claims
to be is its first few bytes. This module sniffs those for the file
types we accept (jpg, png, webp, gif, pdf) and rejects anything else,
even if the suffix and Content-Type say otherwise.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class _Magic:
    suffix: str          # canonical extension, lowercase, with dot
    mime: str
    matcher: callable    # bytes -> bool


def _png(b: bytes) -> bool:   return b.startswith(b"\x89PNG\r\n\x1a\n")
def _jpg(b: bytes) -> bool:   return b.startswith(b"\xff\xd8\xff")
def _gif(b: bytes) -> bool:   return b.startswith(b"GIF87a") or b.startswith(b"GIF89a")
def _pdf(b: bytes) -> bool:   return b.startswith(b"%PDF-")
def _webp(b: bytes) -> bool:  return len(b) >= 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP"


_KNOWN: tuple[_Magic, ...] = (
    _Magic(".png",  "image/png",  _png),
    _Magic(".jpg",  "image/jpeg", _jpg),
    _Magic(".jpeg", "image/jpeg", _jpg),
    _Magic(".gif",  "image/gif",  _gif),
    _Magic(".pdf",  "application/pdf", _pdf),
    _Magic(".webp", "image/webp", _webp),
)


class UnsafeUploadError(ValueError):
    """Raised when an upload's bytes do not match the suffix it claims."""


def detect_kind(payload: bytes) -> _Magic | None:
    """Return the matching magic record, or None if unrecognised."""
    head = payload[:64]
    for m in _KNOWN:
        if m.matcher(head):
            return m
    return None


def assert_matches(
    payload: bytes,
    *,
    declared_suffix: str,
    allowed_suffixes: Iterable[str],
) -> _Magic:
    """Verify that ``payload``'s magic bytes correspond to one of
    ``allowed_suffixes`` AND match the ``declared_suffix`` the user gave.

    Returns the canonical _Magic record so the caller can use the safe
    suffix/mime instead of trusting the user. Raises UnsafeUploadError
    on any mismatch.
    """
    declared = (declared_suffix or "").lower().strip()
    allowed = {s.lower() for s in allowed_suffixes}
    if declared not in allowed:
        raise UnsafeUploadError(f"Extension {declared!r} not allowed")

    kind = detect_kind(payload)
    if kind is None:
        raise UnsafeUploadError("Unrecognised file format")
    if kind.suffix not in allowed:
        raise UnsafeUploadError(f"Detected format {kind.suffix} not allowed")

    # jpg / jpeg are aliases of the same magic. Otherwise the declared
    # suffix must match what the bytes say.
    aliases = {".jpg", ".jpeg"}
    if not (declared in aliases and kind.suffix in aliases):
        if declared != kind.suffix:
            raise UnsafeUploadError(
                f"Extension {declared} but bytes look like {kind.suffix}"
            )
    return kind
