# White-Label Broker Platform

A full-stack, white-label forex/CFD brokerage platform:

- **Backend** — FastAPI microservices: `gateway` (trader REST + WebSocket), `admin` (back-office API), `market-data` (tick ingestion), `b-book-engine` (execution), `risk-engine` (margin/stop-out), plus a shared `packages/common` library.
- **Frontends** — Next.js apps: `frontend/trader` (marketing site + trading dashboard/terminal) and `frontend/admin` (back-office panel).
- **Data** — PostgreSQL (core), TimescaleDB (market data), Redis (pub/sub + cache).

Everything runs under Docker Compose; schema evolution is via Alembic.

## Quickstart (Docker)

```bash
cp .env.example .env        # fill in secrets (openssl rand -hex 32 for JWTs)
docker compose up -d --build
docker compose --profile migrate up migrate   # apply Alembic migrations
```

- Trader app: http://127.0.0.1:3010
- Admin app: http://127.0.0.1:3011
- Gateway API docs: http://127.0.0.1:8000/docs
- Admin API docs: http://127.0.0.1:8001/docs

## Local native development (Windows)

Runs infra (Postgres/Timescale/Redis) in Docker and all app code natively with hot reload:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-native.ps1
# stop everything:
powershell -ExecutionPolicy Bypass -File scripts\dev-native-stop.ps1
```

## Branding / white-labeling

Branding is configured in one place — the root `.env` (see the
**White-label branding** section at the top of `.env.example`):

| Variable | Where it applies |
|---|---|
| `BRAND_NAME`, `BRAND_DOMAIN` | Backend (runtime): emails, statements, API strings |
| `MAIL_FROM_NAME`, `EMAIL_LOGO_URL` | Outbound email headers/logo |
| `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_SLUG`, `NEXT_PUBLIC_BRAND_DOMAIN`, `NEXT_PUBLIC_BRAND_LOGO`, `NEXT_PUBLIC_BRAND_SUPPORT_EMAIL` | Frontends (build time) |

Frontend brand constants live in `frontend/trader/src/lib/brand.ts` and
`frontend/admin/src/lib/brand.ts`. `NEXT_PUBLIC_*` values are **baked into
the JS bundle at build time** — in Docker they are forwarded as build args
(see `build.args` in `docker-compose.yml`), so rebuild the frontend images
after changing them. An empty `NEXT_PUBLIC_BRAND_LOGO` makes the UI render
styled brand text instead of an image, so a fresh build never ships another
brand's artwork.

Domain-specific config (CORS origins, cookie domain, nginx `server_name`)
uses `example.com` placeholders — replace with the tenant domain in `.env`
and `deploy/nginx/broker.conf` before deploying.

> **Note for pre-rename deployments:** the compose project name changed to
> `broker`. Docker namespaces volumes by project name — existing servers must
> `export COMPOSE_PROJECT_NAME=<old-name>` or migrate volumes before
> updating. See the header comment in `docker-compose.yml`.

## Deploy (production)

```bash
./scripts/deploy.sh          # pull main, rebuild, migrate, up -d (prod overlay)
```

The prod overlay (`docker-compose.prod.yml`) binds services on
`127.0.0.1:<prod-port>`; nginx (see `deploy/nginx/broker.conf`) terminates
TLS and proxies apex/trade/admin/api hostnames to those ports.

## Backups & disaster recovery

Daily snapshots of Postgres, TimescaleDB, and the `uploads/` directory are
written to `/opt/broker/backups/` and (optionally) mirrored to an offsite
`rclone` remote (Backblaze B2 / Cloudflare R2 / S3 / DO Spaces). All backup
artefacts are GPG-encrypted before touching disk.

**One-time setup on a server:**
```bash
chmod +x scripts/*.sh
rclone config                                # configure your offsite remote once
./scripts/install-backup-cron.sh             # installs daily 03:00 cron
```

**Manual on-demand snapshot:**
```bash
set -a && source .env && set +a
./scripts/backup.sh
```

**Restore from a known-good dump:**
```bash
./scripts/restore.sh \
  backups/postgres-2026-05-02_0300.sql.gz.gpg \
  backups/uploads-2026-05-02_0300.tar.gz.gpg
```

**Full disaster-recovery runbook (rebuild on a fresh VPS in ~30 min):** see
[`docs/disaster-recovery.md`](docs/disaster-recovery.md). Practice it once
a quarter on a throwaway VPS — untested backups are no backups.

Configure retention + offsite via the `BACKUP_*` vars in `.env` (see
`.env.example`). The `.env` itself is **not** part of the backup blob —
keep an encrypted copy in a password manager.
