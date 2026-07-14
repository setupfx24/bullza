# SwisDex — Developer Onboarding & Operations Guide

Everything a new engineer needs to read the code, run it locally, and deploy to
production. Read this top to bottom once; after that use it as a reference.

> **Repo:** `git@github.com:swisdexDev/swisdex_official_web.git`
> **Prod server:** `ssh swisdex@187.127.160.221` (SSH key auth) → app lives in `/opt/swisdex`
> **Domains:** `swisdex.com` (marketing) · `trade.swisdex.com` (trader) · `admin.swisdex.com` (admin) · `api.swisdex.com` (WebSocket origin)

---

## 1. What this is

A full forex/CFD **B-book brokerage platform**:

- **Backend** — Python 3.12 / FastAPI microservices (async SQLAlchemy 2.0).
- **Web frontends** — two independent Next.js 15 apps (trader + admin).
- **Mobile** — an Expo (React Native) app in a separate top-level folder.
- **Data stores** — PostgreSQL (business data), TimescaleDB (ticks + candle history), Redis (real-time bus + cache).
- **Market data** — live prices from **InfoWay** (paid WS plan) + Binance for crypto; the platform stores its own tick/candle history.

Two top-level folders in the workspace:

```
swisdesk/                 ← this repo (backend + both web frontends)
swisdex_mobile_app/       ← the Expo mobile app (separate)
```

---

## 2. Repository layout

```
swisdesk/
├── docker-compose.yml            # dev stack (all services + infra)
├── docker-compose.prod.yml       # PROD overlay (restart:always, localhost-only ports, no --reload)
├── docker-compose.local-infra.yml# infra-only, for native (non-docker) app dev
├── Makefile                      # `make deploy`, `make logs`, `make ps`
├── scripts/
│   ├── deploy.sh                 # THE blessed deploy path (see §7)
│   ├── backup.sh / restore.sh    # Postgres/Timescale/uploads snapshots
│   └── dev-native.ps1            # run app code natively, infra in docker
│
├── backend/
│   ├── packages/common/          # SHARED library — imported by every service
│   │   └── src/
│   │       ├── models/           # ALL SQLAlchemy models live here (see §4)
│   │       ├── schemas/          # Pydantic request/response schemas
│   │       ├── auth.py           # JWT create/verify, get_current_user, require_admin
│   │       ├── config.py         # every env var (Pydantic settings) — the config surface
│   │       ├── database.py       # async engines: AsyncSessionLocal (PG) + TimescaleSessionLocal
│   │       ├── redis_client.py   # Redis helpers + channel/key name constants (PriceChannel)
│   │       ├── instrument_pricing.py # spread/commission/swap resolution
│   │       ├── trading_service.py    # P&L / currency conversion helpers
│   │       ├── smtp_mail.py       # single email choke point (suppression list here)
│   │       ├── corecen_trade_client.py # A-book LP forwarding (HMAC)
│   │       └── infoway_rest.py    # InfoWay historical klines (REST)
│   │
│   ├── services/
│   │   ├── gateway/              # TRADER API + WebSockets + background engines (port 8000)
│   │   │   └── src/
│   │   │       ├── main.py       # FastAPI app, router mounts, 4 WS endpoints, engine lifespan
│   │   │       ├── api/          # routers: auth, orders, positions, deposits, business, fixed_return, …
│   │   │       ├── services/     # business logic (trading_service.py is the execution core)
│   │   │       ├── engines/      # asyncio background jobs (sltp, copy, fixed_return, payout, …)
│   │   │       └── *.py          # one-off maintenance/seed scripts (run manually)
│   │   ├── admin/               # ADMIN API (port 8001, separate JWT, Redis db 1)
│   │   │   ├── main.py           # app + startup DDL self-heal
│   │   │   ├── dependencies.py   # RBAC: require_permission, role→permission map
│   │   │   ├── routes/           # admin route modules
│   │   │   └── services/         # admin business logic
│   │   ├── market-data/         # price feed → tick pipeline → Redis + Timescale (no HTTP)
│   │   │   └── src/
│   │   │       ├── main.py       # MarketDataService: feed loops, watchdogs, aggregation
│   │   │       ├── infoway_feed.py   # InfoWay WS (+ zombie-reconnect guard)
│   │   │       ├── feed_handler.py   # INSTRUMENTS universe + simulator + Binance
│   │   │       ├── bar_aggregator.py # tick → OHLCV for all timeframes
│   │   │       ├── spread_cache.py   # admin spread applied around mid
│   │   │       ├── store.py          # TickStore + OHLCStore (Timescale writes)
│   │   │       ├── seed_bars.py          # seed recent history into Redis
│   │   │       └── backfill_history.py   # DEEP history backfill (see §11)
│   │   ├── b-book-engine/        # pending-order + SL/TP watcher (no HTTP)
│   │   ├── risk-engine/          # margin monitor / stop-out / swaps (no HTTP)
│   │   └── b_book_engine, market_data, risk_engine  → SYMLINKS (edit the hyphenated dirs!)
│   │
│   ├── infra/migrations/         # Alembic migrations (numbered 0001…; latest ~0097)
│   ├── tests/                    # minimal (one deposit-request test)
│   └── uploads/                  # user-uploaded files (banners, wallet proofs, KYC)
│
└── frontend/
    ├── trader/                   # Next.js 15 — trade.swisdex.com (port 3000)
    │   └── src/
    │       ├── app/              # App Router pages (trading/terminal, wallet, fixed-return, earn/*, …)
    │       ├── components/       # OrderPanel, PositionsPanel, charts/ChartingLibraryChart, …
    │       ├── stores/           # Zustand (tradingStore, authStore, wsStore)
    │       ├── lib/
    │       │   ├── api/client.ts # the fetch wrapper (singleton `api`)
    │       │   ├── ws/           # priceSocket, barSocket, tradeSocket, wsManager
    │       │   ├── charting/     # datafeed.ts (TradingView datafeed) + broker.ts
    │       │   └── wallet/centDisplay.ts # cent-account ×100 display helper
    │       └── charting/         # (unused) custom canvas chart engine
    └── admin/                    # Next.js 15 — admin.swisdex.com (port 3001)
        └── src/
            ├── app/(admin)/      # admin pages (users, kyc, deposits, config/*, reward-campaigns, …)
            ├── components/layout/AdminLayout.tsx + AdminSidebar.tsx  # shell (mobile drawer)
            ├── lib/api.ts        # admin fetch wrapper (singleton `adminApi`)
            └── stores/           # Zustand (authStore, themeStore)
```

