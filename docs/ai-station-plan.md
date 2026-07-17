# AI Station — TradingView / Admin display-only trades on AI-Powered Staking

**Status:** in progress. **Owner:** vibhooti. **Started:** 2026-07-17.

## Goal (as agreed)

Show, per AI-Powered Staking lock, the trades an admin/TradingView ran on the
pooled AI capital — **display only**. The existing `fixed_return` guaranteed
payout logic is **NOT changed**. This feature **never touches user balances,
margin, or the real trading engine**. If it were removed tomorrow the old
system would be byte-for-byte identical.

### Confirmed decisions
- **Money model:** display-only. Guaranteed % stays the real payout. Trade P&L
  is shown, never credited/debited.
- **Trades are real-priced but not real positions:** entry/exit come from the
  live tick (honest prices), but no `Position`/margin/liquidation is created —
  this is what lets an admin freely edit any trade (open or closed).
- **Two trade sources:** TradingView webhook (`source='tradingview'`) and admin
  manual open at current price (`source='admin'`). Both fan out identically.
- **Fan-out sizing:** admin **slabs** — principal range → display lot size,
  stored in `system_settings` key `ai_station_slabs`.
- **Admin can:** open (manual), edit (open + closed: entry/exit/lots/SL/TP/PnL),
  close any trade, see `%` and `$` monthly PnL.
- **User side:** strictly read-only Portfolio view.

## Data model (migration 0098)

- `ai_station_signals` — one master trade (source, symbol, side, entry, SL, TP,
  close, status open/closed, fanout_count, external_id for TV dedup, raw JSON).
- `ai_station_trades` — per-lock display copy (signal_id, lock_id, user_id,
  symbol, side, lots [from slab], entry, close, SL, TP, pnl, status, is_edited).

Models: `backend/packages/common/src/models/ai_station.py` (one-directional
relationships — old models untouched).

## system_settings keys
- `ai_station_enabled` (bool)
- `ai_station_webhook_secret` (string; TradingView shared secret in the URL)
- `ai_station_slabs` (JSON array: `[{"min":1000,"max":5000,"lots":0.02}, ...]`,
  `max: null` = unbounded top slab)

## Backend surfaces
- Gateway service `services/ai_station_service.py` — pure slab lookup + display
  PnL calc + fan-out (open signal → row per active lock) + close.
- Gateway router `api/tradingview.py` — `POST /webhooks/tradingview/{secret}`
  (HMAC/secret verify + idempotency via external_id).
- Gateway router `api/ai_station.py` — trader **read-only** `GET /my-trades`.
- Admin routes `routes/ai_station.py` + `services/ai_station_service.py` —
  config, slabs, manual open, list/edit/close trades, `%`/`$` PnL summary.
  RBAC `require_permission("ai_station.manage")`.

## Frontend surfaces
- Admin `frontend/admin/src/app/(admin)/ai-station/*` — Connection, Slabs,
  Manual open, Trades (edit/close), PnL summary. Sidebar entry.
- Trader — new read-only **Portfolio** section on the AI-Powered Staking page:
  per-lock today's trades, open + closed, each PnL, total monthly PnL.

## Build order
1. ✅ Models + migration 0098 + registry.
2. Gateway fan-out service + TradingView webhook.
3. Admin routes/services (config, slabs, manual open, edit/close, PnL summary).
4. Trader read-only portfolio endpoint.
5. Admin frontend pages.
6. Trader Portfolio section.

## Testing note
Dev machine has no Docker/DB. Pure logic (slab lookup, PnL) is unit-tested
locally; full API testing runs against the docker/prod stack via a prepared
curl script (`scripts/ai-station-smoketest.sh`, TBD).
