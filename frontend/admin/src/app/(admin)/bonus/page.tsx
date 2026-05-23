'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, RefreshCw, Gift } from 'lucide-react';
import toast from 'react-hot-toast';

interface BonusOffer {
  id: string;
  name: string;
  bonus_type: string;
  // Backend keeps `percentage` and `fixed_amount` separate; the form lets
  // admin pick a type and types only one number. We resolve the value here
  // when reading from the API so the UI shows the right column.
  percentage: number | null;
  fixed_amount: number | null;
  min_deposit: number;
  max_deposit: number | null;
  max_bonus: number | null;
  lots_required: number;
  target_audience: string;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  // Tier-display extras — admin manages these to drive the trader /bonus page.
  perks: string[] | null;
  is_popular: boolean;
  sort_order: number;
  cta_label: string | null;
  tagline: string | null;
  allocations_count?: number;
}

interface BonusAllocation {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  offer_name: string;
  bonus_amount: number;
  lots_completed: number;
  lots_required: number;
  status: string;
  allocated_at: string;
}

type Tab = 'offers' | 'allocations';

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_FORM = {
  name: '',
  bonus_type: 'percentage',
  bonus_value: '',
  min_deposit: '',
  // Empty = no upper bound (top-tier card, "$X+" on the trader page).
  max_deposit: '',
  max_bonus: '',
  lots_required: '',
  target_audience: 'all',
  starts_at: '',
  expires_at: '',
  is_active: true,
  // Tier-display fields — drive the trader /bonus page cards.
  perks: '',         // one bullet per line
  is_popular: false,
  sort_order: '0',
  cta_label: '',
  tagline: '',
};

/** Simple welcome-bonus rule state — one number, no tiers.
 *  Persisted as four system_settings keys via PUT /admin/settings. */
interface WelcomeBonusSettings {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: string;     // string so the input keeps the user's typed decimals
  cap_usd: string;   // 0 / empty = no cap
}

const EMPTY_WELCOME: WelcomeBonusSettings = {
  enabled: false,
  type: 'percentage',
  value: '',
  cap_usd: '',
};

