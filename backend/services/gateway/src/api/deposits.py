"""Wallet API — Deposits, Withdrawals, Transactions."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.schemas import (
    DepositRequest,
    InternalWalletTransferRequest,
    TransferMainToTradingRequest,
    TransferTradingToMainRequest,
    WithdrawalRequest,
)
from packages.common.src.auth import get_current_user
from packages.common.src.rate_limit import check_rate_limit
from ..services import wallet_service

router = APIRouter()

# Per-user throttle on money-out endpoints (security review). A
# legitimate trader withdraws a handful of times a day; an
# account-takeover or scripted-abuse attempt hammers it. 10 attempts /
# 10 min per user, on top of nginx's coarse per-IP cap.
WITHDRAW_MAX_PER_WINDOW = 10
WITHDRAW_WINDOW_SEC = 600


@router.post("/deposit", status_code=201)
async def create_deposit(
    req: DepositRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.create_deposit(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/deposit/manual", status_code=201)
async def create_manual_deposit(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    account_id: Optional[UUID] = Form(default=None),
    amount: Decimal = Form(...),
    transaction_id: str = Form(...),
    # Screenshot/proof is OPTIONAL (client 2026-06-16, XM-style): finance
    # reconciles bank transfers by the unique reference instead of forcing a
    # proof upload.
    file: Optional[UploadFile] = File(default=None),
    bonus_code: Optional[str] = Form(default=None),
):
    """Bank / UPI manual deposit: user pays admin bank (see bank-details), includes the unique reference; proof upload optional."""
    # UI gating alone is bypassable, so the same admin flag the
    # /payment-methods endpoint exposes also hard-rejects API calls
    # when manual is disabled.
    from fastapi import HTTPException
    from packages.common.src.settings_store import get_bool_setting
    if not await get_bool_setting("wallet.manual_enabled", True):
        raise HTTPException(
            status_code=403,
            detail="Manual deposits are currently disabled. Please use the crypto channel.",
        )
    return await wallet_service.create_manual_deposit(
        user_id=current_user["user_id"],
        account_id=account_id, amount=amount,
        transaction_id=transaction_id, file=file, db=db,
        bonus_code=bonus_code,
    )


# ─── On-site wallet-connect deposits (NOWPayments /v1/payment) ────────────


class WalletDepositRequest(BaseModel):
    amount: Decimal
    crypto_currency: str  # frontend asset id, e.g. "USDT_ERC", "ETH"
    bonus_code: Optional[str] = None


class TxHashSaveRequest(BaseModel):
    tx_hash: str


@router.post("/deposit/wallet", status_code=201)
async def create_wallet_deposit(
    req: WalletDepositRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a NOWPayments direct payment (no hosted-page redirect).

    Returns the deposit row id + the pay_address / pay_amount / network /
    expires_at the frontend needs to drive the on-site wallet-connect UI.
    Settlement still happens via the same IPN webhook + handle_nowpayments_webhook
    path — balance is never credited from this endpoint."""
    return await wallet_service.create_wallet_deposit(
        amount=req.amount,
        crypto_currency=req.crypto_currency,
        user_id=current_user["user_id"],
        db=db,
        bonus_code=req.bonus_code,
    )


