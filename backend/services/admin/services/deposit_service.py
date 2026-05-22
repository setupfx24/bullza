"""Admin Finance Service — deposit/withdrawal listing, approval, rejection, screenshots."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.models import User, TradingAccount, Deposit, Withdrawal, Transaction, BonusOffer
from packages.common.src.notify import create_notification
from packages.common.src.admin_schemas import DepositOut, WithdrawalOut, PaginatedResponse
from dependencies import write_audit_log


def _deposit_to_out(d: Deposit, user: User = None) -> DepositOut:
    return DepositOut(
        id=str(d.id),
        user_id=str(d.user_id),
        account_id=str(d.account_id) if d.account_id else None,
        amount=float(d.amount or 0),
        currency=d.currency or "INR",
        method=d.method,
        status=d.status,
        transaction_id=d.transaction_id,
        screenshot_url=d.screenshot_url,
        rejection_reason=d.rejection_reason,
        created_at=d.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        bonus_code=d.bonus_code,
        bonus_status=d.bonus_status,
        bonus_amount=float(d.bonus_amount) if d.bonus_amount is not None else None,
    )


def _withdrawal_to_out(w: Withdrawal, user: User = None) -> WithdrawalOut:
    return WithdrawalOut(
        id=str(w.id),
        user_id=str(w.user_id),
        account_id=str(w.account_id) if w.account_id else None,
        amount=float(w.amount or 0),
        currency=w.currency or "INR",
        method=w.method,
        status=w.status,
        bank_details=w.bank_details,
        crypto_address=w.crypto_address,
        rejection_reason=w.rejection_reason,
        created_at=w.created_at,
        user_email=user.email if user else None,
        user_name=f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
    )


async def list_pending_deposits(page: int, per_page: int, db: AsyncSession):
    query = select(Deposit).where(Deposit.status == "pending")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Deposit.created_at.asc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_pending_withdrawals(page: int, per_page: int, db: AsyncSession):
    query = select(Withdrawal).where(Withdrawal.status == "pending")
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Withdrawal.created_at.asc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_deposits(page: int, per_page: int, status: str | None, db: AsyncSession):
    query = select(Deposit)
    if status and status != "all":
        if status == "approved":
            query = query.where(Deposit.status.in_(["approved", "auto_approved"]))
        else:
            query = query.where(Deposit.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Deposit.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    deposits = result.scalars().all()

    items = []
    for d in deposits:
        user_q = await db.execute(select(User).where(User.id == d.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_deposit_to_out(d, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def list_all_withdrawals(page: int, per_page: int, status: str | None, db: AsyncSession):
    query = select(Withdrawal)
    if status and status != "all":
        query = query.where(Withdrawal.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Withdrawal.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        user_q = await db.execute(select(User).where(User.id == w.user_id))
        user = user_q.scalar_one_or_none()
        items.append(_withdrawal_to_out(w, user))

    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page)


async def approve_deposit(
    deposit_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "approved"
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    user_q = await db.execute(select(User).where(User.id == deposit.user_id))
    user_row = user_q.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=400, detail="User not found for deposit")

    user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + deposit.amount

    db.add(
        Transaction(
            user_id=deposit.user_id,
            account_id=None,
            type="deposit",
            amount=deposit.amount,
            balance_after=user_row.main_wallet_balance,
            reference_id=deposit.id,
            description=f"Deposit to main wallet - {deposit.method or 'manual'}",
            created_by=admin_id,
        )
    )

    bonus_msg = ""
    applied_bonuses: list[tuple[str, Decimal]] = []
    now = datetime.utcnow()
    # If the trader typed a promo code at deposit time (bonus_code), do
    # NOT auto-apply standing BonusOffers — admin will grant/deny that
    # request explicitly via /deposits/{id}/grant-bonus. Mixing auto +
    # manual would let one deposit double-dip.
    skip_auto_bonus = bool(deposit.bonus_code)
    offers_q = await db.execute(
        select(BonusOffer).where(
            BonusOffer.is_active == True,
            BonusOffer.bonus_type.in_(["deposit", "welcome"]),
            BonusOffer.min_deposit <= deposit.amount,
        )
    ) if not skip_auto_bonus else None
    for offer in (offers_q.scalars().all() if offers_q is not None else []):
        if offer.starts_at and offer.starts_at > now:
            continue
        if offer.expires_at and offer.expires_at < now:
            continue

        if offer.percentage and offer.percentage > 0:
            bonus_amount = deposit.amount * offer.percentage / Decimal("100")
        elif offer.fixed_amount and offer.fixed_amount > 0:
            bonus_amount = offer.fixed_amount
        else:
            continue

        if offer.max_bonus and bonus_amount > offer.max_bonus:
            bonus_amount = offer.max_bonus

        user_row.main_wallet_balance = (user_row.main_wallet_balance or Decimal("0")) + bonus_amount
        db.add(
            Transaction(
                user_id=deposit.user_id,
                account_id=None,
                type="bonus",
                amount=bonus_amount,
                balance_after=user_row.main_wallet_balance,
                description=f"Bonus: {offer.name} ({offer.percentage or 0}%)",
                created_by=admin_id,
            )
        )
        bonus_msg = f" + ${float(bonus_amount):.2f} bonus ({offer.name})"
        applied_bonuses.append((offer.name, bonus_amount))

    # Note: user-level referral commission used to fire here on first
    # deposit. The policy changed (per client) — it's now a FLAT amount
    # paid by trading_service.close_position once the referred user
    # completes the qualifying trade count, not at deposit time.

    # IB per-referral bounty — flat tier-scaled payout to the IB upline
    # of the referred user, fired on their first approved deposit.
    # Wrapped in a SAVEPOINT so any failure inside rolls back ONLY the
    # bounty writes; the parent deposit-approval transaction stays
    # clean. Plain try/except wasn't enough — a flushed-then-failed
    # insert leaves the session in a poisoned state and the next
    # operation 500s (root cause of the Close-All 500s and the
    # 'cannot approve subsequent deposits' bug).
    try:
        from sqlalchemy import select as _sel, func as _func
        from packages.common.src.models import (
            User as _U, Deposit as _D, Referral as _R, IBProfile as _IB,
            SystemSetting as _SS,
        )
        import json as _json
        async with db.begin_nested():
            count2 = (await db.execute(
                _sel(_func.count()).select_from(_D).where(
                    _D.user_id == deposit.user_id,
                    _D.status.in_(["approved", "auto_approved"]),
                )
            )).scalar() or 0
            if count2 == 1:
                r2 = (await db.execute(
                    _sel(_R).where(_R.referred_id == deposit.user_id).limit(1)
                )).scalar_one_or_none()
                if r2 is not None and r2.ib_profile_id is not None:
                    ib2 = (await db.execute(
                        _sel(_IB).where(_IB.id == r2.ib_profile_id)
                    )).scalar_one_or_none()
                    if ib2 is not None and ib2.is_active:
                        tiers_row = (await db.execute(
                            _sel(_SS).where(_SS.key == "ib_commission_tiers")
                        )).scalar_one_or_none()
                        tiers: list = []
                        if tiers_row and tiers_row.value:
                            raw = tiers_row.value
                            if isinstance(raw, str):
                                try:
                                    raw = _json.loads(raw)
                                except Exception:
                                    raw = []
                            if isinstance(raw, list):
                                tiers = raw
                        active_n2 = (await db.execute(
                            _sel(_func.count()).select_from(_R).where(_R.ib_profile_id == ib2.id)
                        )).scalar() or 0
                        chosen = None
                        for t in tiers:
                            lo = int(t.get("min_referrals") or 0)
                            hi = t.get("max_referrals")
                            hi_v = int(hi) if hi is not None else None
                            if active_n2 >= lo and (hi_v is None or active_n2 <= hi_v):
                                chosen = t
                                break
                        if chosen is not None:
                            try:
                                bounty = Decimal(str(chosen.get("per_referral_bounty") or 0)).quantize(Decimal("0.01"))
                            except Exception:
                                bounty = Decimal("0")
                            if bounty > 0:
                                ib_user = (await db.execute(
                                    _sel(_U).where(_U.id == ib2.user_id)
                                )).scalar_one_or_none()
                                if ib_user is not None:
                                    ib_user.main_wallet_balance = (
                                        Decimal(str(ib_user.main_wallet_balance or 0)) + bounty
                                    )
                                    db.add(Transaction(
                                        user_id=ib_user.id,
                                        type="ib_referral_bounty",
                                        amount=bounty,
                                        balance_after=ib_user.main_wallet_balance,
                                        reference_id=deposit.id,
                                        description=(
                                            f"IB referral bounty — {chosen.get('label')} tier "
                                            f"(${float(bounty):.2f}) for first deposit by {deposit.user_id}"
                                        ),
                                        created_by=admin_id,
                                    ))
    except Exception:
        pass

    await write_audit_log(
        db, admin_id, "approve_deposit", "deposit", deposit_id,
        new_values={"amount": str(deposit.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit approved",
        message=(
            f"Your deposit of ${float(deposit.amount):,.2f} was approved and added to your main wallet.{bonus_msg}"
        ),
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Email — fire-and-forget after commit so SMTP latency doesn't delay the
    # admin's response and a delivery failure can't roll back the approval.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import (
            render_deposit_confirmed, render_bonus_credited,
        )
        from packages.common.src.config import get_settings as _get_settings
        if smtp_configured() and user_row.email:
            app_url = (_get_settings().TRADER_APP_URL or "https://trade.swisdex.com")
            subject, html, text = render_deposit_confirmed(
                first_name=user_row.first_name,
                amount=deposit.amount,
                currency="USD",
                method=deposit.method or "Manual",
                reference=str(deposit.id),
                new_balance=user_row.main_wallet_balance,
                trader_app_url=app_url,
            )
            fire_and_forget(send_email(user_row.email, subject, html, text=text, category="account"))
            for offer_name, bonus_amount in applied_bonuses:
                bsubject, bhtml, btext = render_bonus_credited(
                    first_name=user_row.first_name,
                    bonus_amount=bonus_amount,
                    bonus_label=offer_name,
                    currency="USD",
                    new_bonus_balance=user_row.main_wallet_balance,
                    trader_app_url=app_url,
                )
                # Bonus credit pings come from voucher@, the deposit
                # confirmation above came from account@ — same approval
                # but two distinct emails to the user.
                fire_and_forget(send_email(user_row.email, bsubject, bhtml, text=btext, category="voucher"))
    except Exception as _e:
        # Logger isn't always imported at module top here; deferred lookup.
        import logging as _logging
        _logging.getLogger("admin.deposit").warning("deposit email failed: %s", _e)
    return {"message": f"Deposit approved successfully{bonus_msg}"}


async def reject_deposit(
    deposit_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if deposit.status != "pending":
        raise HTTPException(status_code=400, detail="Deposit is not pending")

    deposit.status = "rejected"
    deposit.rejection_reason = reason
    deposit.approved_by = admin_id
    deposit.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_deposit", "deposit", deposit_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        deposit.user_id,
        title="Deposit not approved",
        message=f"Your deposit request of ${float(deposit.amount):,.2f} was not approved.{extra}",
        notif_type="deposit",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    return {"message": "Deposit rejected"}


async def approve_withdrawal(
    withdrawal_id: uuid.UUID, admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    if withdrawal.account_id:
        acc_q = await db.execute(
            select(TradingAccount).where(TradingAccount.id == withdrawal.account_id)
        )
        account = acc_q.scalar_one_or_none()
        if account:
            if (account.balance or Decimal("0")) < withdrawal.amount:
                raise HTTPException(status_code=400, detail="Insufficient account balance")
            account.balance = (account.balance or Decimal("0")) - withdrawal.amount
            account.equity = account.balance + (account.credit or Decimal("0"))
            account.free_margin = account.equity - (account.margin_used or Decimal("0"))

            txn = Transaction(
                user_id=withdrawal.user_id,
                account_id=account.id,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=account.balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
            db.add(txn)
    else:
        uw = await db.execute(select(User).where(User.id == withdrawal.user_id))
        user_row = uw.scalar_one_or_none()
        if not user_row:
            raise HTTPException(status_code=400, detail="User not found")
        main_bal = user_row.main_wallet_balance or Decimal("0")
        if main_bal < withdrawal.amount:
            raise HTTPException(status_code=400, detail="Insufficient main wallet balance")
        user_row.main_wallet_balance = main_bal - withdrawal.amount
        db.add(
            Transaction(
                user_id=withdrawal.user_id,
                account_id=None,
                type="withdrawal",
                amount=-withdrawal.amount,
                balance_after=user_row.main_wallet_balance,
                reference_id=withdrawal.id,
                description=f"Withdrawal approved (main wallet) - {withdrawal.method or 'manual'}",
                created_by=admin_id,
            )
        )

    withdrawal.status = "approved"
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "approve_withdrawal", "withdrawal", withdrawal_id,
        new_values={"amount": float(withdrawal.amount), "status": "approved"},
        ip_address=ip_address,
    )
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal approved",
        message=(
            f"Your withdrawal of ${float(withdrawal.amount):,.2f} via "
            f"{withdrawal.method or 'manual'} has been approved and will be processed."
        ),
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Approval email — fire-and-forget.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_approved
        from packages.common.src.config import get_settings as _gs
        u = (await db.execute(select(User).where(User.id == withdrawal.user_id))).scalar_one_or_none()
        if smtp_configured() and u and u.email:
            destination_str: str | None = None
            if withdrawal.crypto_address:
                ca = str(withdrawal.crypto_address)
                destination_str = f"{ca[:6]}…{ca[-4:]}" if len(ca) > 12 else ca
            elif withdrawal.bank_details and isinstance(withdrawal.bank_details, dict):
                acct = withdrawal.bank_details.get("account_number") or ""
                if acct:
                    destination_str = f"Bank ****{str(acct)[-4:]}"
            subject, html, text = render_withdrawal_approved(
                first_name=u.first_name,
                amount=withdrawal.amount,
                currency="USD",
                method=withdrawal.method or "Manual",
                destination=destination_str,
                request_id=str(withdrawal.id),
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisdex.com"),
            )
            fire_and_forget(send_email(u.email, subject, html, text=text, category="account"))
    except Exception as _e:
        import logging as _logging
        _logging.getLogger("admin.withdraw").warning("withdrawal approve email failed: %s", _e)
    return {"message": "Withdrawal approved successfully"}


async def reject_withdrawal(
    withdrawal_id: uuid.UUID, reason: str | None,
    admin_id: uuid.UUID, ip_address: str | None, db: AsyncSession,
) -> dict:
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending")

    withdrawal.status = "rejected"
    withdrawal.rejection_reason = reason
    withdrawal.approved_by = admin_id
    withdrawal.approved_at = datetime.utcnow()

    await write_audit_log(
        db, admin_id, "reject_withdrawal", "withdrawal", withdrawal_id,
        new_values={"status": "rejected", "reason": reason},
        ip_address=ip_address,
    )
    reason_str = (reason or "").strip()
    extra = f" Reason: {reason_str}" if reason_str else ""
    await create_notification(
        db,
        withdrawal.user_id,
        title="Withdrawal not approved",
        message=f"Your withdrawal request of ${float(withdrawal.amount):,.2f} was not approved.{extra}",
        notif_type="withdrawal",
        action_url="/wallet",
        commit=False,
    )
    await db.commit()
    # Rejection email — fire-and-forget.
    try:
        from packages.common.src.smtp_mail import (
            send_email, smtp_configured, fire_and_forget,
        )
        from packages.common.src.email_templates import render_withdrawal_rejected
        from packages.common.src.config import get_settings as _gs
        u = (await db.execute(select(User).where(User.id == withdrawal.user_id))).scalar_one_or_none()
        if smtp_configured() and u and u.email:
            subject, html, text = render_withdrawal_rejected(
                first_name=u.first_name,
                amount=withdrawal.amount,
                currency="USD",
                reason=reason_str or None,
                request_id=str(withdrawal.id),
                trader_app_url=(_gs().TRADER_APP_URL or "https://trade.swisdex.com"),
            )
            fire_and_forget(send_email(u.email, subject, html, text=text, category="account"))
    except Exception as _e:
        import logging as _logging
        _logging.getLogger("admin.withdraw").warning("withdrawal reject email failed: %s", _e)
    return {"message": "Withdrawal rejected"}


async def download_deposit_screenshot(deposit_id: uuid.UUID, db: AsyncSession):
    """Serve manual deposit proof file (same filesystem path gateway wrote)."""
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if not deposit or not deposit.screenshot_url:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    p = Path(deposit.screenshot_url)
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(str(p), filename=p.name, media_type="application/octet-stream")


async def download_withdrawal_payout_qr(withdrawal_id: uuid.UUID, db: AsyncSession):
    """User-uploaded QR / payout image for manual withdrawals."""
    result = await db.execute(select(Withdrawal).where(Withdrawal.id == withdrawal_id))
    w = result.scalar_one_or_none()
    if not w or not w.bank_details:
        raise HTTPException(status_code=404, detail="Attachment not found")
    raw = w.bank_details.get("user_payout_qr_path") if isinstance(w.bank_details, dict) else None
    if not raw:
        raise HTTPException(status_code=404, detail="No payout QR on file")
    p = Path(str(raw))
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(str(p), filename=p.name, media_type="application/octet-stream")


# ─── Manual bonus grant / deny on a deposit ──────────────────────────────
# Trader optionally types a promo code at deposit time (bonus_code).
# Deposits with a code arrive as bonus_status='pending' and skip the
# existing auto-apply BonusOffer loop — admin reviews each one here and
# either credits a custom amount or rejects with a reason.

async def grant_deposit_bonus(
    deposit_id: uuid.UUID,
    amount: Decimal,
    description: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Credit a custom bonus to the trader's main wallet. Idempotency:
    a deposit can only be granted once — re-running returns 409 so the
    admin doesn't double-pay on a refresh / double-click."""
    if amount is None or Decimal(str(amount)) <= 0:
        raise HTTPException(status_code=400, detail="Bonus amount must be greater than zero")

    deposit = (await db.execute(
        select(Deposit).where(Deposit.id == deposit_id)
    )).scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if not deposit.bonus_code:
        raise HTTPException(
            status_code=400,
            detail="This deposit did not request a bonus — no code on file",
        )
    if deposit.bonus_status not in ("pending", None):
        raise HTTPException(
            status_code=409,
            detail=f"Bonus already {deposit.bonus_status} for this deposit",
        )

    user = (await db.execute(
        select(User).where(User.id == deposit.user_id)
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    bonus_amount = Decimal(str(amount))
    user.main_wallet_balance = (user.main_wallet_balance or Decimal("0")) + bonus_amount

    desc = (description or "").strip() or (
        f"Bonus credited for deposit {deposit.id} (code {deposit.bonus_code})"
    )
    db.add(Transaction(
        user_id=deposit.user_id,
        account_id=None,
        type="bonus",
        amount=bonus_amount,
        balance_after=user.main_wallet_balance,
        reference_id=deposit.id,
        description=desc,
    ))

    deposit.bonus_status = "granted"
    deposit.bonus_amount = bonus_amount
    deposit.bonus_decided_by = admin_id
    deposit.bonus_decided_at = datetime.now(timezone.utc)

    try:
        await create_notification(
            db, deposit.user_id,
            title=f"Bonus credited — ${float(bonus_amount):,.2f}",
            message=(
                f"Your bonus request with code {deposit.bonus_code} on deposit "
                f"${float(deposit.amount):,.2f} was approved. ${float(bonus_amount):,.2f} "
                "has been credited to your main wallet."
            ),
            notif_type="bonus", action_url="/wallet",
        )
    except Exception:
        pass

    await write_audit_log(
        db, admin_id, "grant_deposit_bonus", "deposit", deposit_id,
        new_values={
            "bonus_code": deposit.bonus_code,
            "bonus_amount": float(bonus_amount),
            "description": desc,
        },
        ip_address=ip_address,
    )
    await db.commit()

    return {
        "message": "Bonus granted",
        "deposit_id": str(deposit_id),
        "bonus_amount": float(bonus_amount),
        "main_wallet_balance": float(user.main_wallet_balance),
    }


async def deny_deposit_bonus(
    deposit_id: uuid.UUID,
    reason: str | None,
    admin_id: uuid.UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Mark the bonus request denied — no money moves. Sends an in-app
    notification with the reason; underlying deposit status is untouched
    so the trader still sees their actual deposit settle separately."""
    deposit = (await db.execute(
        select(Deposit).where(Deposit.id == deposit_id)
    )).scalar_one_or_none()
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if not deposit.bonus_code:
        raise HTTPException(
            status_code=400,
            detail="This deposit did not request a bonus",
        )
    if deposit.bonus_status not in ("pending", None):
        raise HTTPException(
            status_code=409,
            detail=f"Bonus already {deposit.bonus_status} for this deposit",
        )

    reason_clean = (reason or "").strip()[:500] or "Denied by admin"
    deposit.bonus_status = "denied"
    deposit.bonus_amount = None
    deposit.bonus_decided_by = admin_id
    deposit.bonus_decided_at = datetime.now(timezone.utc)

    try:
        await create_notification(
            db, deposit.user_id,
            title="Bonus request denied",
            message=(
                f"Your bonus request with code {deposit.bonus_code} on deposit "
                f"${float(deposit.amount):,.2f} was not approved. Reason: {reason_clean}"
            ),
            notif_type="bonus", action_url="/wallet",
        )
    except Exception:
        pass

    await write_audit_log(
        db, admin_id, "deny_deposit_bonus", "deposit", deposit_id,
        new_values={"bonus_code": deposit.bonus_code, "reason": reason_clean},
        ip_address=ip_address,
    )
    await db.commit()

    return {"message": "Bonus denied", "deposit_id": str(deposit_id), "reason": reason_clean}
