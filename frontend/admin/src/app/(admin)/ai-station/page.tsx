'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Loader2, Save, Plus, Trash2, RefreshCw, Copy, X, Pencil, Radio, TrendingUp, Eye, EyeOff,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ── types ─────────────────────────────────────────────────────────────────
interface Slab { min: number; max: number | null; lots: number }
interface Config {
  enabled: boolean;
  terminal_enabled: boolean;
  has_secret: boolean;
  webhook_secret: string;
  webhook_path: string | null;
  webhook_base: string;
  webhook_url: string | null;
  slabs: Slab[];
}
interface Follower {
  user_id: string; email: string | null; name: string | null;
  principal: number; locks: number; trades: number; open_trades: number; realized_pnl: number;
}
interface Summary {
  active_principal: number;
  open_count: number; closed_count: number;
  open_pnl: number; realized_pnl_month: number; realized_pnl_total: number;
  monthly_pnl: number; total_pnl: number;
  monthly_pnl_pct: number; total_pnl_pct: number;
}
interface Trade {
  id: string; signal_id: string; user_id: string; user_email?: string; user_name?: string;
  symbol: string; side: string; lots: number;
  entry_price: number; close_price: number | null;
  stop_loss: number | null; take_profit: number | null;
  pnl: number | null; status: string; is_edited: boolean;
  opened_at: string; closed_at: string | null;
  contract_size?: number;
}
interface Signal {
  id: string; source: string; symbol: string; side: string;
  entry_price: number; close_price: number | null; status: string;
  fanout_count: number; note: string | null; opened_at: string; closed_at: string | null;
}

type Tab = 'overview' | 'trades' | 'signals' | 'followers' | 'connection';

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const pnlCls = (n: number | null | undefined) =>
  (n ?? 0) > 0 ? 'text-buy' : (n ?? 0) < 0 ? 'text-sell' : 'text-text-secondary';
const sideCls = (s: string) => (s === 'buy' ? 'text-buy' : 'text-sell');
const dt = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

// Ready-to-copy TradingView alert messages for ONE instrument. Each trade uses a
// UNIQUE `id` (symbol-scoped) so a close alert with the same id closes exactly
// that trade. `sl`/`tp` are examples — replace with your own price levels.
function buildTemplates(symbol: string): { title: string; desc: string; json: Record<string, unknown> }[] {
  const sym = (symbol || 'EURUSD').toUpperCase();
  const tag = sym.toLowerCase();
  return [
    { title: 'Open BUY', desc: 'New buy trade — unique id', json: { action: 'buy', symbol: sym, id: `${tag}-1` } },
    { title: 'Open SELL', desc: 'New sell trade — unique id', json: { action: 'sell', symbol: sym, id: `${tag}-2` } },
    { title: 'Open with SL / TP', desc: 'Replace sl/tp with your prices', json: { action: 'buy', symbol: sym, sl: 0, tp: 0, id: `${tag}-3` } },
    { title: 'Close THIS trade', desc: `Closes only ${tag}-1`, json: { action: 'close', id: `${tag}-1` } },
    { title: `Close ALL ${sym}`, desc: 'Closes every open trade on this symbol', json: { action: 'close', symbol: sym } },
  ];
}