export default function BonusPage() {
  const [tab, setTab] = useState<Tab>('offers');
  // ── Simple welcome bonus rule (admin's quick-config) ──────────────
  // Lives next to the tier list because conceptually it's another
  // way to grant the same bonus. When enabled it WINS over the tier
  // matrix on first deposits — see wallet_service.compute_welcome_bonus.
  const [welcome, setWelcome] = useState<WelcomeBonusSettings>(EMPTY_WELCOME);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [offers, setOffers] = useState<BonusOffer[]>([]);
  const [allocations, setAllocations] = useState<BonusAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  /** Read the four welcome-bonus settings from /admin/settings (single GET).
   *  Settings endpoint returns an array of {key, value}; we hydrate the
   *  WelcomeBonusSettings state from it. Defaults match what
   *  compute_welcome_bonus uses on the backend when keys are absent. */
  const loadWelcome = useCallback(async () => {
    try {
      const rows = await adminApi.get<{ key: string; value: any }[]>('/settings');
      const list = Array.isArray(rows) ? rows : [];
      const get = (k: string) => list.find((r) => r.key === k)?.value;
      const enabled = Boolean(get('welcome_bonus_enabled'));
      const type = (String(get('welcome_bonus_type') || 'percentage')) as 'percentage' | 'fixed';
      const value = get('welcome_bonus_value');
      const cap = get('welcome_bonus_cap_usd');
      setWelcome({
        enabled,
        type: type === 'fixed' ? 'fixed' : 'percentage',
        value: value == null || value === '' ? '' : String(value),
        cap_usd: cap == null || cap === '' || Number(cap) === 0 ? '' : String(cap),
      });
    } catch {
      /* keep defaults silently — admin can still save and overwrite */
    }
  }, []);

  useEffect(() => { void loadWelcome(); }, [loadWelcome]);

  const saveWelcome = async () => {
    const numVal = parseFloat(welcome.value);
    if (welcome.enabled && (!Number.isFinite(numVal) || numVal <= 0)) {
      toast.error('Enter a positive bonus value');
      return;
    }
    setWelcomeSaving(true);
    try {
      // 0 cap means "no cap"; we still send 0 explicitly so admin can
      // clear a previously-set cap by emptying the field + saving.
      const cap = welcome.cap_usd.trim() === '' ? 0 : parseFloat(welcome.cap_usd) || 0;
      await adminApi.put('/settings', {
        settings: {
          welcome_bonus_enabled: welcome.enabled,
          welcome_bonus_type: welcome.type,
          welcome_bonus_value: Number.isFinite(numVal) ? numVal : 0,
          welcome_bonus_cap_usd: cap,
        },
      });
      toast.success(welcome.enabled ? 'Welcome bonus enabled' : 'Welcome bonus disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setWelcomeSaving(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'offers') {
        const res = await adminApi.get<{ offers: BonusOffer[] }>('/bonus/offers');
        setOffers(res.offers || []);
      } else {
        const res = await adminApi.get<{ allocations: BonusAllocation[] }>('/bonus/allocations');
        setAllocations(res.allocations || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (offer: BonusOffer) => {
    setEditId(offer.id);
    // Pick the right "value" column based on the type so admin always
    // sees their last-saved number, even when switching between
    // percentage and fixed types.
    const value = offer.bonus_type === 'percentage' || offer.bonus_type === 'deposit'
      ? offer.percentage
      : offer.fixed_amount;
    setForm({
      name: offer.name,
      bonus_type: offer.bonus_type || 'percentage',
      bonus_value: value != null ? String(value) : '',
      min_deposit: String(offer.min_deposit ?? 0),
      max_deposit: offer.max_deposit != null ? String(offer.max_deposit) : '',
      max_bonus: offer.max_bonus != null ? String(offer.max_bonus) : '',
      lots_required: String(offer.lots_required ?? 0),
      target_audience: offer.target_audience || 'all',
      starts_at: offer.starts_at ? offer.starts_at.slice(0, 10) : '',
      expires_at: offer.expires_at ? offer.expires_at.slice(0, 10) : '',
      is_active: offer.is_active,
      perks: Array.isArray(offer.perks) ? offer.perks.join('\n') : '',
      is_popular: !!offer.is_popular,
      sort_order: String(offer.sort_order ?? 0),
      cta_label: offer.cta_label || '',
      tagline: offer.tagline || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      const val = parseFloat(form.bonus_value);
      const perksList = form.perks
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      // Map the single "Value" form field to the right backend column.
      // Percentage / deposit-match flows persist `percentage`; fixed and
      // no_deposit persist `fixed_amount`. Keeps the form simple but the
      // backend strict.
      const isPctType = form.bonus_type === 'percentage' || form.bonus_type === 'deposit';
      const body: Record<string, unknown> = {
        name: form.name,
        bonus_type: form.bonus_type,
        percentage: isPctType ? (Number.isFinite(val) ? val : null) : null,
        fixed_amount: !isPctType ? (Number.isFinite(val) ? val : null) : null,
        min_deposit: parseFloat(form.min_deposit) || 0,
        max_deposit: form.max_deposit.trim() === '' ? null : parseFloat(form.max_deposit),
        max_bonus: form.max_bonus.trim() === '' ? null : parseFloat(form.max_bonus),
        lots_required: parseFloat(form.lots_required) || 0,
        target_audience: form.target_audience,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
        perks: perksList.length ? perksList : null,
        is_popular: form.is_popular,
        sort_order: parseInt(form.sort_order, 10) || 0,
        cta_label: form.cta_label.trim() || null,
        tagline: form.tagline.trim() || null,
      };
      if (editId) {
        await adminApi.put(`/bonus/offers/${editId}`, body);
        toast.success('Offer updated');
      } else {
        await adminApi.post('/bonus/offers', body);
        toast.success('Offer created');
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Bonus Management</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">Create bonus offers and track allocations</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'offers' && (
              <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast">
                <Plus size={14} /> New Offer
              </button>
            )}
            <button onClick={fetchData} className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ── Simple welcome-bonus rule ───────────────────────────────
            One number, no tiers. When enabled, this rule WINS over the
            tier matrix below — every first deposit gets exactly this
            bonus credited to main_wallet_bonus. Same first-deposit /
            not-withdrawable / forfeit-on-first-withdraw rules apply. */}
        <div className="bg-bg-secondary border border-border-primary rounded-md p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Welcome Bonus — Simple Rule</h2>
              <p className="text-xxs text-text-tertiary mt-0.5 leading-relaxed">
                One global setting that applies to <span className="text-text-secondary">every user&apos;s first approved deposit</span>.
                When enabled, this overrides the multi-tier offers below. Bonus credits the user&apos;s
                <span className="text-text-secondary"> main wallet bonus</span> (tradeable, not withdrawable, cleared on first withdrawal).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={welcome.enabled}
                onChange={(e) => setWelcome((w) => ({ ...w, enabled: e.target.checked }))}
                className="w-3.5 h-3.5"
              />
              <span className={welcome.enabled ? 'text-success font-medium' : ''}>
                {welcome.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3 transition-opacity', !welcome.enabled && 'opacity-50')}>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Type</label>
              <select
                value={welcome.type}
                disabled={!welcome.enabled}
                onChange={(e) => setWelcome((w) => ({ ...w, type: e.target.value === 'fixed' ? 'fixed' : 'percentage' }))}
                className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md disabled:cursor-not-allowed"
              >
                <option value="percentage">% of deposit</option>
                <option value="fixed">Flat $ amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">
                Value {welcome.type === 'percentage' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!welcome.enabled}
                value={welcome.value}
                onChange={(e) => setWelcome((w) => ({ ...w, value: e.target.value }))}
                placeholder={welcome.type === 'percentage' ? 'e.g. 100' : 'e.g. 50'}
                className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">
                Cap ($) <span className="text-text-tertiary">— blank = no cap</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!welcome.enabled}
                value={welcome.cap_usd}
                onChange={(e) => setWelcome((w) => ({ ...w, cap_usd: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border-primary/40">
            <p className="text-xxs text-text-tertiary">
              {welcome.enabled
                ? welcome.type === 'percentage'
                  ? `Every first deposit will get ${welcome.value || '—'}% bonus${welcome.cap_usd ? ` (capped at $${welcome.cap_usd})` : ''}.`
                  : `Every first deposit will get a flat $${welcome.value || '—'} bonus.`
                : 'Rule is OFF — multi-tier offers below will apply instead.'}
            </p>
            <button
              onClick={() => void saveWelcome()}
              disabled={welcomeSaving}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50"
            >
              {welcomeSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {([['offers', 'Offers'], ['allocations', 'Allocations']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : tab === 'offers' ? (
              offers.length === 0 ? (
                <div className="text-center text-xs text-text-tertiary py-12">No bonus offers created yet</div>
              ) : (
                <div className="border border-border-primary rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="border-b border-border-primary bg-bg-tertiary/40">
                          {['Order', 'Name', 'Type', 'Value', 'Deposit Range', 'Cap', 'Popular', 'Status', 'Actions'].map((col) => (
                            <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', ['Value', 'Deposit Range', 'Cap'].includes(col) && 'text-right', col === 'Actions' && 'text-right', ['Order', 'Popular', 'Status'].includes(col) && 'text-center')}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((offer) => {
                          const value = offer.bonus_type === 'percentage' || offer.bonus_type === 'deposit'
                            ? offer.percentage
                            : offer.fixed_amount;
                          const valueLabel = value == null
                            ? '—'
                            : (offer.bonus_type === 'percentage' || offer.bonus_type === 'deposit')
                              ? `${value}%`
                              : `$${formatMoney(value)}`;
                          const range = offer.max_deposit == null
                            ? `$${formatMoney(offer.min_deposit)}+`
                            : `$${formatMoney(offer.min_deposit)} – $${formatMoney(offer.max_deposit)}`;
                          return (
                            <tr key={offer.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                              <td className="px-4 py-2.5 text-xs text-text-tertiary text-center font-mono tabular-nums">{offer.sort_order}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Gift size={12} className="text-accent" />
                                  <span className="text-xs text-text-primary">{offer.name}</span>
                                </div>
                                {offer.tagline && (
                                  <p className="text-xxs text-text-tertiary mt-0.5">{offer.tagline}</p>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-buy/15 text-buy">{offer.bonus_type}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">
                                {valueLabel}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">{range}</td>
                              <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">
                                {offer.max_bonus != null ? `$${formatMoney(offer.max_bonus)}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {offer.is_popular ? (
                                  <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-accent/15 text-accent">★</span>
                                ) : (
                                  <span className="text-text-tertiary text-xxs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium', offer.is_active ? 'bg-success/15 text-success' : 'bg-text-tertiary/15 text-text-tertiary')}>
                                  {offer.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => openEdit(offer)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xxs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">
                                  <Pencil size={12} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : allocations.length === 0 ? (
              <div className="text-center text-xs text-text-tertiary py-12">No allocations found</div>
            ) : (
              <div className="border border-border-primary rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {['User', 'Offer', 'Bonus Amount', 'Lots Progress', 'Status', 'Allocated'].map((col) => (
                          <th key={col} className={cn('text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide', col === 'Bonus Amount' && 'text-right')}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover">
                          <td className="px-4 py-2.5">
                            <p className="text-xs text-text-primary">{a.user_name}</p>
                            <p className="text-xxs text-text-tertiary">{a.user_email}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary">{a.offer_name}</td>
                          <td className="px-4 py-2.5 text-xs text-text-primary text-right font-mono tabular-nums">${formatMoney(a.bonus_amount)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                <div className="h-full bg-buy rounded-full" style={{ width: `${Math.min((a.lots_completed / (a.lots_required || 1)) * 100, 100)}%` }} />
                              </div>
                              <span className="text-xxs text-text-tertiary font-mono tabular-nums">{a.lots_completed}/{a.lots_required}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium',
                              a.status === 'completed' ? 'bg-success/15 text-success' :
                              a.status === 'active' ? 'bg-buy/15 text-buy' :
                              a.status === 'cancelled' ? 'bg-danger/15 text-danger' :
                              'bg-warning/15 text-warning'
                            )}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums">{a.allocated_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit Bonus Tier' : 'Create Bonus Tier'}</h3>
              <p className="text-xxs text-text-tertiary mt-0.5">
                Drives one card on the trader <span className="text-text-secondary font-medium">/bonus</span> page.
                Set deposit range, bonus %, cap, and perks. Inactive tiers are hidden from the trader page.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* ── Identity ──────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xxs text-text-tertiary mb-1">Name (internal)</label>
                  <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. Tier 1 — Starter Match" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Sort Order</label>
                  <input type="number" step="1" value={form.sort_order} onChange={(e) => updateForm('sort_order', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" title="Lower = left-most card on /bonus page" />
                </div>
              </div>

              {/* ── Bonus value ───────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Bonus Type</label>
                  <select value={form.bonus_type} onChange={(e) => updateForm('bonus_type', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                    <option value="percentage">% of Deposit</option>
                    <option value="deposit">Deposit Match (legacy)</option>
                    <option value="fixed">Fixed $ Amount</option>
                    <option value="no_deposit">No-Deposit Bonus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">
                    Value {(form.bonus_type === 'percentage' || form.bonus_type === 'deposit') ? '(%)' : '($)'}
                  </label>
                  <input type="number" step="0.01" value={form.bonus_value} onChange={(e) => updateForm('bonus_value', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Cap ($)</label>
                  <input type="number" step="0.01" value={form.max_bonus} onChange={(e) => updateForm('max_bonus', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="e.g. 1000" title="Max bonus amount. Renders as 'Up to $X' on the card." />
                </div>
              </div>

              {/* ── Deposit range ─────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Min Deposit ($)</label>
                  <input type="number" step="0.01" value={form.min_deposit} onChange={(e) => updateForm('min_deposit', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Max Deposit ($)</label>
                  <input type="number" step="0.01" value={form.max_deposit} onChange={(e) => updateForm('max_deposit', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="blank = no upper bound" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Lots Required</label>
                  <input type="number" step="0.01" value={form.lots_required} onChange={(e) => updateForm('lots_required', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono" placeholder="e.g. 5" />
                </div>
              </div>

              {/* ── Trader-page display ───────────────────────────────── */}
              <div className="rounded-md bg-accent/5 border border-accent/30 p-3 space-y-3">
                <p className="text-xxs font-semibold text-accent uppercase tracking-wide">Trader /bonus page card</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xxs text-text-tertiary mb-1">CTA Button Label</label>
                    <input value={form.cta_label} onChange={(e) => updateForm('cta_label', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="auto: 'Deposit $100'" />
                  </div>
                  <div>
                    <label className="block text-xxs text-text-tertiary mb-1">Tagline (optional)</label>
                    <input value={form.tagline} onChange={(e) => updateForm('tagline', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" placeholder="e.g. Welcome Match" />
                  </div>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">
                    Perks <span className="text-text-tertiary">(one per line)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.perks}
                    onChange={(e) => updateForm('perks', e.target.value)}
                    placeholder={'Auto-credited within minutes\nTradeable on all instruments\nEmail + chat support'}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_popular}
                    onChange={(e) => updateForm('is_popular', e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  Mark as <span className="text-accent font-semibold">Most Popular</span> (highlighted card)
                </label>
              </div>

              {/* ── Audience + window ─────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Audience</label>
                  <select value={form.target_audience} onChange={(e) => updateForm('target_audience', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md">
                    <option value="all">All Users</option>
                    <option value="new">New Users Only</option>
                    <option value="vip">VIP Users</option>
                    <option value="ib">IB Users</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Starts At</label>
                  <input type="date" value={form.starts_at} onChange={(e) => updateForm('starts_at', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Expires At</label>
                  <input type="date" value={form.expires_at} onChange={(e) => updateForm('expires_at', e.target.value)} className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm('is_active', e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                Active — visible on the trader /bonus page
              </label>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50">
                {submitting ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
