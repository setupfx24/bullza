'use client';

/**
 * Peer-to-peer trade marketplace — XM-style.
 *
 * Renders as a sub-section inside the wallet page's Deposit and Withdraw
 * tabs. `mode="buy"` opens the marketplace in fiat→crypto direction
 * (deposit path); `mode="sell"` flips it for the withdraw path.
 *
 * Backend wiring is intentionally generic — the component hits
 * `/api/v1/p2p/ads` with the current filters. While the backend is
 * still being built, an empty list + a "marketplace launching soon"
 * banner is rendered so the UI works end-to-end without crashing.
 */
import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  ArrowRightLeft, ShieldCheck, Star, Clock,
  CheckCircle2, Info, Search, Repeat, Wallet,
} from 'lucide-react';
import api from '@/lib/api/client';

type Side = 'buy' | 'sell';

interface P2PAd {
  id: string;
  side: Side;                   // ad poster's side — 'sell' = they sell crypto for fiat
  asset: string;                 // USDT / BTC / ETH / USDC
  fiat: string;                  // INR / USD / EUR / PHP / VND / IDR / MYR / NGN / TRY
  price: number;                 // fiat per 1 unit of asset
  available: number;             // asset units still available
  min_fiat: number;
  max_fiat: number;
  payment_methods: string[];     // e.g. ['UPI', 'IMPS', 'Bank Transfer']
  trader_name: string;
  trader_completed: number;      // total completed trades
  trader_completion_pct: number; // 0–100
  release_minutes: number;       // SLA — how long seller takes to release crypto
}

const ASSETS = ['USDT', 'BTC', 'ETH', 'USDC'] as const;
const FIATS = ['INR', 'USD', 'EUR', 'PHP', 'IDR', 'MYR', 'VND', 'NGN', 'TRY'] as const;
const PAYMENT_METHODS = [
  'All',
  'UPI',
  'IMPS / NEFT',
  'Bank Transfer',
  'PayPal',
  'Wise',
  'GCash',
  'Cash',
] as const;

const ASSET_DECIMALS: Record<string, number> = {
  USDT: 2, USDC: 2, BTC: 6, ETH: 5,
};

const fmtAsset = (n: number, asset: string) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: ASSET_DECIMALS[asset] ?? 2,
  });

const fmtFiat = (n: number, fiat: string) =>
  n.toLocaleString('en-US', { style: 'currency', currency: fiat, maximumFractionDigits: 2 });