export default function AiStationPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [editing, setEditing] = useState<Trade | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, t, sig, f] = await Promise.all([
        adminApi.get<Config>('/ai-station/config'),
        adminApi.get<Summary>('/ai-station/summary'),
        adminApi.get<Trade[]>('/ai-station/trades?limit=200'),
        adminApi.get<Signal[]>('/ai-station/signals?limit=100'),
        adminApi.get<Follower[]>('/ai-station/followers'),
      ]);
      setCfg(c); setSummary(s); setTrades(t || []); setSignals(sig || []); setFollowers(f || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load AI Station');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading || !cfg || !summary) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-text-tertiary" /></div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Radio size={18} className="text-buy" /> AI Station
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            TradingView / manual trades mirrored onto AI-Powered Staking locks —{' '}
            <span className="text-text-secondary">display only</span>. Never touches user balances or the guaranteed return.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xxs px-2 py-1 rounded ${cfg.enabled ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell'}`}>
            {cfg.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <button onClick={loadAll} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-text-secondary border border-border-primary rounded hover:bg-bg-hover">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-border-primary">
        {([['overview', 'Overview'], ['trades', 'Trades'], ['signals', 'Signals'], ['followers', `Followers (${followers.length})`], ['connection', 'Connection & Slabs']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 text-xs font-medium -mb-px border-b-2 ${tab === k ? 'border-buy text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview summary={summary} onOpened={loadAll} />}
      {tab === 'trades' && <TradesTable trades={trades} onEdit={setEditing} reload={loadAll} />}
      {tab === 'signals' && <SignalsTable signals={signals} reload={loadAll} />}
      {tab === 'followers' && <FollowersTable followers={followers} reload={loadAll} />}
      {tab === 'connection' && <Connection cfg={cfg} setCfg={setCfg} reload={loadAll} />}

      {editing && <EditTradeModal trade={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadAll(); }} />}
    </div>
  );
}

// ── Overview: PnL cards + manual open ──────────────────────────────────────
function Overview({ summary, onOpened }: { summary: Summary; onOpened: () => void }) {
  const [f, setF] = useState({ symbol: '', side: 'buy', price: '', stop_loss: '', take_profit: '', note: '' });
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!f.symbol.trim()) { toast.error('Symbol required'); return; }
    setBusy(true);
    try {
      const body: any = { symbol: f.symbol.trim().toUpperCase(), side: f.side, note: f.note || undefined };
      if (f.price) body.price = parseFloat(f.price);
      if (f.stop_loss) body.stop_loss = parseFloat(f.stop_loss);
      if (f.take_profit) body.take_profit = parseFloat(f.take_profit);
      const r = await adminApi.post<{ fanout_count: number }>('/ai-station/open', body);
      toast.success(`Opened — fanned out to ${r.fanout_count} lock(s)`);
      setF({ ...f, price: '', stop_loss: '', take_profit: '', note: '' });
      onOpened();
    } catch (e: any) {
      toast.error(e?.message || 'Open failed');
    } finally { setBusy(false); }
  };

  const Card = ({ label, val, pct, big }: { label: string; val: number; pct?: number; big?: boolean }) => (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
      <div className="text-xxs text-text-tertiary uppercase tracking-wide">{label}</div>
      <div className={`${big ? 'text-2xl' : 'text-lg'} font-semibold tabular-nums mt-1 ${pnlCls(val)}`}>
        {val >= 0 ? '+' : ''}${fmt(val)}
      </div>
      {pct !== undefined && <div className={`text-xs tabular-nums ${pnlCls(pct)}`}>{pct >= 0 ? '+' : ''}{fmt(pct)}%</div>}
    </div>
  );

  const inputCls = 'w-full px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded text-text-primary';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Monthly P&L" val={summary.monthly_pnl} pct={summary.monthly_pnl_pct} big />
        <Card label="Total P&L" val={summary.total_pnl} pct={summary.total_pnl_pct} big />
        <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
          <div className="text-xxs text-text-tertiary uppercase tracking-wide">Open / Closed</div>
          <div className="text-lg font-semibold tabular-nums mt-1 text-text-primary">{summary.open_count} / {summary.closed_count}</div>
          <div className="text-xs text-text-tertiary">open P&L {summary.open_pnl >= 0 ? '+' : ''}${fmt(summary.open_pnl)}</div>
        </div>
        <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
          <div className="text-xxs text-text-tertiary uppercase tracking-wide">Active Principal</div>
          <div className="text-lg font-semibold tabular-nums mt-1 text-text-primary">${fmt(summary.active_principal)}</div>
          <div className="text-xs text-text-tertiary">% is P&L ÷ this</div>
        </div>
      </div>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-3 max-w-2xl">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2"><TrendingUp size={15} /> Open a trade manually (fans out to all active locks)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-xs text-text-secondary block mb-1">Symbol</label>
            <input className={inputCls} placeholder="EURUSD" value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} /></div>
          <div><label className="text-xs text-text-secondary block mb-1">Side</label>
            <select className={inputCls} value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}>
              <option value="buy">Buy</option><option value="sell">Sell</option></select></div>
          <div><label className="text-xs text-text-secondary block mb-1">Price <span className="text-text-tertiary">(blank = live)</span></label>
            <input className={inputCls} placeholder="live tick" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div><label className="text-xs text-text-secondary block mb-1">Note</label>
            <input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <div><label className="text-xs text-text-secondary block mb-1">Stop Loss</label>
            <input className={inputCls} value={f.stop_loss} onChange={(e) => setF({ ...f, stop_loss: e.target.value })} /></div>
          <div><label className="text-xs text-text-secondary block mb-1">Take Profit</label>
            <input className={inputCls} value={f.take_profit} onChange={(e) => setF({ ...f, take_profit: e.target.value })} /></div>
        </div>
        <button onClick={open} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Open & fan out
        </button>
      </section>
    </div>
  );
}

