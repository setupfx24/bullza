#!/usr/bin/env bash
# AI Station end-to-end smoke test. Run against a RUNNING stack.
#
# Usage:
#   ADMIN_COOKIE="admin_access=<jwt>" \
#   GATEWAY=http://127.0.0.1:8002 ADMIN=http://127.0.0.1:8003 \
#   ./scripts/ai-station-smoketest.sh
#
# Prereqs:
#   * migration 0098 applied (deploy.sh / `docker compose --profile migrate up migrate`)
#   * at least one ACTIVE fixed_return lock exists (so fan-out has a target)
#   * market-data feeding EURUSD (so the live tick exists)
#   * a super-admin cookie in ADMIN_COOKIE (copy from the admin browser session)
set -euo pipefail

GATEWAY="${GATEWAY:-http://127.0.0.1:8002}"
ADMIN="${ADMIN:-http://127.0.0.1:8003}"
ADMIN_COOKIE="${ADMIN_COOKIE:?set ADMIN_COOKIE=admin_access=<jwt>}"
SYMBOL="${SYMBOL:-EURUSD}"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
A() { curl -sS -H "Cookie: $ADMIN_COOKIE" "$@"; }

say "1) Configure: enable + set slabs + generate secret"
A -X PUT "$ADMIN/api/v1/admin/ai-station/config" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true,"regenerate_secret":true,
       "webhook_base":"'"$GATEWAY"'",
       "slabs":[{"min":1000,"max":5000,"lots":0.02},
                {"min":5000,"max":10000,"lots":0.05},
                {"min":10000,"max":null,"lots":0.10}]}'
echo

say "2) Read config back (grab webhook_url)"
CFG=$(A "$ADMIN/api/v1/admin/ai-station/config")
echo "$CFG"
SECRET=$(echo "$CFG" | sed -n 's/.*"webhook_secret":"\([^"]*\)".*/\1/p')
echo "secret=$SECRET"

say "3) TradingView webhook: OPEN a buy on $SYMBOL"
curl -sS -X POST "$GATEWAY/api/v1/webhooks/tradingview/$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"action":"buy","symbol":"'"$SYMBOL"'","id":"smoke-open-1"}'
echo

say "4) Admin: manual OPEN a sell on $SYMBOL (current price)"
A -X POST "$ADMIN/api/v1/admin/ai-station/open" \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"'"$SYMBOL"'","side":"sell","note":"smoketest manual"}'
echo

say "5) Admin: list signals"
A "$ADMIN/api/v1/admin/ai-station/signals?limit=5"
echo

say "6) Admin: list trades (fan-out copies)"
A "$ADMIN/api/v1/admin/ai-station/trades?limit=10"
echo

say "7) Admin: P&L summary (\$ + %)"
A "$ADMIN/api/v1/admin/ai-station/summary"
echo

say "8) TradingView webhook: CLOSE all open $SYMBOL signals"
curl -sS -X POST "$GATEWAY/api/v1/webhooks/tradingview/$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"action":"close","symbol":"'"$SYMBOL"'"}'
echo

say "9) Trader endpoint needs a USER cookie — verify manually:"
echo "   curl -H 'Cookie: pt_access=<jwt>' $GATEWAY/api/v1/ai-station/my-trades"

say "DONE — check that fan-out counts, P&L, and open->closed transitions look right."
