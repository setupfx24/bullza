# Spread & Charges Setup — Reference Sheet

> Industry-standard reference values for broker spread, commission, and swap
> configuration. Use as a starting point — undercut competition selectively
> or widen on illiquid instruments.

## 1. What each field means

| Field | What it is | Where in admin |
|---|---|---|
| **Spread markup** | Extra pips/points added to the raw market spread your liquidity provider quotes. This is how the broker earns on every trade in a "spread model" account. | `/admin/config/spreads` |
| **Commission per lot** | Flat fee charged per round-turn lot (open + close = 1 round-turn). Used in ECN/VIP accounts where the spread is near-zero but the broker earns a fixed commission. | `/admin/config/charges` |
| **Swap (rollover)** | Overnight financing charge (or credit) when a position is held past 5pm NY time. Long swap = paid for long positions, Short swap = paid for short. Triple swap typically Wednesday night (covers weekend). | `/admin/config/swaps` |

## 2. Account-type model recommendations

| Account type | Spread approach | Commission |
|---|---|---|
| **Standard** | Wider spread, no commission | $0 |
| **ECN** | Near raw-market spread (0.0–0.5 pips on majors) | $5–7 per round-turn lot |
| **VIP** | Tightest possible (~0.0–0.3 pips on majors) | $3–5 per round-turn lot |

The wider Standard spread already includes the broker's edge — that's why no extra commission.

## 3. Per-instrument typical values (industry reference)

### Forex Majors
| Pair | Standard | ECN | VIP |
|---|---|---|---|
| EURUSD | 1.5 pips | 0.3 | 0.1 |
| GBPUSD | 2.0 | 0.5 | 0.2 |
| USDJPY | 1.5 | 0.3 | 0.1 |
| AUDUSD | 1.8 | 0.5 | 0.2 |

### Metals
| Symbol | Standard | ECN | VIP |
|---|---|---|---|
| XAUUSD (Gold) | 35 pips | 18 | 10 |
| XAGUSD (Silver) | 25 | 12 | 8 |

### Indices
| Symbol | Standard | ECN | VIP |
|---|---|---|---|
| US30 (Dow) | 3.0 pts | 1.5 | 1.0 |
| US500 (S&P) | 0.5 | 0.25 | 0.15 |
| USTEC (Nasdaq) | 1.5 | 0.8 | 0.4 |
| GER40 (DAX) | 1.5 | 0.8 | 0.5 |

### Commodities
| Symbol | Standard | ECN | VIP |
|---|---|---|---|
| USOIL (WTI) | 4¢ | 2¢ | 1.5¢ |
| UKOIL (Brent) | 5¢ | 3¢ | 2¢ |

### Crypto
| Symbol | Standard | ECN | VIP |
|---|---|---|---|
| BTCUSD | $40 | $25 | $15 |
| ETHUSD | $4 | $2.50 | $1.50 |

Full table with swap values is in [`spread_and_charges_reference.csv`](./spread_and_charges_reference.csv) — open in Excel/Sheets.

## 4. Swap rules of thumb

- **Long swap negative** (broker charges) when funding currency rate is HIGHER than the asset's currency rate. e.g. holding long EURUSD → pay swap (EUR rate < USD rate as of 2026).
- **Short swap negative** when the opposite is true.
- **Triple swap day**: most brokers charge 3x swap on Wednesday night to cover the Saturday + Sunday rollover. Some on Friday.
- For metals & crypto — usually both long and short have negative swap (cost of holding).

## 5. Quick admin setup checklist

For a brand-new platform, set ECN as the default account type and use these starting values:

1. Open `/admin/config/spreads`
2. For each instrument segment (Forex, Metals, Indices, Commodities, Crypto), enter the **ECN** column values from the table above.
3. Open `/admin/config/charges`, set **$7 per round-turn lot** for forex/metals on ECN. **$0** for Standard.
4. Open `/admin/config/swaps`, populate per-instrument long/short swap values from the CSV.
5. Test: place a 0.01 lot trade on EURUSD from a Standard account — open spread should be visible (~1.5 pips). Close it overnight to see swap charge in /transactions.

## 6. Tuning over time

- **Tight pricing on majors** wins traders — EURUSD/Gold are flagship pairs. Don't be too greedy here.
- **Wider on exotics + crypto** is fine; clients expect it. 80–150 pips on USDTRY is normal.
- **Re-check competitors monthly** — Exness/IC Markets/FxPro publish their live spreads on their websites. Aim within 0.2 pips of them on Standard, tighter on ECN/VIP.
- **Watch your B-book P&L** in `/admin/book-management` — if you're losing on a pair, that means clients are systematically profitable there, consider widening the spread by 20–30% on that instrument.

---

*Sheet last reviewed: May 2026. Source: average across 5 major retail brokers
(Exness / IC Markets / Pepperstone / FxPro / RoboForex).*
