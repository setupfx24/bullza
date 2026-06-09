'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Loader2, RefreshCw, Trash2, Users, DollarSign, AlertTriangle, X,
  Plus, Pencil, Search, Layers, UserCog, Save, PauseCircle, PlayCircle,
} from 'lucide-react';

/**
 * MAM Accounts — Multi-Account Manager.
 *
 * Filters /business/masters to master_type='mamm' only. The create/edit form
 * locks master_type so this page can never produce a PAMM or signal_provider
 * row. Use Copy Masters when you need the combined view or to change a
 * master's type.
 */

interface Master {
  id: string;
  user_id: string;
  account_id: string | null;
  provider_name: string;
  email: string;
  master_type: string;
  status: string;
  active_followers: number;
  total_aum: number;
  total_return_pct: number;
  performance_fee_pct: number;
  management_fee_pct: number;
  admin_commission_pct: number;
  min_investment: number;
  max_investors: number;
  description: string | null;
  spread_markup_pips: number | null;
  commission_per_lot_usd: number | null;
  swap_long_pips?: number | null;
  swap_short_pips?: number | null;
  // Admin-set risk controls (Mig 0066).
  max_drawdown_pct: number;
  max_loss_per_trade_pct: number | null;
  insurance_enabled: boolean;
  created_at: string | null;
}

