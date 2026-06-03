import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from dependencies import require_permission
from packages.common.src.models import User
from packages.common.src.admin_schemas import (
    MLMConfigIn, UpdateIBCommissionIn, RejectIBIn, IBCommissionPlanIn,
)
from services import business_service

router = APIRouter(prefix="/business", tags=["Business"])


class CompanyIBDesignateIn(BaseModel):
    # Empty string clears the designation.
    user_id: str
    attach_unreferred: bool = False


@router.get("/company-ib")
async def get_company_ib(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """Show which user is currently designated as the company / house IB,
    plus its referral link and a quick stat (referrals on file)."""
    return await business_service.get_company_ib(db)


@router.put("/company-ib")
async def set_company_ib(
    body: CompanyIBDesignateIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.set_company_ib(
        user_id_str=body.user_id,
        attach_unreferred=body.attach_unreferred,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )


@router.get("/referral/overview")
async def referral_overview(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """Admin oversight for the personal-referral program (not IB MLM).

    Returns: current commission %, total paid, count of referred users,
    top referrers by earnings, and a paginated list of recent payouts.
    """
    return await business_service.referral_program_overview(
        page=page, per_page=per_page, db=db,
    )


@router.get("/ib/applications")
async def list_ib_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/ib/applications/{app_id}/approve")
async def approve_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/applications/{app_id}/reject")
async def reject_ib_application(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_ib_application(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/agents")
async def list_ib_agents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_ib_agents(page=page, per_page=per_page, db=db)


@router.put("/ib/agents/{agent_id}/commission")
async def update_ib_commission(
    agent_id: uuid.UUID,
    body: UpdateIBCommissionIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_ib_commission(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


class _RefCodeBody(BaseModel):
    code: str


@router.put("/ib/agents/{agent_id}/referral-code")
async def update_ib_referral_code(
    agent_id: uuid.UUID,
    body: _RefCodeBody,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Overwrite an IB's auto-generated referral code with a custom vanity
    code (e.g. 'SDASIA' for the house master). Strict charset + uniqueness
    validation; audit-logged."""
    return await business_service.update_ib_referral_code(
        agent_id=agent_id, new_code=body.code, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/ib/agents/{agent_id}/reject")
async def reject_active_ib(
    agent_id: uuid.UUID,
    body: RejectIBIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_active_ib(
        agent_id=agent_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/ib/commission-plans")
async def list_commission_plans(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_commission_plans(db=db)


@router.post("/ib/commission-plans")
async def create_commission_plan(
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.create_commission_plan(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/ib/commission-plans/{plan_id}")
async def update_commission_plan(
    plan_id: uuid.UUID,
    body: IBCommissionPlanIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_commission_plan(
        plan_id=plan_id, body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.delete("/ib/commission-plans/{plan_id}")
async def delete_commission_plan(
    plan_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.delete_commission_plan(
        plan_id=plan_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/mlm/config")
async def get_mlm_config(
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_mlm_config(db=db)


@router.put("/mlm/config")
async def update_mlm_config(
    body: MLMConfigIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.update_mlm_config(
        body=body, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── IB Hierarchy Management ──────────────────────────────────────────────

from pydantic import BaseModel as _BM

class _SetParentBody(_BM):
    parent_ib_id: str | None = None

class _MoveUserBody(_BM):
    new_ib_id: str


@router.get("/ib/tree")
async def get_ib_tree(
    ib_id: str | None = Query(None),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    _id = uuid.UUID(ib_id) if ib_id else None
    return await business_service.get_ib_tree(ib_id=_id, db=db)


@router.get("/ib/users/unassigned")
async def get_unassigned_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_unassigned_users(page=page, per_page=per_page, db=db)


@router.get("/ib/agents/{agent_id}/referrals")
async def get_ib_referrals(
    agent_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.get_ib_referrals(ib_id=agent_id, page=page, per_page=per_page, db=db)


@router.put("/ib/agents/{agent_id}/parent")
async def set_parent_ib(
    agent_id: uuid.UUID,
    body: _SetParentBody,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    parent_id = uuid.UUID(body.parent_ib_id) if body.parent_ib_id else None
    return await business_service.set_parent_ib(
        ib_id=agent_id, parent_ib_id=parent_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.put("/ib/users/{user_id}/move")
async def move_user_to_ib(
    user_id: uuid.UUID,
    body: _MoveUserBody,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.move_user_to_ib(
        user_id=user_id, new_ib_id=uuid.UUID(body.new_ib_id), admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── Sub-Broker ───────────────────────────────────────────────────────────

@router.get("/sub-broker/applications")
async def list_sub_broker_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_broker_applications(
        page=page, per_page=per_page, status_filter=status_filter, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/approve")
async def approve_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.approve_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/sub-broker/applications/{app_id}/reject")
async def reject_sub_broker(
    app_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.reject_sub_broker(
        app_id=app_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.get("/sub-broker/agents")
async def list_sub_brokers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    return await business_service.list_sub_brokers(page=page, per_page=per_page, db=db)


# ─── Copy-Trade Master Management ──────────────────────────────

@router.get("/masters")
async def list_masters(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    master_type: str | None = Query(
        None,
        description="Filter to a single master_type (signal_provider | pamm | mamm). Default = all.",
    ),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """List copy-trade masters with stats. Pass `master_type=mamm` to
    scope the result to MAM only (so the admin MAM dashboard never
    receives PAMM rows even before the client-side filter runs)."""
    return await business_service.list_masters(
        page=page, per_page=per_page, db=db, master_type=master_type,
    )


@router.get("/masters/admin-commission-summary")
async def admin_commission_summary(
    master_type: str | None = Query(None),
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate admin-cut earned across all masters of `master_type`
    (default = all). Returns the lifetime total + a per-master
    breakdown so the admin MAM dashboard can show who's contributing
    how much to the house cut."""
    return await business_service.admin_commission_summary(
        master_type=master_type, db=db,
    )


@router.delete("/masters/{master_id}")
async def delete_master(
    master_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a copy-trade master. Closes all open copy positions, refunds
    allocation amounts to each follower's main wallet, and sweeps the master's
    trading account balance back to the master user's main wallet."""
    return await business_service.delete_master(
        master_id=master_id, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


class MasterCreateIn(BaseModel):
    user_id: str
    master_type: str = "signal_provider"  # signal_provider | pamm | mamm
    performance_fee_pct: float = 20
    management_fee_pct: float = 0
    admin_commission_pct: float = 0
    min_investment: float = 100
    max_investors: int = 100
    description: str | None = None
    spread_markup_pips: float | None = None
    commission_per_lot_usd: float | None = None
    # Admin-set risk controls (Mig 0066). Optional on create — null
    # leaves the column default in place (0 / NULL = disabled).
    max_drawdown_pct: float | None = None
    max_loss_per_trade_pct: float | None = None
    # Default TRUE in the model; admin can flip it off at create time
    # to forbid investors from auto-insuring trades on this master.
    insurance_enabled: bool = True


@router.post("/masters")
async def create_master(
    body: MasterCreateIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-direct master creation. Picks a user, auto-creates the pool
    trading account (CT/PM/MM prefix), and marks the master 'approved' in
    one call — skipping the user-side 'become_provider' application flow."""
    return await business_service.create_master(
        user_id_str=body.user_id,
        master_type=body.master_type,
        performance_fee_pct=body.performance_fee_pct,
        management_fee_pct=body.management_fee_pct,
        admin_commission_pct=body.admin_commission_pct,
        min_investment=body.min_investment,
        max_investors=body.max_investors,
        description=body.description,
        spread_markup_pips=body.spread_markup_pips,
        commission_per_lot_usd=body.commission_per_lot_usd,
        max_drawdown_pct=body.max_drawdown_pct,
        max_loss_per_trade_pct=body.max_loss_per_trade_pct,
        insurance_enabled=body.insurance_enabled,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )


class MasterUpdateIn(BaseModel):
    performance_fee_pct: float | None = None
    management_fee_pct: float | None = None
    admin_commission_pct: float | None = None
    min_investment: float | None = None
    max_investors: int | None = None
    description: str | None = None
    master_type: str | None = None
    status: str | None = None
    # Explicit null clears the override and falls through to the global
    # SpreadConfig / ChargeConfig resolver for this master's pool fills.
    spread_markup_pips: float | None = None
    commission_per_lot_usd: float | None = None
    # Mig 0066 admin risk + insurance fields. Patch semantics — only
    # update what's explicitly sent.
    max_drawdown_pct: float | None = None
    max_loss_per_trade_pct: float | None = None
    insurance_enabled: bool | None = None
    # Mig 0067 per-master swap overrides. Same NULL-clears-the-override
    # semantics as spread_markup_pips.
    swap_long_pips: float | None = None
    swap_short_pips: float | None = None


@router.put("/masters/{master_id}")
async def update_master(
    master_id: uuid.UUID,
    body: MasterUpdateIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Patch master fields. Only fields explicitly present in the request
    body are applied — exclude_unset keeps absent fields untouched."""
    patch = body.model_dump(exclude_unset=True)
    return await business_service.update_master(
        master_id=master_id, patch=patch, admin_id=admin.id,
        ip_address=request.client.host if request.client else None, db=db,
    )


# ─── Per-investor allocation management (drives the MAM page Investors drawer) ──

class AllocationUpdateIn(BaseModel):
    """Admin patch on a single investor_allocations row. Every field is
    optional — exclude_unset keeps untouched fields untouched. JSON null on
    a fee override clears it (investor falls back to master default); a
    real numeric 0 stores 0%."""
    status: str | None = None  # active | paused | closed
    copy_type: str | None = None
    allocation_amount: float | None = None
    allocation_pct: float | None = None
    max_drawdown_pct: float | None = None
    max_lot_override: float | None = None
    performance_fee_pct_override: float | None = None
    admin_commission_pct_override: float | None = None
    admin_notes: str | None = None


@router.get("/masters/{master_id}/allocations")
async def list_master_allocations(
    master_id: uuid.UUID,
    admin: User = Depends(require_permission("ib.view")),
    db: AsyncSession = Depends(get_db),
):
    """List every investor allocation on a master, with effective fee % so
    admin can see at a glance who is on the house rate vs a custom override."""
    return await business_service.list_master_allocations(master_id=master_id, db=db)


@router.patch("/masters/{master_id}/allocations/{allocation_id}")
async def update_master_allocation(
    master_id: uuid.UUID,
    allocation_id: uuid.UUID,
    body: AllocationUpdateIn,
    request: Request,
    admin: User = Depends(require_permission("ib.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Admin patches a single allocation: change status (pause/resume/close),
    set a custom performance fee just for this investor, cap their max lot,
    leave an audit note. copy_engine._close_copy reads the overrides on the
    next close."""
    patch = body.model_dump(exclude_unset=True)
    return await business_service.update_master_allocation(
        master_id=master_id,
        allocation_id=allocation_id,
        patch=patch,
        admin_id=admin.id,
        ip_address=request.client.host if request.client else None,
        db=db,
    )