**No shared frontend package** — the trader and admin apps duplicate their api client / auth store / utils by copy. A change to shared-looking code must be made in **both** apps.

---

## 3. How the services talk to each other

There is **no direct HTTP between internal services** for trading. Everything flows through **Redis** and **Postgres**.

- **Redis** (`packages/common/src/redis_client.py`) — gateway uses **db 0**, admin uses **db 1**.
  Key channels & keys:

  | Name | Type | Written by | Read by | Purpose |
  |---|---|---|---|---|
  | `tick:<SYM>` | key, 120s TTL | market-data | gateway, engines | latest bid/ask (dead feed → key expires) |
  | `prices`, `prices:<SYM>` | pub/sub | market-data | gateway `/ws/prices` | every tick |
  | `bars:updates` | pub/sub | market-data | gateway `/ws/bars` | forming candle on every tick |
  | `bar:current:<SYM>:<TF>` | key | market-data | gateway `/bars` | the in-progress candle |
  | `bars:<SYM>:<TF>` | list (1000) | market-data | gateway `/bars` | recent closed candles cache |
  | `account:<account_id>` | pub/sub | gateway, engines | gateway `/ws/trades` | order_filled / position_closed / balance_update |
  | `admin:trades/deposits/alerts` | pub/sub | gateway | gateway `/ws/admin` | admin live feed |
  | `config:instruments:reload` | pub/sub | admin | market-data | bust spread/instrument caches |
  | `exposure:summary` | key | risk-engine | admin | house net exposure |
  | `engine:*:lock` | key (SET NX EX) | engines | engines | leader lock (multi-worker safety) |