interface UserHit {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface Allocation {
  id: string;
  investor_user_id: string;
  investor_account_id: string | null;
  investor_name: string;
  investor_email: string;
  account_number: string | null;
  account_balance: number | null;
  account_equity: number | null;
  copy_type: string;
  status: string;
  allocation_amount: number;
  allocation_pct: number | null;
  max_drawdown_pct: number | null;
  max_lot_override: number | null;
  total_profit: number;
  performance_fee_pct_override: number | null;
  admin_commission_pct_override: number | null;
  admin_notes: string | null;
  effective_performance_fee_pct: number;
  effective_admin_commission_pct: number;
}

interface AllocationDraft {
  status: string;
  allocation_amount: string;
  max_drawdown_pct: string;
  max_lot_override: string;
  performance_fee_pct_override: string;
  admin_commission_pct_override: string;
  admin_notes: string;
}

interface MamFormState {
  user_id: string;
  user_label: string;
  performance_fee_pct: string;
  management_fee_pct: string;
  admin_commission_pct: string;
  min_investment: string;
  max_investors: string;
  description: string;
  spread_markup_pips: string;
  commission_per_lot_usd: string;
  swap_long_pips: string;
  swap_short_pips: string;
  status: string;
  // Mig 0066: admin-owned risk controls + insurance gate.
  max_drawdown_pct: string;
  max_loss_per_trade_pct: string;
  insurance_enabled: boolean;
}

const EMPTY_FORM: MamFormState = {
  user_id: '',
  user_label: '',
  performance_fee_pct: '20',
  management_fee_pct: '0',
  admin_commission_pct: '0',
  min_investment: '100',
  max_investors: '100',
  description: '',
  spread_markup_pips: '',
  commission_per_lot_usd: '',
  swap_long_pips: '',
  swap_short_pips: '',
  status: 'approved',
  max_drawdown_pct: '',
  max_loss_per_trade_pct: '',
  insurance_enabled: true,
};

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MamPage() {
  const [allMasters, setAllMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Master | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Master | null>(null);
  const [form, setForm] = useState<MamFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Investors drawer — opens when admin clicks "Investors" on a MAM row.
  const [investorsMaster, setInvestorsMaster] = useState<Master | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loadingAllocs, setLoadingAllocs] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState<Allocation | null>(null);
  const [allocDraft, setAllocDraft] = useState<AllocationDraft | null>(null);
  const [savingAlloc, setSavingAlloc] = useState(false);

  const openInvestors = async (m: Master) => {
    setInvestorsMaster(m);
    setLoadingAllocs(true);
    try {
      const res = await adminApi.get<{ items: Allocation[] }>(
        `/business/masters/${m.id}/allocations`,
      );
      setAllocations(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load investors');
      setAllocations([]);
    } finally {
      setLoadingAllocs(false);
    }
  };

  const closeInvestors = () => {
    if (savingAlloc) return;
    setInvestorsMaster(null);
    setAllocations([]);
    setEditingAlloc(null);
    setAllocDraft(null);
  };

  const reloadInvestors = async () => {
    if (!investorsMaster) return;
    setLoadingAllocs(true);
    try {
      const res = await adminApi.get<{ items: Allocation[] }>(
        `/business/masters/${investorsMaster.id}/allocations`,
      );
      setAllocations(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Reload failed');
    } finally {
      setLoadingAllocs(false);
    }
  };

  const beginEditAlloc = (a: Allocation) => {
    setEditingAlloc(a);
    setAllocDraft({
      status: a.status,
      allocation_amount: String(a.allocation_amount ?? ''),
      max_drawdown_pct: a.max_drawdown_pct != null ? String(a.max_drawdown_pct) : '',
      max_lot_override: a.max_lot_override != null ? String(a.max_lot_override) : '',
      performance_fee_pct_override:
        a.performance_fee_pct_override != null ? String(a.performance_fee_pct_override) : '',
      admin_commission_pct_override:
        a.admin_commission_pct_override != null ? String(a.admin_commission_pct_override) : '',
      admin_notes: a.admin_notes || '',
    });
  };

  const cancelEditAlloc = () => {
    if (savingAlloc) return;
    setEditingAlloc(null);
    setAllocDraft(null);
  };

  // Empty-string in a numeric draft clears the override (sends null);
  // a typed 0 sends 0 so admin can pin a real 0% rate explicitly.
  const numOrNull = (s: string): number | null =>
    s.trim() === '' ? null : Number(s);

  const saveAlloc = async () => {
    if (!editingAlloc || !investorsMaster || !allocDraft) return;
    setSavingAlloc(true);
    try {
      const body: any = {
        status: allocDraft.status,
        allocation_amount: allocDraft.allocation_amount.trim() === ''
          ? undefined
          : Number(allocDraft.allocation_amount),
        max_drawdown_pct: numOrNull(allocDraft.max_drawdown_pct),
        max_lot_override: numOrNull(allocDraft.max_lot_override),
        performance_fee_pct_override: numOrNull(allocDraft.performance_fee_pct_override),
        admin_commission_pct_override: numOrNull(allocDraft.admin_commission_pct_override),
        admin_notes: allocDraft.admin_notes,
      };
      await adminApi.patch(
        `/business/masters/${investorsMaster.id}/allocations/${editingAlloc.id}`,
        body,
      );
      toast.success('Allocation updated');
      setEditingAlloc(null);
      setAllocDraft(null);
      await reloadInvestors();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingAlloc(false);
    }
  };

  const quickToggleStatus = async (a: Allocation) => {
    if (!investorsMaster) return;
    const next = a.status === 'active' ? 'paused' : 'active';
    try {
      await adminApi.patch(
        `/business/masters/${investorsMaster.id}/allocations/${a.id}`,
        { status: next },
      );
      toast.success(`${a.investor_name} ${next === 'active' ? 'resumed' : 'paused'}`);
      reloadInvestors();
    } catch (e: any) {
      toast.error(e.message || 'Status change failed');
    }
  };

  // The list endpoint is now scoped server-side via ?master_type=mamm
  // (client request 2026-06-01 #6 — PAMM rows were leaking in past the
  // client filter). We keep a defensive client-side filter so a stray
  // signal_provider row from a stale cache can't render here either.
  const masters = useMemo(
    () => allMasters.filter((m) => (m.master_type || '').toLowerCase() === 'mamm'),
    [allMasters],
  );

  const aggregateAum = useMemo(
    () => masters.reduce((sum, m) => sum + (Number(m.total_aum) || 0), 0),
    [masters],
  );
  const totalFollowers = useMemo(
    () => masters.reduce((sum, m) => sum + (m.active_followers || 0), 0),
    [masters],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Master[] }>(
        '/business/masters?master_type=mamm&per_page=200',
      );
      setAllMasters(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load MAM accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!showCreate) return;
    if (!userQuery || userQuery.length < 2) { setUserHits([]); return; }
    const t = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await adminApi.get<{ users: UserHit[] }>(
          `/users?search=${encodeURIComponent(userQuery)}&per_page=10`,
        );
        setUserHits(res.users || []);
      } catch {
        setUserHits([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery, showCreate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setUserQuery('');
    setUserHits([]);
    setShowCreate(true);
  };

  const openEdit = (m: Master) => {
    setEditTarget(m);
    setForm({
      user_id: m.user_id,
      user_label: `${m.provider_name} · ${m.email}`,
      performance_fee_pct: String(m.performance_fee_pct ?? 0),
      management_fee_pct: String(m.management_fee_pct ?? 0),
      admin_commission_pct: String(m.admin_commission_pct ?? 0),
      min_investment: String(m.min_investment ?? 0),
      max_investors: String(m.max_investors ?? 0),
      description: m.description || '',
      spread_markup_pips: m.spread_markup_pips != null ? String(m.spread_markup_pips) : '',
      commission_per_lot_usd: m.commission_per_lot_usd != null ? String(m.commission_per_lot_usd) : '',
      swap_long_pips: m.swap_long_pips != null ? String(m.swap_long_pips) : '',
      swap_short_pips: m.swap_short_pips != null ? String(m.swap_short_pips) : '',
      status: m.status,
      max_drawdown_pct: m.max_drawdown_pct != null && m.max_drawdown_pct > 0 ? String(m.max_drawdown_pct) : '',
      max_loss_per_trade_pct: m.max_loss_per_trade_pct != null ? String(m.max_loss_per_trade_pct) : '',
      insurance_enabled: m.insurance_enabled !== false,
    });
  };

  const closeModals = () => {
    if (saving) return;
    setShowCreate(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setUserQuery('');
    setUserHits([]);
  };

  const submitCreate = async () => {
    if (!form.user_id) { toast.error('Pick a user'); return; }
    setSaving(true);
    try {
      const body: any = {
        user_id: form.user_id,
        // Hard-locked — this page only mints MAM masters.
        master_type: 'mamm',
        performance_fee_pct: Number(form.performance_fee_pct) || 0,
        management_fee_pct: Number(form.management_fee_pct) || 0,
        admin_commission_pct: Number(form.admin_commission_pct) || 0,
        min_investment: Number(form.min_investment) || 0,
        max_investors: parseInt(form.max_investors, 10) || 100,
        description: form.description || null,
        spread_markup_pips: form.spread_markup_pips === '' ? null : Number(form.spread_markup_pips),
        commission_per_lot_usd: form.commission_per_lot_usd === '' ? null : Number(form.commission_per_lot_usd),
        swap_long_pips: form.swap_long_pips === '' ? null : Number(form.swap_long_pips),
        swap_short_pips: form.swap_short_pips === '' ? null : Number(form.swap_short_pips),
        max_drawdown_pct: form.max_drawdown_pct === '' ? null : Number(form.max_drawdown_pct),
        max_loss_per_trade_pct: form.max_loss_per_trade_pct === '' ? null : Number(form.max_loss_per_trade_pct),
        // Forced FALSE — insurance not available for MAM/PAMM (2026-06-01).
        insurance_enabled: false,
      };
      const res = await adminApi.post<{ pool_account_number: string }>('/business/masters', body);
      toast.success(`MAM created — pool account ${res.pool_account_number}`);
      closeModals();
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const body: any = {
        // Keep type stable — converting MAM ⇄ PAMM ⇄ Signal is done from Copy Masters.
        master_type: 'mamm',
        status: form.status,
        performance_fee_pct: Number(form.performance_fee_pct) || 0,
        management_fee_pct: Number(form.management_fee_pct) || 0,
        admin_commission_pct: Number(form.admin_commission_pct) || 0,
        min_investment: Number(form.min_investment) || 0,
        max_investors: parseInt(form.max_investors, 10) || 100,
        description: form.description || null,
        spread_markup_pips: form.spread_markup_pips === '' ? null : Number(form.spread_markup_pips),
        commission_per_lot_usd: form.commission_per_lot_usd === '' ? null : Number(form.commission_per_lot_usd),
        swap_long_pips: form.swap_long_pips === '' ? null : Number(form.swap_long_pips),
        swap_short_pips: form.swap_short_pips === '' ? null : Number(form.swap_short_pips),
        max_drawdown_pct: form.max_drawdown_pct === '' ? null : Number(form.max_drawdown_pct),
        max_loss_per_trade_pct: form.max_loss_per_trade_pct === '' ? null : Number(form.max_loss_per_trade_pct),
        // Forced FALSE — insurance not available for MAM/PAMM (2026-06-01).
        insurance_enabled: false,
      };
      await adminApi.put(`/business/masters/${editTarget.id}`, body);
      toast.success('MAM updated');
      closeModals();
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.delete<{
        message: string;
        master_sweep: number;
        followers_refunded: number;
        total_refunded_to_followers: number;
      }>(`/business/masters/${deleteTarget.id}`);
      toast.success(
        `${deleteTarget.provider_name} deleted — ${res.followers_refunded} investor(s) refunded $${fmtMoney(res.total_refunded_to_followers)}, MAM wallet +$${fmtMoney(res.master_sweep)}`,
        { duration: 7000 },
      );
      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const isEditing = !!editTarget;
  const modalOpen = showCreate || isEditing;

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Layers size={18} className="text-accent" /> MAM Accounts
            </h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Multi-Account Manager — one master, many sub-accounts copied by lot ratio.
              Per-master spread &amp; commission overrides layer on top of the global SpreadConfig / ChargeConfig.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast"
            >
              <Plus size={13} /> New MAM
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-secondary border border-border-primary rounded-md px-4 py-3">
            <p className="text-xxs text-text-tertiary uppercase tracking-wide">Active MAMs</p>
            <p className="text-lg font-semibold text-text-primary mt-1 tabular-nums">
              {loading ? '—' : masters.filter((m) => m.status === 'approved' || m.status === 'active').length}
            </p>
            <p className="text-xxs text-text-tertiary mt-0.5">of {loading ? '—' : masters.length} total</p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-md px-4 py-3">
            <p className="text-xxs text-text-tertiary uppercase tracking-wide">Aggregate AUM</p>
            <p className="text-lg font-semibold text-success mt-1 font-mono tabular-nums">
              ${loading ? '—' : fmtMoney(aggregateAum)}
            </p>
            <p className="text-xxs text-text-tertiary mt-0.5">across all MAM pools</p>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-md px-4 py-3">
            <p className="text-xxs text-text-tertiary uppercase tracking-wide">Total Investors</p>
            <p className="text-lg font-semibold text-text-primary mt-1 tabular-nums">
              {loading ? '—' : totalFollowers}
            </p>
            <p className="text-xxs text-text-tertiary mt-0.5">active allocations</p>
          </div>
          <AdminCommissionCard />
        </div>

        {/* Admin commission breakdown — per-master estimate */}
        <AdminCommissionBreakdown />


        <div className="bg-bg-secondary border border-border-primary rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : masters.length === 0 ? (
            <div className="text-center py-16 text-xs text-text-tertiary">
              <Layers size={28} className="mx-auto mb-3 text-text-tertiary/50" />
              No MAM accounts yet
              <p className="text-xxs mt-1">Click <span className="text-accent font-medium">New MAM</span> to spin up your first multi-account manager.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Name', 'Status', 'Investors', 'AUM', 'ROI', 'Perf Fee', 'Mgmt Fee', 'Spread Mkup', 'Comm/Lot', 'Actions'].map((col) => (
                      <th
                        key={col}
                        className={cn(
                          'text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                          ['Investors', 'AUM', 'ROI', 'Perf Fee', 'Mgmt Fee', 'Spread Mkup', 'Comm/Lot'].includes(col) && 'text-right',
                          col === 'Actions' && 'text-right',
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m) => (
                    <tr key={m.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-text-tertiary" />
                          <span className="text-xs text-text-primary font-medium">{m.provider_name}</span>
                        </div>
                        <p className="text-xxs text-text-tertiary mt-0.5">{m.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'text-xxs px-1.5 py-0.5 rounded-sm font-medium capitalize',
                            m.status === 'approved' || m.status === 'active'
                              ? 'bg-success/15 text-success'
                              : m.status === 'pending'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-danger/15 text-danger',
                          )}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono tabular-nums text-text-primary">{m.active_followers}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono tabular-nums text-success">${fmtMoney(m.total_aum)}</td>
                      <td className={cn('px-4 py-2.5 text-xs text-right font-mono tabular-nums', m.total_return_pct >= 0 ? 'text-success' : 'text-danger')}>
                        {m.total_return_pct >= 0 ? '+' : ''}{m.total_return_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono text-text-primary">{m.performance_fee_pct}%</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono text-text-primary">{m.management_fee_pct}%</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono">
                        {m.spread_markup_pips != null ? (
                          <span className="text-accent">+{m.spread_markup_pips} p</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono">
                        {m.commission_per_lot_usd != null ? (
                          <span className="text-accent">${m.commission_per_lot_usd}</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openInvestors(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-fast"
                          >
                            <UserCog size={11} /> Investors
                          </button>
                          <button
                            onClick={() => openEdit(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-fast"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={closeModals}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                {isEditing ? `Edit MAM — ${editTarget?.provider_name}` : 'Create MAM Account'}
              </h3>
              <button onClick={closeModals} className="text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {!isEditing && (
                <div>
                  <label className="block text-xxs text-text-tertiary uppercase mb-1">User</label>
                  {form.user_id ? (
                    <div className="flex items-center justify-between bg-bg-tertiary border border-border-primary rounded-md px-3 py-2">
                      <span className="text-xs text-text-primary">{form.user_label}</span>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, user_id: '', user_label: '' }))}
                        className="text-text-tertiary hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                        <input
                          autoFocus
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Search by email or name…"
                          className="w-full pl-8 pr-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                        />
                      </div>
                      {(searchingUsers || userHits.length > 0) && (
                        <div className="mt-1 border border-border-primary rounded-md bg-bg-tertiary max-h-40 overflow-y-auto">
                          {searchingUsers ? (
                            <div className="py-2 text-center text-xxs text-text-tertiary">Searching…</div>
                          ) : (
                            userHits.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  user_id: u.id,
                                  user_label: `${u.first_name || ''} ${u.last_name || ''}`.trim() + ` · ${u.email}`,
                                }))}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-bg-hover border-b border-border-primary/40 last:border-b-0"
                              >
                                <span className="text-text-primary">{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</span>
                                <span className="text-text-tertiary ml-1.5">· {u.email}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary uppercase mb-1">Type</label>
                  <div className="w-full px-3 py-2 text-xs bg-bg-tertiary/60 border border-border-primary rounded-md text-text-primary flex items-center gap-2">
                    <Layers size={12} className="text-accent" />
                    <span className="font-medium">MAM</span>
                    <span className="text-text-tertiary text-xxs">(locked on this page)</span>
                  </div>
                </div>
                {isEditing && (
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: 'performance_fee_pct', label: 'Perf Fee %', step: '0.01' },
                  { k: 'management_fee_pct', label: 'Mgmt Fee %', step: '0.01' },
                  { k: 'admin_commission_pct', label: 'Admin Comm %', step: '0.01' },
                ].map((f) => (
                  <div key={f.k}>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">{f.label}</label>
                    <input
                      type="number"
                      step={f.step}
                      value={(form as any)[f.k]}
                      onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary uppercase mb-1">Min Investment $</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.min_investment}
                    onChange={(e) => setForm((s) => ({ ...s, min_investment: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary uppercase mb-1">Max Investors</label>
                  <input
                    type="number"
                    step="1"
                    value={form.max_investors}
                    onChange={(e) => setForm((s) => ({ ...s, max_investors: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="rounded-md bg-accent/5 border border-accent/30 p-3 space-y-3">
                <div>
                  <p className="text-xxs font-semibold text-accent flex items-center gap-1">
                    <DollarSign size={11} /> Per-MAM trade-cost overrides
                  </p>
                  <p className="text-xxs text-text-tertiary mt-0.5">
                    Layer on top of the global SpreadConfig / ChargeConfig. Leave blank to fall through to the resolver.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Spread (pips)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 1.5"
                      value={form.spread_markup_pips}
                      onChange={(e) => setForm((s) => ({ ...s, spread_markup_pips: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">REPLACES resolved spread (account-type ignored on pool fills).</p>
                  </div>
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Commission $/lot</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7.00"
                      value={form.commission_per_lot_usd}
                      onChange={(e) => setForm((s) => ({ ...s, commission_per_lot_usd: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Replaces resolved commission.</p>
                  </div>
                </div>
                {/* Swap overrides — Mig 0067. Daily long / short pips
                    charged on overnight positions; NULL falls through
                    to swap_configs. */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Swap Long (pips/day)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. -2.5"
                      value={form.swap_long_pips}
                      onChange={(e) => setForm((s) => ({ ...s, swap_long_pips: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Overnight charge on BUY positions.</p>
                  </div>
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Swap Short (pips/day)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. -1.3"
                      value={form.swap_short_pips}
                      onChange={(e) => setForm((s) => ({ ...s, swap_short_pips: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Overnight charge on SELL positions.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-amber-500/5 border border-amber-500/30 p-3 space-y-3">
                <div>
                  <p className="text-xxs font-semibold text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={11} /> Admin-set risk controls
                  </p>
                  <p className="text-xxs text-text-tertiary mt-0.5">
                    Investors don&apos;t see these — they&apos;re yours to set per master. Mig 0066.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Max drawdown %</label>
                    <input
                      type="number" step="0.1" min="0" max="100"
                      placeholder="0 = disabled"
                      value={form.max_drawdown_pct}
                      onChange={(e) => setForm((s) => ({ ...s, max_drawdown_pct: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Peak-to-trough equity halt.</p>
                  </div>
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Max loss / trade %</label>
                    <input
                      type="number" step="0.1" min="0" max="100"
                      placeholder="blank = no cap"
                      value={form.max_loss_per_trade_pct}
                      onChange={(e) => setForm((s) => ({ ...s, max_loss_per_trade_pct: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Single-trade loss cap (% of pool equity).</p>
                  </div>
                </div>
                {/* Insurance toggle removed 2026-06-01 — insurance is
                    not available for MAM/PAMM accounts platform-wide.
                    The column stays in master_accounts for record but
                    is forced FALSE on create / update so legacy data
                    can't surface the option to investors. */}
              </div>

              <div>
                <label className="block text-xxs text-text-tertiary uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={closeModals}
                disabled={saving}
                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={isEditing ? submitEdit : submitCreate}
                disabled={saving || (!isEditing && !form.user_id)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : isEditing ? <Pencil size={13} /> : <Plus size={13} />}
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create MAM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investors drawer — slide-in panel listing every InvestorAllocation
          on a MAM with admin override controls per investor. */}
      {investorsMaster && (
        <div className="fixed inset-0 z-[990] bg-black/60 flex justify-end" onClick={closeInvestors}>
          <div
            className="bg-bg-secondary border-l border-border-primary w-full max-w-3xl h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-5 py-4 border-b border-border-primary bg-bg-secondary flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <UserCog size={14} className="text-primary" />
                  Investors in {investorsMaster.provider_name}
                </h3>
                <p className="text-xxs text-text-tertiary mt-0.5">
                  Master defaults: perf {investorsMaster.performance_fee_pct}% · admin {investorsMaster.admin_commission_pct}%.
                  Per-investor overrides take precedence on the next copy-close.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reloadInvestors}
                  disabled={loadingAllocs}
                  className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingAllocs ? 'animate-spin' : ''} />
                </button>
                <button onClick={closeInvestors} className="text-text-tertiary hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {loadingAllocs ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-text-tertiary" />
                </div>
              ) : allocations.length === 0 ? (
                <div className="text-center py-16 text-xs text-text-tertiary">
                  No investors allocated yet
                </div>
              ) : (
                <div className="space-y-3">
                  {allocations.map((a) => {
                    const isEditing = editingAlloc?.id === a.id;
                    const isOverride = a.performance_fee_pct_override != null;
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-md border bg-bg-tertiary/50 transition-fast',
                          isEditing ? 'border-accent/50 shadow-card' : 'border-border-primary',
                        )}
                      >
                        <div className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-text-primary truncate">{a.investor_name}</span>
                              <span
                                className={cn(
                                  'text-xxs px-1.5 py-0.5 rounded-sm font-medium capitalize',
                                  a.status === 'active' ? 'bg-success/15 text-success'
                                    : a.status === 'paused' ? 'bg-warning/15 text-warning'
                                      : 'bg-text-tertiary/15 text-text-tertiary',
                                )}
                              >
                                {a.status}
                              </span>
                              <span className="text-xxs text-text-tertiary uppercase tracking-wide">{a.copy_type}</span>
                              {isOverride && (
                                <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent font-medium">
                                  custom fee
                                </span>
                              )}
                            </div>
                            <p className="text-xxs text-text-tertiary mt-0.5 truncate">
                              {a.investor_email}
                              {a.account_number ? ` · ${a.account_number}` : ''}
                            </p>
                            <div className="mt-2 grid grid-cols-4 gap-3 text-xxs">
                              <div>
                                <p className="text-text-tertiary uppercase">Allocated</p>
                                <p className="font-mono text-text-primary">${fmtMoney(a.allocation_amount)}</p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase">Equity</p>
                                <p className="font-mono text-text-primary">
                                  {a.account_equity != null ? `$${fmtMoney(a.account_equity)}` : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase">Realised P/L</p>
                                <p className={cn('font-mono', a.total_profit >= 0 ? 'text-success' : 'text-danger')}>
                                  {a.total_profit >= 0 ? '+' : ''}${fmtMoney(a.total_profit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase">Eff. fee</p>
                                <p className="font-mono text-accent">
                                  {a.effective_performance_fee_pct}% / {a.effective_admin_commission_pct}%
                                </p>
                              </div>
                            </div>
                          </div>
                          {!isEditing && (
                            <div className="shrink-0 flex flex-col gap-1.5">
                              <button
                                onClick={() => beginEditAlloc(a)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              {a.status === 'closed' ? null : (
                                <button
                                  onClick={() => quickToggleStatus(a)}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium border',
                                    a.status === 'active'
                                      ? 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25'
                                      : 'bg-success/15 text-success border-success/30 hover:bg-success/25',
                                  )}
                                >
                                  {a.status === 'active' ? (
                                    <><PauseCircle size={11} /> Pause</>
                                  ) : (
                                    <><PlayCircle size={11} /> Resume</>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing && allocDraft && (
                          <div className="px-4 pb-4 pt-1 border-t border-border-primary/60 space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Status</label>
                                <select
                                  value={allocDraft.status}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, status: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                >
                                  <option value="active">Active</option>
                                  <option value="paused">Paused</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Allocation $</label>
                                <input
                                  type="number" step="0.01"
                                  value={allocDraft.allocation_amount}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, allocation_amount: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Max DD %</label>
                                <input
                                  type="number" step="0.01"
                                  placeholder="inherit"
                                  value={allocDraft.max_drawdown_pct}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, max_drawdown_pct: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Max lot override</label>
                                <input
                                  type="number" step="0.01"
                                  placeholder="no cap"
                                  value={allocDraft.max_lot_override}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, max_lot_override: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">
                                  Perf fee % override
                                </label>
                                <input
                                  type="number" step="0.01"
                                  placeholder={`inherit (${investorsMaster.performance_fee_pct}%)`}
                                  value={allocDraft.performance_fee_pct_override}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, performance_fee_pct_override: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                                <p className="text-xxs text-text-tertiary mt-1">Empty = master default. Type 0 to pin 0%.</p>
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">
                                  Admin cut % override
                                </label>
                                <input
                                  type="number" step="0.01"
                                  placeholder={`inherit (${investorsMaster.admin_commission_pct}%)`}
                                  value={allocDraft.admin_commission_pct_override}
                                  onChange={(e) => setAllocDraft((d) => d ? { ...d, admin_commission_pct_override: e.target.value } : d)}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                                <p className="text-xxs text-text-tertiary mt-1">% of perf fee that goes to broker.</p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xxs text-text-tertiary uppercase mb-1">Admin notes</label>
                              <textarea
                                rows={2}
                                placeholder="Why this deal? Ticket #, agreement ref, …"
                                value={allocDraft.admin_notes}
                                onChange={(e) => setAllocDraft((d) => d ? { ...d, admin_notes: e.target.value } : d)}
                                className="w-full px-2 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent resize-none"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={cancelEditAlloc}
                                disabled={savingAlloc}
                                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveAlloc}
                                disabled={savingAlloc}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {savingAlloc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                {savingAlloc ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}

                        {!isEditing && a.admin_notes && (
                          <div className="px-4 pb-3 -mt-1">
                            <p className="text-xxs text-text-tertiary italic">
                              <span className="text-text-secondary not-italic">Note:</span> {a.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Investors drawer — per-MAM allocation control */}
      {investorsMaster && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex justify-end" onClick={closeInvestors}>
          <div
            className="bg-bg-secondary border-l border-border-primary shadow-modal h-full w-full max-w-3xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-primary flex items-start justify-between sticky top-0 bg-bg-secondary z-10">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <UserCog size={14} className="text-accent" />
                  Investors — {investorsMaster.provider_name}
                </h3>
                <p className="text-xxs text-text-tertiary mt-0.5">
                  Master defaults · Perf {investorsMaster.performance_fee_pct}% · Admin {investorsMaster.admin_commission_pct}%.
                  Per-investor overrides below take precedence on close.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reloadInvestors}
                  disabled={loadingAllocs}
                  className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingAllocs ? 'animate-spin' : ''} />
                </button>
                <button onClick={closeInvestors} className="text-text-tertiary hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {loadingAllocs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={18} className="animate-spin text-text-tertiary" />
                </div>
              ) : allocations.length === 0 ? (
                <div className="text-center py-12 text-xs text-text-tertiary">
                  <Users size={24} className="mx-auto mb-2 text-text-tertiary/50" />
                  No investors allocated yet.
                </div>
              ) : (
                allocations.map((a) => {
                  const isEditing = editingAlloc?.id === a.id;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'rounded-md border bg-bg-tertiary/40 px-4 py-3',
                        isEditing ? 'border-accent/60 ring-1 ring-accent/30' : 'border-border-primary',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{a.investor_name}</p>
                          <p className="text-xxs text-text-tertiary truncate">
                            {a.investor_email}
                            {a.account_number && <> · acct {a.account_number}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={cn(
                              'text-xxs px-1.5 py-0.5 rounded-sm font-medium capitalize',
                              a.status === 'active'
                                ? 'bg-success/15 text-success'
                                : a.status === 'paused'
                                  ? 'bg-warning/15 text-warning'
                                  : 'bg-text-tertiary/15 text-text-tertiary',
                            )}
                          >
                            {a.status}
                          </span>
                          {!isEditing && a.status !== 'closed' && (
                            <button
                              onClick={() => quickToggleStatus(a)}
                              title={a.status === 'active' ? 'Pause' : 'Resume'}
                              className="p-1 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
                            >
                              {a.status === 'active'
                                ? <PauseCircle size={12} />
                                : <PlayCircle size={12} className="text-success" />}
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              onClick={() => beginEditAlloc(a)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xxs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {!isEditing ? (
                        <div className="grid grid-cols-4 gap-2 mt-3 text-xxs">
                          <div>
                            <p className="text-text-tertiary uppercase">Type</p>
                            <p className="text-text-primary font-medium capitalize mt-0.5">{a.copy_type}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary uppercase">Allocated</p>
                            <p className="text-text-primary font-mono tabular-nums mt-0.5">${fmtMoney(a.allocation_amount)}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary uppercase">Eff Perf %</p>
                            <p className={cn(
                              'font-mono tabular-nums mt-0.5',
                              a.performance_fee_pct_override != null ? 'text-accent font-semibold' : 'text-text-primary',
                            )}>
                              {a.effective_performance_fee_pct}%
                              {a.performance_fee_pct_override != null && <span className="text-text-tertiary"> *</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-tertiary uppercase">Eff Admin %</p>
                            <p className={cn(
                              'font-mono tabular-nums mt-0.5',
                              a.admin_commission_pct_override != null ? 'text-accent font-semibold' : 'text-text-primary',
                            )}>
                              {a.effective_admin_commission_pct}%
                              {a.admin_commission_pct_override != null && <span className="text-text-tertiary"> *</span>}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-text-tertiary uppercase">P/L</p>
                            <p className={cn(
                              'font-mono tabular-nums mt-0.5',
                              a.total_profit >= 0 ? 'text-success' : 'text-danger',
                            )}>
                              {a.total_profit >= 0 ? '+' : ''}${fmtMoney(a.total_profit)}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-text-tertiary uppercase">Max DD / Max Lot</p>
                            <p className="text-text-primary font-mono tabular-nums mt-0.5">
                              {a.max_drawdown_pct != null ? `${a.max_drawdown_pct}%` : '—'}
                              {' / '}
                              {a.max_lot_override != null ? a.max_lot_override : '—'}
                            </p>
                          </div>
                          {a.admin_notes && (
                            <div className="col-span-4 mt-1 rounded-sm bg-bg-tertiary/60 border border-border-primary/40 px-2 py-1.5">
                              <p className="text-text-tertiary uppercase text-xxs">Admin notes</p>
                              <p className="text-text-secondary mt-0.5 whitespace-pre-wrap">{a.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        allocDraft && (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Status</label>
                                <select
                                  value={allocDraft.status}
                                  onChange={(e) => setAllocDraft((d) => d && ({ ...d, status: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                >
                                  <option value="active">Active</option>
                                  <option value="paused">Paused</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Allocation $</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={allocDraft.allocation_amount}
                                  onChange={(e) => setAllocDraft((d) => d && ({ ...d, allocation_amount: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                            </div>

                            <div className="rounded-md bg-accent/5 border border-accent/30 p-2.5 space-y-2">
                              <p className="text-xxs font-semibold text-accent flex items-center gap-1">
                                <DollarSign size={11} /> Per-investor commission overrides
                              </p>
                              <p className="text-xxs text-text-tertiary">
                                Empty = inherit master defaults. Type a number (incl. 0) to pin a custom rate just for this investor.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xxs text-text-tertiary uppercase mb-1">
                                    Perf Fee % (master: {investorsMaster.performance_fee_pct}%)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="inherit"
                                    value={allocDraft.performance_fee_pct_override}
                                    onChange={(e) => setAllocDraft((d) => d && ({ ...d, performance_fee_pct_override: e.target.value }))}
                                    className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xxs text-text-tertiary uppercase mb-1">
                                    Admin/Broker % (master: {investorsMaster.admin_commission_pct}%)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="inherit"
                                    value={allocDraft.admin_commission_pct_override}
                                    onChange={(e) => setAllocDraft((d) => d && ({ ...d, admin_commission_pct_override: e.target.value }))}
                                    className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Max Drawdown %</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="none"
                                  value={allocDraft.max_drawdown_pct}
                                  onChange={(e) => setAllocDraft((d) => d && ({ ...d, max_drawdown_pct: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div>
                                <label className="block text-xxs text-text-tertiary uppercase mb-1">Max Lot Override</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="none"
                                  value={allocDraft.max_lot_override}
                                  onChange={(e) => setAllocDraft((d) => d && ({ ...d, max_lot_override: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xxs text-text-tertiary uppercase mb-1">Admin notes</label>
                              <textarea
                                rows={2}
                                placeholder="Ticket #, deal context, anything future-admin should know."
                                value={allocDraft.admin_notes}
                                onChange={(e) => setAllocDraft((d) => d && ({ ...d, admin_notes: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent resize-none"
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={cancelEditAlloc}
                                disabled={savingAlloc}
                                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveAlloc}
                                disabled={savingAlloc}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {savingAlloc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                {savingAlloc ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border-primary flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-danger" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Delete MAM Account?</h3>
                  <p className="text-xxs text-text-tertiary mt-0.5">{deleteTarget.provider_name} · {deleteTarget.email}</p>
                </div>
              </div>
              <button onClick={() => !deleting && setDeleteTarget(null)} className="text-text-tertiary hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="rounded-md bg-bg-tertiary border border-border-primary p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Active Investors</span>
                  <span className="font-semibold text-text-primary">{deleteTarget.active_followers}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Total AUM</span>
                  <span className="font-semibold text-success font-mono">${fmtMoney(deleteTarget.total_aum)}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Master Type</span>
                  <span className="font-semibold text-text-primary">MAM</span>
                </div>
              </div>

              <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xxs text-text-secondary">
                <p className="font-semibold text-warning mb-1.5 flex items-center gap-1">
                  <DollarSign size={12} /> What happens on delete:
                </p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>All open positions (MAM + investors) close at open price (0 P/L)</li>
                  <li>MAM&apos;s trading account balance → MAM user&apos;s main wallet</li>
                  <li>Each investor&apos;s copy account balance → investor&apos;s main wallet</li>
                  <li>All active allocations marked &lsquo;closed&rsquo;</li>
                  <li>MAM record permanently deleted</li>
                </ul>
              </div>

              <p className="text-xxs text-danger font-semibold">⚠ This cannot be undone.</p>
            </div>

            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deleting…' : 'Delete MAM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ─── Admin Commission cards ─────────────────────────────────────────

interface CommissionSummary {
  lifetime_total: number;
  breakdown_total_estimate: number;
  by_master: {
    master_id: string;
    provider_name: string;
    email: string;
    master_type: string;
    admin_commission_pct: number;
    master_net_earned: number;
    admin_earned_estimate: number;
  }[];
}

function useCommissionSummary() {
  const [data, setData] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<CommissionSummary>(
          '/business/masters/admin-commission-summary?master_type=mamm',
        );
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData({ lifetime_total: 0, breakdown_total_estimate: 0, by_master: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { data, loading };
}

function AdminCommissionCard() {
  const { data, loading } = useCommissionSummary();
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md px-4 py-3">
      <p className="text-xxs text-text-tertiary uppercase tracking-wide">Admin commission</p>
      <p className="text-lg font-semibold text-accent mt-1 font-mono tabular-nums">
        {loading || !data ? '—' : `$${fmtMoney(data.lifetime_total)}`}
      </p>
      <p className="text-xxs text-text-tertiary mt-0.5">lifetime (all master types)</p>
    </div>
  );
}

function AdminCommissionBreakdown() {
  const { data, loading } = useCommissionSummary();
  if (loading || !data || data.by_master.length === 0) {
    return null;
  }
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md">
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Admin commission — by master</h2>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Estimated admin slice per MAM, derived from
            <span className="text-text-secondary"> master.total_fee_earned </span>
            ×<span className="text-text-secondary"> admin_pct / (100 − admin_pct)</span>.
            Lifetime sum: <span className="text-accent font-mono">${fmtMoney(data.lifetime_total)}</span>
            {data.breakdown_total_estimate > 0 && (
              <> · breakdown estimate <span className="text-text-secondary font-mono">${fmtMoney(data.breakdown_total_estimate)}</span></>
            )}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/40">
              <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Master</th>
              <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Admin %</th>
              <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Master net</th>
              <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Admin earned (est)</th>
            </tr>
          </thead>
          <tbody>
            {data.by_master.map((r) => (
              <tr key={r.master_id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                <td className="px-4 py-2.5">
                  <div className="text-xs text-text-primary">{r.provider_name}</div>
                  <div className="text-xxs text-text-tertiary">{r.email}</div>
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-text-secondary">
                  {r.admin_commission_pct.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-text-primary">
                  ${fmtMoney(r.master_net_earned)}
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-accent font-semibold">
                  ${fmtMoney(r.admin_earned_estimate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