// ── Trades table ───────────────────────────────────────────────────────────
function TradesTable({ trades, onEdit, reload }: { trades: Trade[]; onEdit: (t: Trade) => void; reload: () => void }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const rows = useMemo(() => trades.filter((t) => filter === 'all' || t.status === filter), [trades, filter]);

  const closeTrade = async (t: Trade) => {
    if (!confirm(`Close ${t.user_email || 'this user'}'s ${t.symbol} ${t.side.toUpperCase()} trade at the current price?`)) return;
    try { await adminApi.post(`/ai-station/trades/${t.id}/close`, {}); toast.success('Trade closed'); reload(); }
    catch (e: any) { toast.error(e?.message || 'Close failed'); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['all', 'open', 'closed'] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-2 py-1 text-xxs rounded ${filter === k ? 'bg-buy/15 text-buy' : 'text-text-tertiary hover:text-text-secondary'}`}>{k}</button>
        ))}
        <span className="text-xxs text-text-tertiary ml-auto self-center">{rows.length} trades</span>
      </div>
      <div className="overflow-x-auto border border-border-primary rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-bg-secondary text-text-tertiary">
            <tr className="text-left">
              {['User', 'Symbol', 'Side', 'Lots', 'Entry', 'Close', 'P&L', 'Status', 'Opened', ''].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border-primary hover:bg-bg-hover">
                <td className="px-2 py-1.5 text-text-secondary">{t.user_email || t.user_id.slice(0, 8)}</td>
                <td className="px-2 py-1.5 font-medium text-text-primary">{t.symbol}</td>
                <td className={`px-2 py-1.5 uppercase ${sideCls(t.side)}`}>{t.side}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmt(t.lots, 2)}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmt(t.entry_price, 5)}</td>
                <td className="px-2 py-1.5 tabular-nums">{t.close_price === null ? '—' : fmt(t.close_price, 5)}</td>
                <td className={`px-2 py-1.5 tabular-nums ${pnlCls(t.pnl)}`}>{t.pnl === null ? '—' : `${t.pnl >= 0 ? '+' : ''}$${fmt(t.pnl)}`}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.status === 'open' ? 'bg-buy/15 text-buy' : 'bg-bg-input text-text-tertiary'}`}>{t.status}</span>
                  {t.is_edited && <span className="ml-1 text-[9px] text-amber-500">edited</span>}
                </td>
                <td className="px-2 py-1.5 text-text-tertiary whitespace-nowrap">{dt(t.opened_at)}</td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(t)} className="p-1 text-text-tertiary hover:text-text-primary" title="Edit"><Pencil size={13} /></button>
                    {t.status === 'open' && <button onClick={() => closeTrade(t)} className="p-1 text-sell hover:opacity-70" title="Close this trade"><X size={13} /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="px-2 py-8 text-center text-text-tertiary">No trades yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Signals table ──────────────────────────────────────────────────────────
function SignalsTable({ signals, reload }: { signals: Signal[]; reload: () => void }) {
  const close = async (s: Signal) => {
    if (!confirm(`Close signal ${s.symbol} (${s.side})?`)) return;
    try { await adminApi.post(`/ai-station/signals/${s.id}/close`, {}); toast.success('Closed'); reload(); }
    catch (e: any) { toast.error(e?.message || 'Close failed'); }
  };
  return (
    <div className="overflow-x-auto border border-border-primary rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-bg-secondary text-text-tertiary">
          <tr className="text-left">{['Source', 'Symbol', 'Side', 'Entry', 'Close', 'Fan-out', 'Status', 'Opened', ''].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.id} className="border-t border-border-primary hover:bg-bg-hover">
              <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${s.source === 'tradingview' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-bg-input text-text-secondary'}`}>{s.source}</span></td>
              <td className="px-2 py-1.5 font-medium text-text-primary">{s.symbol}</td>
              <td className={`px-2 py-1.5 uppercase ${sideCls(s.side)}`}>{s.side}</td>
              <td className="px-2 py-1.5 tabular-nums">{fmt(s.entry_price, 5)}</td>
              <td className="px-2 py-1.5 tabular-nums">{s.close_price === null ? '—' : fmt(s.close_price, 5)}</td>
              <td className="px-2 py-1.5 tabular-nums">{s.fanout_count}</td>
              <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${s.status === 'open' ? 'bg-buy/15 text-buy' : 'bg-bg-input text-text-tertiary'}`}>{s.status}</span></td>
              <td className="px-2 py-1.5 text-text-tertiary whitespace-nowrap">{dt(s.opened_at)}</td>
              <td className="px-2 py-1.5">{s.status === 'open' && <button onClick={() => close(s)} className="p-1 text-sell hover:opacity-70" title="Close"><X size={13} /></button>}</td>
            </tr>
          ))}
          {signals.length === 0 && <tr><td colSpan={9} className="px-2 py-8 text-center text-text-tertiary">No signals yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Followers (users participating in AI Station) ───────────────────────────
function FollowersTable({ followers, reload }: { followers: Follower[]; reload: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const totalPrincipal = followers.reduce((a, f) => a + (f.principal || 0), 0);
  const allSelected = followers.length > 0 && sel.size === followers.length;

  const toggle = (id: string) => setSel((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(followers.map((f) => f.user_id)));

  const setVisibility = async (hidden: boolean) => {
    if (sel.size === 0) { toast.error('Select at least one user'); return; }
    setBusy(true);
    try {
      await adminApi.post('/ai-station/followers/visibility', { user_ids: Array.from(sel), hidden });
      toast.success(hidden ? 'Portfolio hidden for selected users' : 'Portfolio shown for selected users');
      setSel(new Set());
      reload();
    } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xxs text-text-tertiary">
        <span>{followers.length} users · Total principal ${fmt(totalPrincipal)}</span>
        <span className="hidden md:inline">Users with an active AI-Powered Staking lock — the fan-out applies to them.</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-text-secondary">{sel.size} selected</span>
          <button onClick={() => setVisibility(true)} disabled={busy || sel.size === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-primary text-sell hover:bg-bg-hover disabled:opacity-40"><EyeOff size={12} /> Hide portfolio</button>
          <button onClick={() => setVisibility(false)} disabled={busy || sel.size === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-primary text-buy hover:bg-bg-hover disabled:opacity-40"><Eye size={12} /> Show portfolio</button>
        </div>
      </div>
      <div className="overflow-x-auto border border-border-primary rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-bg-secondary text-text-tertiary">
            <tr className="text-left">
              <th className="px-2 py-2 w-8"><input type="checkbox" className="w-3.5 h-3.5 accent-buy" checked={allSelected} onChange={toggleAll} /></th>
              {['User', 'Principal', 'Locks', 'AI trades', 'Open', 'Realized P&L', 'Portfolio'].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {followers.map((f) => (
              <tr key={f.user_id} className={`border-t border-border-primary hover:bg-bg-hover ${sel.has(f.user_id) ? 'bg-buy/5' : ''}`}>
                <td className="px-2 py-1.5"><input type="checkbox" className="w-3.5 h-3.5 accent-buy" checked={sel.has(f.user_id)} onChange={() => toggle(f.user_id)} /></td>
                <td className="px-2 py-1.5">
                  <div className="text-text-primary">{f.email || f.user_id.slice(0, 8)}</div>
                  {f.name && <div className="text-[10px] text-text-tertiary">{f.name}</div>}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-text-primary">${fmt(f.principal)}</td>
                <td className="px-2 py-1.5 tabular-nums">{f.locks}</td>
                <td className="px-2 py-1.5 tabular-nums">{f.trades}</td>
                <td className="px-2 py-1.5 tabular-nums">{f.open_trades}</td>
                <td className={`px-2 py-1.5 tabular-nums ${pnlCls(f.realized_pnl)}`}>{f.realized_pnl >= 0 ? '+' : ''}${fmt(f.realized_pnl)}</td>
                <td className="px-2 py-1.5">
                  {f.portfolio_hidden
                    ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-sell/15 text-sell">hidden</span>
                    : <span className="px-1.5 py-0.5 rounded text-[10px] bg-buy/15 text-buy">visible</span>}
                </td>
              </tr>
            ))}
            {followers.length === 0 && <tr><td colSpan={8} className="px-2 py-8 text-center text-text-tertiary">No users have an active AI-Powered Staking lock yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Connection & Slabs ─────────────────────────────────────────────────────
function Connection({ cfg, setCfg, reload }: { cfg: Config; setCfg: (c: Config) => void; reload: () => void }) {
  const [slabs, setSlabs] = useState<Slab[]>(cfg.slabs.length ? cfg.slabs : [{ min: 1000, max: 5000, lots: 0.02 }]);
  const [base, setBase] = useState(cfg.webhook_base || '');
  const [saving, setSaving] = useState(false);
  const [symbols, setSymbols] = useState<{ symbol: string; display_name?: string }[]>([]);
  const [syms, setSyms] = useState<string[]>(['EURUSD']);
  const [symInput, setSymInput] = useState('');
  const inputCls = 'px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded text-text-primary tabular-nums';

  useEffect(() => {
    // Restore the instrument list this admin picked (per-browser).
    try {
      const saved = JSON.parse(localStorage.getItem('ai_station_alert_syms') || '[]');
      if (Array.isArray(saved) && saved.length) setSyms(saved);
    } catch { /* ignore */ }
    (async () => {
      try {
        const r = await adminApi.get<{ items: { symbol: string; display_name?: string }[] }>('/config/instruments');
        setSymbols((r?.items || []).filter((i) => i.symbol));
      } catch { /* instruments optional */ }
    })();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('ai_station_alert_syms', JSON.stringify(syms)); } catch { /* ignore */ }
  }, [syms]);

  const addSym = (raw?: string) => {
    const v = (raw ?? symInput).trim().toUpperCase();
    if (!v) return;
    setSyms((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setSymInput('');
  };

  const save = async (extra: Partial<{ enabled: boolean; terminal_enabled: boolean; regenerate_secret: boolean }> = {}) => {
    setSaving(true);
    try {
      const c = await adminApi.put<Config>('/ai-station/config', {
        slabs, webhook_base: base, ...extra,
      });
      setCfg(c); setSlabs(c.slabs); setBase(c.webhook_base || '');
      toast.success('Saved');
      reload();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success('Copied'); };

  return (
    <div className="space-y-4 max-w-3xl">
      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">TradingView connection</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
              <input type="checkbox" className="w-4 h-4 accent-buy" checked={cfg.enabled}
                onChange={(e) => save({ enabled: e.target.checked })} />
              Trading enabled
              <span className="text-[10px] text-text-tertiary">(webhook / trades)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
              <input type="checkbox" className="w-4 h-4 accent-buy" checked={cfg.terminal_enabled}
                onChange={(e) => save({ terminal_enabled: e.target.checked })} />
              Show terminal to users
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Webhook base URL <span className="text-text-tertiary">(gateway public origin, e.g. https://api.swisdex.com)</span></label>
          <input className={`${inputCls} w-full`} placeholder="https://api.swisdex.com" value={base} onChange={(e) => setBase(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Webhook URL (paste into TradingView alert)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1.5 text-xs bg-bg-input border border-border-primary rounded text-text-primary break-all">
              {cfg.webhook_url || cfg.webhook_path || '— set base URL & save —'}
            </code>
            {(cfg.webhook_url || cfg.webhook_path) && (
              <button onClick={() => copy(cfg.webhook_url || cfg.webhook_path || '')} className="p-1.5 border border-border-primary rounded text-text-secondary hover:bg-bg-hover"><Copy size={13} /></button>
            )}
            <button onClick={() => { if (confirm('Regenerate secret? The old URL stops working.')) save({ regenerate_secret: true }); }}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xxs border border-border-primary rounded text-text-secondary hover:bg-bg-hover"><RefreshCw size={12} /> Regenerate</button>
          </div>
          <p className="text-[10px] text-text-tertiary mt-1">Set a UNIQUE <code>id</code> per trade. A close alert with the same id closes only that one trade.</p>
        </div>
      </section>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">TradingView alert templates</h2>
        <p className="text-[10px] text-text-tertiary">
          Add every instrument you trade — each one gets its own alert set below. In the TradingView alert: put the <b>Webhook URL</b> (above)
          in the Webhook field, and copy that instrument&apos;s JSON into the <b>Message</b> field. Keep each trade&apos;s <code>id</code> unique;
          reuse an id only to open → close → re-open the same strategy.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input list="ai-symbols" className={`${inputCls} w-44`} value={symInput}
            onChange={(e) => setSymInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSym(); } }}
            placeholder="Add instrument…" />
          <datalist id="ai-symbols">
            {symbols.map((i) => <option key={i.symbol} value={i.symbol}>{i.display_name || i.symbol}</option>)}
          </datalist>
          <button onClick={() => addSym()} className="inline-flex items-center gap-1 px-2 py-1.5 text-xxs border border-border-primary rounded text-text-secondary hover:bg-bg-hover"><Plus size={12} /> Add</button>
          {symbols.length > 0 && (
            <button onClick={() => setSyms(symbols.map((i) => i.symbol))}
              className="px-2 py-1.5 text-xxs border border-border-primary rounded text-text-secondary hover:bg-bg-hover">Add all ({symbols.length})</button>
          )}
          {syms.length > 0 && (
            <button onClick={() => setSyms([])} className="px-2 py-1.5 text-xxs border border-border-primary rounded text-sell hover:bg-bg-hover">Clear</button>
          )}
        </div>

        {syms.length === 0 && <p className="text-xxs text-text-tertiary">No instruments added yet — add one above.</p>}

        <div className="space-y-3">
          {syms.map((sy) => (
            <div key={sy} className="border border-border-primary rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text-primary">{sy}</h3>
                <button onClick={() => setSyms(syms.filter((x) => x !== sy))} className="p-1 text-sell hover:opacity-70" title="Remove"><Trash2 size={12} /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {buildTemplates(sy).map((t) => (
                  <div key={t.title} className="border border-border-primary rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-text-primary">{t.title}</div>
                        <div className="text-[10px] text-text-tertiary">{t.desc}</div>
                      </div>
                      <button onClick={() => copy(JSON.stringify(t.json))} className="p-1.5 border border-border-primary rounded text-text-secondary hover:bg-bg-hover shrink-0" title="Copy JSON"><Copy size={12} /></button>
                    </div>
                    <code className="block px-2 py-1.5 text-[11px] bg-bg-input rounded text-text-primary break-all">{JSON.stringify(t.json)}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Investment slabs</h2>
            <p className="text-[10px] text-text-tertiary">Principal range → display lot size. Lower inclusive, upper exclusive. Below the smallest slab = skipped.</p>
          </div>
          <button onClick={() => setSlabs([...slabs, { min: 0, max: null, lots: 0.01 }])} className="inline-flex items-center gap-1 px-2 py-1 text-xxs border border-border-primary rounded text-text-secondary hover:bg-bg-hover"><Plus size={12} /> Add</button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xxs text-text-tertiary px-1">
            <span>Min $</span><span>Max $ (blank = ∞)</span><span>Lots</span><span></span>
          </div>
          {slabs.map((sl, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <input className={inputCls} type="number" value={sl.min} onChange={(e) => { const n = [...slabs]; n[i] = { ...sl, min: parseFloat(e.target.value) || 0 }; setSlabs(n); }} />
              <input className={inputCls} type="number" placeholder="∞" value={sl.max ?? ''} onChange={(e) => { const n = [...slabs]; n[i] = { ...sl, max: e.target.value === '' ? null : parseFloat(e.target.value) }; setSlabs(n); }} />
              <input className={inputCls} type="number" step={0.01} value={sl.lots} onChange={(e) => { const n = [...slabs]; n[i] = { ...sl, lots: parseFloat(e.target.value) || 0 }; setSlabs(n); }} />
              <button onClick={() => setSlabs(slabs.filter((_, j) => j !== i))} className="p-1.5 text-sell hover:opacity-70"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save slabs & base URL
        </button>
      </section>
    </div>
  );
}

// ── Edit trade modal ───────────────────────────────────────────────────────
function EditTradeModal({ trade, onClose, onSaved }: { trade: Trade; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    entry_price: String(trade.entry_price ?? ''),
    close_price: trade.close_price === null ? '' : String(trade.close_price),
    stop_loss: trade.stop_loss === null ? '' : String(trade.stop_loss),
    take_profit: trade.take_profit === null ? '' : String(trade.take_profit),
    lots: String(trade.lots ?? ''),
    status: trade.status,
  });
  const [busy, setBusy] = useState(false);
  const inputCls = 'w-full px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded text-text-primary tabular-nums';

  // Live P&L preview (same math the backend uses on save) so the admin sees
  // the recalculated value BEFORE saving.
  const dir = trade.side === 'buy' ? 1 : -1;
  const cs = trade.contract_size || 100000;
  const entryN = parseFloat(f.entry_price) || 0;
  const lotsN = parseFloat(f.lots) || 0;
  const closeN = f.close_price === '' ? null : parseFloat(f.close_price);
  const autoPnl = closeN === null ? null : Math.round((closeN - entryN) * dir * lotsN * cs * 100) / 100;

  const save = async () => {
    setBusy(true);
    try {
      const body: any = { status: f.status };
      // No pnl sent — the backend recomputes it from entry/close/lots.
      (['entry_price', 'close_price', 'stop_loss', 'take_profit', 'lots'] as const).forEach((k) => {
        body[k] = f[k] === '' ? null : parseFloat(f[k]);
      });
      await adminApi.patch(`/ai-station/trades/${trade.id}`, body);
      toast.success('Trade updated');
      onSaved();
    } catch (e: any) { toast.error(e?.message || 'Update failed'); } finally { setBusy(false); }
  };

  const fields: [string, keyof typeof f, number][] = [
    ['Entry', 'entry_price', 0.00001], ['Close', 'close_price', 0.00001],
    ['Stop Loss', 'stop_loss', 0.00001], ['Take Profit', 'take_profit', 0.00001],
    ['Lots', 'lots', 0.01],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg-primary border border-border-primary rounded-lg p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Edit trade · {trade.symbol} <span className={sideCls(trade.side)}>{trade.side}</span></h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([label, k, step]) => (
            <div key={k}>
              <label className="text-xs text-text-secondary block mb-1">{label}</label>
              <input className={inputCls} type="number" step={step} value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-bg-secondary border border-border-primary rounded-md px-3 py-2">
          <span className="text-xs text-text-secondary">P&L (auto-calculated)</span>
          <span className={`text-sm font-semibold tabular-nums ${pnlCls(autoPnl)}`}>
            {closeN === null ? 'open — live P&L' : `${(autoPnl ?? 0) >= 0 ? '+' : ''}$${fmt(autoPnl)}`}
          </span>
        </div>
        <div><label className="text-xs text-text-secondary block mb-1">Status</label>
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="open">open</option><option value="closed">closed</option></select></div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded hover:bg-bg-hover">Cancel</button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
