"""AI Station pure math — slab resolution + display P&L.

Stdlib-only (Decimal) so it is trivially unit-testable in isolation, with no DB,
redis, or SQLAlchemy import. `ai_station_service` imports everything here.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Optional


def dec(v, default: str = "0") -> Decimal:
    try:
        if v is None or v == "":
            return Decimal(default)
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def resolve_slab_lots(principal, slabs) -> Optional[Decimal]:
    """Map a lock principal to its display lot size using the admin slabs.

    Lower bound inclusive, upper bound exclusive (a value on a boundary falls
    into the higher slab). On overlaps the highest matching ``min`` wins (most
    specific). Returns None when the principal is below the smallest slab — that
    lock is simply skipped from the fan-out.
    """
    p = dec(principal)
    best: Optional[tuple[Decimal, Decimal]] = None
    for s in slabs or []:
        if not isinstance(s, dict):
            continue
        mn = dec(s.get("min"))
        lots = dec(s.get("lots"))
        mx_raw = s.get("max", None)
        if lots <= 0:
            continue
        upper_ok = mx_raw is None or mx_raw == "" or p < dec(mx_raw)
        if p >= mn and upper_ok:
            if best is None or mn > best[0]:
                best = (mn, lots)
    return best[1] if best else None


def compute_display_pnl(side, entry, close, lots, contract_size) -> Decimal:
    """Display P&L (quote currency, shown as USD). Single choke point.

    buy: (close - entry) * lots * contract_size ; sell: inverted.
    """
    e = dec(entry)
    c = dec(close)
    l = dec(lots)
    cs = dec(contract_size, "100000")
    direction = Decimal("1") if str(side).lower() in ("buy", "long") else Decimal("-1")
    return ((c - e) * direction * l * cs).quantize(Decimal("0.01"))


def fill_price(side, bid: Decimal, ask: Decimal, *, opening: bool) -> Decimal:
    """A realistic fill: open a buy at ask / sell at bid; close the reverse."""
    is_buy = str(side).lower() in ("buy", "long")
    if opening:
        return ask if is_buy else bid
    return bid if is_buy else ask
