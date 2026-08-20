'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  ArrowDownToLine, ArrowUpFromLine, ChevronDown, ExternalLink,
} from 'lucide-react';
import { handleTerminalOpen } from '@/lib/tradingNav';
import { fmtAccountMoney, isCentAccount } from '@/lib/wallet/centDisplay';
import { MarginDonut } from './MarginDonut';

export interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  equity: number;
  free_margin: number;
  margin_used?: number;
  leverage: number;
  is_demo: boolean;
  swap_free?: boolean;
  account_group_name?: string | null;
  account_group?: { is_cent_account?: boolean | null } | null;
  is_cent_account?: boolean | null;
}

// Relative (same-origin) so the terminal stays inside the app / PWA.
const tradeUrl = (accountId: string) =>
  `/trading/terminal?account=${encodeURIComponent(accountId)}&view=chart`;

/**
 * Primary hero — the EXISTING account selector, balance stats and
 * Deposit / Trade / Withdraw / Details actions, restyled to the
 * reference's hero-card language: one dominant figure, quiet labels,
 * pill actions, and the margin donut as the visual anchor on desktop.
 */
export function AccountHero({
  accounts, active, onChangeAccount, loading,
}: {
  accounts: AccountRow[];
  active: AccountRow | null;
  onChangeAccount: (id: string) => void;
  loading: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const a = active;
  const cent = isCentAccount(a);

  return (
    <div
      className="rounded-3xl p-5 md:p-7"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Left: account picker + dominant balance */}
        <div className="flex-1 min-w-0">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-bg-hover"
              style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-secondary)' }}
            >
              <span
                className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full"
                style={a?.is_demo
                  ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                  : { color: '#E85D3D', background: 'rgba(232, 93, 61,0.12)' }}
              >
                {a?.is_demo ? 'Demo' : 'Real'}
              </span>
              <span className="text-xs font-bold tabular-nums text-text-primary">
                {a?.account_number ? `#${a.account_number}` : (loading ? '…' : 'No accounts')}
              </span>
              <ChevronDown size={13} className="text-text-tertiary" />
            </button>
            {pickerOpen && accounts.length > 0 && (
              <div
                className="absolute top-full left-0 mt-2 z-30 rounded-2xl p-1.5 min-w-[264px]"
                style={{
                  background: 'var(--bg-glass-heavy)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { onChangeAccount(acc.id); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-bg-hover"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full"
                      style={acc.is_demo
                        ? { color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
                        : { color: '#E85D3D', background: 'rgba(232, 93, 61,0.12)' }}
                    >
                      {acc.is_demo ? 'Demo' : 'Real'}
                    </span>
                    <span className="font-semibold tabular-nums">#{acc.account_number}</span>
                    <span className="ml-auto text-xs text-text-tertiary tabular-nums">
                      {fmtAccountMoney(acc.balance, isCentAccount(acc))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] font-semibold text-text-tertiary">
            Trading balance
          </p>
          <p className="mt-1 text-3xl md:text-4xl font-extrabold tabular-nums text-text-primary leading-none">
            {fmtAccountMoney(a?.balance ?? 0, cent)}
          </p>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <HeroStat label="Equity" value={fmtAccountMoney(a?.equity ?? 0, cent)} />
            <HeroStat label="Free margin" value={fmtAccountMoney(a?.free_margin ?? 0, cent)} />
            <HeroStat label="Leverage" value={a ? `1:${a.leverage}` : '—'} />
            <HeroStat label="Swap-free" value={a?.swap_free ? 'Yes' : 'No'} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-transform hover:scale-[1.02]"
              style={{ background: '#E85D3D', color: '#0c1105' }}
            >
              <ArrowDownToLine size={13} /> Deposit
            </Link>
            <a
              href={a ? tradeUrl(a.id) : '#'}
              target={a ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (a) handleTerminalOpen(e, tradeUrl(a.id)); }}
              aria-disabled={!a}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-bg-hover',
                !a && 'pointer-events-none opacity-50',
              )}
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            >
              Trade <ExternalLink size={12} />
            </a>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <ArrowUpFromLine size={13} /> Withdraw
            </Link>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors hover:bg-bg-hover"
              style={{ border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            >
              Details
            </Link>
          </div>
        </div>

        {/* Right: margin-usage ring (existing margin_used / equity fields) */}
        <div className="hidden lg:block shrink-0 pl-6" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
          <MarginDonut marginUsed={a?.margin_used ?? 0} equity={a?.equity ?? 0} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-text-tertiary truncate">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-text-primary truncate" title={value}>{value}</p>
    </div>
  );
}
