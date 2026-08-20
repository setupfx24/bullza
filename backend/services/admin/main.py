import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from packages.common.src.config import get_settings
from packages.common.src.database import engine
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("admin-api")

from routes import (
    auth, dashboard, users, trades, deposits, banks, book,
    config as routes_config, instruments_admin, business, social, analytics, bonus, banners,
    support, employees, settings, transactions, kyc, account_types, user_audit_logs,
    admin_audit_logs,
    insurance as insurance_admin, play_zone as play_zone_admin,
    lifestyle as lifestyle_admin, approvals, notifications, broadcast,
    fixed_return as fixed_return_admin, rm as rm_admin, tasks as tasks_admin,
    expenses as expenses_admin, risk as risk_admin,
    reward_campaigns as reward_campaigns_admin,
    ai_station as ai_station_admin,
    referral_campaigns as referral_campaigns_admin,
)

app_settings = get_settings()
init_sentry("admin-api")

_cors_origins = [
    o.strip()
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
]
if not _cors_origins:
    _cors_origins = ["http://localhost:3001"]
_cors_methods = [m.strip() for m in app_settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in app_settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _detect_schema_drift():
    """Loud drift DETECTOR — no longer mutates schema at boot.

    This function used to run a large block of self-healing DDL on every
    start, which meant the real schema was defined in two places (Alembic
    + here) and a missed migration was silently papered over. The DDL now
    lives in migration 0104 (a no-op on databases that ran 0071–0078) and
    `scripts/deploy.sh` blocks on `alembic upgrade head` before `up`.
    Here we only probe a few sentinel objects and scream if they're
    missing, so a host that skipped migrations fails loudly instead of
    mysteriously 500-ing on random admin endpoints.
    """
    from sqlalchemy import text
    probes = {
        "employees.extra_permissions": (
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='employees' AND column_name='extra_permissions'"
        ),
        "system_settings": "SELECT to_regclass('system_settings')",
        "rm_funding_requests": "SELECT to_regclass('rm_funding_requests')",
        "orders.spread_revenue": (
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='orders' AND column_name='spread_revenue'"
        ),
    }
    try:
        async with engine.connect() as conn:
            missing = []
            for name, sql in probes.items():
                row = (await conn.execute(text(sql))).scalar()
                if not row:
                    missing.append(name)
        if missing:
            logger.error(
                "SCHEMA DRIFT: missing %s — run `alembic -c infra/migrations/alembic.ini "
                "upgrade head` (deploy.sh does this automatically). Admin endpoints "
                "touching these objects will 500 until migrations are applied.",
                ", ".join(missing),
            )
    except Exception as e:  # noqa: BLE001 — a probe failure must not block boot
        logger.warning("schema drift probe skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _detect_schema_drift()
    yield
    await engine.dispose()


app = FastAPI(
    title=f"{app_settings.BRAND_NAME} Admin API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if app_settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if app_settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if app_settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)

add_middleware_stack(app)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """Return JSON (not plain text) so proxies and the admin UI can parse errors."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


prefix = "/api/v1/admin"

app.include_router(auth.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(trades.router, prefix=prefix)
app.include_router(book.router, prefix=prefix)
app.include_router(deposits.router, prefix=prefix)
app.include_router(banks.router, prefix=prefix)
app.include_router(routes_config.router, prefix=prefix)
app.include_router(instruments_admin.router, prefix=prefix)
app.include_router(business.router, prefix=prefix)
app.include_router(social.router, prefix=prefix)
app.include_router(analytics.router, prefix=prefix)
app.include_router(bonus.router, prefix=prefix)
app.include_router(banners.router, prefix=prefix)
app.include_router(support.router, prefix=prefix)
app.include_router(employees.router, prefix=prefix)
app.include_router(tasks_admin.router, prefix=f"{prefix}/tasks")
app.include_router(settings.router, prefix=prefix)
app.include_router(transactions.router, prefix=prefix)
app.include_router(kyc.router, prefix=prefix)
app.include_router(account_types.router, prefix=prefix)
app.include_router(user_audit_logs.router, prefix=prefix)
app.include_router(admin_audit_logs.router, prefix=prefix)
app.include_router(insurance_admin.router, prefix=prefix)
app.include_router(fixed_return_admin.router, prefix=prefix)
app.include_router(play_zone_admin.router, prefix=prefix)
app.include_router(lifestyle_admin.router, prefix=prefix)
app.include_router(approvals.router, prefix=f"{prefix}/approvals", tags=["Approvals"])
app.include_router(notifications.router, prefix=prefix)
app.include_router(broadcast.router, prefix=prefix)
app.include_router(rm_admin.router, prefix=prefix)
app.include_router(expenses_admin.router, prefix=prefix)
app.include_router(risk_admin.router, prefix=prefix)
app.include_router(reward_campaigns_admin.router, prefix=prefix)
app.include_router(ai_station_admin.router, prefix=prefix)
app.include_router(referral_campaigns_admin.router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
