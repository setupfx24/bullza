'use client';

/**
 * Public Risk Management calculator — the SAME calculator as the user
 * dashboard (app/risk-calculator): Margin / Profit-Loss / Lot Size / Swap
 * in a vertical accordion, with the identical currency-aware math
 * (lib/trading/riskMath). Ported standalone for the marketing site — no
 * login, no live prices: a built-in instrument list + manual balance /
 * leverage / entry inputs. Replaces the old "Lot Size & Profit" landing
 * calculator (client request 2026-06-11).
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Info, Search, ChevronDown, X } from 'lucide-react';
import { usdPipValuePerLot, usdMarginPerLot, suggestedLotSize } from '@/lib/trading/riskMath';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';

interface Instr {
  symbol: string;
  display_name: string;
  segment: string;
  digits: number;
  pip_size: number;
  contract_size: number;
  base_currency: string;
  quote_currency: string;
}

// Built-in instrument set (the public site has no live instruments feed).
// pip_size / contract_size match the platform's conventions so the math
// lines up with the in-app calculator.
const INSTRUMENTS: Instr[] = [
  { symbol: 'EURUSD', display_name: 'Euro / US Dollar',     segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'EUR', quote_currency: 'USD' },
  { symbol: 'GBPUSD', display_name: 'Pound / US Dollar',    segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'GBP', quote_currency: 'USD' },
  { symbol: 'AUDUSD', display_name: 'Aussie / US Dollar',   segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'AUD', quote_currency: 'USD' },
  { symbol: 'NZDUSD', display_name: 'Kiwi / US Dollar',     segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'NZD', quote_currency: 'USD' },
  { symbol: 'USDJPY', display_name: 'US Dollar / Yen',      segment: 'Forex',  digits: 3, pip_size: 0.01,   contract_size: 100000, base_currency: 'USD', quote_currency: 'JPY' },
  { symbol: 'USDCHF', display_name: 'US Dollar / Franc',    segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'USD', quote_currency: 'CHF' },
  { symbol: 'USDCAD', display_name: 'US Dollar / Loonie',   segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'USD', quote_currency: 'CAD' },
  { symbol: 'EURJPY', display_name: 'Euro / Yen',           segment: 'Forex',  digits: 3, pip_size: 0.01,   contract_size: 100000, base_currency: 'EUR', quote_currency: 'JPY' },
  { symbol: 'GBPJPY', display_name: 'Pound / Yen',          segment: 'Forex',  digits: 3, pip_size: 0.01,   contract_size: 100000, base_currency: 'GBP', quote_currency: 'JPY' },
  { symbol: 'EURGBP', display_name: 'Euro / Pound',         segment: 'Forex',  digits: 5, pip_size: 0.0001, contract_size: 100000, base_currency: 'EUR', quote_currency: 'GBP' },
  { symbol: 'XAUUSD', display_name: 'Gold / US Dollar',     segment: 'Metals', digits: 2, pip_size: 0.01,   contract_size: 100,    base_currency: 'XAU', quote_currency: 'USD' },
  { symbol: 'XAGUSD', display_name: 'Silver / US Dollar',   segment: 'Metals', digits: 3, pip_size: 0.001,  contract_size: 5000,   base_currency: 'XAG', quote_currency: 'USD' },
  { symbol: 'BTCUSD', display_name: 'Bitcoin / US Dollar',  segment: 'Crypto', digits: 2, pip_size: 0.01,   contract_size: 1,      base_currency: 'BTC', quote_currency: 'USD' },
  { symbol: 'ETHUSD', display_name: 'Ethereum / US Dollar', segment: 'Crypto', digits: 2, pip_size: 0.01,   contract_size: 1,      base_currency: 'ETH', quote_currency: 'USD' },
];

const TABS: { id: CalcTab; label: string; sub: string }[] = [
  { id: 'margin', label: 'Margin Calculator', sub: 'Required margin for a position' },
  { id: 'pnl', label: 'Profit / Loss Calculator', sub: 'Estimate P&L from entry to exit price' },
  { id: 'lotsize', label: 'Lot Size Calculator', sub: 'Lot size from risk amount + SL distance' },
  { id: 'swap', label: 'Swap Calculator', sub: 'Overnight swap fee across the days held' },
];

/* ─── Searchable instrument picker ─── */
function InstrumentPicker({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = INSTRUMENTS.filter((i) =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.display_name.toLowerCase().includes(search.toLowerCase()) ||
    i.segment.toLowerCase().includes(search.toLowerCase()),
  );
  const current = INSTRUMENTS.find((i) => i.symbol === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full flex items-center justify-between rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm font-medium text-text-primary cursor-pointer hover:border-accent/40 transition-colors"
      >
        <span className="truncate">{current ? `${current.symbol} — ${current.display_name}` : 'Select Instrument'}</span>
        <ChevronDown size={14} className={clsx('text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-bg-primary">
            <Search size={14} className="text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instrument..."
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-text-tertiary hover:text-text-primary">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {filtered.length > 0 ? filtered.map((instr) => (
              <button
                key={instr.symbol}
                type="button"
                onClick={() => { onChange(instr.symbol); setOpen(false); setSearch(''); }}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  instr.symbol === value ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-[13px]">{instr.symbol}</span>
                  <span className="text-[10px] text-text-tertiary">{instr.display_name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary text-text-tertiary border border-border-primary">{instr.segment}</span>
              </button>
            )) : (
              <div className="px-3 py-4 text-center text-xs text-text-tertiary">No instruments found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group cursor-help ml-1 inline-flex" title={text}>
      <Info size={13} className="text-text-tertiary group-hover:text-accent transition-colors" />
    </span>
  );
}

function InputField({
  label, tip, value, onChange, placeholder, suffix, type = 'number',
}: {
  label: string; tip?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; suffix?: string; type?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
      <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
        {label}{tip && <Tip text={tip} />}
      </label>
      <div className="flex-1 flex items-center rounded-lg border border-border-primary bg-bg-primary overflow-hidden">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm font-mono text-text-primary outline-none w-0 min-w-0 placeholder:text-text-tertiary"
        />
        {suffix && <span className="pr-3 text-[11px] font-semibold text-text-tertiary shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectField({
  label, tip, value, onChange, options,
}: {
  label: string; tip?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
      <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
        {label}{tip && <Tip text={tip} />}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none appearance-none cursor-pointer font-medium"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ResultPanel({ label, value, details }: { label: string; value: string; details?: { l: string; v: string }[] }) {
  return (
    <div
      className="flex flex-col items-center justify-center p-6 sm:p-8 min-h-[220px] w-full"
      style={{
        borderRadius: 'var(--mk-radius-lg)',
        border: '1px solid var(--mk-accent-line)',
        background: 'var(--mk-accent-soft)',
      }}
    >
      <span
        className="mb-2 font-semibold"
        style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
      >
        {label}
      </span>
      <span
        className="font-black"
        style={{ fontSize: 'var(--mk-text-h2)', fontFamily: 'var(--mk-font-mono)', color: 'var(--mk-accent)', lineHeight: 1.1 }}
      >
        {value}
      </span>
      {details && details.length > 0 && (
        <div className="mt-4 w-full space-y-1.5 max-w-[260px]">
          {details.map((d) => (
            <div key={d.l} className="flex items-center justify-between" style={{ fontSize: 'var(--mk-text-xs)' }}>
              <span style={{ color: 'var(--mk-text-faint)' }}>{d.l}</span>
              <span className="font-semibold" style={{ fontFamily: 'var(--mk-font-mono)', color: 'var(--mk-text-muted)' }}>{d.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalculatorPage() {
  const [tab, setTab] = useState<CalcTab | null>('margin');

  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');
  const [balanceStr, setBalanceStr] = useState('10000');
  const [leverageStr, setLeverageStr] = useState('100');

  const inst = INSTRUMENTS.find((i) => i.symbol === symbol) ?? INSTRUMENTS[0];
  const digits = inst.digits;
  const pipSize = inst.pip_size;
  const contractSize = inst.contract_size;
  const baseCcy = inst.base_currency;
  const quoteCcy = inst.quote_currency;
  const balance = Math.max(0, parseFloat(balanceStr) || 0);
  const accountLeverage = Math.max(1, parseFloat(leverageStr) || 100);

  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || 0;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    const perLot = usdMarginPerLot(
      { pipSize, contractSize, price: ep, symbol, base: baseCcy, quote: quoteCcy },
      accountLeverage,
    );
    return { margin: perLot * lot, ep, lot, lev: accountLeverage };
  }, [entryPrice, accountLeverage, lots, contractSize, pipSize, symbol, baseCcy, quoteCcy]);

  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = usdPipValuePerLot({ pipSize, contractSize, price: ep, symbol, base: baseCcy, quote: quoteCcy });
    return { pnl: lot * pips * pipVal, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize, symbol, baseCcy, quoteCcy]);

  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || 0;
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slDist = Math.abs(ep - sl);
    const slPips = slDist / pipSize;
    if (slPips <= 0) return null;
    const pipVal = usdPipValuePerLot({ pipSize, contractSize, price: ep, symbol, base: baseCcy, quote: quoteCcy });
    const lotSize = suggestedLotSize(
      { pipSize, contractSize, price: ep, symbol, base: baseCcy, quote: quoteCcy },
      riskAmt, slDist,
    );
    return { lotSize: Math.max(0.01, parseFloat(lotSize.toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, pipSize, contractSize, symbol, baseCcy, quoteCcy]);

  const swapResult = useMemo(() => {
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    const px = parseFloat(entryPrice) || 1;
    if (!lot) return null;
    const pipVal = usdPipValuePerLot({ pipSize, contractSize, price: px, symbol, base: baseCcy, quote: quoteCcy });
    const dailySwap = lot * 0.5 * pipVal;
    return { dailySwap, totalSwap: dailySwap * days, days };
  }, [lots, daysHeld, entryPrice, pipSize, contractSize, symbol, baseCcy, quoteCcy]);

  return (
    <main>
      <PageHero
        kicker="Risk Management"
        title="Trading Calculators"
        lead={`Margin, profit/loss, lot size and swap — the same calculators you get inside your ${BRAND_NAME} account. Enter your numbers to plan a trade.`}
      />

      <Section raised>
        <div className="mx-auto max-w-[1100px] space-y-3">
        {TABS.map((t) => {
          const open = tab === t.id;
          return (
            <div
              key={t.id}
              className="overflow-hidden"
              style={{
                borderRadius: 'var(--mk-radius-lg)',
                border: `1px solid ${open ? 'var(--mk-accent-line)' : 'var(--mk-line)'}`,
                background: 'var(--mk-surface)',
                transition: 'border-color var(--mk-transition)',
              }}
            >
              <button
                type="button"
                onClick={() => setTab(open ? null : t.id)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="text-left min-w-0">
                  <p className="font-bold truncate" style={{ fontSize: 'var(--mk-text-body)', color: 'var(--mk-text)' }}>{t.label}</p>
                  <p className="mt-0.5 truncate" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>{t.sub}</p>
                </div>
                <ChevronDown
                  size={18}
                  className={clsx('shrink-0 ml-3 transition-transform', open && 'rotate-180')}
                  style={{ color: open ? 'var(--mk-accent)' : 'var(--mk-text-faint)' }}
                />
              </button>

              {open && (
                <div style={{ borderTop: '1px solid var(--mk-line)' }}>
                  <div className="grid grid-cols-1 lg:grid-cols-5">
                    {/* LEFT — Form */}
                    <div
                      className="lg:col-span-3 p-5 sm:p-6 space-y-4"
                      style={{ borderBottom: '1px solid var(--mk-line)' }}
                    >
                      {(tab === 'margin' || tab === 'pnl') && (
                        <SelectField
                          label="Direction" tip="Buy or Sell" value={side} onChange={setSide}
                          options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
                        />
                      )}

                      {tab === 'lotsize' && (
                        <InputField label="Account Balance" tip="Your trading account balance (USD)" value={balanceStr} onChange={setBalanceStr} placeholder="10000" suffix="$" />
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                        <label className="text-[13px] font-medium text-text-secondary whitespace-nowrap sm:w-[180px] shrink-0 flex items-center">
                          Instrument<Tip text="Search and select a trading instrument" />
                        </label>
                        <div className="flex-1"><InstrumentPicker value={symbol} onChange={setSymbol} /></div>
                      </div>

                      <InputField label="Entry Price" tip="Enter your entry price" value={entryPrice} onChange={setEntryPrice} placeholder="Enter Entry Price" />

                      {tab === 'pnl' && (
                        <InputField label="Exit Price" tip="Enter your exit / take profit price" value={exitPrice} onChange={setExitPrice} placeholder="Enter Exit Price" />
                      )}

                      {tab === 'margin' && (
                        <>
                          <InputField label="Leverage" tip="Account leverage ratio (e.g. 100 for 1:100)" value={leverageStr} onChange={setLeverageStr} placeholder="100" suffix=":1" />
                          <InputField label="Lot Size" tip="Position size in lots" value={lots} onChange={setLots} placeholder="Enter Size" />
                        </>
                      )}

                      {tab === 'pnl' && (
                        <InputField label="Lot Size" tip="Position size in lots" value={lots} onChange={setLots} placeholder="Enter Size" />
                      )}

                      {tab === 'lotsize' && (
                        <>
                          <InputField label="Risk %" tip="Percentage of balance to risk" value={riskPercent} onChange={setRiskPercent} placeholder="1" suffix="%" />
                          <InputField label="Stop Loss Price" tip="Your stop loss level" value={stopLoss} onChange={setStopLoss} placeholder="Enter SL price" />
                        </>
                      )}

                      {tab === 'swap' && (
                        <>
                          <InputField label="Lot Size" tip="Position size in lots" value={lots} onChange={setLots} placeholder="Enter Size" />
                          <InputField label="Days Held" tip="Number of days position is open" value={daysHeld} onChange={setDaysHeld} placeholder="1" suffix="days" />
                        </>
                      )}
                    </div>

                    {/* RIGHT — Result */}
                    <div className="lg:col-span-2 flex items-stretch">
                      <div className="flex-1 flex items-center justify-center p-5 sm:p-6">
                        {tab === 'margin' && (marginResult ? (
                          <ResultPanel label="Required Margin" value={`$${marginResult.margin.toFixed(2)}`} details={[
                            { l: 'Lots', v: marginResult.lot.toFixed(2) },
                            { l: 'Leverage', v: `1:${marginResult.lev}` },
                            { l: 'Price', v: marginResult.ep.toFixed(digits) },
                            { l: 'Contract Size', v: contractSize.toLocaleString() },
                          ]} />
                        ) : <ResultPanel label="Result" value="$0.00" />)}

                        {tab === 'pnl' && (pnlResult ? (
                          <ResultPanel label={pnlResult.pnl >= 0 ? 'Profit' : 'Loss'} value={`${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}`} details={[
                            { l: 'Pips', v: pnlResult.pips.toFixed(1) },
                            { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
                            { l: 'Direction', v: side.toUpperCase() },
                          ]} />
                        ) : <ResultPanel label="Result" value="$0.00" />)}

                        {tab === 'lotsize' && (lotResult ? (
                          <ResultPanel label="Recommended Lot Size" value={lotResult.lotSize.toFixed(2)} details={[
                            { l: 'Risk Amount', v: `$${lotResult.riskAmt.toFixed(2)}` },
                            { l: 'SL Distance', v: `${lotResult.slPips.toFixed(1)} pips` },
                            { l: 'Pip Value/Lot', v: `$${lotResult.pipVal.toFixed(4)}` },
                          ]} />
                        ) : <ResultPanel label="Result" value="0.00" />)}

                        {tab === 'swap' && (swapResult ? (
                          <ResultPanel label="Estimated Swap" value={`$${swapResult.totalSwap.toFixed(2)}`} details={[
                            { l: 'Daily Swap', v: `$${swapResult.dailySwap.toFixed(4)}` },
                            { l: 'Days', v: String(swapResult.days) },
                            { l: 'Lots', v: lots },
                          ]} />
                        ) : <ResultPanel label="Result" value="$0.00" />)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>

        <p
          className="mt-8 mx-auto max-w-2xl text-center"
          style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)', lineHeight: 'var(--mk-leading-body)' }}
        >
          Results are approximate. Actual values vary with market conditions, the live spread,
          your account currency, and the instrument&apos;s contract specs.
        </p>
      </Section>

      <CtaBanner
        title="Plan the trade, then place it"
        lead={`Open a ${BRAND_NAME} account and use the same calculators inside the platform.`}
        primary={{ label: 'Start Trading', href: '/auth/register' }}
        secondary={{ label: 'Compare Account Types', href: '/account-types' }}
      />
    </main>
  );
}