@router.get("/deposit/{deposit_id}/status")
async def get_wallet_deposit_status(
    deposit_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read-only status check for the wallet-connect UI's polling loop.
    Combines local deposit status + a fresh NOWPayments status fetch so the
    UI can show "waiting → confirming → finished" without waiting for the
    IPN."""
    return await wallet_service.get_wallet_deposit_status(
        deposit_id=deposit_id, user_id=current_user["user_id"], db=db,
    )


@router.post("/deposit/{deposit_id}/tx-hash")
async def save_wallet_deposit_tx_hash(
    deposit_id: UUID,
    req: TxHashSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record the on-chain tx hash the user's wallet returned. Purely
    informational — settlement still gates on the NOWPayments IPN, never
    on a client-supplied hash."""
    return await wallet_service.save_wallet_deposit_tx_hash(
        deposit_id=deposit_id, tx_hash=req.tx_hash,
        user_id=current_user["user_id"], db=db,
    )


@router.post("/withdraw", status_code=201)
async def create_withdrawal(
    req: WithdrawalRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(
        "withdraw", str(current_user["user_id"]),
        max_requests=WITHDRAW_MAX_PER_WINDOW, window_sec=WITHDRAW_WINDOW_SEC,
    )
    return await wallet_service.create_withdrawal(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/withdraw/manual", status_code=201)
async def create_manual_withdrawal(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    amount: Decimal = Form(...),
    upi_id: str = Form(default=""),
    payout_notes: str = Form(default=""),
    file: UploadFile | None = File(default=None),
):
    """Manual payout: user provides UPI ID and/or a QR image for finance to pay out (main wallet)."""
    from fastapi import HTTPException
    from packages.common.src.settings_store import get_bool_setting
    await check_rate_limit(
        "withdraw", str(current_user["user_id"]),
        max_requests=WITHDRAW_MAX_PER_WINDOW, window_sec=WITHDRAW_WINDOW_SEC,
    )
    if not await get_bool_setting("wallet.manual_enabled", True):
        raise HTTPException(
            status_code=403,
            detail="Manual withdrawals are currently disabled. Please use the crypto channel.",
        )
    return await wallet_service.create_manual_withdrawal(
        user_id=current_user["user_id"],
        amount=amount, upi_id=upi_id, payout_notes=payout_notes,
        file=file, db=db,
    )


@router.post("/transfer-internal", status_code=200)
async def internal_wallet_transfer(
    req: InternalWalletTransferRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move funds between the user's own live trading accounts (available balance only)."""
    return await wallet_service.internal_wallet_transfer(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/transfer-trading-to-main", status_code=200)
async def transfer_trading_to_main(
    req: TransferTradingToMainRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move available balance from a live trading account into the user's main wallet."""
    return await wallet_service.transfer_trading_to_main(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.post("/transfer-main-to-trading", status_code=200)
async def transfer_main_to_trading(
    req: TransferMainToTradingRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fund a live trading account from the main wallet."""
    return await wallet_service.transfer_main_to_trading(
        req=req, user_id=current_user["user_id"], db=db,
    )


@router.get("/deposits")
async def list_deposits(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_deposits(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/withdrawals")
async def list_withdrawals(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_withdrawals(
        user_id=current_user["user_id"], db=db,
    )


@router.get("/transactions")
async def list_transactions(
    account_id: UUID | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.list_transactions(
        user_id=current_user["user_id"], account_id=account_id, db=db,
    )


@router.get("/summary")
async def wallet_summary(
    account_id: UUID | None = Query(
        None,
        description="Scope trading balance/equity to one live account. Main wallet + deposit/withdraw totals are always user-wide.",
    ),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Main wallet holds funds for external deposit/withdraw; live trading accounts hold trading balance."""
    return await wallet_service.wallet_summary(
        user_id=current_user["user_id"], account_id=account_id, db=db,
    )


class DepositBankDetailsRequest(BaseModel):
    """Optional amount picks a bank account tier (min/max)."""

    amount: Decimal | None = None


@router.post("/deposit/bank-details")
async def get_deposit_bank_details(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    body: DepositBankDetailsRequest | None = Body(default=None),
):
    """Return an active bank account for manual deposits (details + QR URL from admin)."""
    return await wallet_service.get_deposit_bank_details(
        amount=body.amount if body else None, db=db,
    )


@router.get("/bank-info")
async def get_bank_info(
    amount: Decimal = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
):
    return await wallet_service.get_bank_info(amount=amount, db=db)


@router.get("/deposit/banks")
async def list_deposit_banks(
    amount: Decimal | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """XM-style: list ALL active bank accounts so the user can pick one
    (instead of an auto-selected single bank). Optional `amount` filters to
    banks whose tier covers that amount."""
    return await wallet_service.list_deposit_banks(amount=amount, db=db)


class RmRequestBody(BaseModel):
    amount: Decimal
    phone: str
    side: str = "deposit"  # 'deposit' or 'withdraw'
    payout_details: Optional[str] = None  # bank/UPI for withdraw
    note: Optional[str] = None


@router.post("/deposit/rm-request", status_code=201)
async def create_rm_request(
    body: RmRequestBody,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Client spec 2026-06-09: replaces the P2P-marketplace concept. User
    # submits name/amount/phone and the gateway emails the relationship
    # manager — no marketplace, no escrow, no order flow. RM coordinates
    # the actual payment offline. The body's `side` field lets the same
    # endpoint power deposit + withdraw flows; payout_details is only
    # honoured on withdraw.
    from fastapi import HTTPException
    from packages.common.src.settings_store import get_bool_setting, get_system_setting
    from packages.common.src.models import User, Transaction
    from sqlalchemy import select

    if not await get_bool_setting("wallet.p2p_enabled", False):
        # The same admin toggle that used to gate the P2P marketplace
        # now gates this RM-request flow — admin can disable it without
        # a code deploy if RMs are unavailable.
        raise HTTPException(
            status_code=403,
            detail="Manual RM requests are currently disabled.",
        )

    amount = Decimal(str(body.amount))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    phone = (body.phone or "").strip()
    if len(phone) < 7 or len(phone) > 20:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    side = (body.side or "deposit").lower()
    if side not in ("deposit", "withdraw"):
        raise HTTPException(status_code=400, detail="side must be 'deposit' or 'withdraw'")

    user_row = (await db.execute(
        select(User).where(User.id == current_user["user_id"])
    )).scalar_one_or_none()
    if user_row is None:
        raise HTTPException(status_code=404, detail="User not found")

    full_name = " ".join(filter(None, [user_row.first_name, user_row.last_name])).strip()
    if not full_name:
        full_name = user_row.email or "(unnamed)"

    rm_email = (await get_system_setting("wallet.rm_email", "") or "").strip()
    if not rm_email:
        raise HTTPException(
            status_code=503,
            detail="RM email is not configured. Please contact support.",
        )

    # Build a simple, scannable email body the RM can act on without
    # logging into the platform. No HTML styling for plaintext mode +
    # a quick HTML version too.
    subject = (
        f"[SwisDex] {side.title()} request — {full_name} — "
        f"${float(amount):,.2f}"
    )
    payout_block = (
        f"\nPayout details: {body.payout_details}\n"
        if side == "withdraw" and body.payout_details
        else ""
    )
    note_block = f"\nNote: {body.note}\n" if body.note else ""

    text_body = (
        f"A trader has filed a manual {side} request.\n\n"
        f"Name: {full_name}\n"
        f"User ID: {user_row.id}\n"
        f"Email: {user_row.email or '-'}\n"
        f"Phone (provided): {phone}\n"
        f"Amount: ${float(amount):,.2f}\n"
        f"Type: {side}\n"
        f"Filed at: {datetime.utcnow().isoformat()}Z"
        f"{payout_block}{note_block}"
        f"\nPlease reach out to coordinate payment."
    )
    html_body = (
        f"<p>A trader has filed a manual <b>{side}</b> request.</p>"
        f"<table cellpadding='6' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;'>"
        f"<tr><td><b>Name</b></td><td>{full_name}</td></tr>"
        f"<tr><td><b>User ID</b></td><td><code>{user_row.id}</code></td></tr>"
        f"<tr><td><b>Email</b></td><td>{user_row.email or '-'}</td></tr>"
        f"<tr><td><b>Phone</b></td><td>{phone}</td></tr>"
        f"<tr><td><b>Amount</b></td><td>${float(amount):,.2f}</td></tr>"
        f"<tr><td><b>Type</b></td><td>{side}</td></tr>"
        f"<tr><td><b>Filed at</b></td><td>{datetime.utcnow().isoformat()}Z</td></tr>"
        + (
            f"<tr><td><b>Payout</b></td><td>{body.payout_details}</td></tr>"
            if side == "withdraw" and body.payout_details else ""
        )
        + (f"<tr><td><b>Note</b></td><td>{body.note}</td></tr>" if body.note else "")
        + f"</table><p>Please reach out to coordinate payment.</p>"
    )

    # Fire the mail. Swallow individual mail failure so the request is
    # still recorded on the user's ledger — finance can fall back to the
    # Transaction row if SMTP is briefly down.
    from packages.common.src.smtp_mail import send_email
    try:
        await send_email(
            rm_email, subject, html_body, text=text_body, category="account",
        )
    except Exception as exc:
        # Don't 500 the user — log audit row + tell them anyway
        from packages.common.src.instrumentation import logger as _log
        _log.warning("RM email failed for user=%s: %s", user_row.id, exc)

    # Audit ledger row — finance / support can see every RM request that
    # ever fired, with the same description the email carried.
    db.add(Transaction(
        user_id=user_row.id,
        type="rm_request",
        amount=Decimal("0") if side == "withdraw" else -amount,
        balance_after=Decimal(str(user_row.main_wallet_balance or 0)),
        description=(
            f"Manual {side} request — ${float(amount):,.2f} via RM "
            f"(phone {phone})"
        ),
    ))
    await db.commit()

    return {
        "status": "submitted",
        "message": (
            "Your relationship manager has been notified and will contact "
            "you within 24 hours to coordinate payment."
        ),
    }


@router.get("/payment-methods")
async def get_payment_methods():
    # Public flags driving which tabs the trader UI shows. Crypto
    # (NOWPayments) is always enabled — it's the primary funding rail
    # and shouldn't be admin-toggleable. Manual (bank/UPI) and P2P are
    # both admin-gated via system settings, so admin can switch them
    # off temporarily without a code deploy.
    #
    # Setting keys:
    #   wallet.manual_enabled  → 'manual' tab on deposit + 'bank' tab on withdraw
    #   wallet.p2p_enabled     → 'p2p' tab on both deposit + withdraw
    # Defaults: manual = True (preserves existing behaviour), p2p = False
    # (P2P marketplace is still being onboarded — admin opts in when ready).
    from packages.common.src.settings_store import get_bool_setting
    return {
        "crypto": True,
        "manual": await get_bool_setting("wallet.manual_enabled", True),
        "p2p": await get_bool_setting("wallet.p2p_enabled", False),
    }


@router.get("/bonus/overview")
async def get_bonus_overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trader-facing bonus dashboard data. Returns:
      - active_offers : BonusOffer rows currently advertisable to anyone
                        (is_active + within date window).
      - my_bonuses    : UserBonus rows for the caller across all statuses.
      - recent_requests : last 10 deposits where the trader typed a bonus
                          code (with the granted/denied/pending decision).
    """
    return await wallet_service.get_bonus_overview(
        user_id=current_user["user_id"], db=db,
    )