- **Postgres** — all OLTP/business data (`AsyncSessionLocal`).
- **TimescaleDB** — market data: `ticks` table + `ohlcv_1m … ohlcv_1d` candle tables (`TimescaleSessionLocal`).
- **Outbound HTTP** only to external providers: InfoWay (prices), Binance (crypto), NOWPayments/OxaPay (crypto deposits/payouts), Corecen LP (A-book), SMTP, Google OAuth, Cloudflare Turnstile.

---

## 4. Database models

All models are in **`backend/packages/common/src/models/`** (registry in `__init__.py`). Key ones:

- **`users.py`** — `User` (identity, roles user/admin/super_admin, balances on the row: `main_wallet_balance`, `main_wallet_bonus`, `ib_commission_balance`, `referral_commission_balance`, `book_type` A/B, `is_demo`, `is_promotional`), `Employee` (RBAC backbone), `KYCDocument`, sessions/tokens.
- **`trading.py`** — `AccountGroup` (Standard/ECN/VIP/Cent; `lot_size_multiplier`, `is_cent_account`), `TradingAccount`, `Order`, `Position`, `TradeHistory`.
- **`wallet.py`** — `Deposit`, `Withdrawal`, `Transaction` (append-only ledger), `PaymentMethod`, `ChargeConfig`/`SpreadConfig`/`SwapConfig`.
- **`business.py`** — `IBProfile` (self-referential MLM tree), `IBCommission`, `MasterAccount` (PAMM/MAM), `InvestorAllocation`, `CopyTrade`.
- **`fixed_return.py`** — `FixedReturnLock` ("AI-Powered Staking").
- **`instruments.py`** — `Instrument`, `InstrumentConfig`, `InstrumentSegment`.
- **`rewards.py`** — XP/coins engine + `RewardCampaign`/`RewardCampaignTier`/`RewardCampaignClaim` (referral offers; tiers pay % or fixed $).
- **`system.py`** — `SystemSetting` (key→JSONB — **the source of truth for tunable business rules**: tiers, gates, payout windows).

**Money is `Numeric(18,8)`, USD internally.**

---

## 5. Authentication

