'use client';

/**
 * RM Portal — the Relationship Manager's own workspace.
 *
 * Shows only the users assigned to this RM (server scopes by assigned_rm_id),
 * lets them raise a funding request with a proof file for one of those users,
 * and lists their own past requests with status. The two-admin approve →
 * credit flow happens on the admin side (/rm-requests).
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Upload, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface RMUser { id: string; name: string; email: string | null; phone: string | null; main_wallet_balance: number; kyc_status: string | null; }
interface RMRequest { id: string; user_name: string; amount: number; method: string | null; status: string; rejection_reason: string | null; created_at: string | null; }

const fmt = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-accent/15 text-accent',
  credited: 'bg-success/15 text-success',
  rejected: 'bg-sell/15 text-sell',
};

export default function RMPortalPage() {
  const [users, setUsers] = useState<RMUser[]>([]);
  const [requests, setRequests] = useState<RMRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        adminApi.get<{ users: RMUser[] }>('/rm/my-users'),
        adminApi.get<{ requests: RMRequest[] }>('/rm/my-requests'),
      ]);
      setUsers(u.users || []);
      setRequests(r.requests || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return toast.error('Select a client');
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Enter a valid amount');
    if (!file) return toast.error('Attach a proof file');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('amount', String(amt));
      fd.append('method', method);
      if (note.trim()) fd.append('note', note.trim());
      fd.append('file', file);
      await adminApi.postForm('/rm/requests', fd);
      toast.success('Funding request submitted for admin review');
      setUserId(''); setAmount(''); setNote(''); setFile(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-text-tertiary" size={22} /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">My Clients</h1>
        <p className="text-xxs text-text-tertiary mt-0.5">Raise a funding request with proof — an admin team verifies and releases the money.</p>
      </div>

      {/* New funding request */}
      <form onSubmit={submit} className="bg-bg-secondary border border-border-primary rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5"><Upload size={15} /> New funding request</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xxs text-text-tertiary">Client</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}
              className="mt-1 w-full text-sm py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary">
              <option value="">Select a client…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xxs text-text-tertiary">Amount (USD)</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full text-sm py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary" placeholder="0.00" />
          </label>
          <label className="block">
            <span className="text-xxs text-text-tertiary">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full text-sm py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary">
              <option value="bank">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="crypto">Crypto</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xxs text-text-tertiary">Proof file (JPG/PNG/PDF, max 10 MB)</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-bg-hover file:text-text-primary" />
          </label>
        </div>
        <label className="block">
          <span className="text-xxs text-text-tertiary">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full text-sm py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary" placeholder="Reference / remarks" />
        </label>
        <button type="submit" disabled={submitting}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-accent text-white rounded-md px-4 py-2 disabled:opacity-60">
          {submitting && <Loader2 size={14} className="animate-spin" />} Submit request
        </button>
      </form>

      {/* My requests */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
        <h2 className="text-sm font-bold text-text-primary mb-3">My requests</h2>
        {requests.length === 0 ? <p className="text-xs text-text-tertiary">No requests yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-text-tertiary text-left uppercase tracking-wide">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Client</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Method</th><th className="py-2 pr-3">Status</th>
              </tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border-primary/50">
                    <td className="py-2 pr-3 text-text-secondary whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3 text-text-primary">{r.user_name}</td>
                    <td className="py-2 pr-3 font-mono text-text-primary">{fmt(r.amount)}</td>
                    <td className="py-2 pr-3 capitalize text-text-secondary">{r.method || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[r.status] || 'bg-bg-tertiary text-text-tertiary'}`}>{r.status}</span>
                      {r.status === 'rejected' && r.rejection_reason && <span className="block text-[10px] text-text-tertiary mt-0.5">{r.rejection_reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assigned clients */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
        <h2 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-1.5"><Users size={15} /> Assigned clients ({users.length})</h2>
        {users.length === 0 ? <p className="text-xs text-text-tertiary">No clients assigned to you yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-text-tertiary text-left uppercase tracking-wide">
                <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Phone</th><th className="py-2 pr-3">Wallet</th><th className="py-2 pr-3">KYC</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border-primary/50">
                    <td className="py-2 pr-3 text-text-primary">{u.name}</td>
                    <td className="py-2 pr-3 text-text-secondary">{u.email || '—'}</td>
                    <td className="py-2 pr-3 text-text-secondary">{u.phone || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-text-primary">{fmt(u.main_wallet_balance)}</td>
                    <td className="py-2 pr-3 capitalize text-text-secondary">{u.kyc_status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
