#!/usr/bin/env bash
# SwisDex production deploy — the ONLY blessed deploy path.
#
# Pulls main, rebuilds images with the prod compose overlay, and brings
# everything up bound on 127.0.0.1:<prod-port>. nginx upstreams in
# /etc/nginx/sites-enabled/swisdex.conf must match the prod port table
# printed below.
#
# Refuses to run if docker-compose.prod.yml is missing — that prevents
# silently falling back to the dev compose (which binds different ports
# on 0.0.0.0 and runs uvicorn --reload), the regression that caused the
# 2026-05-12 outage.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Guard: prod overlay must exist. No silent dev-compose fallback.
[[ -f docker-compose.yml      ]] || { echo "FATAL: docker-compose.yml not found in $REPO_ROOT"; exit 1; }
[[ -f docker-compose.prod.yml ]] || { echo "FATAL: docker-compose.prod.yml missing — refusing to deploy"; exit 1; }

PULL=1
BUILD=1
MIGRATE=1
SERVICES=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull)    PULL=0;    shift ;;
    --no-build)   BUILD=0;   shift ;;
    --no-migrate) MIGRATE=0; shift ;;
    --service)    SERVICES+=("$2"); shift 2 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--no-pull] [--no-build] [--no-migrate] [--service <name> [--service <name> ...]]

  --no-pull        Skip 'git pull origin main'
  --no-build       Skip docker compose build (use existing images)
  --no-migrate     Skip Alembic upgrade head. Only use when you know
                   the DB is already on the right revision — leaving
                   migrations un-applied is the #1 cause of post-deploy
                   502s (gateway crashes on first query against a
                   missing column).
  --service <n>    Limit the BUILD step to specific service(s); the up
                   step always brings the full stack up. Repeatable.

Examples:
  $0                                    # full deploy (rebuild + migrate + up everything)
  $0 --service trader-frontend          # rebuild just trader-frontend, up the full stack
  $0 --no-build --service gateway       # skip build entirely (--service is a no-op here)
  $0 --no-migrate                       # rebuild + up, skip Alembic
EOF
      exit 0 ;;
    *) echo "Unknown arg: $1 (try --help)"; exit 2 ;;
  esac
done

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "==> SwisDex prod deploy"
echo "    Repo:    $REPO_ROOT"
echo "    Compose: docker-compose.yml + docker-compose.prod.yml"
echo
echo "    Prod port bindings (must match nginx upstreams):"
echo "      127.0.0.1:8002  → gateway:8000          (REST + WS)"
echo "      127.0.0.1:8003  → admin-api:8001"
echo "      127.0.0.1:3012  → trader-frontend:3000"
echo "      127.0.0.1:3013  → admin-frontend:3001"
echo

if [[ $PULL -eq 1 ]]; then
  echo "==> git pull --ff-only origin main"
  git pull --ff-only origin main
fi

if [[ $BUILD -eq 1 ]]; then
  export APP_VERSION="${APP_VERSION:-$(date +%Y%m%d-%H%M%S)}"
  echo "==> docker compose build  (APP_VERSION=$APP_VERSION)"
  if [[ ${#SERVICES[@]} -gt 0 ]]; then
    "${COMPOSE[@]}" build --no-cache "${SERVICES[@]}"
  else
    "${COMPOSE[@]}" build --no-cache
  fi
fi

# Run pending migrations BEFORE bringing the stack up. The migrate
# service is profile-gated (won't auto-start with normal up), so we
# invoke it explicitly. --exit-code-from migrate makes the run blocking
# and propagates the alembic exit code — if a migration fails, we abort
# the deploy instead of letting the gateway start against a stale DB
# and crash-loop with 'column does not exist'. The 2026-05-21 outage
# (502 for ~2 hours after 0045/0046 shipped without migrate) is the
# regression this prevents.
if [[ $MIGRATE -eq 1 ]]; then
  echo "==> docker compose --profile migrate up migrate  (Alembic upgrade head)"
  "${COMPOSE[@]}" --profile migrate up --exit-code-from migrate migrate
  # Clean up the one-shot container so it doesn't show in `ps` output.
  "${COMPOSE[@]}" --profile migrate rm -f migrate >/dev/null 2>&1 || true
fi

# `up -d` always runs over the FULL stack — even when --service narrowed
# the build. Otherwise, if the operator had done `docker compose down`
# before invoking this script with --service X, only X would come back
# up and admin-frontend / admin-api / engines would stay down (the
# 2026-05-14 admin.swisdex.com outage). Compose is idempotent here:
# already-running containers with unchanged image/config are not touched,
# so this is safe to run regardless of prior state.
echo "==> docker compose up -d  (full stack — --service only scopes build)"
"${COMPOSE[@]}" up -d

echo
echo "==> Service state (verify 127.0.0.1:30{12,13} / 127.0.0.1:80{02,03} appear in PORTS):"
"${COMPOSE[@]}" ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"

echo
echo "==> Done. If any service shows 0.0.0.0:3010 or 0.0.0.0:8000 in PORTS,"
echo "    the prod overlay didn't apply — DO NOT trust the deploy. Run:"
echo "      ${COMPOSE[*]} down && $0"
