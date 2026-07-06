'use client';

/**
 * SwisDex Expenses — a Tally/Excel-style ledger of the broker's own business
 * expenses (rent, salaries, marketing, …). Columns: Date, Name, Amount,
 * Reason, Result. Admin-managed CRUD via /analytics-adjacent /expenses API
 * (super_admin only). Separate from Promotional Expenses (user give-aways).
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2, Pencil, X, Receipt } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Expense {
  id: string;
  expense_date: string;
  name: string;
  amount: number;
  reason: string | null;
  result: string | null;
  created_at: string | null;
}

const fmt = (n: number) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ expense_date: today(), name: '', amount: '', reason: '', result: '' });

export default function SwisDexExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi.get<{ items: Expense[]; total: number }>('/expenses');
      setRows(d.items || []);
      setTotal(d.total || 0);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      expense_date: e.expense_date || today(),
      name: e.name, amount: String(e.amount),
      reason: e.reason || '', result: e.result || '',
    });
    setOpen(true);
  };

  const save = async () => {
    const amt = parseFloat(form.amount);
    if (!form.expense_date) return toast.error('Date is required');
    if (!form.name.trim()) return toast.error('Name is required');
    if (!amt || amt <= 0) return toast.error('Amount must be greater than zero');
    setSaving(true);
    try {
      const body = {
        expense_date: form.expense_date,
        name: form.name.trim(),
        amount: amt,
        reason: form.reason.trim() || undefined,
        result: form.result.trim() || undefined,
      };
      if (editing) await adminApi.put(`/expenses/${editing.id}`, body);
      else await adminApi.post('/expenses', body);
      toast.success(editing ? 'Expense updated' : 'Expense added');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: Expense) => {
    if (!window.confirm(`Delete "${e.name}" (${fmt(e.amount)})?`)) return;
    try {
      await adminApi.delete(`/expenses/${e.id}`);
      toast.success('Deleted');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Receipt size={18} className="text-accent" /> SwisDex Expenses
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Company operating-expense ledger. Records persist like a Tally / Excel book.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="text-xs inline-flex items-center gap-1 rounded-md bg-accent text-white px-3 py-2 hover:opacity-90"
        >
          <Plus size={14} /> Add Expense
        </button>
      </div>

      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary bg-bg-tertiary/40">
          <span className="text-xxs uppercase tracking-wide text-text-tertiary">Total expenses</span>
          <span className="font-mono font-semibold text-text-primary">{fmt(total)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-text-tertiary text-xxs uppercase tracking-wide border-b border-border-primary">
                <th className="text-left py-2.5 px-4">Date</th>
                <th className="text-left py-2.5 px-4">Name</th>
                <th className="text-right py-2.5 px-4">Amount</th>
                <th className="text-left py-2.5 px-4">Reason</th>
                <th className="text-left py-2.5 px-4">Result</th>
                <th className="text-right py-2.5 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="animate-spin inline text-text-tertiary" size={18} /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-text-tertiary text-xs">No expenses recorded yet.</td></tr>
              )}
              {!loading && rows.map((e) => (
                <tr key={e.id} className="border-b border-border-primary/50 hover:bg-bg-hover/30">
                  <td className="py-2.5 px-4 text-text-secondary whitespace-nowrap">{e.expense_date}</td>
                  <td className="py-2.5 px-4 text-text-primary">{e.name}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-text-primary whitespace-nowrap">{fmt(e.amount)}</td>
                  <td className="py-2.5 px-4 text-text-secondary max-w-[220px] truncate" title={e.reason || ''}>{e.reason || '—'}</td>
                  <td className="py-2.5 px-4 text-text-secondary max-w-[220px] truncate" title={e.result || ''}>{e.result || '—'}</td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-primary" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => remove(e)} className="p-1.5 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-sell" title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-bg-secondary border border-border-primary rounded-xl shadow-modal">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary">
              <h2 className="text-sm font-bold text-text-primary">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xxs text-text-tertiary uppercase tracking-wide">Date *</label>
                <input type="date" value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  className="w-full mt-1 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2 text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary uppercase tracking-wide">Name *</label>
                <input type="text" value={form.name} maxLength={200}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2 text-sm text-text-primary"
                  placeholder="e.g. Office rent, Google Ads, Salary — John" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary uppercase tracking-wide">Amount (USD) *</label>
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full mt-1 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2 text-sm text-text-primary font-mono"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary uppercase tracking-wide">Reason</label>
                <textarea value={form.reason} rows={2}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full mt-1 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2 text-sm text-text-primary"
                  placeholder="What the expense was for" />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary uppercase tracking-wide">Result</label>
                <textarea value={form.result} rows={2}
                  onChange={(e) => setForm({ ...form, result: e.target.value })}
                  className="w-full mt-1 rounded-md bg-bg-tertiary border border-border-primary px-3 py-2 text-sm text-text-primary"
                  placeholder="Outcome / status (e.g. paid, pending, delivered)" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setOpen(false)} className="text-xs px-3 py-2 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="text-xs px-3 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1">
                  {saving && <Loader2 size={12} className="animate-spin" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