Two independent JWT trust domains with **separate secrets** (`JWT_SECRET` vs `ADMIN_JWT_SECRET`; boot refuses if they're equal/insecure).

- **Trader** (`packages/common/src/auth.py`): HttpOnly cookies `pt_access` / `pt_refresh`; mobile also gets the refresh token in the JSON body (`JWT_INCLUDE_REFRESH_IN_JSON=true`). Google OAuth + SIWE wallet login supported. `get_current_user` reads cookie or `Authorization: Bearer`.
- **Admin** (`services/admin/dependencies.py`): separate `swisdex_admin` HttpOnly cookie; token carries a password-epoch claim so **changing an admin password revokes all their tokens**. RBAC via `require_permission("<perm>")` — **only `super_admin` bypasses**. Employees are `User.role="admin"` rows with real privileges in `Employee.role`; effective perms = built-in role map ∪ `extra_permissions`, `"*"` = all.

---

## 6. WebSockets (all defined in `gateway/src/main.py`)

Auth from the `pt_access` cookie first, `?token=` fallback. All send `{"type":"ping"}` every 30s.

| Endpoint | Auth | Streams |
|---|---|---|
| `/ws/prices` | optional | every tick (bid/ask/spread) — subscribes Redis `prices` |
| `/ws/bars` | optional | live candle; client sends `{type:"subscribe",symbol,resolution}`, server relays matching `bars:updates` |
| `/ws/trades/{account_id}` | **required + ownership** | order/position/balance events — subscribes `account:<id>` |
| `/ws/admin` | **role-gated** | `admin:trades/deposits/alerts` |

**Frontend WS clients** live in `frontend/trader/src/lib/ws/`: `priceSocket` and `wsManager` (prices), `barSocket` (candles), `tradeSocket` (per-account). They have exponential-backoff reconnect + a half-open watchdog; on reconnect they reset the chart cache so missed bars re-fetch. The trading layout (`app/trading/layout.tsx`) also runs a 1.5s REST poll as a WS fallback, reconciled by a freshness guard.

---

## 7. Deployment

### Log in
```bash
ssh swisdex@187.127.160.221      # key-based; the app is in /opt/swisdex
cd /opt/swisdex
```

### The blessed path — `scripts/deploy.sh`
It: pulls `origin/main`, rebuilds images (`--no-cache`) with the prod overlay, runs Alembic migrations, brings the full stack up bound on `127.0.0.1` (nginx proxies to these):

```
127.0.0.1:8002 → gateway:8000     (REST + WS)
127.0.0.1:8003 → admin-api:8001
127.0.0.1:3012 → trader-frontend:3000
127.0.0.1:3013 → admin-frontend:3001
```

```bash
./scripts/deploy.sh                          # FULL: pull + rebuild all + migrate + up
./scripts/deploy.sh --service trader-frontend# rebuild only trader-frontend, up full stack
./scripts/deploy.sh --no-build --no-migrate  # just restart with current images
./scripts/deploy.sh --no-pull                # deploy local changes without git pull
```

### Which command for which change (IMPORTANT)

Backend service source is **volume-mounted** into the containers; frontends are **baked into the image at build time**. So:

| You changed… | Do this on the server |
|---|---|
| **Backend Python** (gateway / market-data / engines / admin-api) | `git pull` → `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart <service>` — code reloads, no rebuild. (Gateway runs without `--reload` in prod, so a restart is required.) |
| **A DB migration** was added | `./scripts/deploy.sh` (it runs `alembic upgrade head`), or `docker compose --profile migrate up migrate` |
| **Trader frontend** (`frontend/trader`) | `./scripts/deploy.sh --service trader-frontend` — **must rebuild** (Next.js bundle). A restart alone serves stale JS. |
| **Admin frontend** (`frontend/admin`) | `./scripts/deploy.sh --service admin-frontend` |
| **Env var** in `/opt/swisdex/.env` | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d <service>` (recreate — `restart` does NOT reload env) |
| **A one-off data fix** (promo scripts, backfill) | `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec gateway python -m services.gateway.src.<script> [--execute]` |

> **Compose shorthand:** the two `-f` flags are always needed in prod. `make ps` / `make logs` wrap them.

After deploy, verify: `make ps` (all Up, ports show `127.0.0.1:…`) and `curl -s http://127.0.0.1:8002/health`.
Users must **hard-refresh (Ctrl+Shift+R)** to pick up a new frontend bundle.

### The standard workflow we use
1. Edit code locally, `python -m py_compile …` / `tsc --noEmit` to sanity-check.
2. `git commit` + `git push` (goes to `swisdexDev/swisdex_official_web`).
3. On the server: `git pull` then the right command from the table above.

---

## 8. Credentials & secrets

- **`.env` is NOT in git** (`.env`, `backend/.env` are gitignored). The real secrets live only in **`/opt/swisdex/.env`** on the server. Keep an encrypted backup in a password manager — it is not part of `backup.sh`.
- `.env.example` documents every variable name. Key ones: `DATABASE_URL`, `TIMESCALE_URL`, `REDIS_URL`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `INFOWAY_TOKEN`, `INFOWAY_CHANNEL`, `NOWPAYMENTS_*`, `SMTP_*`, `GOOGLE_CLIENT_ID`, `CLOUDFLARE_TURNSTILE_*`, `JWT_INCLUDE_REFRESH_IN_JSON`, `EMAIL_SUPPRESSION_LIST`.
- **Git access:** the server pulls via an **SSH deploy key** (`~/.ssh/swisdex_deploy`, configured in `~/.ssh/config` for `github.com`). Local machines push via HTTPS+token or their own SSH key. The repo is **private** under the `swisdexDev` org — a developer needs org membership.
- **DB access on the server:** `docker compose … exec postgres psql -U swisdex` (main) / `… exec timescaledb psql -U swisdex -d marketdata`.

---

## 9. Local development

Two ways:

**A. Full docker (simplest):**
```bash
cp .env.example .env        # fill in at least INFOWAY_TOKEN, secrets
docker compose up -d        # brings up infra + all services + both frontends
# trader → localhost:3010, admin → localhost:3011, gateway → localhost:8000
docker compose --profile migrate up migrate   # run migrations
```

**B. Native app + docker infra** (`scripts/dev-native.ps1`, Windows) — runs Python/Next natively for fast reload, infra (PG/Timescale/Redis) in docker on shifted ports (5434/5435/6381).

**Mobile** (`swisdex_mobile_app/`, separate): Expo SDK 54, `pnpm start --lan`. Point `EXPO_PUBLIC_API_BASE` at your gateway. Requires backend `JWT_INCLUDE_REFRESH_IN_JSON=true`. See its `AGENTS.md`.

---

## 10. Migrations

Alembic, in `backend/infra/migrations/versions/`, numbered sequentially (`0097_…`). To add one: create `NNNN_description.py` with `revision`/`down_revision`, write idempotent DDL (`… IF NOT EXISTS`). Applied by `deploy.sh` or `docker compose --profile migrate up migrate`. The admin service ALSO self-heals some schema drift with idempotent DDL at boot (`admin/main.py`).

---

## 11. The parts that bite — read before touching

1. **The trading execution core is in the GATEWAY**, not the misleadingly-named `b-book-engine`. Market fills, per-user spread, margin, cent scaling, and closes all live in `gateway/src/services/trading_service.py`. The `b-book-engine` service only triggers pending orders + SL/TP.
2. **SL/TP has three racing closers** (b-book 100ms, gateway `sltp_engine` 1s, manual close). Every closer does an atomic `UPDATE positions … WHERE status='open'` (rowcount 0 → bail) to avoid double-booking. Keep all three consistent.
3. **SL/TP validation** (`modify_position`) is against the **current close price (bid for buy)**, not the open price — so break-even / profit-lock stops work (MT5 semantics).
4. **Cent accounts** — `Position.lots` is the raw engine value scaled by `AccountGroup.lot_size_multiplier` (Cent = 0.01). `effective_lots` is what all engines compute on; the UI scales back (×100 to `¢`, ÷multiplier for lots). Using the wrong field over/understates P&L 100×. Canonical UI helper: `frontend/trader/src/lib/wallet/centDisplay.ts`.
5. **The chart** — history from `GET /instruments/{sym}/bars` (durable Timescale first, InfoWay REST backfill on pan), live candle from `/ws/bars`. Candles are drawn at **BID** (MID shifted down half the live spread) so chart = panel bid = buy-position P&L. **Never invent prices** — there is no synthetic fallback; the chart honestly ends at the oldest real bar. Extra timeframes (3m/10m/45m/2h/3h/W/M/3M/6M/12M) are aggregated **client-side** by TradingView from the base resolutions the server provides.
6. **market-data underscore dirs are symlinks** — edit `market-data`, not `market_data`.
7. **`system_settings` (JSONB) is the source of truth** for business rules (rate matrices, tiers, gates, payout windows) — not code constants. The code carries many dated "client 2026-…" comments documenting rule changes.
8. **Email** — every send goes through `smtp_mail.send_email`; undeliverable/demo/suppressed addresses are dropped there (`EMAIL_SUPPRESSION_LIST` + built-in `demo@swisdex.com` + `.local/.test/.invalid` domains). Promotional accounts are skipped by the engines.
9. **Tests are minimal.** Verify trade-path changes manually (drive the flow, watch the DB + WS events).

---

## 12. Backups & disaster recovery

`scripts/backup.sh` snapshots Postgres + Timescale + `uploads/` to `/opt/swisdex/backups/` (daily 03:00 UTC cron via `install-backup-cron.sh`), optionally mirrored offsite via `rclone`. Restore with `scripts/restore.sh`. Full rebuild runbook: `docs/disaster-recovery.md`. **The `.env` is not in the backup — store it separately.**

---

## 13. Quick reference

```bash
# --- server ---
ssh swisdex@187.127.160.221 && cd /opt/swisdex
make ps                 # service status
make logs               # tail all logs
./scripts/deploy.sh     # full deploy from git
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart gateway   # reload backend code
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f market-data
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres psql -U swisdex

# --- health ---
curl -s http://127.0.0.1:8002/health          # gateway
curl -s http://127.0.0.1:3012/                 # trader frontend
curl -s http://127.0.0.1:3013/login            # admin frontend

# --- one-off data scripts (dry-run by default, --execute to write) ---
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec gateway \
  python -m services.gateway.src.backfill_history          # deep chart history
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec market-data \
  python -m services.market_data.src.backfill_history
```

---

*Keep this file current — when you add a service, engine, WS channel, or a non-obvious
operational step, update the relevant section here in the same PR.*
