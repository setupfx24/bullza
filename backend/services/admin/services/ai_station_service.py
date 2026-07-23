"""Admin AI Station service — config, manual trades, edit/close, P&L summary.

Thin admin layer on top of the shared core (`packages.common.src.ai_station_service`).
Display-only: never moves money; the fixed_return payout logic is untouched.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import (
    SystemSetting, AiStationSignal, AiStationTrade, FixedReturnLock, User, Instrument,
)
from packages.common.src import ai_station_service as core
from dependencies import write_audit_log

WEBHOOK_BASE_KEY = "ai_station_webhook_base"
WEBHOOK_PATH = "/api/v1/webhooks/tradingview"


# ── settings helpers ─────────────────────────────────────────────────────────

async def _bust_gateway_cache():
    """Delete the gateway settings cache on Redis db 0 (admin is pinned to /1)."""
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        base = url.rsplit("/", 1)[0]
        r = aioredis.from_url(f"{base}/0")
        await r.delete("system_settings_cache")
        await r.close()
    except Exception:
        pass


async def _get(db: AsyncSession, key: str, default=None):
    res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    s = res.scalar_one_or_none()
    return s.value if s else default


async def _set(db: AsyncSession, key: str, value, admin_id: UUID):
    res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    s = res.scalar_one_or_none()
    if s:
        s.value = value
        s.updated_by = admin_id
        s.updated_at = datetime.utcnow()
    else:
        db.add(SystemSetting(key=key, value=value, updated_by=admin_id))


def _validate_slabs(slabs) -> list:
    if not isinstance(slabs, list) or not slabs:
        raise HTTPException(status_code=400, detail="slabs must be a non-empty list")
    out = []
    for i, s in enumerate(slabs):
        if not isinstance(s, dict):
            raise HTTPException(status_code=400, detail=f"slab #{i} must be an object")
        try:
            mn = Decimal(str(s.get("min")))
            lots = Decimal(str(s.get("lots")))
        except (InvalidOperation, TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"slab #{i}: min/lots must be numbers")
        mx = s.get("max", None)
        if mx not in (None, ""):
            try:
                mxv = Decimal(str(mx))
            except (InvalidOperation, TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"slab #{i}: max must be a number or null")
            if mxv <= mn:
                raise HTTPException(status_code=400, detail=f"slab #{i}: max must be greater than min")
        if mn < 0 or lots <= 0:
            raise HTTPException(status_code=400, detail=f"slab #{i}: min>=0 and lots>0 required")
        out.append({
            "min": float(mn),
            "max": None if mx in (None, "") else float(Decimal(str(mx))),
            "lots": float(lots),
        })
    out.sort(key=lambda x: x["min"])
    return out


# ── config ───────────────────────────────────────────────────────────────────

async def get_config(db: AsyncSession) -> dict:
    enabled = bool(await _get(db, core.SETTING_ENABLED, False))
    secret = await _get(db, core.SETTING_SECRET, "") or ""
    slabs = await _get(db, core.SETTING_SLABS, None) or core.DEFAULT_SLABS
    base = (await _get(db, WEBHOOK_BASE_KEY, "") or "").rstrip("/")
    path = f"{WEBHOOK_PATH}/{secret}" if secret else None
    return {
        "enabled": enabled,
        "has_secret": bool(secret),
        # Admin is a trusted (super-admin) surface and must see the full URL to
        # paste into TradingView, so the secret is returned in the clear here.
        "webhook_secret": secret,
        "webhook_path": path,
        "webhook_base": base,
        "webhook_url": (f"{base}{path}" if (base and path) else None),
        "slabs": slabs,
    }


async def update_config(
    db: AsyncSession,
    *,
    admin_id: UUID,
    ip_address: str | None,
    enabled=None,
    slabs=None,
    regenerate_secret: bool = False,
    webhook_base=None,
) -> dict:
    if enabled is not None:
        await _set(db, core.SETTING_ENABLED, bool(enabled), admin_id)
    if slabs is not None:
        await _set(db, core.SETTING_SLABS, _validate_slabs(slabs), admin_id)
    if webhook_base is not None:
        await _set(db, WEBHOOK_BASE_KEY, str(webhook_base).rstrip("/"), admin_id)

    secret = await _get(db, core.SETTING_SECRET, "") or ""
    if regenerate_secret or not secret:
        secret = secrets.token_urlsafe(24)
        await _set(db, core.SETTING_SECRET, secret, admin_id)

    await write_audit_log(
        db, admin_id, "ai_station.update_config", "system_setting", None,
        old_values=None,
        new_values={
            "enabled": enabled,
            "slabs_count": len(slabs) if slabs is not None else None,
            "regenerate_secret": regenerate_secret,
        },
        ip_address=ip_address,
    )
    await db.commit()
    await _bust_gateway_cache()
    return await get_config(db)


# ── manual open / close ──────────────────────────────────────────────────────

async def manual_open(
    db: AsyncSession,
    *,
    admin_id: UUID,
    ip_address: str | None,
    symbol: str,
    side: str,
    price=None,
    stop_loss=None,
    take_profit=None,
    note: str | None = None,
) -> dict:
    try:
        sig = await core.open_signal(
            db, source="admin", symbol=symbol, side=side, entry_price=price,
            stop_loss=stop_loss, take_profit=take_profit,
            created_by=admin_id, note=note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await write_audit_log(
        db, admin_id, "ai_station.manual_open", "ai_station_signal", sig.id,
        old_values=None,
        new_values={"symbol": sig.symbol, "side": sig.side, "fanout": sig.fanout_count},
        ip_address=ip_address,
    )
    await db.commit()
    return core.serialize_signal(sig)


async def close_signal(
    db: AsyncSession, *, admin_id: UUID, ip_address: str | None,
    signal_id: UUID, close_price=None,
) -> dict:
    res = await db.execute(select(AiStationSignal).where(AiStationSignal.id == signal_id))
    sig = res.scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    n = await core.close_signal(db, sig, close_price=close_price)
    await write_audit_log(
        db, admin_id, "ai_station.close_signal", "ai_station_signal", signal_id,
        old_values=None, new_values={"trades_closed": n}, ip_address=ip_address,
    )
    await db.commit()
    return {"trades_closed": n, "signal": core.serialize_signal(sig)}


# ── list / edit trades ───────────────────────────────────────────────────────

async def _attach_user_emails(db: AsyncSession, items: list) -> list:
    ids = {UUID(it["user_id"]) for it in items}
    if not ids:
        return items
    rows = (await db.execute(
        select(User.id, User.email, User.first_name, User.last_name).where(User.id.in_(ids))
    )).all()
    emap = {str(r.id): {"email": r.email, "name": f"{r.first_name or ''} {r.last_name or ''}".strip()} for r in rows}
    for it in items:
        u = emap.get(it["user_id"], {})
        it["user_email"] = u.get("email")
        it["user_name"] = u.get("name")
    return items


async def list_signals(db: AsyncSession, *, status=None, limit=100, offset=0) -> list:
    q = select(AiStationSignal)
    if status in ("open", "closed"):
        q = q.where(AiStationSignal.status == status)
    q = q.order_by(AiStationSignal.opened_at.desc()).limit(limit).offset(offset)
    rows = list((await db.execute(q)).scalars().all())
    return [core.serialize_signal(s) for s in rows]


async def list_trades(db: AsyncSession, *, status=None, user_id=None, signal_id=None,
                      limit=200, offset=0) -> list:
    q = select(AiStationTrade)
    if status in ("open", "closed"):
        q = q.where(AiStationTrade.status == status)
    if user_id is not None:
        q = q.where(AiStationTrade.user_id == user_id)
    if signal_id is not None:
        q = q.where(AiStationTrade.signal_id == signal_id)
    q = q.order_by(AiStationTrade.opened_at.desc()).limit(limit).offset(offset)
    rows = list((await db.execute(q)).scalars().all())
    live = await core.enrich_open_pnl(db, rows)
    items = [core.serialize_trade(t, live_pnl=live.get(str(t.id))) for t in rows]
    await _attach_user_emails(db, items)
    await _attach_contract_size(db, items)
    return items


async def _attach_contract_size(db: AsyncSession, items: list) -> list:
    """Add each trade's instrument contract_size so the admin edit modal can
    preview the P&L live (same math the backend uses on save)."""
    syms = {it["symbol"] for it in items}
    if not syms:
        return items
    rows = (await db.execute(
        select(Instrument.symbol, Instrument.contract_size).where(Instrument.symbol.in_(syms))
    )).all()
    cmap = {r.symbol: float(r.contract_size or 100000) for r in rows}
    for it in items:
        it["contract_size"] = cmap.get(it["symbol"], 100000.0)
    return items


def _num(v):
    if v in (None, ""):
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"invalid number: {v!r}")


async def close_trade(db: AsyncSession, *, admin_id: UUID, ip_address: str | None,
                      trade_id: UUID, close_price=None) -> dict:
    res = await db.execute(select(AiStationTrade).where(AiStationTrade.id == trade_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    if t.status == "closed":
        raise HTTPException(status_code=400, detail="Trade already closed")
    await core.close_trade(db, t, close_price=close_price)
    await write_audit_log(
        db, admin_id, "ai_station.close_trade", "ai_station_trade", trade_id,
        old_values=None,
        new_values={"close_price": float(t.close_price) if t.close_price is not None else None,
                    "pnl": float(t.pnl) if t.pnl is not None else None},
        ip_address=ip_address,
    )
    await db.commit()
    return core.serialize_trade(t)


async def edit_trade(db: AsyncSession, *, admin_id: UUID, ip_address: str | None,
                     trade_id: UUID, fields: dict) -> dict:
    res = await db.execute(select(AiStationTrade).where(AiStationTrade.id == trade_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Trade not found")
    for k in ("entry_price", "close_price", "stop_loss", "take_profit", "lots"):
        if k in fields:
            setattr(t, k, _num(fields[k]))
    if "status" in fields and fields["status"] in ("open", "closed"):
        t.status = fields["status"]
        if t.status == "closed" and t.closed_at is None:
            t.closed_at = datetime.now(timezone.utc)
        elif t.status == "open":
            t.closed_at = None

    # Recompute P&L from the (possibly edited) entry / close / lots so it always
    # matches the prices. is_edited=False keeps OPEN trades on live P&L so the
    # user side reflects the change. A closed trade gets its realised P&L here.
    t.is_edited = False
    if t.close_price is not None:
        cs = await core._contract_size(db, t.symbol)
        t.pnl = core.compute_display_pnl(t.side, t.entry_price, t.close_price, t.lots, cs)
    t.updated_at = datetime.now(timezone.utc)
    await write_audit_log(
        db, admin_id, "ai_station.edit_trade", "ai_station_trade", trade_id,
        old_values=None, new_values={k: str(v) for k, v in fields.items()},
        ip_address=ip_address,
    )
    await db.commit()
    return core.serialize_trade(t)


# ── P&L summary ──────────────────────────────────────────────────────────────

async def summary(db: AsyncSession) -> dict:
    rows = list((await db.execute(select(AiStationTrade))).scalars().all())
    live = await core.enrich_open_pnl(db, rows)
    now = datetime.now(timezone.utc)

    open_pnl = realized_month = realized_total = 0.0
    open_count = closed_count = 0
    for t in rows:
        it = core.serialize_trade(t, live_pnl=live.get(str(t.id)))
        pnl = it.get("pnl") or 0.0
        if t.status == "open":
            open_count += 1
            open_pnl += pnl
        else:
            closed_count += 1
            realized_total += pnl
            if t.closed_at and t.closed_at.year == now.year and t.closed_at.month == now.month:
                realized_month += pnl

    principal = float((await db.execute(
        select(func.coalesce(func.sum(FixedReturnLock.principal), 0))
        .where(FixedReturnLock.state == "active")
    )).scalar() or 0)

    monthly_pnl = realized_month + open_pnl
    total_pnl = realized_total + open_pnl

    def pct(v):
        return round((v / principal * 100), 2) if principal > 0 else 0.0

    return {
        "active_principal": round(principal, 2),
        "open_count": open_count,
        "closed_count": closed_count,
        "open_pnl": round(open_pnl, 2),
        "realized_pnl_month": round(realized_month, 2),
        "realized_pnl_total": round(realized_total, 2),
        "monthly_pnl": round(monthly_pnl, 2),
        "total_pnl": round(total_pnl, 2),
        "monthly_pnl_pct": pct(monthly_pnl),
        "total_pnl_pct": pct(total_pnl),
    }