export default function P2PMarketplace({ mode }: { mode: Side }) {
  // When the user is on the Deposit tab (mode='buy'), they want to BUY
  // crypto with fiat — i.e. find SELL ads from other users. Vice-versa
  // on Withdraw. The visible toggle still says Buy/Sell so users see
  // the universal XM-style language.
  const [side, setSide] = useState<Side>(mode);
  const [asset, setAsset] = useState<typeof ASSETS[number]>('USDT');
  const [fiat, setFiat] = useState<typeof FIATS[number]>('INR');
  const [paymentMethod, setPaymentMethod] = useState<string>('All');
  const [amount, setAmount] = useState<string>('');
  const [ads, setAds] = useState<P2PAd[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync the side when the parent flips deposit↔withdraw.
  useEffect(() => { setSide(mode); }, [mode]);

  const fetchAds = useMemo(
    () => async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({
          side,
          asset,
          fiat,
          ...(paymentMethod !== 'All' && { payment_method: paymentMethod }),
          ...(amount && Number(amount) > 0 && { amount }),
        });
        const list = await api.get<P2PAd[]>(`/p2p/ads?${q.toString()}`, { signal });
        setAds(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        // Backend may not be live yet — surface as empty list + banner
        // instead of toasting an error every time the user opens the tab.
        setAds([]);
        setError(e?.message ?? 'unable to load ads');
      } finally {
        setLoading(false);
      }
    },
    [side, asset, fiat, paymentMethod, amount],
  );

  useEffect(() => {
    const c = new AbortController();
    void fetchAds(c.signal);
    return () => c.abort();
  }, [fetchAds]);

  const sideLabel = side === 'buy' ? 'Buy' : 'Sell';
  const otherSideLabel = side === 'buy' ? 'Sell' : 'Buy';

  return (
    <div className="space-y-4">
      {/* Intro / explainer */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 flex items-start gap-2.5">
        <ArrowRightLeft className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="text-xs text-text-secondary leading-relaxed">
          <span className="text-text-primary font-bold">Peer-to-peer marketplace.</span>{' '}
          {side === 'buy'
            ? 'Pick a seller, pay them directly in your local currency, and they release the crypto to your SwisDex wallet from escrow.'
            : 'Post an offer or accept a buyer\'s. Buyer pays you off-platform; SwisDex holds your crypto in escrow until you confirm and release.'}
          {' '}Inspired by the XM P2P flow — verified traders only, 24/7 dispute support.
        </div>
      </div>

      {/* Buy / Sell toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-secondary border border-border-secondary">
        {(['buy', 'sell'] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={clsx(
              'flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
              side === s
                ? s === 'buy'
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-[#ef4444] text-white'
                : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {s === 'buy' ? 'Buy Crypto' : 'Sell Crypto'}
          </button>
        ))}
      </div>

      {/* Filters: asset + fiat + payment method + amount */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Filter title="Asset">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-sm font-bold text-text-primary outline-none focus:border-accent/50"
          >
            {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Filter>
        <Filter title="Fiat">
          <select
            value={fiat}
            onChange={(e) => setFiat(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-sm font-bold text-text-primary outline-none focus:border-accent/50"
          >
            {FIATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Filter>
        <Filter title="Payment">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-sm font-bold text-text-primary outline-none focus:border-accent/50"
          >
            {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Filter>
        <Filter title={`Amount (${fiat})`}>
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Any"
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary text-sm font-mono font-bold text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
          />
        </Filter>
      </div>

      {/* Ads list */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-bold">
            {side === 'buy' ? `Sellers offering ${asset} for ${fiat}` : `Buyers wanting ${asset} for ${fiat}`}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <ShieldCheck className="w-3 h-3" /> Escrow-protected
          </div>
        </div>

        {loading && (
          <div className="px-4 py-12 text-center text-text-tertiary text-xs flex items-center justify-center gap-2">
            <Search className="w-3.5 h-3.5 animate-pulse" /> Loading ads…
          </div>
        )}

        {!loading && (ads?.length ?? 0) === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
              <Repeat className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm font-bold text-text-primary mb-1">
              P2P Marketplace launching soon
            </div>
            <div className="text-xs text-text-tertiary max-w-sm mx-auto leading-relaxed">
              We&apos;re onboarding verified traders for the SwisDex P2P launch.
              Until the first ads go live, deposits and withdrawals remain
              available via the <span className="text-text-primary font-semibold">Crypto</span> and{' '}
              <span className="text-text-primary font-semibold">{mode === 'buy' ? 'Manual' : 'Bank'}</span> tabs.
            </div>
            {error && (
              <div className="mt-3 text-[10px] text-text-tertiary flex items-center justify-center gap-1.5">
                <Info className="w-3 h-3" />
                {error}
              </div>
            )}
          </div>
        )}

        {!loading && (ads?.length ?? 0) > 0 && (
          <ul className="divide-y divide-border-primary">
            {(ads ?? []).map((ad) => (
              <AdRow key={ad.id} ad={ad} sideLabel={otherSideLabel} />
            ))}
          </ul>
        )}
      </div>

      {/* Post your own ad */}
      <button
        type="button"
        className="w-full py-3 rounded-xl border border-dashed border-border-primary text-xs text-text-tertiary hover:text-text-primary hover:border-accent/50 flex items-center justify-center gap-2"
        onClick={() => {
          // Backend endpoint TBD — placeholder navigation to a future create-ad flow.
          window.location.href = '/wallet/p2p/post';
        }}
      >
        <Wallet className="w-3.5 h-3.5" />
        Want to {sideLabel.toLowerCase()} your own? Post an ad
      </button>
    </div>
  );
}

function Filter({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1 truncate">
        {title}
      </span>
      {children}
    </label>
  );
}

function AdRow({ ad, sideLabel }: { ad: P2PAd; sideLabel: string }) {
  return (
    <li className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.4fr_auto] gap-3 sm:items-center hover:bg-bg-hover/40">
      {/* Trader */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-accent/20 text-accent grid place-items-center text-xs font-bold shrink-0">
          {ad.trader_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-text-primary truncate flex items-center gap-1.5">
            {ad.trader_name}
            <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
          </div>
          <div className="text-[10px] text-text-tertiary flex items-center gap-2.5">
            <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> {ad.trader_completion_pct.toFixed(1)}%</span>
            <span>{ad.trader_completed.toLocaleString('en-US')} trades</span>
            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {ad.release_minutes}m</span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="text-sm">
        <div className="text-text-primary font-bold tabular-nums">
          {fmtFiat(ad.price, ad.fiat)}
        </div>
        <div className="text-[10px] text-text-tertiary">per 1 {ad.asset}</div>
      </div>

      {/* Available + limits + methods */}
      <div className="text-[11px] text-text-secondary leading-snug min-w-0">
        <div className="tabular-nums">
          Available <span className="text-text-primary font-semibold">{fmtAsset(ad.available, ad.asset)} {ad.asset}</span>
        </div>
        <div className="tabular-nums">
          Limit{' '}
          <span className="text-text-primary font-semibold">
            {fmtFiat(ad.min_fiat, ad.fiat)} – {fmtFiat(ad.max_fiat, ad.fiat)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {ad.payment_methods.slice(0, 4).map((p) => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary border border-border-primary">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        className={clsx(
          'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider sm:justify-self-end',
          sideLabel === 'Sell' ? 'bg-[#ef4444] text-white' : 'bg-[#22c55e] text-white',
        )}
        onClick={() => {
          window.location.href = `/wallet/p2p/trade/${ad.id}`;
        }}
      >
        {sideLabel} {ad.asset}
      </button>
    </li>
  );
}
