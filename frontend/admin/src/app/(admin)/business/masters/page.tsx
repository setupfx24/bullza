'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Loader2, RefreshCw, Trash2, Users, DollarSign, AlertTriangle, X,
  Plus, Pencil, Search,
} from 'lucide-react';

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
  created_at: string | null;
}

interface UserHit {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface MasterFormState {
  user_id: string;
  user_label: string;
  master_type: string;
  performance_fee_pct: string;
  management_fee_pct: string;
  admin_commission_pct: string;
  min_investment: string;
  max_investors: string;
  description: string;
  spread_markup_pips: string;
  commission_per_lot_usd: string;
  status: string;
}

const EMPTY_FORM: MasterFormState = {
  user_id: '',
  user_label: '',
  master_type: 'pamm',
  performance_fee_pct: '20',
  management_fee_pct: '0',
  admin_commission_pct: '0',
  min_investment: '100',
  max_investors: '100',
  description: '',
  spread_markup_pips: '',
  commission_per_lot_usd: '',
  status: 'approved',
};

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MastersPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Master | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Master | null>(null);
  const [form, setForm] = useState<MasterFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // User picker (create only)
  const [userQuery, setUserQuery] = useState('');
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: Master[] }>('/business/masters');
      setMasters(res.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load masters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounced user search for create modal
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
      master_type: m.master_type,
      performance_fee_pct: String(m.performance_fee_pct ?? 0),
      management_fee_pct: String(m.management_fee_pct ?? 0),
      admin_commission_pct: String(m.admin_commission_pct ?? 0),
      min_investment: String(m.min_investment ?? 0),
      max_investors: String(m.max_investors ?? 0),
      description: m.description || '',
      spread_markup_pips: m.spread_markup_pips != null ? String(m.spread_markup_pips) : '',
      commission_per_lot_usd: m.commission_per_lot_usd != null ? String(m.commission_per_lot_usd) : '',
      status: m.status,
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
        master_type: form.master_type,
        performance_fee_pct: Number(form.performance_fee_pct) || 0,
        management_fee_pct: Number(form.management_fee_pct) || 0,
        admin_commission_pct: Number(form.admin_commission_pct) || 0,
        min_investment: Number(form.min_investment) || 0,
        max_investors: parseInt(form.max_investors, 10) || 100,
        description: form.description || null,
        spread_markup_pips: form.spread_markup_pips === '' ? null : Number(form.spread_markup_pips),
        commission_per_lot_usd: form.commission_per_lot_usd === '' ? null : Number(form.commission_per_lot_usd),
      };
      const res = await adminApi.post<{ pool_account_number: string }>('/business/masters', body);
      toast.success(`Master created — pool account ${res.pool_account_number}`);
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
        master_type: form.master_type,
        status: form.status,
        performance_fee_pct: Number(form.performance_fee_pct) || 0,
        management_fee_pct: Number(form.management_fee_pct) || 0,
        admin_commission_pct: Number(form.admin_commission_pct) || 0,
        min_investment: Number(form.min_investment) || 0,
        max_investors: parseInt(form.max_investors, 10) || 100,
        description: form.description || null,
        spread_markup_pips: form.spread_markup_pips === '' ? null : Number(form.spread_markup_pips),
        commission_per_lot_usd: form.commission_per_lot_usd === '' ? null : Number(form.commission_per_lot_usd),
      };
      await adminApi.put(`/business/masters/${editTarget.id}`, body);
      toast.success('Master updated');
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
        `${deleteTarget.provider_name} deleted — ${res.followers_refunded} follower(s) refunded $${fmtMoney(res.total_refunded_to_followers)}, master wallet +$${fmtMoney(res.master_sweep)}`,
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
            <h1 className="text-lg font-semibold text-text-primary">Copy-Trade Masters</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              PAMM / MAM / signal providers. Per-master spread &amp; commission overrides layer on top of the global SpreadConfig / ChargeConfig.
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
              <Plus size={13} /> New Master
            </button>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : masters.length === 0 ? (
            <div className="text-center py-16 text-xs text-text-tertiary">No masters found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['Name', 'Type', 'Status', 'Followers', 'AUM', 'ROI', 'Perf Fee', 'Spread Mkup', 'Comm/Lot', 'Actions'].map((col) => (
                      <th
                        key={col}
                        className={cn(
                          'text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                          ['Followers', 'AUM', 'ROI', 'Perf Fee', 'Spread Mkup', 'Comm/Lot'].includes(col) && 'text-right',
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
                        <span className="text-xxs px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-medium capitalize">
                          {m.master_type.replace('_', ' ')}
                        </span>
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
                {isEditing ? `Edit Master — ${editTarget?.provider_name}` : 'Create Copy-Trade Master'}
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
                  <select
                    value={form.master_type}
                    onChange={(e) => setForm((f) => ({ ...f, master_type: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                  >
                    <option value="pamm">PAMM</option>
                    <option value="mamm">MAM</option>
                    <option value="signal_provider">Signal Provider</option>
                  </select>
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
                    <DollarSign size={11} /> Per-master trade-cost overrides
                  </p>
                  <p className="text-xxs text-text-tertiary mt-0.5">
                    Layer on top of the global SpreadConfig / ChargeConfig. Leave blank to fall through to the resolver.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xxs text-text-tertiary uppercase mb-1">Spread Markup (pips)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 1.5"
                      value={form.spread_markup_pips}
                      onChange={(e) => setForm((s) => ({ ...s, spread_markup_pips: e.target.value }))}
                      className="w-full px-3 py-2 text-xs font-mono bg-bg-tertiary border border-border-primary rounded-md focus:outline-none focus:border-accent"
                    />
                    <p className="text-xxs text-text-tertiary mt-1">Added to resolved spread.</p>
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
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Master'}
              </button>
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
                  <h3 className="text-sm font-semibold text-text-primary">Delete Copy-Trade Master?</h3>
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
                  <span className="text-text-tertiary">Active Followers</span>
                  <span className="font-semibold text-text-primary">{deleteTarget.active_followers}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Total AUM</span>
                  <span className="font-semibold text-success font-mono">${fmtMoney(deleteTarget.total_aum)}</span>
                </div>
                <div className="flex items-center justify-between text-xxs">
                  <span className="text-text-tertiary">Master Type</span>
                  <span className="font-semibold text-text-primary capitalize">{deleteTarget.master_type.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xxs text-text-secondary">
                <p className="font-semibold text-warning mb-1.5 flex items-center gap-1">
                  <DollarSign size={12} /> What happens on delete:
                </p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>All open positions (master + followers) close at open price (0 P/L)</li>
                  <li>Master&apos;s trading account balance → master&apos;s main wallet</li>
                  <li>Each follower&apos;s copy account balance → follower&apos;s main wallet</li>
                  <li>All active allocations marked &lsquo;closed&rsquo;</li>
                  <li>Master record permanently deleted</li>
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
                {deleting ? 'Deleting…' : 'Delete Master'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
